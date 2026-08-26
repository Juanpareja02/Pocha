export type AppEnvironment = 'development' | 'staging' | 'production';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type AuthProvider = 'development' | 'external';
export type PersistentStore = 'memory' | 'prisma';
export type EphemeralStore = 'memory' | 'redis';

export interface AppConfig {
  readonly appEnv: AppEnvironment;
  readonly port: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly authProvider: AuthProvider;
  readonly authIssuerUrl: string;
  readonly authAudience: string;
  readonly corsAllowedOrigins: readonly string[];
  readonly publicBaseUrl: string;
  readonly logLevel: LogLevel;
  readonly enableDebugEndpoints: boolean;
  readonly userStore: PersistentStore;
  readonly gameStore: PersistentStore;
  readonly seasonStore: PersistentStore;
  readonly rankedStore: PersistentStore;
  readonly roomStore: EphemeralStore;
  readonly sessionLookupStore: EphemeralStore;
  readonly presenceStore: EphemeralStore;
  readonly casualQueueStore: EphemeralStore;
  readonly rankedQueueStore: EphemeralStore;
  readonly analyticsProvider: 'memory' | 'external' | 'noop';
  readonly metricsEnabled: boolean;
  readonly metricsToken: string;
  readonly minimumSupportedProtocolVersion: number;
  readonly latestProtocolVersion: number;
  readonly redisKeyPrefix: string;
  readonly healthTimeoutMs: number;
  readonly onlineBidTimeoutMs: number;
  readonly onlinePlayTimeoutMs: number;
  readonly onlineTrumpTimeoutMs: number;
  readonly onlineDisconnectGraceMs: number;
  readonly onlineRoundResultMs: number;
}

const APP_ENVIRONMENTS: readonly AppEnvironment[] = [
  'development',
  'staging',
  'production',
];
const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

function isReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '10.0.2.2' ||
    host === 'invalid' ||
    host.endsWith('.invalid') ||
    host === 'example.com' ||
    host.endsWith('.example.com') ||
    host === 'example.org' ||
    host.endsWith('.example.org') ||
    host === 'example.net' ||
    host.endsWith('.example.net')
  );
}

function assertSafeNetworkHost(key: string, value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must contain a valid network host`);
  }
  if (!parsed.hostname || isReservedHost(parsed.hostname)) {
    throw new Error(
      `${key} must not point to a local or reserved host outside development`,
    );
  }
}

function stringValue(
  values: Record<string, unknown>,
  key: string,
  fallback = '',
): string {
  const value = values[key];
  return typeof value === 'string' ? value.trim() : fallback;
}

function numberValue(
  values: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const raw = stringValue(values, key);
  if (raw.length === 0) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive number`);
  }
  return value;
}

function booleanValue(
  values: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const raw = stringValue(values, key);
  if (raw.length === 0) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${key} must be true or false`);
}

function enumValue<T extends string>(
  values: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = stringValue(values, key) || fallback;
  if (!allowed.includes(value as T)) {
    throw new Error(`${key} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function requireValue(key: string, value: string): string {
  if (!value) throw new Error(`${key} is required outside development`);
  return value;
}

function assertProductionUrl(key: string, value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${key} must use HTTPS outside development`);
  }
  if (isReservedHost(parsed.hostname)) {
    throw new Error(
      `${key} must not point to a local or reserved host outside development`,
    );
  }
}

function assertSecureCorsOrigins(
  origins: readonly string[],
  appEnv: AppEnvironment,
): void {
  if (appEnv === 'development') return;
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('CORS_ALLOWED_ORIGINS must contain valid URLs');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash ||
      isReservedHost(parsed.hostname)
    ) {
      throw new Error(
        'CORS_ALLOWED_ORIGINS must contain HTTPS origins without credentials, paths, or reserved hosts outside development',
      );
    }
  }
}

function assertDatabaseUrl(value: string, appEnv: AppEnvironment): void {
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string');
  }
  if (appEnv !== 'development') assertSafeNetworkHost('DATABASE_URL', value);
}

function assertRedisUrl(value: string, appEnv: AppEnvironment): void {
  if (!value.startsWith('redis://') && !value.startsWith('rediss://')) {
    throw new Error('REDIS_URL must be a Redis connection string');
  }
  if (appEnv !== 'development') assertSafeNetworkHost('REDIS_URL', value);
}

/**
 * Validates and normalizes the complete server configuration before Nest boots.
 * Development deliberately keeps in-memory defaults; staging and production do
 * not, so a deployment cannot silently hide a missing external service.
 */
export function validateEnvironment(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = stringValue(values, 'NODE_ENV');
  const inferredEnv = nodeEnv === 'production' ? 'production' : 'development';
  const appEnv = enumValue(
    values,
    'APP_ENV',
    APP_ENVIRONMENTS,
    inferredEnv as AppEnvironment,
  );
  const nonDevelopment = appEnv !== 'development';
  if (nonDevelopment && nodeEnv !== 'production') {
    throw new Error('NODE_ENV=production is required outside development');
  }
  if (!nonDevelopment && nodeEnv === 'production') {
    throw new Error('APP_ENV must not be development with NODE_ENV=production');
  }
  const port = numberValue(values, 'PORT', 3000);
  const databaseUrl = stringValue(
    values,
    'DATABASE_URL',
    nonDevelopment
      ? ''
      : 'postgresql://pocha:pocha@localhost:5432/pocha?schema=public',
  );
  const redisUrl = stringValue(
    values,
    'REDIS_URL',
    nonDevelopment ? '' : 'redis://localhost:6379',
  );
  const authProvider = enumValue(
    values,
    'AUTH_PROVIDER',
    ['development', 'external'] as const,
    nonDevelopment ? 'external' : 'development',
  );
  const authIssuerUrl = stringValue(values, 'AUTH_ISSUER_URL');
  const authAudience = stringValue(values, 'AUTH_AUDIENCE');
  const corsAllowedOrigins = stringValue(
    values,
    'CORS_ALLOWED_ORIGINS',
    nonDevelopment ? '' : 'http://localhost:3000',
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const publicBaseUrl = stringValue(
    values,
    'PUBLIC_BASE_URL',
    nonDevelopment ? '' : 'http://localhost:3000',
  );
  const logLevel = enumValue(values, 'LOG_LEVEL', LOG_LEVELS, 'debug');
  const enableDebugEndpoints = booleanValue(
    values,
    'ENABLE_DEBUG_ENDPOINTS',
    !nonDevelopment,
  );
  const userStore = enumValue(
    values,
    'USER_STORE',
    ['memory', 'prisma'] as const,
    nonDevelopment ? 'prisma' : 'memory',
  );
  const gameStore = enumValue(
    values,
    'GAME_STORE',
    ['memory', 'prisma'] as const,
    nonDevelopment ? 'prisma' : 'memory',
  );
  const seasonStore = enumValue(
    values,
    'SEASON_STORE',
    ['memory', 'prisma'] as const,
    nonDevelopment ? 'prisma' : 'memory',
  );
  const rankedStore = enumValue(
    values,
    'RANKED_STORE',
    ['memory', 'prisma'] as const,
    nonDevelopment ? 'prisma' : 'memory',
  );
  const roomStore = enumValue(
    values,
    'ROOM_STORE',
    ['memory', 'redis'] as const,
    nonDevelopment ? 'redis' : 'memory',
  );
  const sessionLookupStore = enumValue(
    values,
    'SESSION_LOOKUP_STORE',
    ['memory', 'redis'] as const,
    nonDevelopment ? 'redis' : 'memory',
  );
  const presenceStore = enumValue(
    values,
    'PRESENCE_STORE',
    ['memory', 'redis'] as const,
    nonDevelopment ? 'redis' : 'memory',
  );
  const casualQueueStore = enumValue(
    values,
    'CASUAL_QUEUE_STORE',
    ['memory', 'redis'] as const,
    nonDevelopment ? 'redis' : 'memory',
  );
  const rankedQueueStore = enumValue(
    values,
    'RANKED_QUEUE_STORE',
    ['memory', 'redis'] as const,
    nonDevelopment ? 'redis' : 'memory',
  );
  const analyticsProvider = enumValue(
    values,
    'ANALYTICS_PROVIDER',
    ['memory', 'external', 'noop'] as const,
    nonDevelopment ? 'noop' : 'memory',
  );
  const metricsEnabled = booleanValue(values, 'METRICS_ENABLED', false);
  const metricsToken = stringValue(values, 'METRICS_TOKEN');
  if (metricsEnabled && nonDevelopment && !metricsToken) {
    throw new Error(
      'METRICS_TOKEN is required when metrics are enabled outside development',
    );
  }
  const minimumSupportedProtocolVersion = numberValue(
    values,
    'MINIMUM_SUPPORTED_PROTOCOL_VERSION',
    1,
  );
  const latestProtocolVersion = numberValue(
    values,
    'LATEST_PROTOCOL_VERSION',
    1,
  );
  const redisKeyPrefix = stringValue(values, 'REDIS_KEY_PREFIX', 'pocha');
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(redisKeyPrefix)) {
    throw new Error('REDIS_KEY_PREFIX must be a short safe namespace');
  }
  const healthTimeoutMs = numberValue(values, 'HEALTH_TIMEOUT_MS', 1500);

  if (latestProtocolVersion < minimumSupportedProtocolVersion) {
    throw new Error(
      'LATEST_PROTOCOL_VERSION must be greater than or equal to MINIMUM_SUPPORTED_PROTOCOL_VERSION',
    );
  }

  if (nonDevelopment) {
    assertDatabaseUrl(requireValue('DATABASE_URL', databaseUrl), appEnv);
    assertRedisUrl(requireValue('REDIS_URL', redisUrl), appEnv);
    if (authProvider !== 'external')
      throw new Error('AUTH_PROVIDER=external is required outside development');
    requireValue('AUTH_ISSUER_URL', authIssuerUrl);
    requireValue('AUTH_AUDIENCE', authAudience);
    if (corsAllowedOrigins.length === 0 || corsAllowedOrigins.includes('*')) {
      throw new Error(
        'CORS_ALLOWED_ORIGINS must explicitly list allowed origins outside development',
      );
    }
    assertSecureCorsOrigins(corsAllowedOrigins, appEnv);
    assertProductionUrl(
      'AUTH_ISSUER_URL',
      requireValue('AUTH_ISSUER_URL', authIssuerUrl),
    );
    assertProductionUrl(
      'PUBLIC_BASE_URL',
      requireValue('PUBLIC_BASE_URL', publicBaseUrl),
    );
    if (enableDebugEndpoints)
      throw new Error(
        'ENABLE_DEBUG_ENDPOINTS must be false outside development',
      );
    if (
      userStore !== 'prisma' ||
      gameStore !== 'prisma' ||
      seasonStore !== 'prisma' ||
      rankedStore !== 'prisma' ||
      roomStore !== 'redis' ||
      sessionLookupStore !== 'redis' ||
      presenceStore !== 'redis' ||
      casualQueueStore !== 'redis' ||
      rankedQueueStore !== 'redis'
    ) {
      throw new Error(
        'Staging and production require Prisma persistence and Redis coordination stores',
      );
    }
  }

  return {
    ...values,
    APP_ENV: appEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    AUTH_PROVIDER: authProvider,
    AUTH_ISSUER_URL: authIssuerUrl,
    AUTH_AUDIENCE: authAudience,
    CORS_ALLOWED_ORIGINS: corsAllowedOrigins.join(','),
    PUBLIC_BASE_URL: publicBaseUrl,
    LOG_LEVEL: logLevel,
    ENABLE_DEBUG_ENDPOINTS: enableDebugEndpoints,
    USER_STORE: userStore,
    GAME_STORE: gameStore,
    SEASON_STORE: seasonStore,
    RANKED_STORE: rankedStore,
    ROOM_STORE: roomStore,
    SESSION_LOOKUP_STORE: sessionLookupStore,
    PRESENCE_STORE: presenceStore,
    CASUAL_QUEUE_STORE: casualQueueStore,
    RANKED_QUEUE_STORE: rankedQueueStore,
    ANALYTICS_PROVIDER: analyticsProvider,
    METRICS_ENABLED: metricsEnabled,
    METRICS_TOKEN: metricsToken,
    MINIMUM_SUPPORTED_PROTOCOL_VERSION: minimumSupportedProtocolVersion,
    LATEST_PROTOCOL_VERSION: latestProtocolVersion,
    REDIS_KEY_PREFIX: redisKeyPrefix,
    HEALTH_TIMEOUT_MS: healthTimeoutMs,
  };
}

export function appConfigFromEnvironment(
  values: Record<string, unknown> = process.env,
): AppConfig {
  const normalized = validateEnvironment(values);
  return {
    appEnv: normalized.APP_ENV as AppEnvironment,
    port: normalized.PORT as number,
    databaseUrl: normalized.DATABASE_URL as string,
    redisUrl: normalized.REDIS_URL as string,
    authProvider: normalized.AUTH_PROVIDER as AuthProvider,
    authIssuerUrl: normalized.AUTH_ISSUER_URL as string,
    authAudience: normalized.AUTH_AUDIENCE as string,
    corsAllowedOrigins: (normalized.CORS_ALLOWED_ORIGINS as string)
      .split(',')
      .filter(Boolean),
    publicBaseUrl: normalized.PUBLIC_BASE_URL as string,
    logLevel: normalized.LOG_LEVEL as LogLevel,
    enableDebugEndpoints: normalized.ENABLE_DEBUG_ENDPOINTS as boolean,
    userStore: normalized.USER_STORE as PersistentStore,
    gameStore: normalized.GAME_STORE as PersistentStore,
    seasonStore: normalized.SEASON_STORE as PersistentStore,
    rankedStore: normalized.RANKED_STORE as PersistentStore,
    roomStore: normalized.ROOM_STORE as EphemeralStore,
    sessionLookupStore: normalized.SESSION_LOOKUP_STORE as EphemeralStore,
    presenceStore: normalized.PRESENCE_STORE as EphemeralStore,
    casualQueueStore: normalized.CASUAL_QUEUE_STORE as EphemeralStore,
    rankedQueueStore: normalized.RANKED_QUEUE_STORE as EphemeralStore,
    analyticsProvider:
      normalized.ANALYTICS_PROVIDER as AppConfig['analyticsProvider'],
    metricsEnabled: normalized.METRICS_ENABLED as boolean,
    metricsToken: normalized.METRICS_TOKEN as string,
    minimumSupportedProtocolVersion:
      normalized.MINIMUM_SUPPORTED_PROTOCOL_VERSION as number,
    latestProtocolVersion: normalized.LATEST_PROTOCOL_VERSION as number,
    redisKeyPrefix: normalized.REDIS_KEY_PREFIX as string,
    healthTimeoutMs: normalized.HEALTH_TIMEOUT_MS as number,
    onlineBidTimeoutMs: numberValue(values, 'ONLINE_BID_TIMEOUT_MS', 20_000),
    onlinePlayTimeoutMs: numberValue(values, 'ONLINE_PLAY_TIMEOUT_MS', 20_000),
    onlineTrumpTimeoutMs: numberValue(
      values,
      'ONLINE_TRUMP_TIMEOUT_MS',
      15_000,
    ),
    onlineDisconnectGraceMs: numberValue(
      values,
      'ONLINE_DISCONNECT_GRACE_MS',
      60_000,
    ),
    onlineRoundResultMs: numberValue(values, 'ONLINE_ROUND_RESULT_MS', 250),
  };
}
