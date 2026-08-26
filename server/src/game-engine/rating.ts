export interface RatedPlayer {
  readonly id: string;
  readonly rating: number;
  readonly gamesPlayed: number;
}

export interface RatingConfig {
  readonly defaultKFactor: number;
  readonly provisionalKFactor: number;
  readonly provisionalGames: number;
  readonly normalization: number;
}

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  defaultKFactor: 32,
  provisionalKFactor: 64,
  provisionalGames: 10,
  normalization: 1,
};

export interface RatingPlayerResult {
  readonly id: string;
  readonly oldRating: number;
  readonly newRating: number;
  readonly delta: number;
  readonly provisional: boolean;
}

function roundedZeroSumDeltas(
  players: readonly RatedPlayer[],
  rawChanges: Readonly<Record<string, number>>,
): Record<string, number> {
  const deltas = Object.fromEntries(
    players.map((player) => [player.id, Math.round(rawChanges[player.id])]),
  );
  let remainder = -Object.values(deltas).reduce((sum, value) => sum + value, 0);
  if (remainder === 0) return deltas;

  const candidates = [...players].sort((left, right) => {
    const leftFraction = Math.abs(rawChanges[left.id] - deltas[left.id]);
    const rightFraction = Math.abs(rawChanges[right.id] - deltas[right.id]);
    return rightFraction - leftFraction || left.id.localeCompare(right.id);
  });
  let index = 0;
  while (remainder !== 0) {
    const player = candidates[index % candidates.length];
    deltas[player.id] += remainder > 0 ? 1 : -1;
    remainder += remainder > 0 ? -1 : 1;
    index += 1;
  }
  return deltas;
}

export function calculateMultiplayerRatingChanges(
  players: readonly RatedPlayer[],
  positions: Readonly<Record<string, number>>,
  config: RatingConfig = DEFAULT_RATING_CONFIG,
): Record<string, number> {
  if (players.length < 2) throw new Error('At least two players are required');
  const changes = Object.fromEntries(players.map((player) => [player.id, 0]));
  for (let leftIndex = 0; leftIndex < players.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < players.length;
      rightIndex += 1
    ) {
      const left = players[leftIndex];
      const right = players[rightIndex];
      const leftPosition = positions[left.id];
      const rightPosition = positions[right.id];
      if (leftPosition === undefined || rightPosition === undefined) {
        throw new Error('Every player needs a final position');
      }
      const expectedLeft = 1 / (1 + 10 ** ((right.rating - left.rating) / 400));
      const outcomeLeft =
        leftPosition === rightPosition
          ? 0.5
          : leftPosition < rightPosition
            ? 1
            : 0;
      const leftK =
        left.gamesPlayed < config.provisionalGames
          ? config.provisionalKFactor
          : config.defaultKFactor;
      const rightK =
        right.gamesPlayed < config.provisionalGames
          ? config.provisionalKFactor
          : config.defaultKFactor;
      const pairK = (leftK + rightK) / 2;
      const pairDelta = pairK * (outcomeLeft - expectedLeft);
      changes[left.id] += pairDelta;
      changes[right.id] -= pairDelta;
    }
  }
  const divisor = Math.max(1, (players.length - 1) * config.normalization);
  const rawChanges = Object.fromEntries(
    Object.entries(changes).map(([id, change]) => [id, change / divisor]),
  );
  return roundedZeroSumDeltas(players, rawChanges);
}

export class RatingService {
  constructor(private readonly config: RatingConfig = DEFAULT_RATING_CONFIG) {}

  calculate(
    players: readonly RatedPlayer[],
    positions: Readonly<Record<string, number>>,
  ): readonly RatingPlayerResult[] {
    const deltas = calculateMultiplayerRatingChanges(
      players,
      positions,
      this.config,
    );
    return players.map((player) => ({
      id: player.id,
      oldRating: player.rating,
      newRating: Math.max(0, player.rating + deltas[player.id]),
      delta: deltas[player.id],
      provisional: player.gamesPlayed < this.config.provisionalGames,
    }));
  }

  get ratingConfig(): RatingConfig {
    return this.config;
  }
}

export interface RankDefinition {
  readonly id: string;
  readonly name: string;
  readonly minimumElo: number;
  readonly order: number;
}

export const DEFAULT_RANKS: readonly RankDefinition[] = [
  { id: 'bronze', name: 'Bronce', minimumElo: 0, order: 0 },
  { id: 'silver', name: 'Plata', minimumElo: 1000, order: 1 },
  { id: 'gold', name: 'Oro', minimumElo: 1200, order: 2 },
  { id: 'platinum', name: 'Platino', minimumElo: 1400, order: 3 },
  { id: 'diamond', name: 'Diamante', minimumElo: 1600, order: 4 },
  { id: 'master', name: 'Maestro', minimumElo: 1800, order: 5 },
  { id: 'grand-master', name: 'Gran Maestro', minimumElo: 2000, order: 6 },
];

export function rankForElo(
  elo: number,
  ranks: readonly RankDefinition[] = DEFAULT_RANKS,
): RankDefinition {
  return (
    [...ranks]
      .sort((a, b) => b.minimumElo - a.minimumElo)
      .find((rank) => elo >= rank.minimumElo) ?? ranks[0]
  );
}
