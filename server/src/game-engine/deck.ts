import { Card, Rank, RandomSource, STANDARD_40_RANKS, SUITS } from './types';

export function createSpanishDeck(
  ranks: readonly Rank[] = STANDARD_40_RANKS,
): Card[] {
  return SUITS.flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${suit}:${rank}`,
      suit,
      rank,
    })),
  );
}

export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const value = random();
    if (value < 0 || value >= 1) {
      throw new RangeError('RandomSource must return a value in [0, 1)');
    }
    const swapIndex = Math.floor(value * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/** Deterministic RNG for tests and local simulations. */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
