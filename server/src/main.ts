import 'reflect-metadata';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { isRenderRuntime, SERVER_BIND_ADDRESS } from './config/runtime';

const LOG_LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type RuntimeLogLevel = keyof typeof LOG_LEVEL_ORDER;

function logLevelAllows(configured: RuntimeLogLevel, level: RuntimeLogLevel) {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[configured];
}

function writeLog(
  configured: RuntimeLogLevel,
  level: RuntimeLogLevel,
  payload: Record<string, unknown>,
): void {
  if (!logLevelAllows(configured, level)) return;
  const line = JSON.stringify({ level, ...payload });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const appEnv = config.get<string>('APP_ENV', 'development');
  const configuredLogLevel = config.get<RuntimeLogLevel>('LOG_LEVEL', 'debug');
  const allowedOrigins = (config.get<string>('CORS_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(helmet());
  if (appEnv !== 'development' && isRenderRuntime()) {
    // Render terminates TLS and forwards one trusted proxy hop. This keeps
    // Express/Nest rate limiting based on the real client IP.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.enableCors({
    origin: appEnv === 'development' ? true : allowedOrigins,
    credentials: appEnv !== 'development',
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: appEnv === 'production',
    }),
  );
  app.use(
    (
      request: {
        headers: Record<string, string | string[] | undefined>;
        method: string;
        originalUrl?: string;
        url: string;
      },
      response: {
        statusCode: number;
        setHeader(name: string, value: string): void;
        on(event: string, listener: () => void): void;
      },
      next: () => void,
    ) => {
      const rawRequestId = request.headers['x-request-id'];
      const requestId =
        typeof rawRequestId === 'string' &&
        /^[a-zA-Z0-9._-]{1,80}$/.test(rawRequestId)
          ? rawRequestId
          : randomUUID();
      response.setHeader('x-request-id', requestId);
      const startedAt = Date.now();
      response.on('finish', () => {
        const level: RuntimeLogLevel =
          response.statusCode >= 500
            ? 'error'
            : response.statusCode >= 400
              ? 'warn'
              : 'info';
        writeLog(configuredLogLevel, level, {
          event: 'http_request',
          requestId,
          method: request.method,
          path: request.originalUrl ?? request.url,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        });
      });
      next();
    },
  );
  await app.listen(config.get<number>('PORT', 3000), SERVER_BIND_ADDRESS);
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown bootstrap error';
  writeLog('error', 'error', { event: 'bootstrap_failed', message });
  process.exitCode = 1;
});
