import { describe, expect, it } from 'vitest';
import { RatingService } from '../game-engine';
import { DEFAULT_RATING_CONFIG } from '../game-engine/rating';

describe('ranked RatingService', () => {
  const service = new RatingService(DEFAULT_RATING_CONFIG);

  it('is pairwise, normalized and zero-sum for four equal players', () => {
    const result = service.calculate(
      [1, 2, 3, 4].map((id) => ({
        id: `${id}`,
        rating: 1000,
        gamesPlayed: 20,
      })),
      { '1': 1, '2': 2, '3': 3, '4': 4 },
    );
    expect(result[0].delta).toBeGreaterThan(result[1].delta);
    expect(result[3].delta).toBeLessThan(0);
    expect(result.reduce((sum, item) => sum + item.delta, 0)).toBe(0);
  });

  it('uses stronger volatility for placements and lets an underdog gain more', () => {
    const result = service.calculate(
      [
        { id: 'favorite', rating: 1400, gamesPlayed: 20 },
        { id: 'newcomer', rating: 1000, gamesPlayed: 0 },
      ],
      { favorite: 2, newcomer: 1 },
    );
    expect(
      result.find((item) => item.id === 'newcomer')!.delta,
    ).toBeGreaterThan(0);
    expect(result.find((item) => item.id === 'newcomer')!.provisional).toBe(
      true,
    );
    expect(result.find((item) => item.id === 'favorite')!.delta).toBeLessThan(
      0,
    );
  });

  it('covers favorite wins and favorite losses with the established K factor', () => {
    const favoriteWins = service.calculate(
      [
        { id: 'favorite', rating: 1400, gamesPlayed: 20 },
        { id: 'challenger', rating: 1000, gamesPlayed: 20 },
      ],
      { favorite: 1, challenger: 2 },
    );
    expect(favoriteWins.find((item) => item.id === 'favorite')!.delta).toBe(3);

    const favoriteLoses = service.calculate(
      [
        { id: 'favorite', rating: 1400, gamesPlayed: 20 },
        { id: 'challenger', rating: 1000, gamesPlayed: 20 },
      ],
      { favorite: 2, challenger: 1 },
    );
    expect(favoriteLoses.find((item) => item.id === 'favorite')!.delta).toBe(
      -29,
    );

    const established = service.calculate(
      [
        { id: 'a', rating: 1000, gamesPlayed: 20 },
        { id: 'b', rating: 1000, gamesPlayed: 20 },
      ],
      { a: 1, b: 2 },
    );
    const provisional = service.calculate(
      [
        { id: 'a', rating: 1000, gamesPlayed: 0 },
        { id: 'b', rating: 1000, gamesPlayed: 0 },
      ],
      { a: 1, b: 2 },
    );
    expect(established.find((item) => item.id === 'a')!.delta).toBe(16);
    expect(provisional.find((item) => item.id === 'a')!.delta).toBe(32);
  });

  it('uses a half result for ties and preserves exact conservation after rounding', () => {
    const result = service.calculate(
      [
        { id: 'a', rating: 1000, gamesPlayed: 20 },
        { id: 'b', rating: 1000, gamesPlayed: 20 },
        { id: 'c', rating: 1100, gamesPlayed: 20 },
        { id: 'd', rating: 900, gamesPlayed: 20 },
      ],
      { a: 1, b: 1, c: 3, d: 4 },
    );
    expect(result.reduce((sum, item) => sum + item.delta, 0)).toBe(0);
    expect(
      result.find((item) => item.id === 'a')!.delta,
    ).toBeGreaterThanOrEqual(-32);
  });
});
