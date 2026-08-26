import {
  calculateFinalResults,
  chooseTrump,
  classicRules,
  createGame,
  finishGame,
  makeBid,
  playCard,
  seededRandom,
  startNextRound,
  startRound,
} from '../game-engine';
import { botView, createBotStrategy } from '../bots';
import {
  BotDifficulty,
  BotDecisionConfig,
  DEFAULT_BOT_CONFIG,
} from '../bots/types';

export interface SimulationConfig {
  readonly games: number;
  readonly players: number;
  /** One difficulty broadcasts to every seat; an array defines a seat profile. */
  readonly difficulty: BotDifficulty | readonly BotDifficulty[];
  readonly seed: number;
  readonly botConfig?: Partial<BotDecisionConfig>;
}

export interface SimulationResult {
  readonly games: number;
  readonly completedGames: number;
  readonly errors: number;
  readonly deadlocks: number;
  readonly durationMs: number;
  readonly averageRounds: number;
  readonly averageScore: number;
  readonly predictionAccuracy: number;
  readonly positions: Record<string, number>;
  readonly positionsByBot: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
  readonly failures: readonly SimulationFailure[];
}

export interface SimulationFailure {
  readonly seed: number;
  readonly error: string;
  readonly state?: unknown;
  readonly lastEvents?: readonly string[];
}

class SimulationDeadlockError extends Error {
  constructor(
    message: string,
    readonly snapshot: unknown,
    readonly lastEvents: readonly string[],
  ) {
    super(message);
    this.name = 'SimulationDeadlockError';
  }
}

export function runSimulation(config: SimulationConfig): SimulationResult {
  validateConfig(config);
  const started = Date.now();
  let completedGames = 0;
  let errors = 0;
  let deadlocks = 0;
  let rounds = 0;
  let score = 0;
  let accuratePredictions = 0;
  let totalPredictions = 0;
  const positions: Record<string, number> = {};
  const positionsByBot: Record<string, Record<string, number>> = {};
  const failures: SimulationFailure[] = [];

  for (let index = 0; index < config.games; index += 1) {
    const seed = config.seed + index;
    try {
      const result = runOneGame(seed, config);
      completedGames += 1;
      rounds += result.rounds;
      score += result.averageScore;
      accuratePredictions += result.accuratePredictions;
      totalPredictions += result.totalPredictions;
      for (const finalResult of result.results) {
        positions[`position_${finalResult.position}`] =
          (positions[`position_${finalResult.position}`] ?? 0) + 1;
        const botPositions = (positionsByBot[finalResult.playerId] ??= {});
        botPositions[`position_${finalResult.position}`] =
          (botPositions[`position_${finalResult.position}`] ?? 0) + 1;
      }
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('Deadlock')) deadlocks += 1;
      if (failures.length < 20) {
        failures.push({
          seed,
          error: message,
          ...(error instanceof SimulationDeadlockError
            ? { state: error.snapshot, lastEvents: error.lastEvents }
            : {}),
        });
      }
    }
  }

  return {
    games: config.games,
    completedGames,
    errors,
    deadlocks,
    durationMs: Date.now() - started,
    averageRounds: completedGames === 0 ? 0 : rounds / completedGames,
    averageScore: completedGames === 0 ? 0 : score / completedGames,
    predictionAccuracy:
      totalPredictions === 0 ? 0 : accuratePredictions / totalPredictions,
    positions,
    positionsByBot,
    failures,
  };
}

function runOneGame(seed: number, config: SimulationConfig) {
  const rules = classicRules(config.players);
  const difficulties = normalizeDifficulties(config);
  const playerDefinitions = Array.from(
    { length: config.players },
    (_, index) => ({
      id: `bot-${index + 1}`,
      name: `bot-${index + 1}`,
    }),
  );
  const stateSeed = seededRandom(seed);
  const strategies = playerDefinitions.map((_, index) =>
    createBotStrategy(
      difficulties[index],
      seed * 1009 + index,
      config.botConfig,
    ),
  );
  let state = startRound(
    createGame(`simulation-${seed}`, playerDefinitions, rules),
    stateSeed,
  );
  let actions = 0;
  let accuratePredictions = 0;
  let totalPredictions = 0;
  const lastEvents: string[] = [];
  const remember = (event: string) => {
    lastEvents.push(event);
    if (lastEvents.length > 16) lastEvents.shift();
  };
  while (state.status !== 'FINISHED') {
    remember(
      `${actions}:${state.status}:v${state.stateVersion}:turn=${state.currentPlayerIndex}`,
    );
    if (state.status === 'BIDDING') {
      const playerIndex = state.currentPlayerIndex;
      const playerId = state.players[playerIndex].id;
      const bid = strategies[playerIndex].chooseBid(botView(state, playerId));
      state = makeBid(state, playerId, bid, state.stateVersion);
      actions += 1;
    } else if (state.status === 'CHOOSE_TRUMP') {
      const playerIndex = state.currentPlayerIndex;
      const playerId = state.players[playerIndex].id;
      const suit = strategies[playerIndex].chooseTrump(
        botView(state, playerId),
      );
      state = chooseTrump(state, playerId, suit, state.stateVersion);
      actions += 1;
    } else if (state.status === 'PLAYING_TRICK') {
      const playerIndex = state.currentPlayerIndex;
      const playerId = state.players[playerIndex].id;
      const cardId = strategies[playerIndex].chooseCard(
        botView(state, playerId),
      );
      state = playCard(state, playerId, cardId, state.stateVersion);
      actions += 1;
    } else if (state.status === 'ROUND_RESULTS') {
      const completedRound = state.roundIndex;
      for (const player of state.players) {
        totalPredictions += 1;
        accuratePredictions += Number(player.bid === player.tricksWon);
      }
      if (completedRound >= rules.roundSequence.length - 1) {
        state = startNextRound(state, stateSeed);
      } else {
        state = startNextRound(state, stateSeed);
      }
      actions += 1;
    } else if (state.status === 'GAME_RESULTS') {
      state = finishGame(state);
      actions += 1;
    } else {
      throw new SimulationDeadlockError(
        `Deadlock: unsupported state ${state.status} after ${actions} actions`,
        {
          status: state.status,
          stateVersion: state.stateVersion,
          roundIndex: state.roundIndex,
          currentPlayerIndex: state.currentPlayerIndex,
          actions,
        },
        lastEvents,
      );
    }
    const maxActions =
      rules.roundSequence.reduce(
        (total, cards) => total + cards * config.players + config.players + 2,
        0,
      ) + 10;
    if (actions > maxActions) {
      throw new SimulationDeadlockError(
        `Deadlock: exceeded ${maxActions} actions at state ${state.status}`,
        {
          status: state.status,
          stateVersion: state.stateVersion,
          roundIndex: state.roundIndex,
          currentPlayerIndex: state.currentPlayerIndex,
          actions,
        },
        lastEvents,
      );
    }
  }
  const results = calculateFinalResults(state);
  return {
    rounds: rules.roundSequence.length,
    averageScore:
      state.players.reduce((total, player) => total + player.score, 0) /
      state.players.length,
    accuratePredictions,
    totalPredictions,
    results,
  };
}

function validateConfig(config: SimulationConfig): void {
  if (!Number.isInteger(config.games) || config.games < 1)
    throw new Error('games must be a positive integer');
  if (
    !Number.isInteger(config.players) ||
    config.players < 3 ||
    config.players > 6
  )
    throw new Error('players must be between 3 and 6');
  const difficulties = normalizeDifficulties(config);
  if (
    difficulties.includes('hard') &&
    (config.botConfig?.maxSimulations ??
      DEFAULT_BOT_CONFIG.hard.maxSimulations) < 1
  ) {
    throw new Error('hard simulations must be positive');
  }
}

function normalizeDifficulties(
  config: SimulationConfig,
): readonly BotDifficulty[] {
  const difficulties = Array.isArray(config.difficulty)
    ? config.difficulty
    : [config.difficulty];
  if (difficulties.length !== 1 && difficulties.length !== config.players) {
    throw new Error('difficulty profile must have one value or one per player');
  }
  for (const difficulty of difficulties) {
    if (!['easy', 'normal', 'hard'].includes(difficulty)) {
      throw new Error(`unknown bot difficulty: ${difficulty}`);
    }
  }
  return difficulties.length === 1
    ? Array.from({ length: config.players }, () => difficulties[0])
    : difficulties;
}
