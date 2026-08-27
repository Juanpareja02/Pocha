import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  BadRequestException,
  ConflictException,
  Inject,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { AuthPrincipal, AuthService } from '../auth/auth.service';
import {
  AddBotPayload,
  CasualMatchPayload,
  CreateRoomPayload,
  GameErrorCode,
  GameErrorPayload,
  JoinRoomPayload,
  PROTOCOL_VERSION,
  isSupportedProtocolVersion,
  RankedMatchPayload,
  RoomView,
} from '../protocol/protocol';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { RoomService } from '../rooms/room.service';
import { GameSessionManager } from '../game-sessions/game-session.manager';
import { SessionError } from '../game-sessions/game-session';
import { RealtimeRateLimiter } from './rate-limiter';
import { RankedMatchmakingService } from '../ranked/ranked-matchmaking.service';
import { AnalyticsService, NoopAnalytics } from '../analytics/analytics';
import { MetricsService } from '../observability/metrics.service';

interface SocketData {
  principal?: AuthPrincipal;
  roomId?: string;
  gameId?: string;
}

type OnlineSocket = Socket & { data: SocketData };

@WebSocketGateway({
  namespace: '/online',
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      const appEnv = process.env.APP_ENV ?? 'development';
      if (appEnv === 'development' || !origin) return callback(null, true);
      const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      return callback(null, allowed.includes(origin));
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class OnlineGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  private server!: Server;
  private readonly invalidActionAttempts = new Map<string, number>();
  private readonly connectedSockets = new Set<string>();
  private activeGames = 0;

  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService,
    @Inject(RoomService)
    private readonly rooms: RoomService,
    @Inject(GameSessionManager)
    private readonly sessions: GameSessionManager,
    @Inject(RealtimeRateLimiter)
    private readonly rateLimiter: RealtimeRateLimiter,
    @Inject(MatchmakingService)
    private readonly matchmaking: MatchmakingService,
    @Inject(RankedMatchmakingService)
    private readonly rankedMatchmaking: RankedMatchmakingService,
    @Inject(AnalyticsService)
    private readonly analytics: AnalyticsService = new AnalyticsService(
      new NoopAnalytics(),
    ),
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(MetricsService)
    private readonly metrics: MetricsService,
  ) {
    this.sessions.subscribe((update) => {
      if (update.event === 'GAME_STARTED') {
        this.activeGames += 1;
        this.metrics.increment('games_started');
        this.metrics.setGauge('active_games', this.activeGames);
      } else if (update.event === 'GAME_FINISHED') {
        this.activeGames = Math.max(0, this.activeGames - 1);
        this.metrics.increment('games_completed');
        this.metrics.setGauge('active_games', this.activeGames);
        this.clearInvalidAttemptsForGame(update.gameId);
      }
      void this.broadcastGame(
        update.gameId,
        update.event,
        update.stateVersion,
      ).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'game_broadcast_failed',
            gameId: update.gameId,
            gameEvent: update.event,
            stateVersion: update.stateVersion,
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        );
      });
    });
  }

  async handleConnection(socket: OnlineSocket): Promise<void> {
    try {
      const auth = socket.handshake.auth as
        { token?: unknown; protocolVersion?: unknown } | undefined;
      if (
        !isSupportedProtocolVersion(
          auth?.protocolVersion,
          this.config.get<number>('MINIMUM_SUPPORTED_PROTOCOL_VERSION', 1),
          this.config.get<number>('LATEST_PROTOCOL_VERSION', PROTOCOL_VERSION),
        )
      ) {
        throw new ConflictException('Unsupported protocol version');
      }
      const remoteAddress = socket.handshake.address || 'unknown';
      if (!(await this.rateLimiter.allowAsync(`connection:${remoteAddress}`))) {
        throw new ConflictException('Rate limit exceeded');
      }
      const token = this.readToken(socket);
      const principal = await this.auth.verifyToken(token);
      socket.data.principal = principal;
      this.connectedSockets.add(socket.id);
      this.metrics.increment('connections_accepted');
      this.metrics.setGauge('active_connections', this.connectedSockets.size);
      socket.emit('session:authenticated', {
        protocolVersion: PROTOCOL_VERSION,
        userId: principal.userId,
      });
    } catch (error) {
      this.metrics.increment('errors');
      const protocolMismatch =
        error instanceof ConflictException &&
        error.message.includes('protocol version');
      const rateLimited =
        error instanceof ConflictException &&
        error.message.includes('Rate limit');
      socket.emit(
        'game:error',
        this.error(
          protocolMismatch
            ? 'PROTOCOL_UNSUPPORTED'
            : rateLimited
              ? 'RATE_LIMITED'
              : 'NOT_AUTHENTICATED',
          protocolMismatch
            ? 'Client protocol version is not supported'
            : rateLimited
              ? 'Too many connection attempts'
              : 'Authentication required',
        ),
      );
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: OnlineSocket): void {
    this.connectedSockets.delete(socket.id);
    this.metrics.setGauge('active_connections', this.connectedSockets.size);
    this.metrics.increment('disconnects');
    const principal = socket.data.principal;
    const roomId = socket.data.roomId;
    if (!principal) return;
    this.clearInvalidAttemptsForUser(principal.userId);
    if (!roomId) {
      void this.matchmaking.cancelByUser(principal.userId);
      void this.rankedMatchmaking.cancelByUser(principal.userId);
      return;
    }
    try {
      const room = this.rooms.view(roomId);
      if (room.status === 'STARTED' && room.gameId) {
        this.sessions.disconnect(room.gameId, principal.userId);
      }
      const updated = this.rooms.disconnect(roomId, principal.userId);
      void this.broadcastRoom(updated);
    } catch {
      // A closed room is already cleaned up; disconnect must be idempotent.
    }
  }

  onModuleDestroy(): void {
    for (const socket of this.localSockets()) socket.disconnect(true);
    this.invalidActionAttempts.clear();
    this.connectedSockets.clear();
    this.activeGames = 0;
  }

  @SubscribeMessage('room:create')
  createRoom(
    @MessageBody() payload: CreateRoomPayload,
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAuth(socket, 'room:create', () => {
      const room = this.rooms.create(
        socket.data.principal!,
        this.assertRoomPayload(payload),
      );
      socket.data.roomId = room.roomId;
      socket.join(room.roomId);
      socket.emit('room:created', this.publicRoom(room));
      void this.broadcastRoom(room);
    });
  }

  @SubscribeMessage('room:join')
  joinRoom(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAuth(socket, 'room:join', () => {
      if (
        typeof payload?.code !== 'string' ||
        payload.code.trim().length !== 6
      ) {
        throw new ConflictException('Room code is invalid');
      }
      const room = this.rooms.join(socket.data.principal!, payload.code);
      socket.data.roomId = room.roomId;
      socket.data.gameId = room.gameId;
      socket.join(room.roomId);
      socket.emit('room:joined', this.publicRoom(room));
      void this.broadcastRoom(room);
      if (room.gameId) {
        const snapshot = this.sessions.reconnect(
          room.gameId,
          socket.data.principal!.userId,
        );
        this.metrics.increment('reconnects');
        socket.data.gameId = room.gameId;
        socket.emit('game:started', snapshot);
        socket.emit('game:snapshot', snapshot);
      }
    });
  }

  @SubscribeMessage('room:ready')
  ready(
    @MessageBody() payload: { roomId?: string },
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAuth(socket, 'room:ready', () => {
      const room = this.requireSocketRoom(socket, payload?.roomId);
      const updated = this.rooms.ready(socket.data.principal!, room.roomId);
      void this.broadcastRoom(updated);
    });
  }

  @SubscribeMessage('room:leave')
  leaveRoom(@ConnectedSocket() socket: OnlineSocket): void {
    void this.withAuth(socket, 'room:leave', () => {
      const roomId = socket.data.roomId;
      if (!roomId) throw new NotFoundException('Room not found');
      const updated = this.rooms.leave(socket.data.principal!, roomId);
      socket.leave(roomId);
      socket.data.roomId = undefined;
      socket.data.gameId = undefined;
      socket.emit('room:left', { roomId });
      if (updated) void this.broadcastRoom(updated);
    });
  }

  @SubscribeMessage('room:addBot')
  addBot(
    @MessageBody() payload: AddBotPayload,
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAuth(socket, 'room:addBot', () => {
      const room = this.requireSocketRoom(socket);
      const updated = this.rooms.addBot(
        socket.data.principal!,
        room.roomId,
        payload ?? {},
      );
      void this.broadcastRoom(updated);
    });
  }

  @SubscribeMessage('room:removeBot')
  removeBot(
    @MessageBody() payload: { userId: string },
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAuth(socket, 'room:removeBot', () => {
      const room = this.requireSocketRoom(socket);
      const updated = this.rooms.removeBot(
        socket.data.principal!,
        room.roomId,
        payload.userId,
      );
      void this.broadcastRoom(updated);
    });
  }

  @SubscribeMessage('room:start')
  startRoom(
    @MessageBody() payload: { roomId?: string },
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAsyncAuth(socket, 'room:start', async () => {
      const room = this.rooms.start(
        socket.data.principal!,
        this.requireSocketRoom(socket, payload?.roomId).roomId,
      );
      const created = await this.sessions.create(room);
      const started = this.rooms.markStarted(room.roomId, created.gameId);
      socket.data.gameId = created.gameId;
      await this.attachGameToRoomSockets(room.roomId, created.gameId);
      created.session.start();
      void this.broadcastRoom(started);
    });
  }

  @SubscribeMessage('matchmaking:join')
  joinMatchmaking(
    @MessageBody() payload: CasualMatchPayload,
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAsyncAuth(socket, 'matchmaking:join', async () => {
      const result = await this.matchmaking.join(
        socket.data.principal!,
        payload,
      );
      if (result.room) {
        void this.startMatchedRoom(result.room);
      } else {
        socket.emit('matchmaking:queued', result);
      }
    });
  }

  @SubscribeMessage('matchmaking:cancel')
  cancelMatchmaking(@ConnectedSocket() socket: OnlineSocket): void {
    void this.withAsyncAuth(socket, 'matchmaking:cancel', async () => {
      await this.matchmaking.cancel(socket.data.principal!);
      socket.emit('matchmaking:cancelled', { cancelled: true });
    });
  }

  @SubscribeMessage('ranked:join')
  joinRanked(
    @MessageBody() payload: RankedMatchPayload,
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAsyncAuth(socket, 'ranked:join', async () => {
      const result = await this.rankedMatchmaking.join(
        socket.data.principal!,
        payload ?? { rulesetId: 'ranked_standard' },
      );
      if (result.room) {
        void this.startMatchedRoom(result.room);
      } else {
        socket.emit('ranked:queued', result);
      }
    });
  }

  @SubscribeMessage('ranked:cancel')
  cancelRanked(@ConnectedSocket() socket: OnlineSocket): void {
    void this.withAsyncAuth(socket, 'ranked:cancel', async () => {
      await this.rankedMatchmaking.cancel(socket.data.principal!);
      socket.emit('ranked:cancelled', { cancelled: true });
    });
  }

  @SubscribeMessage('game:sync')
  sync(
    @MessageBody()
    payload: {
      gameId: string;
      expectedStateVersion?: number;
      actionId?: string;
    },
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAuth(socket, 'game:sync', () => {
      const gameId = this.requireGame(socket, payload.gameId);
      const snapshot = this.sessions.snapshot(
        gameId,
        socket.data.principal!.userId,
      );
      socket.emit('game:snapshot', snapshot);
    });
  }

  @SubscribeMessage('game:bid')
  bid(
    @MessageBody()
    payload: {
      gameId: string;
      expectedStateVersion: number;
      actionId: string;
      bid: number;
    },
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    this.dispatch(socket, payload.gameId, { ...payload, type: 'bid' });
  }

  @SubscribeMessage('game:chooseTrump')
  chooseTrump(
    @MessageBody()
    payload: {
      gameId: string;
      expectedStateVersion: number;
      actionId: string;
      suit: string;
    },
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    this.dispatch(socket, payload.gameId, { ...payload, type: 'chooseTrump' });
  }

  @SubscribeMessage('game:playCard')
  playCard(
    @MessageBody()
    payload: {
      gameId: string;
      expectedStateVersion: number;
      actionId: string;
      cardId: string;
    },
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    this.dispatch(socket, payload.gameId, { ...payload, type: 'playCard' });
  }

  @SubscribeMessage('game:leave')
  leave(
    @MessageBody()
    payload: { gameId: string; expectedStateVersion: number; actionId: string },
    @ConnectedSocket() socket: OnlineSocket,
  ): void {
    void this.withAuth(socket, 'game:leave', () => {
      const gameId = this.requireGame(socket, payload.gameId);
      const result = this.sessions.dispatch(
        gameId,
        socket.data.principal!.userId,
        {
          ...payload,
          type: 'leave',
        },
      );
      socket.emit('game:snapshot', result.snapshot);
    });
  }

  private dispatch(
    socket: OnlineSocket,
    gameId: string,
    payload: {
      gameId: string;
      expectedStateVersion: number;
      actionId: string;
      type: 'bid' | 'chooseTrump' | 'playCard';
      bid?: number;
      suit?: string;
      cardId?: string;
    },
  ): void {
    void this.withAuth(
      socket,
      `game:${payload.type}`,
      () => {
        this.requireGame(socket, gameId);
        if (
          !Number.isInteger(payload.expectedStateVersion) ||
          typeof payload.actionId !== 'string'
        ) {
          throw new SessionError(
            'INVALID_ACTION',
            'Command metadata is invalid',
          );
        }
        if (
          (payload.type === 'bid' &&
            (payload.bid === undefined ||
              !Number.isInteger(payload.bid) ||
              payload.bid < 0 ||
              payload.bid > 40)) ||
          (payload.type === 'chooseTrump' &&
            typeof payload.suit !== 'string') ||
          (payload.type === 'playCard' &&
            (typeof payload.cardId !== 'string' || payload.cardId.length === 0))
        ) {
          throw new SessionError(
            'INVALID_ACTION',
            'Command payload is invalid',
          );
        }
        const result = this.sessions.dispatch(
          gameId,
          socket.data.principal!.userId,
          payload,
        );
        socket.emit('game:snapshot', result.snapshot);
      },
      { requestedGameId: gameId },
    );
  }

  private async withAuth(
    socket: OnlineSocket,
    action: string,
    callback: () => void,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const principal = socket.data.principal;
    if (!principal) {
      this.metrics.increment('errors');
      socket.emit(
        'game:error',
        this.error('NOT_AUTHENTICATED', 'Authentication required'),
      );
      return;
    }
    let allowed: boolean;
    try {
      allowed = await this.rateLimiter.allowAsync(
        `${principal.userId}:${action}`,
      );
    } catch {
      this.metrics.increment('errors');
      socket.emit(
        'game:error',
        this.error(
          'SERVER_ERROR',
          'El servicio no está disponible temporalmente',
        ),
      );
      return;
    }
    if (!allowed) {
      this.metrics.increment('rate_limited');
      this.trackRankedSecurity(socket, 'ranked_action_spam', action);
      socket.emit(
        'game:error',
        this.error('RATE_LIMITED', 'Too many requests'),
      );
      return;
    }
    try {
      callback();
    } catch (error) {
      this.logActionFailure(action, error, socket, context);
      this.metrics.increment('errors');
      let payload = this.toError(error);
      this.trackRankedSecurity(
        socket,
        'ranked_invalid_action',
        action,
        payload.code,
      );
      if (
        payload.code === 'STALE_STATE' &&
        socket.data.gameId &&
        socket.data.principal
      ) {
        payload = {
          ...payload,
          snapshot: this.sessions.snapshot(
            socket.data.gameId,
            socket.data.principal.userId,
          ),
        };
      }
      socket.emit('game:error', payload);
    }
  }

  private async withAsyncAuth(
    socket: OnlineSocket,
    action: string,
    callback: () => Promise<void>,
  ): Promise<void> {
    const principal = socket.data.principal;
    if (!principal) {
      this.metrics.increment('errors');
      socket.emit(
        'game:error',
        this.error('NOT_AUTHENTICATED', 'Authentication required'),
      );
      return;
    }
    let allowed: boolean;
    try {
      allowed = await this.rateLimiter.allowAsync(
        `${principal.userId}:${action}`,
      );
    } catch {
      this.metrics.increment('errors');
      socket.emit(
        'game:error',
        this.error(
          'SERVER_ERROR',
          'El servicio no está disponible temporalmente',
        ),
      );
      return;
    }
    if (!allowed) {
      this.metrics.increment('rate_limited');
      this.trackRankedSecurity(socket, 'ranked_action_spam', action);
      socket.emit(
        'game:error',
        this.error('RATE_LIMITED', 'Too many requests'),
      );
      return;
    }
    try {
      await callback();
    } catch (error) {
      this.logActionFailure(action, error, socket);
      this.metrics.increment('errors');
      const payload = this.toError(error);
      this.trackRankedSecurity(
        socket,
        'ranked_invalid_action',
        action,
        payload.code,
      );
      socket.emit('game:error', payload);
    }
  }

  private requireSocketRoom(socket: OnlineSocket, roomId?: string): RoomView {
    const current = roomId ?? socket.data.roomId;
    if (!current || current !== socket.data.roomId)
      throw new NotFoundException('Room not found');
    return this.rooms.view(current);
  }

  private requireGame(socket: OnlineSocket, gameId: string): string {
    if (typeof gameId !== 'string' || gameId !== socket.data.gameId) {
      throw new SessionError(
        'NOT_IN_GAME',
        'Socket is not attached to this game',
      );
    }
    return gameId;
  }

  private async broadcastRoom(room: RoomView): Promise<void> {
    this.server.to(room.roomId).emit('room:updated', this.publicRoom(room));
  }

  private async broadcastGame(
    gameId: string,
    event: string,
    stateVersion: number,
  ): Promise<void> {
    const session = this.sessions.get(gameId);
    if (!session) return;
    // Render Free runs this service as one process and no Socket.IO adapter is
    // configured. Use the local socket registry so state broadcasts cannot be
    // delayed or lost behind a Redis fetch for every game event.
    for (const socket of this.localSockets()) {
      if (socket.data.gameId !== gameId || !socket.data.principal) continue;
      const snapshot = session.snapshot(socket.data.principal.userId);
      socket.emit('game:event', { event, stateVersion });
      if (event === 'GAME_STARTED') socket.emit('game:started', snapshot);
      socket.emit('game:snapshot', snapshot);
    }
  }

  private async attachGameToRoomSockets(
    roomId: string,
    gameId: string,
  ): Promise<void> {
    // Render Free runs one process and no Socket.IO adapter is configured.
    // Avoid an asynchronous adapter lookup when assigning the game context.
    for (const socket of this.localSockets()) {
      if (!socket.rooms.has(roomId)) continue;
      socket.data.gameId = gameId;
    }
  }

  private async startMatchedRoom(room: RoomView): Promise<void> {
    try {
      const record = this.rooms.requireRoom(room.roomId);
      const created = await this.sessions.create(record);
      const started = this.rooms.markStarted(record.roomId, created.gameId);
      for (const socket of this.localSockets()) {
        const userId = socket.data.principal?.userId;
        if (
          !userId ||
          !started.players.some((player) => player.userId === userId)
        )
          continue;
        socket.data.roomId = started.roomId;
        socket.data.gameId = created.gameId;
        this.server.in(socket.id).socketsJoin(started.roomId);
        socket.emit('matchmaking:matched', this.publicRoom(started));
        if (started.mode === 'ranked')
          socket.emit('ranked:matched', this.publicRoom(started));
        socket.emit('room:joined', this.publicRoom(started));
      }
      created.session.start();
      void this.broadcastRoom(started);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'match_start_failed',
          mode: room.mode ?? 'casual',
          roomId: room.roomId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
      return;
    }
  }

  private publicRoom(room: RoomView): RoomView {
    return { ...room, players: room.players.map((player) => ({ ...player })) };
  }

  private localSockets(): Iterable<OnlineSocket> {
    const namespace = this.server as unknown as
      | { sockets?: Map<string, OnlineSocket> }
      | undefined;
    return namespace?.sockets?.values() ?? [];
  }

  private readToken(socket: OnlineSocket): unknown {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    if (auth?.token) return auth.token;
    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer '))
      return header.slice(7);
    return undefined;
  }

  private assertRoomPayload(payload: CreateRoomPayload): CreateRoomPayload {
    if (!payload || !Number.isInteger(payload.playerCount)) {
      throw new ConflictException('Room configuration is invalid');
    }
    return payload;
  }

  private error(code: GameErrorCode, message: string): GameErrorPayload {
    return { code, message };
  }

  private toError(error: unknown): GameErrorPayload {
    if (error instanceof SessionError) {
      return error.stateVersion === undefined
        ? { code: error.code, message: error.message }
        : {
            code: error.code,
            message: error.message,
            stateVersion: error.stateVersion,
          };
    }
    if (error instanceof NotFoundException)
      return this.error('ROOM_NOT_FOUND', error.message);
    if (error instanceof ServiceUnavailableException)
      return this.error('RANKED_UNAVAILABLE', error.message);
    if (error instanceof BadRequestException) {
      const message = error.message;
      if (message.includes('permanent account'))
        return this.error('ACCOUNT_REQUIRED', message);
      if (message.includes('ranked ruleset'))
        return this.error('INVALID_RULESET', message);
      return this.error('INVALID_ACTION', message);
    }
    if (error instanceof ConflictException) {
      const message = error.message;
      if (message.includes('full')) return this.error('ROOM_FULL', message);
      if (message.includes('started'))
        return this.error('GAME_ALREADY_STARTED', message);
      if (message.includes('host')) return this.error('NOT_HOST', message);
      if (message.includes('cooldown'))
        return this.error('QUEUE_COOLDOWN', message);
      if (message.includes('season'))
        return this.error('SEASON_NOT_AVAILABLE', message);
      if (message.includes('another online flow'))
        return this.error('ALREADY_IN_GAME', message);
      return this.error('INVALID_ACTION', message);
    }
    return this.error('SERVER_ERROR', 'No se ha podido procesar la acción');
  }

  private trackRankedSecurity(
    socket: OnlineSocket,
    event: 'ranked_invalid_action' | 'ranked_action_spam',
    action: string,
    code?: string,
  ): void {
    const userId = socket.data.principal?.userId;
    const roomId = socket.data.roomId;
    if (!userId || !roomId) return;
    try {
      const room = this.rooms.view(roomId);
      if (room.mode !== 'ranked') return;
      const key = `${socket.data.gameId ?? room.gameId ?? room.roomId}:${userId}:${action}:${code ?? 'unknown'}`;
      const attempt =
        event === 'ranked_invalid_action'
          ? (this.invalidActionAttempts.get(key) ?? 0) + 1
          : 1;
      if (event === 'ranked_invalid_action')
        this.invalidActionAttempts.set(key, attempt);
      this.analytics.track(event, {
        userId,
        gameId: socket.data.gameId,
        seasonId: room.seasonId,
        properties: {
          action,
          ...(code ? { code } : {}),
          ...(event === 'ranked_invalid_action'
            ? { attempt, repeated: attempt > 1 }
            : {}),
        },
      });
    } catch {
      // Security telemetry must never break an authoritative game action.
    }
  }

  private clearInvalidAttemptsForUser(userId: string): void {
    const marker = `:${userId}:`;
    for (const key of this.invalidActionAttempts.keys())
      if (key.includes(marker)) this.invalidActionAttempts.delete(key);
  }

  private clearInvalidAttemptsForGame(gameId: string): void {
    const marker = `${gameId}:`;
    for (const key of this.invalidActionAttempts.keys())
      if (key.startsWith(marker)) this.invalidActionAttempts.delete(key);
  }

  private logActionFailure(
    action: string,
    error: unknown,
    socket: OnlineSocket,
    context?: Record<string, unknown>,
  ): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'realtime_action_failed',
        action,
        error: message,
        socketGameId: socket.data.gameId,
        socketRoomId: socket.data.roomId,
        ...context,
      }),
    );
  }
}
