import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();

  increment(name: string, amount = 1): void {
    this.assertName(name);
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  setGauge(name: string, value: number): void {
    this.assertName(name);
    this.gauges.set(name, value);
  }

  snapshot(): Readonly<Record<string, number>> {
    const snapshot = Object.fromEntries([
      ...[...this.counters.entries()].map(([key, value]) => [
        `counter.${key}`,
        value,
      ]),
      ...[...this.gauges.entries()].map(([key, value]) => [
        `gauge.${key}`,
        value,
      ]),
    ]);
    const gamesStarted = this.counters.get('games_started');
    if (gamesStarted !== undefined && gamesStarted > 0) {
      snapshot['gauge.game_completion_rate'] = Math.min(
        1,
        (this.counters.get('games_completed') ?? 0) / gamesStarted,
      );
    }
    return snapshot;
  }

  private assertName(name: string): void {
    if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(name)) {
      throw new Error('Metric names must be bounded and low-cardinality');
    }
  }
}
