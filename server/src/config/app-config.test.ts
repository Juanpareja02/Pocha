import { describe, expect, it } from 'vitest';
import { appConfigFromEnvironment, validateEnvironment } from './app-config';

const external = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://pocha:secret@db.staging.dev:5432/pocha',
  REDIS_URL: 'rediss://redis.staging.dev:6380',
  AUTH_PROVIDER: 'external',
  AUTH_ISSUER_URL: 'https://accounts.staging.dev',
  AUTH_AUDIENCE: 'pocha-mobile',
  CORS_ALLOWED_ORIGINS: 'https://app.staging.dev',
  PUBLIC_BASE_URL: 'https://api.staging.dev',
  ENABLE_DEBUG_ENDPOINTS: 'false',
  USER_STORE: 'prisma',
  GAME_STORE: 'prisma',
  SEASON_STORE: 'prisma',
  RANKED_STORE: 'prisma',
  ROOM_STORE: 'redis',
  SESSION_LOOKUP_STORE: 'redis',
  PRESENCE_STORE: 'redis',
  CASUAL_QUEUE_STORE: 'redis',
  RANKED_QUEUE_STORE: 'redis',
  RENDER: 'true',
};

describe('runtime configuration', () => {
  it('keeps development defaults isolated to development', () => {
    const config = appConfigFromEnvironment({ NODE_ENV: 'test' });
    expect(config.appEnv).toBe('development');
    expect(config.userStore).toBe('memory');
    expect(config.roomStore).toBe('memory');
  });

  it('accepts an explicitly configured external environment', () => {
    expect(appConfigFromEnvironment(external).appEnv).toBe('production');
  });

  it('rejects development auth or memory adapters outside development', () => {
    expect(() =>
      validateEnvironment({
        ...external,
        AUTH_PROVIDER: 'development',
      }),
    ).toThrow(/AUTH_PROVIDER=external/);
    expect(() =>
      validateEnvironment({
        ...external,
        ROOM_STORE: 'memory',
      }),
    ).toThrow(/Prisma persistence and Redis/);
  });

  it('rejects wildcard CORS and insecure public URLs', () => {
    expect(() =>
      validateEnvironment({ ...external, CORS_ALLOWED_ORIGINS: '*' }),
    ).toThrow(/CORS_ALLOWED_ORIGINS/);
    expect(() =>
      validateEnvironment({
        ...external,
        PUBLIC_BASE_URL: 'http://api.example.com',
      }),
    ).toThrow(/HTTPS/);
    expect(() =>
      validateEnvironment({
        ...external,
        CORS_ALLOWED_ORIGINS: 'http://app.example.com',
      }),
    ).toThrow(/HTTPS origins/);
    expect(() =>
      validateEnvironment({
        ...external,
        PUBLIC_BASE_URL: 'https://api.example.com',
      }),
    ).toThrow(/reserved host/);
    expect(() =>
      validateEnvironment({
        ...external,
        DATABASE_URL: 'postgresql://pocha:secret@db.example.com:5432/pocha',
      }),
    ).toThrow(/reserved host/);
  });

  it('requires the production Node environment for staging and production', () => {
    expect(() =>
      validateEnvironment({
        ...external,
        APP_ENV: 'staging',
        NODE_ENV: 'development',
      }),
    ).toThrow(/NODE_ENV=production/);
    expect(() =>
      validateEnvironment({
        ...external,
        APP_ENV: 'development',
        NODE_ENV: 'production',
      }),
    ).toThrow(/APP_ENV must not be development/);
  });

  it('does not silently fill missing staging infrastructure with local defaults', () => {
    expect(() =>
      validateEnvironment({ APP_ENV: 'staging', NODE_ENV: 'production' }),
    ).toThrow(/DATABASE_URL is required/);
  });

  it('requires a metrics token when exposing metrics outside development', () => {
    expect(() =>
      validateEnvironment({
        ...external,
        METRICS_ENABLED: 'true',
      }),
    ).toThrow(/METRICS_TOKEN/);
  });
});
