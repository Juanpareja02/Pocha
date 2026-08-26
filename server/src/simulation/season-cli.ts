import { runSeasonSimulation } from './season-simulation';

const args = parseArgs(process.argv.slice(2));
const result = runSeasonSimulation({
  seasons: numberArg(args.seasons, 3),
  gamesPerSeason: numberArg(args.games, 3_000),
  players: numberArg(args.players, 100),
  seed: numberArg(args.seed, 20260825),
});
console.log(
  args.json === 'true'
    ? JSON.stringify(result, null, 2)
    : result.seasonsReport
        .map((season) =>
          [
            `Temporada ${season.season}: ${result.gamesPerSeason} partidas`,
            `Media: ${season.meanRating.toFixed(2)} · mínimo/máximo: ${season.minRating}/${season.maxRating}`,
            `Rangos: ${JSON.stringify(season.rankDistribution)}`,
          ].join('\n'),
        )
        .join('\n'),
);

function parseArgs(values: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    if (!values[index].startsWith('--')) continue;
    const [key, inline] = values[index].slice(2).split('=', 2);
    result[key] = inline ?? values[index + 1] ?? 'true';
    if (inline === undefined) index += 1;
  }
  if (Object.keys(result).length === 0) {
    if (values[0]) result.seasons = values[0];
    if (values[1]) result.games = values[1];
    if (values[2]) result.players = values[2];
    if (values[3]) result.seed = values[3];
  }
  return result;
}

function numberArg(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
