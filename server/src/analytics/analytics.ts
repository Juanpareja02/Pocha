import { Inject, Injectable } from '@nestjs/common';
import { ANALYTICS_PORT } from '../realtime/tokens';

export type AnalyticsEventName =
  | 'onboarding_completed'
  | 'calculator_game_started'
  | 'calculator_game_finished'
  | 'single_game_started'
  | 'single_game_finished'
  | 'data_export_requested'
  | 'casual_queue_started'
  | 'casual_queue_finished'
  | 'casual_game_finished'
  | 'ranked_queue_started'
  | 'ranked_queue_finished'
  | 'ranked_queue_cancelled'
  | 'ranked_match_found'
  | 'ranked_game_finished'
  | 'rank_promoted'
  | 'rank_demoted'
  | 'placement_finished'
  | 'ranked_abandonment'
  | 'ranked_disconnect'
  | 'ranked_timeout'
  | 'ranked_invalid_action'
  | 'ranked_action_spam';

export interface AnalyticsEvent {
  readonly name: AnalyticsEventName;
  readonly userId?: string;
  readonly gameId?: string;
  readonly seasonId?: string;
  readonly createdAt: string;
  readonly properties?: Readonly<Record<string, string | number | boolean>>;
}

export interface AnalyticsPort {
  track(event: AnalyticsEvent): void | Promise<void>;
}

export class NoopAnalytics implements AnalyticsPort {
  track(): void {
    // Intentionally empty until an external analytics provider is selected.
  }
}

export class InMemoryAnalytics implements AnalyticsPort {
  readonly events: AnalyticsEvent[] = [];

  track(event: AnalyticsEvent): void {
    this.events.push(event);
  }
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(ANALYTICS_PORT) private readonly port: AnalyticsPort) {}

  track(
    name: AnalyticsEventName,
    details: Omit<AnalyticsEvent, 'name' | 'createdAt'> = {},
  ): void {
    const properties = details.properties
      ? Object.fromEntries(
          Object.entries(details.properties).filter(
            ([key]) =>
              !/(token|password|secret|email|card|hand|rng|private)/i.test(key),
          ),
        )
      : undefined;
    void this.port.track({
      name,
      ...details,
      ...(properties ? { properties } : {}),
      createdAt: new Date().toISOString(),
    });
  }
}
