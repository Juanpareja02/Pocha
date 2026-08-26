import { rankForElo, RatingService } from '../game-engine';

export interface SeasonSimulationOptions {
  readonly seasons: number;
  readonly gamesPerSeason: number;
  readonly players: number;
  readonly seed: number;
}

export interface SeasonSimulationResult {
  readonly seasons: number;
  readonly gamesPerSeason: number;
  readonly players: number;
  readonly seasonsReport: readonly {
    readonly season: number;
    readonly minRating: number;
    readonly maxRating: number;
    readonly meanRating: number;
    readonly rankDistribution: Readonly<Record<string, number>>;
  }[];
}

interface SeasonPlayer {
  readonly id: string;
  readonly skill: number;
  rating: number;
  games: number;
}

export function runSeasonSimulation(
  options: SeasonSimulationOptions,
): SeasonSimulationResult {
  if (!Number.isInteger(options.seasons) || options.seasons < 1)
    throw new Error('seasons must be positive');
  if (!Number.isInteger(options.gamesPerSeason) || options.gamesPerSeason < 1)
    throw new Error('gamesPerSeason must be positive');
  if (!Number.isInteger(options.players) || options.players < 4)
    throw new Error('players must be at least 4');
  const random = mulberry32(options.seed);
  const players: SeasonPlayer[] = Array.from(
    { length: options.players },
    (_, index) => ({
      id: `season-player-${index.toString().padStart(3, '0')}`,
      skill: 800 + (index / Math.max(1, options.players - 1)) * 800,
      rating: 1000,
      games: 0,
    }),
  );
  const service = new RatingService();
  const seasonsReport: Array<SeasonSimulationResult['seasonsReport'][number]> =
    [];

  for (let season = 1; season <= options.seasons; season += 1) {
    for (let game = 0; game < options.gamesPerSeason; game += 1) {
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
      const results = service.calculate(
        selected.map((player) => ({
          id: player.id,
          rating: player.rating,
          gamesPlayed: player.games,
        })),
        positions,
      );
      for (const result of results) {
        const player = players.find((candidate) => candidate.id === result.id)!;
        player.rating = result.newRating;
        player.games += 1;
      }
    }
    const ratings = players.map((player) => player.rating);
    const rankDistribution: Record<string, number> = {};
    for (const player of players) {
      const rank = rankForElo(player.rating);
      rankDistribution[rank.id] = (rankDistribution[rank.id] ?? 0) + 1;
    }
    seasonsReport.push({
      season,
      minRating: Math.min(...ratings),
      maxRating: Math.max(...ratings),
      meanRating:
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
      rankDistribution,
    });
    for (const player of players) {
      player.rating = Math.round(1000 + 0.75 * (player.rating - 1000));
      player.games = 0;
    }
  }

  return {
    seasons: options.seasons,
    gamesPerSeason: options.gamesPerSeason,
    players: options.players,
    seasonsReport,
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
