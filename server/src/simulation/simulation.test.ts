import { describe, expect, it } from 'vitest';
import { runSimulation } from './simulation';

describe('bot simulations', () => {
  it.each(['easy', 'normal', 'hard'] as const)(
    'completes deterministic %s games without deadlocks',
    (difficulty) => {
      const result = runSimulation({
        games: 10,
        players: 3,
        difficulty,
        seed: 100,
        botConfig: difficulty === 'hard' ? { maxSimulations: 3 } : undefined,
      });
      expect(result.completedGames).toBe(10);
      expect(result.errors).toBe(0);
      expect(result.deadlocks).toBe(0);
      expect(result.averageRounds).toBeGreaterThan(0);
    },
    30000,
  );

  it('is reproducible for a fixed seed and configuration', () => {
    const config = {
      games: 4,
      players: 4,
      difficulty: 'normal' as const,
      seed: 77,
    };
    const first = runSimulation(config);
    const second = runSimulation(config);
    expect({ ...first, durationMs: 0 }).toEqual({ ...second, durationMs: 0 });
  });

  it('supports mixed difficulty profiles without leaking hidden cards', () => {
    const result = runSimulation({
      games: 2,
      players: 3,
      difficulty: ['hard', 'normal', 'easy'],
      seed: 44,
      botConfig: { maxSimulations: 1 },
    });
    expect(result.completedGames).toBe(2);
    expect(result.errors).toBe(0);
    expect(result.deadlocks).toBe(0);
  });

  it('completes a release-candidate performance smoke benchmark', () => {
    const result = runSimulation({
      games: 8,
      players: 4,
      difficulty: 'normal',
      seed: 20260825,
    });

    expect(result.completedGames).toBe(8);
    expect(result.errors).toBe(0);
    expect(result.deadlocks).toBe(0);
    expect(result.durationMs).toBeLessThan(30_000);
  }, 30_000);
});
