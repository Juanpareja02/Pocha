import {
  BotPlayerView,
  BotRandomSource,
  BotStrategy,
  DEFAULT_BOT_CONFIG,
} from './types';
import {
  chooseBestTrump,
  chooseCardForTarget,
  estimateBid,
  viewerPlayer,
} from './common';
import { Suit } from '../game-engine';

export class NormalBotStrategy implements BotStrategy {
  readonly difficulty = 'normal' as const;

  constructor(private readonly random: BotRandomSource) {}

  chooseBid(view: BotPlayerView): number {
    return estimateBid(
      view,
      this.random,
      DEFAULT_BOT_CONFIG.normal.difficultyNoise,
    );
  }

  chooseTrump(view: BotPlayerView): Suit | null {
    return chooseBestTrump(view);
  }

  chooseCard(view: BotPlayerView): string {
    const player = viewerPlayer(view);
    const target = (player.bid ?? 0) - player.tricksWon;
    return chooseCardForTarget(view, target > 0).id;
  }
}
