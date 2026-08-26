import { RankedQueueEntry, RANKED_PLAYER_COUNT } from './ranked.types';
import { MatchQualityService } from './match-quality.service';
import Redis from 'ioredis';
import { OnModuleDestroy } from '@nestjs/common';

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

type MaybePromise<T> = T | Promise<T>;

export interface RankedQueue {
  initialize?(): Promise<void>;
  enqueue(entry: RankedQueueEntry): MaybePromise<void>;
  remove(userId: string): MaybePromise<void>;
  findByUser(userId: string): MaybePromise<RankedQueueEntry | undefined>;
  takeMatch(
    entry: RankedQueueEntry,
    now?: number,
    quality?: MatchQualityService,
  ): MaybePromise<readonly RankedQueueEntry[]>;
  entries(): MaybePromise<readonly RankedQueueEntry[]>;
}

export class InMemoryRankedQueue implements RankedQueue {
  private readonly values = new Map<string, RankedQueueEntry>();

  constructor(private readonly quality = new MatchQualityService()) {}

  enqueue(entry: RankedQueueEntry): void {
    this.values.set(entry.userId, entry);
  }

  remove(userId: string): void {
    this.values.delete(userId);
  }

  findByUser(userId: string): RankedQueueEntry | undefined {
    return this.values.get(userId);
  }

  takeMatch(
    entry: RankedQueueEntry,
    now = Date.now(),
    quality = this.quality,
  ): readonly RankedQueueEntry[] {
    const candidates = [...this.values.values()]
      .filter(
        (candidate) =>
          candidate.seasonId === entry.seasonId &&
          candidate.rulesetId === entry.rulesetId &&
          candidate.rulesetVersion === entry.rulesetVersion,
      )
      .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
    const groups: RankedQueueEntry[][] = [];
    for (const candidate of candidates) {
      let inserted = false;
      for (const group of groups) {
        if (
          group.length < RANKED_PLAYER_COUNT &&
          quality.isCompatible([...group, candidate], now)
        ) {
          group.push(candidate);
          inserted = true;
          break;
        }
      }
      if (!inserted) groups.push([candidate]);
    }
    const match =
      groups
        .filter(
          (group) =>
            group.length === RANKED_PLAYER_COUNT &&
            group.some((candidate) => candidate.userId === entry.userId),
        )
        .sort(
          (left, right) => quality.score(left, now) - quality.score(right, now),
        )[0] ?? [];
    if (match.length !== RANKED_PLAYER_COUNT) return [];
    for (const candidate of match) this.values.delete(candidate.userId);
    return match;
  }

  entries(): readonly RankedQueueEntry[] {
    return [...this.values.values()];
  }
}

/** Redis-backed ranked queue with a short distributed lock around match consumption. */
export class RedisRankedQueue implements RankedQueue, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly quality: MatchQualityService;
  private readonly namespace: string;

  constructor(
    redisUrl: string,
    quality = new MatchQualityService(),
    namespace = 'pocha',
  ) {
    this.namespace = namespace;
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
    });
    this.redis.on('error', (error: Error) => {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'redis_error',
          message: error.message,
        }),
      );
    });
    this.quality = quality;
  }

  async initialize(): Promise<void> {
    await this.redis.ping();
  }

  async enqueue(entry: RankedQueueEntry): Promise<void> {
    const key = this.queueKey(entry);
    await this.redis
      .multi()
      .set(this.entryKey(entry.userId), JSON.stringify(entry), 'EX', 15 * 60)
      .zadd(key, Date.parse(entry.queuedAt), entry.userId)
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

  async findByUser(userId: string): Promise<RankedQueueEntry | undefined> {
    const direct = await this.redis.get(this.entryKey(userId));
    return direct ? (JSON.parse(direct) as RankedQueueEntry) : undefined;
  }

  async takeMatch(
    entry: RankedQueueEntry,
    now = Date.now(),
    quality = this.quality,
  ): Promise<readonly RankedQueueEntry[]> {
    const lockKey = `${this.namespace}:ranked:lock:${entry.seasonId}:${entry.rulesetId}`;
    const token = `${process.pid}:${Math.random()}`;
    const locked = await this.redis.set(lockKey, token, 'PX', 2_000, 'NX');
    if (locked !== 'OK') return [];
    try {
      const ids = await this.redis.zrange(this.queueKey(entry), 0, -1);
      const rawEntries = await Promise.all(
        ids.map((userId) => this.redis.get(this.entryKey(userId))),
      );
      const staleIds = ids.filter((_, index) => rawEntries[index] === null);
      if (staleIds.length > 0)
        await this.redis.zrem(this.queueKey(entry), ...staleIds);
      const candidates = rawEntries
        .filter((raw): raw is string => raw !== null)
        .map((raw) => JSON.parse(raw) as RankedQueueEntry)
        .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
      const group = candidates
        .filter(
          (candidate) =>
            candidate.seasonId === entry.seasonId &&
            candidate.rulesetId === entry.rulesetId &&
            candidate.rulesetVersion === entry.rulesetVersion,
        )
        .slice(0, 4);
      if (group.length !== 4 || !quality.canMatch(group, now)) return [];
      const transaction = this.redis.multi();
      for (const candidate of group)
        transaction
          .zrem(this.queueKey(candidate), candidate.userId)
          .del(this.entryKey(candidate.userId));
      await transaction.exec();
      return group;
    } finally {
      await this.redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        lockKey,
        token,
      );
    }
  }

  async entries(): Promise<readonly RankedQueueEntry[]> {
    const keys = await scanKeys(this.redis, `${this.namespace}:ranked:entry:*`);
    const raw = await Promise.all(keys.map((key) => this.redis.get(key)));
    return raw
      .filter((value): value is string => value !== null)
      .map((value) => JSON.parse(value) as RankedQueueEntry);
  }

  private entryKey(userId: string): string {
    return `${this.namespace}:ranked:entry:${userId}`;
  }

  private queueKey(entry: RankedQueueEntry): string {
    return `${this.namespace}:ranked:queue:${entry.seasonId}:${entry.rulesetId}:${entry.rulesetVersion}`;
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }
}
