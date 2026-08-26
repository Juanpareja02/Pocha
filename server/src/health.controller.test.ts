import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { InfrastructureHealthService } from './infrastructure/infrastructure-health.service';

function configFor(values: Record<string, string | number>): ConfigService {
  return {
    get: <T>(key: string, fallback?: T) =>
      (values[key] as T | undefined) ?? fallback,
    getOrThrow: <T>(key: string) => values[key] as T,
  } as unknown as ConfigService;
}

describe('health checks', () => {
  it('returns live and ready in development without external services', async () => {
    const service = new InfrastructureHealthService(
      configFor({ APP_ENV: 'development', HEALTH_TIMEOUT_MS: 50 }),
      {} as never,
    );
    const controller = new HealthController(service);

    expect(controller.live()).toMatchObject({ status: 'ok' });
    await expect(controller.ready()).resolves.toMatchObject({
      status: 'ready',
      checks: { database: 'skipped', redis: 'skipped' },
    });
  });

  it('reports not ready instead of falling back when Redis is unavailable', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]),
    };
    const service = new InfrastructureHealthService(
      configFor({
        APP_ENV: 'staging',
        REDIS_URL: 'redis://127.0.0.1:1',
        HEALTH_TIMEOUT_MS: 50,
      }),
      prisma as never,
    );

    await expect(service.ready()).resolves.toEqual({
      status: 'not_ready',
      checks: { config: 'ok', database: 'ok', redis: 'failed' },
    });
    await service.onModuleDestroy();
  });
});
