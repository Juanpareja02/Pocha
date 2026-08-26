import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { AuthController } from './auth/auth.controller';
import {
  AuthService,
  ExternalTokenVerifier,
  FirebaseTokenVerifier,
} from './auth/auth.service';
import { FirebaseAdminVerifier } from './auth/firebase-admin.adapter';
import { GameSessionManager } from './game-sessions/game-session.manager';
import { MatchmakingService } from './matchmaking/matchmaking.service';
import {
  InMemoryOnlineGameRepository,
  PrismaOnlineGameRepository,
} from './games/online-game.repository';
import { OnlineGateway } from './realtime/online.gateway';
import {
  RedisRealtimeRateLimiter,
  RealtimeRateLimiter,
} from './realtime/rate-limiter';
import {
  InMemoryPresenceRepository,
  InMemorySessionLookupRepository,
  InMemoryMatchmakingQueue,
  InMemoryRoomRepository,
  RedisMatchmakingQueue,
  RedisPresenceRepository,
  RedisRoomRepository,
  RedisSessionLookupRepository,
} from './realtime/repositories';
import {
  MATCHMAKING_QUEUE,
  ONLINE_GAME_REPOSITORY,
  PRESENCE_REPOSITORY,
  ROOM_REPOSITORY,
  SESSION_LOOKUP,
  USER_REPOSITORY,
  RANKED_QUEUE,
  RANKED_REPOSITORY,
  RANKED_SEASON_REPOSITORY,
  ANALYTICS_PORT,
  AUTH_TOKEN_VERIFIER,
  PRISMA_CLIENT,
} from './realtime/tokens';
import { RoomService } from './rooms/room.service';
import { UserController } from './users/user.controller';
import {
  InMemoryUserRepository,
  PrismaUserRepository,
} from './users/user.repository';
import { UserService } from './users/user.service';
import { PrismaClient } from '@prisma/client';
import { RankedController } from './ranked/ranked.controller';
import { SeasonController } from './ranked/season.controller';
import { RankedMatchmakingService } from './ranked/ranked-matchmaking.service';
import { MatchQualityService } from './ranked/match-quality.service';
import { InMemoryRankedQueue, RedisRankedQueue } from './ranked/ranked.queue';
import {
  InMemoryRankedRepository,
  PrismaRankedRepository,
} from './ranked/ranked.repository';
import {
  InMemorySeasonRepository,
  PrismaSeasonRepository,
} from './ranked/season.repository';
import { RankedResultService } from './ranked/ranked-result.service';
import { RankedAbusePolicyService } from './ranked/abuse-policy.service';
import { LeaderboardService } from './ranked/leaderboard.service';
import { SeasonService } from './ranked/season.service';
import {
  AnalyticsService,
  InMemoryAnalytics,
  NoopAnalytics,
} from './analytics/analytics';
import { validateEnvironment } from './config/app-config';
import { InfrastructureHealthService } from './infrastructure/infrastructure-health.service';
import { PrismaClientManager } from './infrastructure/prisma-client.provider';
import { MetricsService } from './observability/metrics.service';
import { MetricsController } from './observability/metrics.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [
    HealthController,
    AuthController,
    UserController,
    RankedController,
    SeasonController,
    MetricsController,
  ],
  providers: [
    AuthService,
    UserService,
    RoomService,
    MatchmakingService,
    RankedMatchmakingService,
    MatchQualityService,
    RankedResultService,
    RankedAbusePolicyService,
    LeaderboardService,
    SeasonService,
    AnalyticsService,
    InfrastructureHealthService,
    MetricsService,
    PrismaClientManager,
    GameSessionManager,
    OnlineGateway,
    {
      provide: RealtimeRateLimiter,
      useFactory: (config: ConfigService) =>
        config.get<string>('APP_ENV') === 'development'
          ? new RealtimeRateLimiter()
          : new RedisRealtimeRateLimiter(
              config.getOrThrow<string>('REDIS_URL'),
              config.get<string>('REDIS_KEY_PREFIX', 'pocha'),
            ),
      inject: [ConfigService],
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: PRISMA_CLIENT,
      useFactory: (manager: PrismaClientManager) => manager.client,
      inject: [PrismaClientManager],
    },
    {
      provide: ANALYTICS_PORT,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('ANALYTICS_PROVIDER');
        return provider === 'memory'
          ? new InMemoryAnalytics()
          : new NoopAnalytics();
      },
      inject: [ConfigService],
    },
    {
      provide: AUTH_TOKEN_VERIFIER,
      useFactory: (config: ConfigService) => {
        if (config.get<string>('AUTH_PROVIDER') !== 'external') {
          return new ExternalTokenVerifier();
        }
        return new ExternalTokenVerifier(
          new FirebaseTokenVerifier(
            new FirebaseAdminVerifier(
              config.getOrThrow<string>('AUTH_AUDIENCE'),
              config.getOrThrow<string>('AUTH_ISSUER_URL'),
            ),
          ),
        );
      },
      inject: [ConfigService],
    },
    {
      provide: USER_REPOSITORY,
      useFactory: (config: ConfigService, prisma: PrismaClient) =>
        config.get<string>('USER_STORE') === 'prisma'
          ? new PrismaUserRepository(prisma)
          : new InMemoryUserRepository(),
      inject: [ConfigService, PRISMA_CLIENT],
    },
    {
      provide: ROOM_REPOSITORY,
      useFactory: (config: ConfigService) =>
        config.get<string>('ROOM_STORE') === 'redis'
          ? new RedisRoomRepository(
              config.getOrThrow<string>('REDIS_URL'),
              config.get<string>('REDIS_KEY_PREFIX', 'pocha'),
            )
          : new InMemoryRoomRepository(),
      inject: [ConfigService],
    },
    {
      provide: SESSION_LOOKUP,
      useFactory: (config: ConfigService) =>
        config.get<string>('SESSION_LOOKUP_STORE') === 'redis'
          ? new RedisSessionLookupRepository(
              config.getOrThrow<string>('REDIS_URL'),
              config.get<string>('REDIS_KEY_PREFIX', 'pocha'),
            )
          : new InMemorySessionLookupRepository(),
      inject: [ConfigService],
    },
    {
      provide: PRESENCE_REPOSITORY,
      useFactory: (config: ConfigService) =>
        config.get<string>('PRESENCE_STORE') === 'redis'
          ? new RedisPresenceRepository(
              config.getOrThrow<string>('REDIS_URL'),
              config.get<string>('REDIS_KEY_PREFIX', 'pocha'),
            )
          : new InMemoryPresenceRepository(),
      inject: [ConfigService],
    },
    {
      provide: ONLINE_GAME_REPOSITORY,
      useFactory: (config: ConfigService, prisma: PrismaClient) => {
        if (config.get<string>('GAME_STORE') === 'prisma') {
          return new PrismaOnlineGameRepository(prisma);
        }
        return new InMemoryOnlineGameRepository();
      },
      inject: [ConfigService, PRISMA_CLIENT],
    },
    {
      provide: MATCHMAKING_QUEUE,
      useFactory: (config: ConfigService) =>
        config.get<string>('CASUAL_QUEUE_STORE') === 'redis'
          ? new RedisMatchmakingQueue(
              config.getOrThrow<string>('REDIS_URL'),
              config.get<string>('REDIS_KEY_PREFIX', 'pocha'),
            )
          : new InMemoryMatchmakingQueue(),
      inject: [ConfigService],
    },
    {
      provide: RANKED_QUEUE,
      useFactory: (config: ConfigService) =>
        config.get<string>('RANKED_QUEUE_STORE') === 'redis'
          ? new RedisRankedQueue(
              config.getOrThrow<string>('REDIS_URL'),
              new MatchQualityService(),
              config.get<string>('REDIS_KEY_PREFIX', 'pocha'),
            )
          : new InMemoryRankedQueue(),
      inject: [ConfigService],
    },
    {
      provide: RANKED_SEASON_REPOSITORY,
      useFactory: (config: ConfigService, prisma: PrismaClient) =>
        config.get<string>('SEASON_STORE') === 'prisma'
          ? new PrismaSeasonRepository(prisma)
          : new InMemorySeasonRepository(),
      inject: [ConfigService, PRISMA_CLIENT],
    },
    {
      provide: RANKED_REPOSITORY,
      useFactory: (config: ConfigService, prisma: PrismaClient) =>
        config.get<string>('RANKED_STORE') === 'prisma'
          ? new PrismaRankedRepository(prisma)
          : new InMemoryRankedRepository(),
      inject: [ConfigService, PRISMA_CLIENT],
    },
  ],
})
export class AppModule {}
