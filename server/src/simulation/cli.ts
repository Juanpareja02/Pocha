import { BotDifficulty, DEFAULT_BOT_CONFIG } from '../bots';
import { runSimulation } from './simulation';

const args = parseArgs(process.argv.slice(2));
const difficultyValues = (args.difficulties ?? args.difficulty ?? 'normal')
  .split(/[,\s]+/)
  .map((value) => value.trim())
  .filter(Boolean) as BotDifficulty[];
const difficulty =
  difficultyValues.length === 1 ? difficultyValues[0] : difficultyValues;
const result = runSimulation({
  games: numberArg(args.games, 100),
  players: numberArg(args.players, 4),
  difficulty,
  seed: numberArg(args.seed, 1),
  botConfig: difficultyValues.includes('hard')
    ? {
        maxSimulations: numberArg(
          args['max-simulations'],
          DEFAULT_BOT_CONFIG.hard.maxSimulations,
        ),
      }
    : undefined,
});

if (args.json === 'true') {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Dificultad: ${difficultyValues.join(', ')}`);
  console.log(`Partidas: ${result.games}`);
  console.log(`Completadas: ${result.completedGames}`);
  console.log(`Errores: ${result.errors}`);
  console.log(`Deadlocks: ${result.deadlocks}`);
  console.log(
    `Duración media: ${(result.durationMs / Math.max(1, result.games)).toFixed(2)} ms`,
  );
  console.log(`Rondas medias: ${result.averageRounds.toFixed(2)}`);
  console.log(
    `Puntuación media por jugador: ${result.averageScore.toFixed(2)}`,
  );
  console.log(
    `Acierto de predicciones: ${(result.predictionAccuracy * 100).toFixed(2)}%`,
  );
  console.log(`Posiciones: ${JSON.stringify(result.positions)}`);
  console.log(`Distribución por bot: ${JSON.stringify(result.positionsByBot)}`);
  if (result.failures.length > 0)
    console.log(`Primeros fallos: ${JSON.stringify(result.failures, null, 2)}`);
}

function parseArgs(values: readonly string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;
    const [key, inline] = value.slice(2).split('=', 2);
    parsed[key] = inline ?? values[index + 1] ?? 'true';
    if (inline === undefined) index += 1;
  }
  // npm on Windows can consume unknown `--key` options and leave only values.
  if (
    Object.keys(parsed).length === 0 &&
    values.length > 0 &&
    !values[0].startsWith('--')
  ) {
    if (values[0] !== undefined) parsed.games = values[0];
    if (values[1] !== undefined) parsed.players = values[1];
    const positionalDifficulties = values.slice(2);
    const last = positionalDifficulties.at(-1);
    const hasTrailingNumber =
      last !== undefined && Number.isFinite(Number(last));
    const difficultyValues = hasTrailingNumber
      ? positionalDifficulties.slice(0, -1)
      : positionalDifficulties;
    if (difficultyValues.length > 0) {
      parsed.difficulty = difficultyValues.join(',');
    }
    if (hasTrailingNumber) parsed['max-simulations'] = last;
  }
  return parsed;
}

function numberArg(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
