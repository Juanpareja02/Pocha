import { describe, expect, it } from 'vitest';
import { AnalyticsService, InMemoryAnalytics } from './analytics';

describe('AnalyticsService', () => {
  it('emits the stable ranked event vocabulary without an external SDK', () => {
    const port = new InMemoryAnalytics();
    const service = new AnalyticsService(port);
    service.track('ranked_queue_started', {
      userId: 'user-1',
      seasonId: 'season_1',
      properties: { provisional: true },
    });
    service.track('ranked_match_found', { seasonId: 'season_1' });
    expect(port.events.map((event) => event.name)).toEqual([
      'ranked_queue_started',
      'ranked_match_found',
    ]);
    expect(port.events[0].properties?.provisional).toBe(true);
    expect(port.events[0].createdAt).toMatch(/T/);
  });

  it('filters personal and private game properties before export', () => {
    const port = new InMemoryAnalytics();
    const service = new AnalyticsService(port);
    service.track('single_game_finished', {
      properties: {
        durationMs: 120,
        email: 'should-not-leave-process',
        cardCount: 4,
        result: 'win',
      },
    });
    expect(port.events[0]?.properties).toEqual({
      durationMs: 120,
      result: 'win',
    });
  });
});
