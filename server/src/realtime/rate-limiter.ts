import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';

@Injectable()
export class RealtimeRateLimiter {
  private readonly calls = new Map<string, number[]>();

  allow(key: string, limit = 40, windowMs = 10_000): boolean {
    const now = Date.now();
    const recent = (this.calls.get(key) ?? []).filter(
      (value) => now - value < windowMs,
    );
    if (recent.length >= limit) {
      this.calls.set(key, recent);
      return false;
    }
    recent.push(now);
    this.calls.set(key, recent);
    return true;
  }

  async allowAsync(
    key: string,
    limit = 40,
    windowMs = 10_000,
  ): Promise<boolean> {
    return this.allow(key, limit, windowMs);
  }
}

/** Redis-backed limiter used outside development so all instances share state. */
export class RedisRealtimeRateLimiter
  extends RealtimeRateLimiter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly redis: Redis;

  constructor(
    redisUrl: string,
    private readonly namespace = 'pocha',
  ) {
    super();
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: true,
      connectTimeout: 1500,
    });
    this.redis.on('error', () => undefined);
  }

  async onModuleInit(): Promise<void> {
    await this.redis.ping();
  }

  override async allowAsync(
    key: string,
    limit = 40,
    windowMs = 10_000,
  ): Promise<boolean> {
    if (!Number.isInteger(limit) || limit <= 0)
      throw new Error('Rate limit must be a positive integer');
    if (!Number.isInteger(windowMs) || windowMs <= 0)
      throw new Error('Rate limit window must be a positive integer');
    const bucket = Math.floor(Date.now() / windowMs);
    const digest = createHash('sha256').update(key).digest('hex').slice(0, 32);
    const redisKey = `${this.namespace}:rate:${digest}:${windowMs}:${bucket}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.pexpire(redisKey, windowMs + 1_000);
    return count <= limit;
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }
}
