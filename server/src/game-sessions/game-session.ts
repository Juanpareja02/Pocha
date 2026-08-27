import {
  buildPlayerView,
  GameRules,
  GameState,
  getLegalBids,
  getLegalCards,
  makeBid,
  chooseTrump,
  playCard,
  seededRandom,
  startNextRound,
  startRound,
  finishGame,
  RuleViolationError,
  Suit,
} from '../game-engine';
import {
  botView,
  createBotStrategy,
  BotDifficulty,
  BotStrategy,
} from '../bots';
import {
  ConnectionStatus,
  GameCommandPayload,
  GameEventName,
  GameEventRecord,
  GameSnapshot,
  PlayerConnectionView,
  TurnTimerView,
} from '../protocol/protocol';

export interface SessionPlayer {
  readonly userId: string;
  readonly displayName: string;
  readonly seat: number;
  readonly isBot: boolean;
  readonly botDifficulty?: BotDifficulty;
}

export interface SessionTimerConfig {
  readonly bidMs: number;
  readonly playCardMs: number;
  readonly chooseTrumpMs: number;
  readonly disconnectGraceMs: number;
  readonly roundResultMs: number;
}

export const DEFAULT_SESSION_TIMERS: Readonly<SessionTimerConfig> = {
  bidMs: 20_000,
  playCardMs: 20_000,
  chooseTrumpMs: 15_000,
  disconnectGraceMs: 60_000,
  roundResultMs: 250,
};

export interface SessionOptions {
  readonly gameId: string;
  readonly roomId: string;
  readonly players: readonly SessionPlayer[];
  readonly rules: GameRules;
  readonly seed?: number;
  readonly random?: () => number;
  readonly timers?: Partial<SessionTimerConfig>;
  readonly now?: () => number;
  readonly onUpdate?: (update: SessionUpdate) => void;
  readonly onFinished?: (result: GameFinishedResult) => void;
}

export interface SessionUpdate {
  readonly gameId: string;
  readonly roomId: string;
  readonly event: GameEventName;
  readonly stateVersion: number;
  readonly createdAt: string;
}

export interface GameFinishedResult {
  readonly gameId: string;
  readonly roomId: string;
  readonly state: GameState;
  readonly finishedAt: string;
  readonly predictionAccuracy: Readonly<Record<string, number>>;
  readonly abandonedPlayerIds: readonly string[];
  readonly disconnectedPlayerIds: readonly string[];
  readonly timedOutPlayerIds: readonly string[];
}

export type SessionCommand =
  | (GameCommandPayload & { readonly type: 'sync'; readonly playerId: string })
  | (GameCommandPayload & {
      readonly type: 'bid';
      readonly playerId: string;
      readonly bid: number;
    })
  | (GameCommandPayload & {
      readonly type: 'chooseTrump';
      readonly playerId: string;
      readonly suit: string;
    })
  | (GameCommandPayload & {
      readonly type: 'playCard';
      readonly playerId: string;
      readonly cardId: string;
    })
  | (GameCommandPayload & {
      readonly type: 'leave';
      readonly playerId: string;
    });

export interface SessionCommandResult {
  readonly snapshot: GameSnapshot;
  readonly duplicate: boolean;
}

export type SessionErrorCode =
  | 'NOT_IN_GAME'
  | 'NOT_YOUR_TURN'
  | 'INVALID_PHASE'
  | 'INVALID_CARD'
  | 'ILLEGAL_CARD'
  | 'INVALID_BID'
  | 'STALE_STATE'
  | 'INVALID_ACTION';

export class SessionError extends Error {
  constructor(
    readonly code: SessionErrorCode,
    message: string,
    readonly stateVersion?: number,
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

interface InternalPlayerStatus {
  status: ConnectionStatus;
  disconnectedAt: number | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
}

export class GameSession {
  private state: GameState;
  private readonly players: readonly SessionPlayer[];
  private readonly playerById: ReadonlyMap<string, SessionPlayer>;
  private readonly statuses = new Map<string, InternalPlayerStatus>();
  private readonly strategies = new Map<string, BotStrategy>();
  private readonly processedActionIds = new Map<string, Set<string>>();
  private readonly predictionAttempts = new Map<string, number>();
  private readonly predictionHits = new Map<string, number>();
  private readonly explicitlyAbandonedPlayers = new Set<string>();
  private readonly abandonedPlayers = new Set<string>();
  private readonly disconnectedPlayers = new Set<string>();
  private readonly timedOutPlayers = new Set<string>();
  private readonly events: GameEventRecord[] = [];
  private readonly random: () => number;
  private readonly timers: SessionTimerConfig;
  private readonly now: () => number;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private turnDeadlineAt: number | null = null;
  private isStarted = false;
  private isFinished = false;

  constructor(private readonly options: SessionOptions) {
    this.players = [...options.players].sort(
      (left, right) => left.seat - right.seat,
    );
    this.playerById = new Map(
      this.players.map((player) => [player.userId, player]),
    );
    this.state = {
      ...this.createLobbyState(),
      players: this.players.map((player) => ({
        id: player.userId,
        name: player.displayName,
        seat: player.seat,
        hand: [],
        cardsRemaining: 0,
        bid: null,
        tricksWon: 0,
        score: 0,
      })),
    };
    this.random = options.random ?? seededRandom(options.seed ?? Date.now());
    this.timers = {
      bidMs: options.timers?.bidMs ?? DEFAULT_SESSION_TIMERS.bidMs,
      playCardMs:
        options.timers?.playCardMs ?? DEFAULT_SESSION_TIMERS.playCardMs,
      chooseTrumpMs:
        options.timers?.chooseTrumpMs ?? DEFAULT_SESSION_TIMERS.chooseTrumpMs,
      disconnectGraceMs:
        options.timers?.disconnectGraceMs ??
        DEFAULT_SESSION_TIMERS.disconnectGraceMs,
      roundResultMs:
        options.timers?.roundResultMs ?? DEFAULT_SESSION_TIMERS.roundResultMs,
    };
    this.now = options.now ?? Date.now;
    for (const player of this.players) {
      this.statuses.set(player.userId, {
        status: player.isBot ? 'BOT_CONTROLLED' : 'CONNECTED',
        disconnectedAt: null,
        graceTimer: null,
      });
      this.processedActionIds.set(player.userId, new Set());
      this.predictionAttempts.set(player.userId, 0);
      this.predictionHits.set(player.userId, 0);
      if (player.isBot) {
        this.strategies.set(
          player.userId,
          createBotStrategy(
            player.botDifficulty ?? 'normal',
            player.seat + 101,
          ),
        );
      }
    }
  }

  get gameId(): string {
    return this.options.gameId;
  }

  get roomId(): string {
    return this.options.roomId;
  }

  get currentState(): GameState {
    return this.state;
  }

  get eventLog(): readonly GameEventRecord[] {
    return this.events;
  }

  start(): void {
    if (this.isStarted) throw new Error('Game session has already started');
    this.isStarted = true;
    this.state = startRound(this.state, this.random);
    this.publish('GAME_STARTED');
    this.publish('ROUND_STARTED');
    this.scheduleTurnTimer();
    this.runBotTurns();
  }

  snapshot(playerId: string): GameSnapshot {
    this.requirePlayer(playerId);
    const player = this.players.find(
      (candidate) => candidate.userId === playerId,
    )!;
    return {
      protocolVersion: 1,
      gameId: this.gameId,
      roomId: this.roomId,
      stateVersion: this.state.stateVersion,
      state: buildPlayerView(this.state, playerId),
      myPlayerId: playerId,
      mySeat: player.seat,
      players: this.players.map((candidate): PlayerConnectionView => ({
        userId: candidate.userId,
        status: this.statuses.get(candidate.userId)!.status,
      })),
      timer: this.isTurnTimerActive() ? this.timerView() : null,
      connectionStatus: this.statuses.get(playerId)!.status,
    };
  }

  allSnapshots(): readonly GameSnapshot[] {
    return this.players
      .filter((player) => !player.isBot)
      .map((player) => this.snapshot(player.userId));
  }

  dispatch(command: SessionCommand): SessionCommandResult {
    this.requirePlayer(command.playerId);
    if (command.type === 'sync') {
      return { snapshot: this.snapshot(command.playerId), duplicate: false };
    }
    this.validateActionId(command.actionId);
    const ids = this.processedActionIds.get(command.playerId)!;
    if (ids.has(command.actionId)) {
      return { snapshot: this.snapshot(command.playerId), duplicate: true };
    }
    // Leaving is an idempotent intent and does not depend on the snapshot
    // contents. Accept it even when another player advanced the game between
    // the client's sync and the leave command; stale protection remains in
    // force for state-dependent actions.
    if (
      command.type !== 'leave' &&
      command.expectedStateVersion !== this.state.stateVersion
    ) {
      throw new SessionError(
        'STALE_STATE',
        'The client state is out of date',
        this.state.stateVersion,
      );
    }
    try {
      const event = this.applyCommand(command);
      ids.add(command.actionId);
      this.publish(event, command.playerId);
      this.scheduleTurnTimer();
      this.runBotTurns();
      return { snapshot: this.snapshot(command.playerId), duplicate: false };
    } catch (error) {
      throw this.toSessionError(error);
    }
  }

  disconnect(playerId: string): void {
    const player = this.requirePlayer(playerId);
    if (player.isBot || this.isFinished) return;
    const status = this.statuses.get(playerId)!;
    this.disconnectedPlayers.add(playerId);
    status.status = 'DISCONNECTED';
    status.disconnectedAt = this.now();
    if (status.graceTimer) clearTimeout(status.graceTimer);
    status.graceTimer = setTimeout(() => {
      const current = this.statuses.get(playerId);
      if (!current || current.status !== 'DISCONNECTED') return;
      current.status = 'BOT_CONTROLLED';
      current.graceTimer = null;
      this.abandonedPlayers.add(playerId);
      this.publish('PLAYER_DISCONNECTED', playerId);
      this.runBotTurns();
    }, this.timers.disconnectGraceMs);
    this.publish('PLAYER_DISCONNECTED', playerId);
  }

  reconnect(playerId: string): GameSnapshot {
    this.requirePlayer(playerId);
    const status = this.statuses.get(playerId)!;
    if (status.graceTimer) clearTimeout(status.graceTimer);
    status.graceTimer = null;
    status.status = 'CONNECTED';
    status.disconnectedAt = null;
    if (!this.explicitlyAbandonedPlayers.has(playerId))
      this.abandonedPlayers.delete(playerId);
    this.publish('PLAYER_RECONNECTED', playerId);
    return this.snapshot(playerId);
  }

  leave(playerId: string): GameSnapshot {
    this.requirePlayer(playerId);
    const status = this.statuses.get(playerId)!;
    this.explicitlyAbandonedPlayers.add(playerId);
    this.abandonedPlayers.add(playerId);
    status.status = 'BOT_CONTROLLED';
    status.disconnectedAt = this.now();
    this.publish('PLAYER_ABANDONED', playerId);
    this.runBotTurns();
    return this.snapshot(playerId);
  }

  dispose(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    for (const status of this.statuses.values()) {
      if (status.graceTimer) clearTimeout(status.graceTimer);
    }
    this.turnTimer = null;
  }

  private applyCommand(
    command: Exclude<SessionCommand, { type: 'sync' }>,
  ): GameEventName {
    if (command.type === 'leave') {
      this.leave(command.playerId);
      return 'PLAYER_ABANDONED';
    }
    if (command.type === 'bid') {
      this.assertCurrentTurn(command.playerId, 'BIDDING');
      if (!getLegalBids(this.state).includes(command.bid)) {
        throw new SessionError('INVALID_BID', 'The bid is not legal');
      }
      this.state = makeBid(
        this.state,
        command.playerId,
        command.bid,
        command.expectedStateVersion,
      );
      return 'BID_MADE';
    }
    if (command.type === 'chooseTrump') {
      this.assertCurrentTurn(command.playerId, 'CHOOSE_TRUMP');
      const suit = command.suit === 'none' ? null : (command.suit as Suit);
      this.state = chooseTrump(
        this.state,
        command.playerId,
        suit,
        command.expectedStateVersion,
      );
      return 'TRUMP_SELECTED';
    }
    this.assertCurrentTurn(command.playerId, 'PLAYING_TRICK');
    const player = this.state.players.find(
      (candidate) => candidate.id === command.playerId,
    )!;
    if (!player.hand.some((card) => card.id === command.cardId)) {
      throw new SessionError(
        'INVALID_CARD',
        'The player does not own this card',
      );
    }
    if (
      !getLegalCards(this.state, command.playerId).some(
        (card) => card.id === command.cardId,
      )
    ) {
      throw new SessionError(
        'ILLEGAL_CARD',
        'The card does not follow the rules',
      );
    }
    const previousTricks = this.state.tricksCompleted;
    this.state = playCard(
      this.state,
      command.playerId,
      command.cardId,
      command.expectedStateVersion,
    );
    if (this.state.tricksCompleted > previousTricks) {
      this.publish('TRICK_FINISHED', command.playerId);
    }
    if (this.state.status === 'ROUND_RESULTS') {
      this.recordRoundPredictions();
      this.publish('ROUND_FINISHED');
      this.scheduleRoundAdvance();
    }
    return 'CARD_PLAYED';
  }

  private runBotTurns(): void {
    if (!this.isStarted || this.isFinished) return;
    let guard = 0;
    while (guard < 300) {
      guard += 1;
      if (
        this.state.status === 'ROUND_RESULTS' ||
        this.state.status === 'GAME_RESULTS'
      ) {
        return;
      }
      const player = this.players[this.state.currentPlayerIndex];
      const status = this.statuses.get(player.userId)!;
      if (!player.isBot && status.status !== 'BOT_CONTROLLED') return;
      const strategy =
        this.strategies.get(player.userId) ??
        createBotStrategy('normal', player.seat + 701);
      this.strategies.set(player.userId, strategy);
      const view = botView(this.state, player.userId);
      const actionId = `bot:${this.state.stateVersion}:${player.userId}`;
      if (this.state.status === 'BIDDING') {
        this.dispatch({
          type: 'bid',
          gameId: this.gameId,
          playerId: player.userId,
          bid: strategy.chooseBid(view),
          expectedStateVersion: this.state.stateVersion,
          actionId,
        });
      } else if (this.state.status === 'CHOOSE_TRUMP') {
        this.dispatch({
          type: 'chooseTrump',
          gameId: this.gameId,
          playerId: player.userId,
          suit: strategy.chooseTrump(view) ?? 'none',
          expectedStateVersion: this.state.stateVersion,
          actionId,
        });
      } else if (this.state.status === 'PLAYING_TRICK') {
        this.dispatch({
          type: 'playCard',
          gameId: this.gameId,
          playerId: player.userId,
          cardId: strategy.chooseCard(view),
          expectedStateVersion: this.state.stateVersion,
          actionId,
        });
      } else {
        return;
      }
    }
    throw new Error('Bot turn guard exceeded');
  }

  private scheduleTurnTimer(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnDeadlineAt = null;
    if (this.isFinished || !this.isStarted) return;
    if (
      !['BIDDING', 'CHOOSE_TRUMP', 'PLAYING_TRICK'].includes(this.state.status)
    )
      return;
    const action =
      this.state.status === 'BIDDING'
        ? 'BID'
        : this.state.status === 'CHOOSE_TRUMP'
          ? 'CHOOSE_TRUMP'
          : 'PLAY_CARD';
    const duration =
      action === 'BID'
        ? this.timers.bidMs
        : action === 'CHOOSE_TRUMP'
          ? this.timers.chooseTrumpMs
          : this.timers.playCardMs;
    this.turnDeadlineAt = this.now() + duration;
    this.turnTimer = setTimeout(() => this.handleTurnTimeout(), duration);
  }

  private handleTurnTimeout(): void {
    if (
      this.isFinished ||
      this.state.status === 'ROUND_RESULTS' ||
      this.state.status === 'GAME_RESULTS'
    )
      return;
    const player = this.players[this.state.currentPlayerIndex];
    if (!player.isBot) this.timedOutPlayers.add(player.userId);
    const strategy =
      this.strategies.get(player.userId) ??
      createBotStrategy('normal', player.seat + 1701);
    this.strategies.set(player.userId, strategy);
    const view = botView(this.state, player.userId);
    const actionId = `timeout:${this.state.stateVersion}:${player.userId}`;
    this.publish('TURN_TIMED_OUT', player.userId);
    if (this.state.status === 'BIDDING') {
      this.dispatch({
        gameId: this.gameId,
        type: 'bid',
        playerId: player.userId,
        bid: strategy.chooseBid(view),
        expectedStateVersion: this.state.stateVersion,
        actionId,
      });
    } else if (this.state.status === 'CHOOSE_TRUMP') {
      this.dispatch({
        gameId: this.gameId,
        type: 'chooseTrump',
        playerId: player.userId,
        suit: strategy.chooseTrump(view) ?? 'none',
        expectedStateVersion: this.state.stateVersion,
        actionId,
      });
    } else {
      this.dispatch({
        gameId: this.gameId,
        type: 'playCard',
        playerId: player.userId,
        cardId: strategy.chooseCard(view),
        expectedStateVersion: this.state.stateVersion,
        actionId,
      });
    }
  }

  private scheduleRoundAdvance(): void {
    setTimeout(() => {
      if (this.isFinished || this.state.status !== 'ROUND_RESULTS') return;
      this.state = startNextRound(this.state, this.random);
      if (this.state.status === 'GAME_RESULTS') {
        this.state = finishGame(this.state);
        this.isFinished = true;
        this.publish('GAME_FINISHED');
        this.options.onFinished?.({
          gameId: this.gameId,
          roomId: this.roomId,
          state: this.state,
          finishedAt: new Date().toISOString(),
          predictionAccuracy: Object.fromEntries(
            this.players.map((player) => {
              const attempts = this.predictionAttempts.get(player.userId) ?? 0;
              const hits = this.predictionHits.get(player.userId) ?? 0;
              return [player.userId, attempts === 0 ? 0 : hits / attempts];
            }),
          ),
          abandonedPlayerIds: [...this.abandonedPlayers],
          disconnectedPlayerIds: [...this.disconnectedPlayers],
          timedOutPlayerIds: [...this.timedOutPlayers],
        });
        return;
      }
      this.publish('ROUND_STARTED');
      this.scheduleTurnTimer();
      this.runBotTurns();
    }, this.timers.roundResultMs);
  }

  private assertCurrentTurn(
    playerId: string,
    status: GameState['status'],
  ): void {
    this.requirePlayer(playerId);
    if (this.state.status !== status)
      throw new SessionError(
        'INVALID_PHASE',
        `Action is not valid in ${this.state.status}`,
      );
    const current = this.state.players[this.state.currentPlayerIndex];
    if (current.id !== playerId)
      throw new SessionError('NOT_YOUR_TURN', 'It is not your turn');
  }

  private requirePlayer(playerId: string): SessionPlayer {
    const player = this.playerById.get(playerId);
    if (!player)
      throw new SessionError('NOT_IN_GAME', 'Player is not in this game');
    return player;
  }

  private validateActionId(actionId: string): void {
    if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(actionId)) {
      throw new SessionError('INVALID_ACTION', 'Action id is invalid');
    }
  }

  private toSessionError(error: unknown): SessionError {
    if (error instanceof SessionError) return error;
    const message =
      error instanceof Error ? error.message : 'Invalid game action';
    if (message.includes('not this player'))
      return new SessionError('NOT_YOUR_TURN', message);
    if (message.includes('Stale state'))
      return new SessionError('STALE_STATE', message, this.state.stateVersion);
    if (message.includes('does not hold'))
      return new SessionError('INVALID_CARD', message);
    if (message.includes('follow'))
      return new SessionError('ILLEGAL_CARD', message);
    if (message.includes('bid'))
      return new SessionError('INVALID_BID', message);
    if (error instanceof RuleViolationError)
      return new SessionError('INVALID_PHASE', message);
    return new SessionError('INVALID_ACTION', message);
  }

  private timerView(): TurnTimerView {
    const action =
      this.state.status === 'BIDDING'
        ? 'BID'
        : this.state.status === 'CHOOSE_TRUMP'
          ? 'CHOOSE_TRUMP'
          : 'PLAY_CARD';
    return { action, deadlineAt: new Date(this.turnDeadlineAt!).toISOString() };
  }

  private isTurnTimerActive(): boolean {
    return (
      this.turnDeadlineAt !== null &&
      ['BIDDING', 'CHOOSE_TRUMP', 'PLAYING_TRICK'].includes(this.state.status)
    );
  }

  private publish(event: GameEventName, userId?: string): void {
    const record: GameEventRecord = {
      gameId: this.gameId,
      roomId: this.roomId,
      userId,
      event,
      stateVersion: this.state.stateVersion,
      createdAt: new Date().toISOString(),
    };
    this.events.push(record);
    this.options.onUpdate?.(record);
  }

  private createLobbyState(): GameState {
    return {
      gameId: this.gameId,
      rulesetId: this.options.rules.id,
      rulesetVersion: this.options.rules.version,
      rules: this.options.rules,
      status: 'LOBBY',
      stateVersion: 0,
      players: [],
      roundIndex: -1,
      cardsPerRound: 0,
      dealerIndex: 0,
      currentPlayerIndex: 0,
      trumpSuit: null,
      leadSuit: null,
      currentTrick: [],
      playedCards: [],
      tricksCompleted: 0,
      lastRoundScores: {},
    };
  }

  private recordRoundPredictions(): void {
    for (const player of this.state.players) {
      if (player.bid === null) continue;
      this.predictionAttempts.set(
        player.id,
        (this.predictionAttempts.get(player.id) ?? 0) + 1,
      );
      if (player.bid === player.tricksWon) {
        this.predictionHits.set(
          player.id,
          (this.predictionHits.get(player.id) ?? 0) + 1,
        );
      }
    }
  }
}
