import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { auctionRules, classicRules, GameRules } from '../game-engine';
import { RoomRecord, SessionLookupRepository } from '../realtime/repositories';
import {
  ONLINE_GAME_REPOSITORY,
  PRESENCE_REPOSITORY,
  SESSION_LOOKUP,
} from '../realtime/tokens';
import { PresenceRepository } from '../realtime/repositories';
import { GameCommandPayload, GameSnapshot } from '../protocol/protocol';
import {
  GameFinishedResult,
  GameSession,
  SessionCommand,
  SessionOptions,
  SessionPlayer,
  SessionUpdate,
  SessionError,
} from './game-session';
import {
  InMemoryOnlineGameRepository,
  OnlineGameRecord,
  OnlineGameRepository,
} from '../games/online-game.repository';
import { RoomService } from '../rooms/room.service';
import { UserService } from '../users/user.service';
import { calculateFinalResults } from '../game-engine';
import { RankedResultService } from '../ranked/ranked-result.service';
import { rankedRules } from '../ranked/ranked.rules';
import { RANKED_RULESET_ID } from '../ranked/ranked.types';
import { AnalyticsService, NoopAnalytics } from '../analytics/analytics';

export interface SessionCreated {
  readonly session: GameSession;
  readonly gameId: string;
}

@Injectable()
export class GameSessionManager implements OnModuleInit, OnModuleDestroy {
  private readonly sessions = new Map<string, GameSession>();
  private readonly gameByRoom = new Map<string, string>();
  private readonly listeners = new Set<(update: SessionUpdate) => void>();

  constructor(
    @Inject(ONLINE_GAME_REPOSITORY)
    private readonly games: OnlineGameRepository = new InMemoryOnlineGameRepository(),
    @Inject(PRESENCE_REPOSITORY)
    private readonly presence: PresenceRepository,
    @Inject(SESSION_LOOKUP)
    private readonly sessionLookup: SessionLookupRepository,
    @Inject(RoomService)
    private readonly rooms: RoomService,
    @Inject(UserService)
    private readonly users: UserService,
    @Inject(RankedResultService)
    private readonly rankedResults: RankedResultService,
    @Inject(AnalyticsService)
    private readonly analytics: AnalyticsService = new AnalyticsService(
      new NoopAnalytics(),
    ),
  ) {}

  async onModuleInit(): Promise<void> {
    await this.sessionLookup.initialize?.();
  }

  onModuleDestroy(): void {
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
    this.gameByRoom.clear();
    this.listeners.clear();
  }

  subscribe(listener: (update: SessionUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async create(room: RoomRecord): Promise<SessionCreated> {
    if (this.gameByRoom.has(room.roomId))
      throw new ConflictException('Game already exists');
    for (const player of room.players) {
      if (!player.isBot && this.presence.hasActiveGame(player.userId)) {
        throw new ConflictException('A player already has an active game');
      }
    }
    const gameId = `game_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const rules = this.rulesFor(room.config.rulesetId, room.config.playerCount);
    const players: SessionPlayer[] = room.players.map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      seat: player.seat,
      isBot: player.isBot,
      botDifficulty: player.botDifficulty,
    }));
    const options: SessionOptions = {
      gameId,
      roomId: room.roomId,
      players,
      rules,
      random: () => randomInt(0, 1_000_000) / 1_000_000,
      timers: {
        bidMs: this.envNumber('ONLINE_BID_TIMEOUT_MS'),
        playCardMs: this.envNumber('ONLINE_PLAY_TIMEOUT_MS'),
        chooseTrumpMs: this.envNumber('ONLINE_TRUMP_TIMEOUT_MS'),
        disconnectGraceMs: this.envNumber('ONLINE_DISCONNECT_GRACE_MS'),
        roundResultMs: this.envNumber('ONLINE_ROUND_RESULT_MS'),
      },
      onUpdate: (update) => this.handleUpdate(update),
      onFinished: (result) => {
        void this.handleFinished(result, room);
      },
    };
    const session = new GameSession(options);
    this.sessions.set(gameId, session);
    this.gameByRoom.set(room.roomId, gameId);
    const record: OnlineGameRecord = {
      gameId,
      roomId: room.roomId,
      mode: room.mode ?? 'private',
      rulesetId: rules.id,
      rulesetVersion: rules.version,
      players: players.map((player) => ({
        userId: player.userId,
        seat: player.seat,
      })),
      snapshot: session.currentState,
      createdAt: new Date().toISOString(),
      status: 'RUNNING',
      seasonId: room.seasonId,
    };
    await this.sessionLookup.save({
      gameId,
      roomId: room.roomId,
      status: 'RUNNING',
      mode: room.mode ?? 'private',
      rulesetId: rules.id,
      rulesetVersion: rules.version,
      playerIds: players.map((player) => player.userId),
      seasonId: room.seasonId,
      updatedAt: record.createdAt,
    });
    await this.users.flush();
    await this.games.create(record);
    return { session, gameId };
  }

  get(gameId: string): GameSession {
    const session = this.sessions.get(gameId);
    if (!session) throw new NotFoundException('Game session not found');
    return session;
  }

  byRoom(roomId: string): GameSession | undefined {
    const gameId = this.gameByRoom.get(roomId);
    return gameId ? this.sessions.get(gameId) : undefined;
  }

  snapshot(gameId: string, userId: string): GameSnapshot {
    return this.get(gameId).snapshot(userId);
  }

  dispatch(
    gameId: string,
    userId: string,
    payload: GameCommandPayload & {
      type: SessionCommand['type'];
      bid?: number;
      suit?: string;
      cardId?: string;
    },
  ) {
    const command = this.toCommand(userId, payload);
    return this.get(gameId).dispatch(command);
  }

  disconnect(gameId: string, userId: string): void {
    this.get(gameId).disconnect(userId);
  }

  reconnect(gameId: string, userId: string): GameSnapshot {
    return this.get(gameId).reconnect(userId);
  }

  leave(gameId: string, userId: string): GameSnapshot {
    return this.get(gameId).leave(userId);
  }

  dispose(gameId: string): void {
    const session = this.sessions.get(gameId);
    if (!session) return;
    session.dispose();
    this.sessions.delete(gameId);
    this.gameByRoom.delete(session.roomId);
  }

  private toCommand(
    userId: string,
    payload: GameCommandPayload & {
      type: SessionCommand['type'];
      bid?: number;
      suit?: string;
      cardId?: string;
    },
  ): SessionCommand {
    const common = {
      gameId: payload.gameId,
      playerId: userId,
      expectedStateVersion: payload.expectedStateVersion,
      actionId: payload.actionId,
    };
    if (payload.type === 'sync')
      return {
        ...common,
        type: 'sync',
        gameId: payload.gameId,
      } as SessionCommand;
    if (payload.type === 'bid' && payload.bid !== undefined)
      return { ...common, type: 'bid', bid: payload.bid };
    if (payload.type === 'chooseTrump' && payload.suit !== undefined)
      return { ...common, type: 'chooseTrump', suit: payload.suit };
    if (payload.type === 'playCard' && payload.cardId !== undefined)
      return { ...common, type: 'playCard', cardId: payload.cardId };
    if (payload.type === 'leave') return { ...common, type: 'leave' };
    throw new SessionError('INVALID_ACTION', 'Command payload is invalid');
  }

  private rulesFor(rulesetId: string, playerCount: number): GameRules {
    if (rulesetId === 'classic') return classicRules(playerCount);
    if (rulesetId === 'auction') return auctionRules(playerCount);
    if (rulesetId === RANKED_RULESET_ID) return rankedRules();
    throw new ConflictException('Unsupported ruleset');
  }

  private envNumber(name: string): number | undefined {
    const value = process.env[name];
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private handleUpdate(update: SessionUpdate): void {
    const session = this.sessions.get(update.gameId);
    if (session)
      void this.games.checkpoint(update.gameId, session.currentState);
    void this.games.appendEvent({
      ...update,
      event: update.event,
    });
    for (const listener of this.listeners) listener(update);
  }

  private async handleFinished(
    result: GameFinishedResult,
    room: RoomRecord,
  ): Promise<void> {
    try {
      await this.games.finish(result.gameId, result.state, result.finishedAt);
      this.rooms.markFinished(room.roomId);
      await this.sessionLookup.save({
        gameId: result.gameId,
        roomId: room.roomId,
        status: 'FINISHED',
        mode: room.mode ?? 'private',
        rulesetId: result.state.rulesetId,
        rulesetVersion: result.state.rulesetVersion,
        playerIds: result.state.players.map((player) => player.id),
        seasonId: room.seasonId,
        updatedAt: result.finishedAt,
      });
      if (room.mode === 'ranked') {
        await this.rankedResults.finalize(result, room);
        return;
      }
      const finalResults = calculateFinalResults(result.state);
      for (const player of room.players) {
        if (!player.isBot) {
          this.presence.clear(player.userId);
          const finalResult = finalResults.find(
            (candidate) => candidate.playerId === player.userId,
          );
          if (finalResult) {
            this.users.recordResult(player.userId, {
              position: finalResult.position,
              predictionAccuracy: result.predictionAccuracy[player.userId] ?? 0,
            });
            if (room.mode === 'casual')
              this.analytics.track('casual_game_finished', {
                userId: player.userId,
                gameId: result.gameId,
                properties: {
                  position: finalResult.position,
                  score: finalResult.score,
                },
              });
          }
        }
      }
    } finally {
      this.dispose(result.gameId);
    }
  }
}
