import { describe, expect, it } from 'vitest';
import { calculateMultiplayerRatingChanges, rankForElo } from './rating';

describe('multiplayer rating', () => {
  it('rewards the winner and balances the pairwise deltas', () => {
    const changes = calculateMultiplayerRatingChanges(
      [
        { id: 'a', rating: 1000, gamesPlayed: 20 },
        { id: 'b', rating: 1000, gamesPlayed: 20 },
        { id: 'c', rating: 1000, gamesPlayed: 20 },
        { id: 'd', rating: 1000, gamesPlayed: 20 },
      ],
      { a: 1, b: 2, c: 3, d: 4 },
    );
    expect(changes.a).toBeGreaterThan(changes.b);
    expect(changes.d).toBeLessThan(0);
    expect(Object.values(changes).reduce((sum, value) => sum + value, 0)).toBe(
      0,
    );
  });

  it('uses the provisional K factor for new players', () => {
    const changes = calculateMultiplayerRatingChanges(
      [
        { id: 'a', rating: 1000, gamesPlayed: 0 },
        { id: 'b', rating: 1000, gamesPlayed: 0 },
      ],
      { a: 1, b: 2 },
    );
    expect(changes.a).toBe(32);
    expect(changes.b).toBe(-32);
  });

  it('maps ELO to configurable visual ranks', () => {
    expect(rankForElo(1000).name).toBe('Plata');
    expect(rankForElo(2200).name).toBe('Gran Maestro');
  });
});
