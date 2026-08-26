import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PRISMA_CLIENT } from '../realtime/tokens';

export interface ReadinessResult {
  readonly status: 'ready' | 'not_ready';
  readonly checks: Readonly<Record<string, 'ok' | 'failed' | 'skipped'>>;
}

/** Cheap dependency checks used by load balancers and deployment probes. */
@Injectable()
export class InfrastructureHealthService implements OnModuleDestroy {
  private readonly appEnv: string;
  private readonly timeoutMs: number;
  private readonly redis?: Redis;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {
    this.appEnv = config.get<string>('APP_ENV', 'development');
    this.timeoutMs = config.get<number>('HEALTH_TIMEOUT_MS', 1500);
    if (this.appEnv !== 'development') {
      this.redis = new Redis(config.getOrThrow<string>('REDIS_URL'), {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: true,
        connectTimeout: this.timeoutMs,
      });
      this.redis.on('error', () => undefined);
    }
  }

  live(): { status: 'ok'; service: string; environment: string } {
    return {
      status: 'ok',
      service: 'pocha-server',
      environment: this.appEnv,
    };
  }

  async ready(): Promise<ReadinessResult> {
    if (this.appEnv === 'development') {
      return {
        status: 'ready',
        checks: { config: 'ok', database: 'skipped', redis: 'skipped' },
      };
    }
    const checks: Record<string, 'ok' | 'failed' | 'skipped'> = {
      config: 'ok',
      database: 'failed',
      redis: 'failed',
    };
    await Promise.all([
      this.withTimeout(this.prisma.$queryRaw`SELECT 1`).then(
        () => (checks.database = 'ok'),
        () => undefined,
      ),
      this.withTimeout(
        this.redis?.ping() ??
          Promise.reject(new Error('Redis is not configured')),
      ).then(
        () => (checks.redis = 'ok'),
        () => undefined,
      ),
    ]);
    return {
      status:
        checks.database === 'ok' && checks.redis === 'ok'
          ? 'ready'
          : 'not_ready',
      checks,
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.redis?.disconnect();
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Health check timed out')),
            this.timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
