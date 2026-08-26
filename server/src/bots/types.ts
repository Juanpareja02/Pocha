import { GameState, Suit } from '../game-engine';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface BotRandomSource {
  next(): number;
}

export interface BotDecisionConfig {
  readonly maxSimulations: number;
  readonly maxActionsPerRollout: number;
  readonly difficultyNoise: number;
}

export const DEFAULT_BOT_CONFIG: Readonly<
  Record<BotDifficulty, BotDecisionConfig>
> = {
  easy: { maxSimulations: 1, maxActionsPerRollout: 160, difficultyNoise: 0.35 },
  normal: {
    maxSimulations: 1,
    maxActionsPerRollout: 160,
    difficultyNoise: 0.08,
  },
  hard: { maxSimulations: 24, maxActionsPerRollout: 160, difficultyNoise: 0 },
};

/** A view contains only the information a player could legitimately know. */
export interface BotPlayerView {
  readonly playerId: string;
  readonly state: GameState;
}

export interface BotStrategy {
  readonly difficulty: BotDifficulty;
  chooseBid(view: BotPlayerView): number;
  chooseTrump(view: BotPlayerView): Suit | null;
  chooseCard(view: BotPlayerView): string;
}
