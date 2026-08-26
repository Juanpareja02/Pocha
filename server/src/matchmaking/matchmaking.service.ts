import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { AuthPrincipal } from '../auth/auth.service';
import {
  CasualMatchPayload,
  MatchmakingView,
  RoomConfig,
} from '../protocol/protocol';
import {
  MatchmakingEntry,
  MatchmakingQueue,
  PresenceRepository,
} from '../realtime/repositories';
import { MATCHMAKING_QUEUE, PRESENCE_REPOSITORY } from '../realtime/tokens';
import { RoomService } from '../rooms/room.service';
import { UserService } from '../users/user.service';
import { MetricsService } from '../observability/metrics.service';
import { AnalyticsService } from '../analytics/analytics';

@Injectable()
export class MatchmakingService implements OnModuleInit {
  constructor(
    @Inject(MATCHMAKING_QUEUE) private readonly queue: MatchmakingQueue,
    @Inject(PRESENCE_REPOSITORY) private readonly presence: PresenceRepository,
    @Inject(RoomService) private readonly rooms: RoomService,
    @Inject(UserService) private readonly users: UserService,
    @Inject(MetricsService) private readonly metrics?: MetricsService,
    @Inject(AnalyticsService) private readonly analytics?: AnalyticsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.initialize?.();
  }

  async join(
    principal: AuthPrincipal,
    payload: CasualMatchPayload,
  ): Promise<MatchmakingView> {
    if (
      !Number.isInteger(payload.playerCount) ||
      payload.playerCount < 3 ||
      payload.playerCount > 6
    ) {
      throw new BadRequestException('Player count must be between 3 and 6');
    }
    if (payload.rulesetId !== 'classic' && payload.rulesetId !== 'auction') {
      throw new BadRequestException('Unsupported casual ruleset');
    }
    if (payload.rulesetVersion !== 1)
      throw new BadRequestException('Unsupported ruleset version');
    this.users.getOrCreate(principal);
    const presence = this.presence.get(principal.userId);
    if (await this.queue.findByUser(principal.userId)) {
      return { queued: true, queueKey: `casual:${principal.userId}` };
    }
    if (
      presence &&
      [
        'IN_LOBBY',
        'IN_CASUAL_QUEUE',
        'IN_RANKED_QUEUE',
        'IN_GAME',
        'DISCONNECTED',
      ].includes(presence.status)
    ) {
      throw new BadRequestException('User is already in another online flow');
    }
    const entry: MatchmakingEntry = {
      userId: principal.userId,
      playerCount: payload.playerCount,
      rulesetId: payload.rulesetId,
      rulesetVersion: payload.rulesetVersion,
      queuedAt: new Date().toISOString(),
    };
    await this.queue.enqueue(entry);
    this.presence.set(principal.userId, 'IN_CASUAL_QUEUE');
    this.analytics?.track('casual_queue_started', {
      userId: principal.userId,
      properties: {
        playerCount: payload.playerCount,
        rulesetId: payload.rulesetId,
      },
    });
    const match = await this.queue.takeMatch(
      payload.playerCount,
      payload.rulesetId,
      payload.rulesetVersion,
    );
    void this.refreshQueueMetric();
    if (match.length === 0) {
      return { queued: true, queueKey: this.key(entry) };
    }
    for (const candidate of match)
      this.analytics?.track('casual_queue_finished', {
        userId: candidate.userId,
        properties: { matched: true, playerCount: match.length },
      });
    const config: RoomConfig = {
      playerCount: payload.playerCount,
      rulesetId: payload.rulesetId,
      rulesetVersion: payload.rulesetVersion,
      allowBots: false,
      botDifficulty: 'normal',
    };
    const room = this.rooms.createCasual(
      match.map((candidate) => candidate.userId),
      config,
    );
    return { queued: false, queueKey: this.key(entry), room };
  }

  async cancel(principal: AuthPrincipal): Promise<void> {
    const wasQueued = Boolean(await this.queue.findByUser(principal.userId));
    await this.queue.remove(principal.userId);
    void this.refreshQueueMetric();
    if (this.presence.get(principal.userId)?.status === 'IN_CASUAL_QUEUE')
      this.presence.clear(principal.userId);
    if (wasQueued)
      this.analytics?.track('casual_queue_finished', {
        userId: principal.userId,
        properties: { matched: false, cancelled: true },
      });
  }

  async cancelByUser(userId: string): Promise<void> {
    const wasQueued = Boolean(await this.queue.findByUser(userId));
    await this.queue.remove(userId);
    void this.refreshQueueMetric();
    if (this.presence.get(userId)?.status === 'IN_CASUAL_QUEUE')
      this.presence.clear(userId);
    if (wasQueued)
      this.analytics?.track('casual_queue_finished', {
        userId,
        properties: { matched: false, cancelled: true },
      });
  }

  private key(entry: MatchmakingEntry): string {
    return `${entry.rulesetId}:${entry.rulesetVersion}:${entry.playerCount}:${entry.userId}`;
  }

  private async refreshQueueMetric(): Promise<void> {
    if (!this.metrics) return;
    try {
      this.metrics.setGauge(
        'queue_size_casual',
        (await this.queue.entries()).length,
      );
    } catch {
      this.metrics.increment('errors');
    }
  }
}
