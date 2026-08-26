import { runRatingSimulation } from './rating-simulation';

const args = parseArgs(process.argv.slice(2));
const result = runRatingSimulation({
  games: numberArg(args.games, 10_000),
  players: numberArg(args.players, 100),
  seed: numberArg(args.seed, 20260825),
});
console.log(
  args.json === 'true'
    ? JSON.stringify(result, null, 2)
    : [
        `Simulación rating: ${result.games} partidas / ${result.players} jugadores`,
        `Media: ${result.mean.toFixed(2)} · mediana: ${result.median}`,
        `Desviación estándar: ${result.standardDeviation.toFixed(2)}`,
        `Mínimo/máximo: ${result.min}/${result.max}`,
        `Movimiento medio absoluto: ${result.averageAbsoluteMovement.toFixed(2)}`,
        `Movimiento provisional medio: ${result.averageProvisionalMovement.toFixed(2)}`,
        `Movimiento máximo: ${result.maxAbsoluteMovement}`,
        `Partidas provisionales contabilizadas: ${result.provisionalGames}`,
        `Rangos: ${JSON.stringify(result.rankDistribution)}`,
      ].join('\n'),
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
    if (values[0]) result.games = values[0];
    if (values[1]) result.players = values[1];
    if (values[2]) result.seed = values[2];
  }
  return result;
}

function numberArg(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
