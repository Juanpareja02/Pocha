import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuthPrincipal } from '../auth/auth.service';
import {
  AddBotPayload,
  BotDifficulty,
  CreateRoomPayload,
  RoomConfig,
  RoomPlayerView,
  RoomView,
} from '../protocol/protocol';
import {
  InMemoryPresenceRepository,
  InMemoryRoomRepository,
  PresenceRepository,
  RoomRecord,
  RoomRepository,
} from '../realtime/repositories';
import { PRESENCE_REPOSITORY, ROOM_REPOSITORY } from '../realtime/tokens';
import { UserService } from '../users/user.service';
import {
  RANKED_PLAYER_COUNT,
  RANKED_RULESET_ID,
  RANKED_RULESET_VERSION,
} from '../ranked/ranked.types';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class RoomService implements OnModuleInit {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository = new InMemoryRoomRepository(),
    @Inject(PRESENCE_REPOSITORY)
    private readonly presence: PresenceRepository = new InMemoryPresenceRepository(),
    @Inject(UserService)
    private readonly users: UserService = new UserService(),
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rooms.initialize?.();
    await this.presence.initialize?.();
  }

  create(principal: AuthPrincipal, payload: CreateRoomPayload): RoomRecord {
    this.assertNoActiveRoom(principal.userId);
    const config = this.parseConfig(payload);
    const user = this.users.getOrCreate(principal);
    const now = new Date().toISOString();
    const player: RoomPlayerView = {
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarSeed: user.avatarSeed,
      seat: 0,
      isHost: true,
      isBot: false,
      ready: false,
      connectionStatus: 'CONNECTED',
    };
    const room: RoomRecord = {
      protocolVersion: 1,
      roomId: randomUUID(),
      code: this.createCode(),
      hostUserId: principal.userId,
      status: 'LOBBY',
      config,
      players: [player],
      createdAt: now,
    };
    this.rooms.save(room);
    this.presence.set(principal.userId, 'IN_LOBBY', room.roomId);
    return room;
  }

  createCasual(userIds: readonly string[], config: RoomConfig): RoomRecord {
    return this.createMatched(userIds, config, 'casual');
  }

  createRanked(userIds: readonly string[], seasonId: string): RoomRecord {
    return this.createMatched(
      userIds,
      {
        playerCount: RANKED_PLAYER_COUNT,
        rulesetId: RANKED_RULESET_ID,
        rulesetVersion: RANKED_RULESET_VERSION,
        allowBots: false,
        botDifficulty: 'normal',
      },
      'ranked',
      seasonId,
    );
  }

  private createMatched(
    userIds: readonly string[],
    config: RoomConfig,
    mode: 'casual' | 'ranked',
    seasonId?: string,
  ): RoomRecord {
    const players: RoomPlayerView[] = userIds.map((userId, seat) => {
      const user = this.users.findById(userId);
      if (!user) throw new NotFoundException('Matchmaking user not found');
      return {
        userId,
        displayName: user.displayName,
        username: user.username,
        avatarSeed: user.avatarSeed,
        seat,
        isHost: seat === 0,
        isBot: false,
        ready: true,
        connectionStatus: 'CONNECTED',
      };
    });
    const room: RoomRecord = {
      protocolVersion: 1,
      roomId: randomUUID(),
      code: this.createCode(),
      hostUserId: userIds[0],
      status: 'LOBBY',
      config,
      players,
      mode,
      seasonId,
      createdAt: new Date().toISOString(),
    };
    this.rooms.save(room);
    for (const userId of userIds)
      this.presence.set(userId, 'IN_LOBBY', room.roomId);
    return room;
  }

  join(principal: AuthPrincipal, rawCode: string): RoomRecord {
    const code = rawCode.trim().toUpperCase();
    const room = this.rooms.findByCode(code);
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== 'LOBBY') {
      const existing = room.players.find(
        (player) => player.userId === principal.userId,
      );
      if (existing && room.status === 'STARTED') return room;
      throw new ConflictException('Game already started');
    }
    this.assertNoActiveRoom(principal.userId);
    if (room.players.length >= room.config.playerCount) {
      throw new ConflictException('Room is full');
    }
    const user = this.users.getOrCreate(principal);
    const player: RoomPlayerView = {
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarSeed: user.avatarSeed,
      seat: room.players.length,
      isHost: false,
      isBot: false,
      ready: false,
      connectionStatus: 'CONNECTED',
    };
    const saved = this.saveRoom(room, { players: [...room.players, player] });
    this.presence.set(principal.userId, 'IN_LOBBY', room.roomId);
    return saved;
  }

  ready(principal: AuthPrincipal, roomId: string): RoomRecord {
    const room = this.requireRoom(roomId);
    const player = this.requirePlayer(room, principal.userId);
    if (room.status !== 'LOBBY') {
      throw new ConflictException('Game already started');
    }
    return this.saveRoom(room, {
      players: room.players.map((candidate) =>
        candidate.userId === player.userId
          ? { ...candidate, ready: true, connectionStatus: 'CONNECTED' }
          : candidate,
      ),
    });
  }

  addBot(
    principal: AuthPrincipal,
    roomId: string,
    payload: AddBotPayload,
  ): RoomRecord {
    const room = this.requireRoom(roomId);
    this.assertHost(room, principal.userId);
    if (room.status !== 'LOBBY')
      throw new ConflictException('Game already started');
    if (!room.config.allowBots)
      throw new BadRequestException('Bots are disabled');
    if (room.players.length >= room.config.playerCount) {
      throw new ConflictException('Room is full');
    }
    const difficulty = this.parseDifficulty(
      payload.difficulty ?? room.config.botDifficulty,
    );
    const seat = room.players.length;
    const bot: RoomPlayerView = {
      userId: `bot_${randomUUID().replaceAll('-', '').slice(0, 12)}`,
      displayName: `Bot ${seat + 1}`,
      username: `bot_${seat + 1}`,
      avatarSeed: seat * 97 + 13,
      seat,
      isHost: false,
      isBot: true,
      botDifficulty: difficulty,
      ready: true,
      connectionStatus: 'BOT_CONTROLLED',
    };
    return this.saveRoom(room, { players: [...room.players, bot] });
  }

  removeBot(
    principal: AuthPrincipal,
    roomId: string,
    botUserId: string,
  ): RoomRecord {
    const room = this.requireRoom(roomId);
    this.assertHost(room, principal.userId);
    const bot = room.players.find((player) => player.userId === botUserId);
    if (!bot?.isBot) throw new BadRequestException('Bot not found');
    const players = room.players
      .filter((player) => player.userId !== botUserId)
      .map((player, seat) => ({ ...player, seat }));
    return this.saveRoom(room, { players });
  }

  start(principal: AuthPrincipal, roomId: string): RoomRecord {
    const room = this.requireRoom(roomId);
    this.assertHost(room, principal.userId);
    if (room.status !== 'LOBBY')
      throw new ConflictException('Game already started');
    if (room.players.length !== room.config.playerCount) {
      throw new BadRequestException('The room does not have enough players');
    }
    if (room.players.some((player) => !player.ready)) {
      throw new BadRequestException('All players must be ready');
    }
    return room;
  }

  markStarted(roomId: string, gameId: string): RoomRecord {
    const room = this.requireRoom(roomId);
    const saved = this.saveRoom(room, { status: 'STARTED', gameId });
    for (const player of saved.players) {
      this.presence.set(player.userId, 'IN_GAME', saved.roomId, gameId);
    }
    return saved;
  }

  markFinished(roomId: string): RoomRecord {
    const room = this.requireRoom(roomId);
    const saved = this.saveRoom(room, { status: 'FINISHED' });
    for (const player of saved.players) this.presence.clear(player.userId);
    return saved;
  }

  disconnect(roomId: string, userId: string): RoomRecord {
    const room = this.requireRoom(roomId);
    if (room.status === 'STARTED') {
      this.presence.set(userId, 'DISCONNECTED', roomId, room.gameId);
    } else if (room.status === 'LOBBY') {
      this.presence.set(userId, 'IN_LOBBY', roomId);
    } else {
      this.presence.clear(userId);
    }
    return this.saveRoom(room, {
      players: room.players.map((player) =>
        player.userId === userId
          ? { ...player, connectionStatus: 'DISCONNECTED' }
          : player,
      ),
    });
  }

  reconnect(roomId: string, userId: string): RoomRecord {
    const room = this.requireRoom(roomId);
    const saved = this.saveRoom(room, {
      players: room.players.map((player) =>
        player.userId === userId
          ? { ...player, connectionStatus: 'CONNECTED' }
          : player,
      ),
    });
    this.presence.set(
      userId,
      saved.status === 'STARTED' ? 'IN_GAME' : 'IN_LOBBY',
      saved.roomId,
      saved.gameId,
    );
    return saved;
  }

  leave(principal: AuthPrincipal, roomId: string): RoomRecord | undefined {
    const room = this.requireRoom(roomId);
    const player = this.requirePlayer(room, principal.userId);
    if (room.status === 'STARTED') {
      throw new ConflictException('Use game:leave after the game starts');
    }
    const players = room.players
      .filter((candidate) => candidate.userId !== player.userId)
      .map((candidate, seat) => ({
        ...candidate,
        seat,
        isHost:
          candidate.userId ===
          (player.isHost ? room.players[1]?.userId : room.hostUserId),
      }));
    this.presence.clear(principal.userId);
    if (players.length === 0) {
      this.rooms.delete(room.roomId);
      return undefined;
    }
    const hostUserId =
      players.find((candidate) => candidate.isHost)?.userId ??
      players[0].userId;
    return this.saveRoom(room, {
      hostUserId,
      players: players.map((candidate) => ({
        ...candidate,
        isHost: candidate.userId === hostUserId,
      })),
    });
  }

  view(roomId: string): RoomView {
    return this.requireRoom(roomId);
  }

  requireRoom(roomId: string): RoomRecord {
    const room = this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  private saveRoom(room: RoomRecord, changes: Partial<RoomRecord>): RoomRecord {
    return this.rooms.save({ ...room, ...changes });
  }

  private requirePlayer(room: RoomRecord, userId: string): RoomPlayerView {
    const player = room.players.find(
      (candidate) => candidate.userId === userId,
    );
    if (!player) throw new NotFoundException('Player is not in this room');
    return player;
  }

  private assertHost(room: RoomRecord, userId: string): void {
    if (room.hostUserId !== userId)
      throw new ConflictException('Only the host can do this');
  }

  private assertNoActiveRoom(userId: string): void {
    const active = this.rooms.findByUser(userId);
    if (active && active.status !== 'FINISHED') {
      throw new ConflictException('User already belongs to an active room');
    }
    if (this.presence.hasActiveGame(userId)) {
      throw new ConflictException('User already has an active game');
    }
    const presence = this.presence.get(userId);
    if (
      presence &&
      [
        'IN_LOBBY',
        'IN_CASUAL_QUEUE',
        'IN_RANKED_QUEUE',
        'DISCONNECTED',
      ].includes(presence.status)
    ) {
      throw new ConflictException(
        'User already belongs to an active online flow',
      );
    }
  }

  private parseConfig(payload: CreateRoomPayload): RoomConfig {
    if (
      !Number.isInteger(payload.playerCount) ||
      payload.playerCount < 3 ||
      payload.playerCount > 6
    ) {
      throw new BadRequestException('Player count must be between 3 and 6');
    }
    const rulesetId = payload.rulesetId.trim().toLowerCase();
    if (rulesetId !== 'classic' && rulesetId !== 'auction') {
      throw new BadRequestException('Unsupported ruleset');
    }
    if (payload.rulesetVersion !== 1)
      throw new BadRequestException('Unsupported ruleset version');
    return {
      playerCount: payload.playerCount,
      rulesetId,
      rulesetVersion: 1,
      allowBots: Boolean(payload.allowBots),
      botDifficulty: this.parseDifficulty(payload.botDifficulty),
    };
  }

  private parseDifficulty(value: string): BotDifficulty {
    if (value === 'easy' || value === 'normal' || value === 'hard')
      return value;
    throw new BadRequestException('Unsupported bot difficulty');
  }

  private createCode(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const bytes = randomBytes(6);
      const code = [...bytes]
        .slice(0, 6)
        .map((byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length])
        .join('');
      if (!this.rooms.findByCode(code)) return code;
    }
    throw new Error('Could not allocate a unique room code');
  }
}
