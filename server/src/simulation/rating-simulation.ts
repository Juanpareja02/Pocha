import { rankForElo, RatingService } from '../game-engine';

export interface RatingSimulationOptions {
  readonly games: number;
  readonly players: number;
  readonly seed: number;
}

export interface RatingSimulationResult {
  readonly games: number;
  readonly players: number;
  readonly mean: number;
  readonly median: number;
  readonly standardDeviation: number;
  readonly min: number;
  readonly max: number;
  readonly averageAbsoluteMovement: number;
  readonly averageProvisionalMovement: number;
  readonly maxAbsoluteMovement: number;
  readonly provisionalGames: number;
  readonly rankDistribution: Readonly<Record<string, number>>;
}

interface SimulatedPlayer {
  readonly id: string;
  readonly skill: number;
  rating: number;
  gamesPlayed: number;
  movement: number;
  maxMovement: number;
}

export function runRatingSimulation(
  options: RatingSimulationOptions,
): RatingSimulationResult {
  if (!Number.isInteger(options.games) || options.games < 1)
    throw new Error('games must be positive');
  if (!Number.isInteger(options.players) || options.players < 4)
    throw new Error('players must be at least 4');
  const random = mulberry32(options.seed);
  const players: SimulatedPlayer[] = Array.from(
    { length: options.players },
    (_, index) => ({
      id: `sim-${index.toString().padStart(4, '0')}`,
      skill: 800 + (index / Math.max(1, options.players - 1)) * 800,
      rating: 1000,
      gamesPlayed: 0,
      movement: 0,
      maxMovement: 0,
    }),
  );
  const service = new RatingService();
  let provisionalMovement = 0;
  let provisionalResults = 0;

  for (let game = 0; game < options.games; game += 1) {
    const selected = chooseFour(players, random);
    const ordered = [...selected].sort((left, right) => {
      const leftPerformance = left.skill + (random() - 0.5) * 500;
      const rightPerformance = right.skill + (random() - 0.5) * 500;
      return (
        rightPerformance - leftPerformance || left.id.localeCompare(right.id)
      );
    });
    const positions = Object.fromEntries(
      ordered.map((player, index) => [player.id, index + 1]),
    );
    const changes = service.calculate(
      selected.map((player) => ({
        id: player.id,
        rating: player.rating,
        gamesPlayed: player.gamesPlayed,
      })),
      positions,
    );
    for (const result of changes) {
      const player = players.find((candidate) => candidate.id === result.id)!;
      player.rating = result.newRating;
      player.gamesPlayed += 1;
      player.movement += Math.abs(result.delta);
      player.maxMovement = Math.max(player.maxMovement, Math.abs(result.delta));
      if (result.provisional) {
        provisionalMovement += Math.abs(result.delta);
        provisionalResults += 1;
      }
    }
  }

  const ratings = players
    .map((player) => player.rating)
    .sort((left, right) => left - right);
  const mean =
    ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  const standardDeviation = Math.sqrt(
    ratings.reduce((sum, rating) => sum + (rating - mean) ** 2, 0) /
      ratings.length,
  );
  const rankDistribution: Record<string, number> = {};
  for (const player of players) {
    const rank = rankForElo(player.rating);
    rankDistribution[rank.id] = (rankDistribution[rank.id] ?? 0) + 1;
  }
  return {
    games: options.games,
    players: options.players,
    mean,
    median: ratings[Math.floor(ratings.length / 2)],
    standardDeviation,
    min: ratings[0],
    max: ratings[ratings.length - 1],
    averageAbsoluteMovement:
      players.reduce((sum, player) => sum + player.movement, 0) /
      players.length,
    averageProvisionalMovement:
      provisionalResults === 0 ? 0 : provisionalMovement / provisionalResults,
    maxAbsoluteMovement: Math.max(
      ...players.map((player) => player.maxMovement),
    ),
    provisionalGames: players.reduce(
      (sum, player) => sum + Math.min(player.gamesPlayed, 10),
      0,
    ),
    rankDistribution,
  };
}

function chooseFour<T>(values: readonly T[], random: () => number): T[] {
  const pool = [...values];
  const selected: T[] = [];
  while (selected.length < 4)
    selected.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return selected;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
