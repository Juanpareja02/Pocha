import { PresenceStatus, RoomView } from '../protocol/protocol';
import Redis from 'ioredis';
import { OnModuleDestroy } from '@nestjs/common';

const ROOM_TTL_SECONDS = 24 * 60 * 60;
const SESSION_TTL_SECONDS = 48 * 60 * 60;
const QUEUE_ENTRY_TTL_SECONDS = 15 * 60;
const PRESENCE_TTL_SECONDS = 60 * 60;

function createRedis(url: string, enableOfflineQueue = true): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue,
  });
  client.on('error', (error: Error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'redis_error',
        message: error.message,
      }),
    );
  });
  return client;
}

function assertRedisReady(redis: Redis): void {
  if (redis.status !== 'ready') {
    throw new Error(
      'Redis is unavailable; refusing to use an in-memory fallback',
    );
  }
}

async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100,
    );
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

export interface RoomRecord extends RoomView {
  readonly createdAt: string;
}

export interface RoomRepository {
  save(room: RoomRecord): RoomRecord;
  findById(roomId: string): RoomRecord | undefined;
  findByCode(code: string): RoomRecord | undefined;
  findByUser(userId: string): RoomRecord | undefined;
  delete(roomId: string): void;
  initialize?(): Promise<void>;
}

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, RoomRecord>();

  save(room: RoomRecord): RoomRecord {
    this.rooms.set(room.roomId, room);
    return room;
  }

  findById(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId);
  }

  findByCode(code: string): RoomRecord | undefined {
    const normalized = code.toUpperCase();
    return [...this.rooms.values()].find((room) => room.code === normalized);
  }

  findByUser(userId: string): RoomRecord | undefined {
    return [...this.rooms.values()].find((room) =>
      room.players.some((player) => player.userId === userId),
    );
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId);
  }
}

export interface PresenceRepository {
  set(
    userId: string,
    status: PresenceStatus,
    roomId?: string,
    gameId?: string,
  ): void;
  get(
    userId: string,
  ): { status: PresenceStatus; roomId?: string; gameId?: string } | undefined;
  clear(userId: string): void;
  hasActiveGame(userId: string): boolean;
  initialize?(): Promise<void>;
}

export class InMemoryPresenceRepository implements PresenceRepository {
  private readonly values = new Map<
    string,
    { status: PresenceStatus; roomId?: string; gameId?: string }
  >();

  set(
    userId: string,
    status: PresenceStatus,
    roomId?: string,
    gameId?: string,
  ): void {
    this.values.set(userId, { status, roomId, gameId });
  }

  get(
    userId: string,
  ): { status: PresenceStatus; roomId?: string; gameId?: string } | undefined {
    return this.values.get(userId);
  }

  clear(userId: string): void {
    this.values.delete(userId);
  }

  hasActiveGame(userId: string): boolean {
    return this.values.get(userId)?.status === 'IN_GAME';
  }
}

/** Redis-backed room cache with durable writes and pub/sub cache invalidation. */
export class RedisRoomRepository implements RoomRepository, OnModuleDestroy {
  private readonly cache = new Map<string, RoomRecord>();
  private readonly redis: Redis;
  private readonly subscriber: Redis;
  private readonly namespace: string;

  constructor(redisUrl: string, namespace = 'pocha') {
    this.namespace = namespace;
    this.redis = createRedis(redisUrl);
    this.subscriber = createRedis(redisUrl, true);
    void this.subscriber.subscribe(this.eventsChannel()).catch(() => undefined);
    this.subscriber.on('message', (_channel, message) => {
      const event = JSON.parse(message) as {
        action: 'save' | 'delete';
        room?: RoomRecord;
        roomId?: string;
      };
      if (event.action === 'save' && event.room)
        this.cache.set(event.room.roomId, event.room);
      if (event.action === 'delete' && event.roomId)
        this.cache.delete(event.roomId);
    });
  }

  async initialize(): Promise<void> {
    const roomIds = await this.redis.smembers(this.indexKey());
    const rows = await Promise.all(
      roomIds.map((roomId) => this.redis.get(this.key(roomId))),
    );
    const staleIds: string[] = [];
    for (const [index, row] of rows.entries())
      if (row) {
        const room = JSON.parse(row) as RoomRecord;
        this.cache.set(room.roomId, room);
      } else staleIds.push(roomIds[index]);
    if (staleIds.length > 0)
      await this.redis.srem(this.indexKey(), ...staleIds);
  }

  save(room: RoomRecord): RoomRecord {
    assertRedisReady(this.redis);
    const previous = this.cache.get(room.roomId);
    this.cache.set(room.roomId, room);
    void this.redis
      .multi()
      .set(this.key(room.roomId), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS)
      .sadd(this.indexKey(), room.roomId)
      .publish(this.eventsChannel(), JSON.stringify({ action: 'save', room }))
      .exec()
      .catch(() => {
        if (previous) this.cache.set(room.roomId, previous);
        else this.cache.delete(room.roomId);
      });
    return room;
  }

  findById(roomId: string): RoomRecord | undefined {
    assertRedisReady(this.redis);
    return this.cache.get(roomId);
  }

  findByCode(code: string): RoomRecord | undefined {
    assertRedisReady(this.redis);
    const normalized = code.toUpperCase();
    return [...this.cache.values()].find((room) => room.code === normalized);
  }

  findByUser(userId: string): RoomRecord | undefined {
    assertRedisReady(this.redis);
    return [...this.cache.values()].find((room) =>
      room.players.some((player) => player.userId === userId),
    );
  }

  delete(roomId: string): void {
    assertRedisReady(this.redis);
    const previous = this.cache.get(roomId);
    this.cache.delete(roomId);
    void this.redis
      .multi()
      .del(this.key(roomId))
      .srem(this.indexKey(), roomId)
      .publish(
        this.eventsChannel(),
        JSON.stringify({ action: 'delete', roomId }),
      )
      .exec()
      .catch(() => {
        if (previous) this.cache.set(roomId, previous);
      });
  }

  private key(roomId: string): string {
    return `${this.namespace}:room:${roomId}`;
  }

  private indexKey(): string {
    return `${this.namespace}:rooms:index`;
  }

  private eventsChannel(): string {
    return `${this.namespace}:rooms:events`;
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
    this.subscriber.disconnect();
  }
}

export interface SessionLookupRecord {
  readonly gameId: string;
  readonly roomId: string;
  readonly status: 'RUNNING' | 'FINISHED';
  readonly mode: string;
  readonly rulesetId: string;
  readonly rulesetVersion: number;
  readonly playerIds: readonly string[];
  readonly seasonId?: string;
  readonly updatedAt: string;
}

export interface SessionLookupRepository {
  save(record: SessionLookupRecord): MaybePromise<SessionLookupRecord>;
  findByGameId(gameId: string): MaybePromise<SessionLookupRecord | undefined>;
  findByRoomId(roomId: string): MaybePromise<SessionLookupRecord | undefined>;
  delete(gameId: string): MaybePromise<void>;
  initialize?(): Promise<void>;
}

export class InMemorySessionLookupRepository implements SessionLookupRepository {
  private readonly records = new Map<string, SessionLookupRecord>();

  save(record: SessionLookupRecord): SessionLookupRecord {
    this.records.set(record.gameId, record);
    return record;
  }

  findByGameId(gameId: string): SessionLookupRecord | undefined {
    return this.records.get(gameId);
  }

  findByRoomId(roomId: string): SessionLookupRecord | undefined {
    return [...this.records.values()].find(
      (record) => record.roomId === roomId,
    );
  }

  delete(gameId: string): void {
    this.records.delete(gameId);
  }
}

/** Redis-backed cross-instance lookup for live game sessions. */
export class RedisSessionLookupRepository
  implements SessionLookupRepository, OnModuleDestroy
{
  private readonly cache = new Map<string, SessionLookupRecord>();
  private readonly redis: Redis;
  private readonly subscriber: Redis;
  private readonly namespace: string;

  constructor(redisUrl: string, namespace = 'pocha') {
    this.namespace = namespace;
    this.redis = createRedis(redisUrl);
    this.subscriber = createRedis(redisUrl, true);
    void this.subscriber.subscribe(this.eventsChannel()).catch(() => undefined);
    this.subscriber.on('message', (_channel, message) => {
      const event = JSON.parse(message) as {
        action: 'save' | 'delete';
        record?: SessionLookupRecord;
        gameId?: string;
      };
      if (event.action === 'save' && event.record)
        this.cache.set(event.record.gameId, event.record);
      if (event.action === 'delete' && event.gameId)
        this.cache.delete(event.gameId);
    });
  }

  async initialize(): Promise<void> {
    const gameIds = await this.redis.smembers(this.indexKey());
    const rows = await Promise.all(
      gameIds.map((gameId) => this.redis.get(this.key(gameId))),
    );
    const staleIds: string[] = [];
    for (const [index, row] of rows.entries())
      if (row) {
        const record = JSON.parse(row) as SessionLookupRecord;
        this.cache.set(record.gameId, record);
      } else staleIds.push(gameIds[index]);
    if (staleIds.length > 0)
      await this.redis.srem(this.indexKey(), ...staleIds);
  }

  save(record: SessionLookupRecord): SessionLookupRecord {
    assertRedisReady(this.redis);
    const previous = this.cache.get(record.gameId);
    this.cache.set(record.gameId, record);
    void this.redis
      .multi()
      .set(
        this.key(record.gameId),
        JSON.stringify(record),
        'EX',
        SESSION_TTL_SECONDS,
      )
      .sadd(this.indexKey(), record.gameId)
      .publish(this.eventsChannel(), JSON.stringify({ action: 'save', record }))
      .exec()
      .catch(() => {
        if (previous) this.cache.set(record.gameId, previous);
        else this.cache.delete(record.gameId);
      });
    return record;
  }

  findByGameId(gameId: string): SessionLookupRecord | undefined {
    assertRedisReady(this.redis);
    return this.cache.get(gameId);
  }

  findByRoomId(roomId: string): SessionLookupRecord | undefined {
    assertRedisReady(this.redis);
    return [...this.cache.values()].find((record) => record.roomId === roomId);
  }

  delete(gameId: string): void {
    assertRedisReady(this.redis);
    const previous = this.cache.get(gameId);
    this.cache.delete(gameId);
    void this.redis
      .multi()
      .del(this.key(gameId))
      .srem(this.indexKey(), gameId)
      .publish(
        this.eventsChannel(),
        JSON.stringify({ action: 'delete', gameId }),
      )
      .exec()
      .catch(() => {
        if (previous) this.cache.set(gameId, previous);
      });
  }

  private key(gameId: string): string {
    return `${this.namespace}:session:${gameId}`;
  }

  private indexKey(): string {
    return `${this.namespace}:sessions:index`;
  }

  private eventsChannel(): string {
    return `${this.namespace}:sessions:events`;
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
    this.subscriber.disconnect();
  }
}

export interface MatchmakingEntry {
  readonly userId: string;
  readonly playerCount: number;
  readonly rulesetId: string;
  readonly rulesetVersion: number;
  readonly queuedAt: string;
}

export type MaybePromise<T> = T | Promise<T>;

export interface MatchmakingQueue {
  enqueue(entry: MatchmakingEntry): MaybePromise<void>;
  remove(userId: string): MaybePromise<void>;
  findByUser(userId: string): MaybePromise<MatchmakingEntry | undefined>;
  takeMatch(
    playerCount: number,
    rulesetId: string,
    rulesetVersion: number,
  ): MaybePromise<MatchmakingEntry[]>;
  entries(): MaybePromise<readonly MatchmakingEntry[]>;
  initialize?(): Promise<void>;
}

export class InMemoryMatchmakingQueue implements MatchmakingQueue {
  private readonly values = new Map<string, MatchmakingEntry>();

  enqueue(entry: MatchmakingEntry): void {
    this.values.set(entry.userId, entry);
  }

  remove(userId: string): void {
    this.values.delete(userId);
  }

  findByUser(userId: string): MatchmakingEntry | undefined {
    return this.values.get(userId);
  }

  takeMatch(
    playerCount: number,
    rulesetId: string,
    rulesetVersion: number,
  ): MatchmakingEntry[] {
    const compatible = [...this.values.values()]
      .filter(
        (entry) =>
          entry.playerCount === playerCount &&
          entry.rulesetId === rulesetId &&
          entry.rulesetVersion === rulesetVersion,
      )
      .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
    if (compatible.length < playerCount) return [];
    const match = compatible.slice(0, playerCount);
    for (const entry of match) this.values.delete(entry.userId);
    return match;
  }

  entries(): readonly MatchmakingEntry[] {
    return [...this.values.values()];
  }
}

/** Redis-backed casual queue. Matching remains constrained by the same official key as memory mode. */
export class RedisMatchmakingQueue
  implements MatchmakingQueue, OnModuleDestroy
{
  private readonly redis: Redis;
  private readonly namespace: string;

  constructor(redisUrl: string, namespace = 'pocha') {
    this.namespace = namespace;
    this.redis = createRedis(redisUrl);
  }

  async initialize(): Promise<void> {
    await this.redis.ping();
  }

  async enqueue(entry: MatchmakingEntry): Promise<void> {
    await this.redis
      .multi()
      .set(
        this.entryKey(entry.userId),
        JSON.stringify(entry),
        'EX',
        QUEUE_ENTRY_TTL_SECONDS,
      )
      .zadd(this.queueKey(entry), Date.parse(entry.queuedAt), entry.userId)
      .exec();
  }

  async remove(userId: string): Promise<void> {
    const entry = await this.findByUser(userId);
    if (!entry) return;
    await this.redis
      .multi()
      .del(this.entryKey(userId))
      .zrem(this.queueKey(entry), userId)
      .exec();
  }

  async findByUser(userId: string): Promise<MatchmakingEntry | undefined> {
    const raw = await this.redis.get(this.entryKey(userId));
    return raw ? (JSON.parse(raw) as MatchmakingEntry) : undefined;
  }

  async takeMatch(
    playerCount: number,
    rulesetId: string,
    rulesetVersion: number,
  ): Promise<MatchmakingEntry[]> {
    const key = this.queueKey({ playerCount, rulesetId, rulesetVersion });
    const lockKey = `${key}:lock`;
    const token = `${process.pid}:${Math.random()}`;
    if ((await this.redis.set(lockKey, token, 'PX', 2_000, 'NX')) !== 'OK')
      return [];
    try {
      const ids = await this.redis.zrange(key, 0, -1);
      const rawEntries = await Promise.all(
        ids.map((userId) => this.redis.get(this.entryKey(userId))),
      );
      const staleIds = ids.filter((_, index) => rawEntries[index] === null);
      if (staleIds.length > 0) await this.redis.zrem(key, ...staleIds);
      const compatible = rawEntries
        .filter((raw): raw is string => raw !== null)
        .map((raw) => JSON.parse(raw) as MatchmakingEntry)
        .filter(
          (entry) =>
            entry.playerCount === playerCount &&
            entry.rulesetId === rulesetId &&
            entry.rulesetVersion === rulesetVersion,
        )
        .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
      if (compatible.length < playerCount) return [];
      const match = compatible.slice(0, playerCount);
      const transaction = this.redis.multi();
      for (const entry of match)
        transaction.del(this.entryKey(entry.userId)).zrem(key, entry.userId);
      await transaction.exec();
      return match;
    } finally {
      await this.redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        lockKey,
        token,
      );
    }
  }

  async entries(): Promise<readonly MatchmakingEntry[]> {
    const keys = await scanKeys(this.redis, `${this.namespace}:casual:entry:*`);
    const raw = await Promise.all(keys.map((key) => this.redis.get(key)));
    return raw
      .filter((value): value is string => value !== null)
      .map((value) => JSON.parse(value) as MatchmakingEntry);
  }

  private queueKey(
    entry: Pick<
      MatchmakingEntry,
      'playerCount' | 'rulesetId' | 'rulesetVersion'
    >,
  ): string {
    return `${this.namespace}:casual:queue:${entry.playerCount}:${entry.rulesetId}:${entry.rulesetVersion}`;
  }

  private entryKey(userId: string): string {
    return `${this.namespace}:casual:entry:${userId}`;
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }
}

export class RedisPresenceRepository
  implements PresenceRepository, OnModuleDestroy
{
  private readonly values = new Map<
    string,
    { status: PresenceStatus; roomId?: string; gameId?: string }
  >();
  private readonly redis: Redis;
  private readonly subscriber: Redis;
  private readonly namespace: string;

  constructor(redisUrl: string, namespace = 'pocha') {
    this.namespace = namespace;
    this.redis = createRedis(redisUrl);
    this.subscriber = createRedis(redisUrl, true);
    void this.subscriber.subscribe(this.eventsChannel()).catch(() => undefined);
    this.subscriber.on('message', (_channel, message) => {
      const event = JSON.parse(message) as {
        action: 'set' | 'clear';
        userId: string;
        value?: { status: PresenceStatus; roomId?: string; gameId?: string };
      };
      if (event.action === 'set' && event.value)
        this.values.set(event.userId, event.value);
      if (event.action === 'clear') this.values.delete(event.userId);
    });
  }

  async initialize(): Promise<void> {
    const keys = await scanKeys(this.redis, `${this.namespace}:presence:*`);
    const rows = await Promise.all(keys.map((key) => this.redis.get(key)));
    for (const [index, row] of rows.entries())
      if (row) {
        const value = JSON.parse(row) as {
          userId?: string;
          status: PresenceStatus;
          roomId?: string;
          gameId?: string;
        };
        const key = keys[index];
        const userId = value.userId ?? key.split(':').pop();
        if (userId)
          this.values.set(userId, {
            status: value.status,
            roomId: value.roomId,
            gameId: value.gameId,
          });
      }
  }

  set(
    userId: string,
    status: PresenceStatus,
    roomId?: string,
    gameId?: string,
  ): void {
    assertRedisReady(this.redis);
    const value = { status, roomId, gameId };
    const previous = this.values.get(userId);
    this.values.set(userId, value);
    void this.redis
      .multi()
      .set(
        this.key(userId),
        JSON.stringify({ ...value, userId }),
        'EX',
        PRESENCE_TTL_SECONDS,
      )
      .publish(
        this.eventsChannel(),
        JSON.stringify({ action: 'set', userId, value }),
      )
      .exec()
      .catch(() => {
        if (previous) this.values.set(userId, previous);
        else this.values.delete(userId);
      });
  }

  get(
    userId: string,
  ): { status: PresenceStatus; roomId?: string; gameId?: string } | undefined {
    assertRedisReady(this.redis);
    return this.values.get(userId);
  }

  clear(userId: string): void {
    assertRedisReady(this.redis);
    const previous = this.values.get(userId);
    this.values.delete(userId);
    void this.redis
      .multi()
      .del(this.key(userId))
      .publish(
        this.eventsChannel(),
        JSON.stringify({ action: 'clear', userId }),
      )
      .exec()
      .catch(() => {
        if (previous) this.values.set(userId, previous);
      });
  }

  hasActiveGame(userId: string): boolean {
    assertRedisReady(this.redis);
    return this.values.get(userId)?.status === 'IN_GAME';
  }

  private key(userId: string): string {
    return `${this.namespace}:presence:${userId}`;
  }

  private eventsChannel(): string {
    return `${this.namespace}:presence:events`;
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
    this.subscriber.disconnect();
  }
}
