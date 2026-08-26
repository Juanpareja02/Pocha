import { EasyBotStrategy } from './easy-bot';
import { HardBotStrategy } from './hard-bot';
import { NormalBotStrategy } from './normal-bot';
import { SeededBotRandom } from './random';
import {
  BotDifficulty,
  BotDecisionConfig,
  BotRandomSource,
  BotStrategy,
  DEFAULT_BOT_CONFIG,
  BotPlayerView,
} from './types';
import { buildPlayerView, GameState } from '../game-engine';

export * from './types';
export * from './random';
export * from './easy-bot';
export * from './normal-bot';
export * from './hard-bot';

export function botView(state: GameState, playerId: string): BotPlayerView {
  return { playerId, state: buildPlayerView(state, playerId) };
}

export function createBotStrategy(
  difficulty: BotDifficulty,
  seed: number,
  config?: Partial<BotDecisionConfig>,
): BotStrategy {
  const random: BotRandomSource = new SeededBotRandom(seed);
  const merged = { ...DEFAULT_BOT_CONFIG[difficulty], ...config };
  if (difficulty === 'easy') return new EasyBotStrategy(random);
  if (difficulty === 'normal') return new NormalBotStrategy(random);
  return new HardBotStrategy(random, merged);
}
