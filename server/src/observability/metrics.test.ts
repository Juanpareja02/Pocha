import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service';

describe('metrics service', () => {
  it('stores bounded low-cardinality counters and gauges', () => {
    const metrics = new MetricsService();

    metrics.increment('connections_accepted', 2);
    metrics.setGauge('active_connections', 3);

    expect(metrics.snapshot()).toEqual({
      'counter.connections_accepted': 2,
      'gauge.active_connections': 3,
    });
  });

  it('rejects unbounded or non-normalized metric names', () => {
    const metrics = new MetricsService();

    expect(() => metrics.increment('connectionsAccepted')).toThrow();
    expect(() => metrics.setGauge('room:ABC123', 1)).toThrow();
  });

  it('exposes a bounded game completion rate from counters', () => {
    const metrics = new MetricsService();

    metrics.increment('games_started', 4);
    metrics.increment('games_completed', 3);

    expect(metrics.snapshot()['gauge.game_completion_rate']).toBe(0.75);
  });
});
