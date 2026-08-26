import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { AuthPrincipal } from '../auth/auth.service';
import {
  RankedMatchPayload,
  RankedMatchmakingView,
} from '../protocol/protocol';
import { PRESENCE_REPOSITORY, RANKED_QUEUE } from '../realtime/tokens';
import { PresenceRepository } from '../realtime/repositories';
import { RoomService } from '../rooms/room.service';
import { UserService } from '../users/user.service';
import { MatchQualityService } from './match-quality.service';
import { RankedQueue } from './ranked.queue';
import {
  RANKED_PLAYER_COUNT,
  RANKED_RULESET_ID,
  RANKED_RULESET_VERSION,
  RankedQueueEntry,
} from './ranked.types';
import { SeasonService } from './season.service';
import { AnalyticsService, NoopAnalytics } from '../analytics/analytics';
import { MetricsService } from '../observability/metrics.service';

@Injectable()
export class RankedMatchmakingService implements OnModuleInit {
  constructor(
    @Inject(RANKED_QUEUE) private readonly queue: RankedQueue,
    @Inject(PRESENCE_REPOSITORY) private readonly presence: PresenceRepository,
    @Inject(RoomService) private readonly rooms: RoomService,
    @Inject(UserService) private readonly users: UserService,
    @Inject(SeasonService) private readonly seasons: SeasonService,
    @Inject(MatchQualityService) private readonly quality: MatchQualityService,
    @Inject(AnalyticsService)
    private readonly analytics: AnalyticsService = new AnalyticsService(
      new NoopAnalytics(),
    ),
    @Inject(MetricsService) private readonly metrics?: MetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.initialize?.();
  }

  async join(
    principal: AuthPrincipal,
    payload: RankedMatchPayload,
  ): Promise<RankedMatchmakingView> {
    if (principal.isGuest)
      throw new BadRequestException('Ranked requires a permanent account');
    if (
      payload.rulesetId !== RANKED_RULESET_ID ||
      (payload.rulesetVersion ?? RANKED_RULESET_VERSION) !==
        RANKED_RULESET_VERSION
    ) {
      throw new BadRequestException('Unsupported ranked ruleset');
    }
    const season = this.seasons.requireActive();
    const quality = this.quality.forConfig(season.matchmaking);
    const user = this.users.getOrCreate(principal);
    if (
      user.queuePenaltyUntil &&
      Date.parse(user.queuePenaltyUntil) > Date.now()
    ) {
      throw new ConflictException('Ranked queue cooldown is active');
    }
    const current = this.presence.get(user.id);
    const existing = await this.queue.findByUser(user.id);
    if (existing) return this.view(existing, true);
    if (
      current &&
      ['IN_LOBBY', 'IN_CASUAL_QUEUE', 'IN_GAME', 'DISCONNECTED'].includes(
        current.status,
      )
    ) {
      throw new ConflictException('User is already in another online flow');
    }
    const entry: RankedQueueEntry = {
      userId: user.id,
      seasonId: season.id,
      rulesetId: RANKED_RULESET_ID,
      rulesetVersion: RANKED_RULESET_VERSION,
      rating: user.elo,
      gamesPlayed: user.rankedGamesPlayed,
      provisional: user.rankedGamesPlayed < season.placementGames,
      queuedAt: new Date().toISOString(),
      region: payload.region,
    };
    await this.queue.enqueue(entry);
    void this.refreshQueueMetric();
    this.presence.set(user.id, 'IN_RANKED_QUEUE');
    this.analytics.track('ranked_queue_started', {
      userId: user.id,
      seasonId: season.id,
      properties: { provisional: entry.provisional, rating: entry.rating },
    });
    const match = await this.queue.takeMatch(entry, Date.now(), quality);
    if (match.length !== RANKED_PLAYER_COUNT) return this.view(entry, true);
    for (const candidate of match)
      this.analytics.track('ranked_queue_finished', {
        userId: candidate.userId,
        seasonId: season.id,
        properties: { matched: true, playerCount: match.length },
      });
    void this.refreshQueueMetric();
    const room = this.rooms.createRanked(
      match.map((candidate) => candidate.userId),
      season.id,
    );
    for (const candidate of match)
      this.presence.set(candidate.userId, 'IN_LOBBY', room.roomId);
    this.analytics.track('ranked_match_found', {
      seasonId: season.id,
      properties: { playerCount: match.length },
    });
    return {
      queued: false,
      queueKey: this.key(entry),
      seasonId: season.id,
      range: Math.max(
        ...match.map((candidate) =>
          quality.allowedRatingDifference(
            Date.now() - Date.parse(candidate.queuedAt),
          ),
        ),
      ),
      queuedAt: entry.queuedAt,
      room,
    };
  }

  async cancel(principal: AuthPrincipal): Promise<void> {
    const existing = await this.queue.findByUser(principal.userId);
    await this.queue.remove(principal.userId);
    void this.refreshQueueMetric();
    const current = this.presence.get(principal.userId);
    if (current?.status === 'IN_RANKED_QUEUE')
      this.presence.clear(principal.userId);
    if (existing) {
      this.analytics.track('ranked_queue_finished', {
        userId: principal.userId,
        seasonId: existing.seasonId,
        properties: { matched: false, cancelled: true },
      });
      this.analytics.track('ranked_queue_cancelled', {
        userId: principal.userId,
        seasonId: existing.seasonId,
      });
    }
  }

  async cancelByUser(userId: string): Promise<void> {
    const existing = await this.queue.findByUser(userId);
    await this.queue.remove(userId);
    void this.refreshQueueMetric();
    const current = this.presence.get(userId);
    if (current?.status === 'IN_RANKED_QUEUE') this.presence.clear(userId);
    if (existing) {
      this.analytics.track('ranked_queue_finished', {
        userId,
        seasonId: existing.seasonId,
        properties: { matched: false, cancelled: true },
      });
      this.analytics.track('ranked_queue_cancelled', {
        userId,
        seasonId: existing.seasonId,
      });
    }
  }

  async status(userId: string): Promise<RankedMatchmakingView | undefined> {
    const entry = await this.queue.findByUser(userId);
    return entry ? this.view(entry, true) : undefined;
  }

  private view(
    entry: RankedQueueEntry,
    queued: boolean,
  ): RankedMatchmakingView {
    const season = this.seasons.find(entry.seasonId);
    const quality = this.quality.forConfig(season.matchmaking);
    return {
      queued,
      queueKey: this.key(entry),
      seasonId: entry.seasonId,
      range: quality.allowedRatingDifference(
        Date.now() - Date.parse(entry.queuedAt),
      ),
      queuedAt: entry.queuedAt,
    };
  }

  private key(entry: RankedQueueEntry): string {
    return `ranked:${entry.seasonId}:${entry.rulesetId}:${entry.userId}`;
  }

  private async refreshQueueMetric(): Promise<void> {
    if (!this.metrics) return;
    try {
      this.metrics.setGauge(
        'queue_size_ranked',
        (await this.queue.entries()).length,
      );
    } catch {
      this.metrics.increment('errors');
    }
  }
}
