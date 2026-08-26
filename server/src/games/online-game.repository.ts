import { PrismaClient } from '@prisma/client';
import { GameEventRecord } from '../protocol/protocol';
import { calculateFinalResults, GameState } from '../game-engine';

export interface OnlineGameResult {
  readonly userId: string;
  readonly position: number;
  readonly score: number;
}

export interface OnlineGameRecord {
  readonly gameId: string;
  readonly roomId: string;
  readonly mode: 'private' | 'casual' | 'ranked';
  readonly rulesetId: string;
  readonly rulesetVersion: number;
  readonly players: readonly { userId: string; seat: number }[];
  readonly snapshot: GameState;
  readonly createdAt: string;
  readonly status: 'RUNNING' | 'FINISHED';
  readonly finishedAt?: string;
  readonly seasonId?: string;
  readonly results?: readonly OnlineGameResult[];
}

export interface OnlineGameRepository {
  create(record: OnlineGameRecord): void | Promise<void>;
  appendEvent(event: GameEventRecord): void | Promise<void>;
  checkpoint(gameId: string, state: GameState): void | Promise<void>;
  finish(
    gameId: string,
    state: GameState,
    finishedAt: string,
  ): void | Promise<void>;
  history(
    userId: string,
  ): readonly OnlineGameRecord[] | Promise<readonly OnlineGameRecord[]>;
}

export class InMemoryOnlineGameRepository implements OnlineGameRepository {
  private readonly games = new Map<string, OnlineGameRecord>();
  private readonly events: GameEventRecord[] = [];

  create(record: OnlineGameRecord): void {
    this.games.set(record.gameId, record);
  }

  appendEvent(event: GameEventRecord): void {
    this.events.push(event);
  }

  finish(gameId: string, state: GameState, finishedAt: string): void {
    const current = this.games.get(gameId);
    if (current) {
      this.games.set(gameId, {
        ...current,
        snapshot: state,
        status: 'FINISHED',
        finishedAt,
        results: calculateFinalResults(state).map((result) => ({
          userId: result.playerId,
          position: result.position,
          score: result.score,
        })),
      });
    }
  }

  checkpoint(gameId: string, state: GameState): void {
    const current = this.games.get(gameId);
    if (current) this.games.set(gameId, { ...current, snapshot: state });
  }

  history(userId: string): readonly OnlineGameRecord[] {
    return [...this.games.values()].filter(
      (game) =>
        game.status === 'FINISHED' &&
        game.players.some((player) => player.userId === userId),
    );
  }

  get eventLog(): readonly GameEventRecord[] {
    return this.events;
  }
}

/** PostgreSQL adapter boundary. Runtime selection is handled by AppModule. */
export class PrismaOnlineGameRepository implements OnlineGameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: OnlineGameRecord): Promise<void> {
    await this.prisma.game.create({
      data: {
        id: record.gameId,
        mode: record.mode,
        status: 'RUNNING',
        rulesetId: record.rulesetId,
        rulesetVersion: record.rulesetVersion,
        stateVersion: record.snapshot.stateVersion,
        snapshot: record.snapshot as object,
        roomId: record.roomId,
        seasonId: record.seasonId,
        players: {
          create: record.players.map((player) => ({
            userId: player.userId,
            seat: player.seat,
          })),
        },
      },
    });
  }

  async appendEvent(event: GameEventRecord): Promise<void> {
    await this.prisma.gameEvent.create({
      data: {
        gameId: event.gameId,
        type: event.event,
        version: event.stateVersion,
        payload: event as object,
      },
    });
  }

  async finish(
    gameId: string,
    state: GameState,
    finishedAt: string,
  ): Promise<void> {
    const results = calculateFinalResults(state);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.game.update({
        where: { id: gameId },
        data: {
          status: 'FINISHED',
          finishedAt: new Date(finishedAt),
          stateVersion: state.stateVersion,
          snapshot: state as object,
        },
      });
      for (const result of results) {
        await transaction.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: result.playerId } },
          data: { position: result.position, score: result.score },
        });
        await transaction.gameResult.upsert({
          where: { gameId_userId: { gameId, userId: result.playerId } },
          create: {
            gameId,
            userId: result.playerId,
            position: result.position,
            score: result.score,
          },
          update: { position: result.position, score: result.score },
        });
      }
    });
  }

  async checkpoint(gameId: string, state: GameState): Promise<void> {
    await this.prisma.game.update({
      where: { id: gameId },
      data: { stateVersion: state.stateVersion, snapshot: state as object },
    });
  }

  async history(userId: string): Promise<readonly OnlineGameRecord[]> {
    const games = await this.prisma.game.findMany({
      where: { players: { some: { userId } }, status: 'FINISHED' },
      include: { players: true, results: true },
      orderBy: { createdAt: 'desc' },
    });
    return games.map((game) => ({
      gameId: game.id,
      roomId: game.roomId ?? game.id,
      mode:
        game.mode === 'casual'
          ? 'casual'
          : game.mode === 'ranked'
            ? 'ranked'
            : 'private',
      rulesetId: game.rulesetId,
      rulesetVersion: game.rulesetVersion,
      players: game.players.map((player) => ({
        userId: player.userId,
        seat: player.seat,
      })),
      snapshot: game.snapshot as unknown as GameState,
      createdAt: game.createdAt.toISOString(),
      status: 'FINISHED',
      finishedAt: game.finishedAt?.toISOString(),
      seasonId: game.seasonId ?? undefined,
      results: game.results.map((result) => ({
        userId: result.userId,
        position: result.position,
        score: result.score,
      })),
    }));
  }
}
