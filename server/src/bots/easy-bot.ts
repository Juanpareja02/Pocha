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
  legalCards,
  viewerPlayer,
} from './common';
import { chooseRandom } from './random';
import { Suit } from '../game-engine';

export class EasyBotStrategy implements BotStrategy {
  readonly difficulty = 'easy' as const;

  constructor(private readonly random: BotRandomSource) {}

  chooseBid(view: BotPlayerView): number {
    return estimateBid(
      view,
      this.random,
      DEFAULT_BOT_CONFIG.easy.difficultyNoise,
    );
  }

  chooseTrump(view: BotPlayerView): Suit | null {
    const suit = chooseBestTrump(view);
    return this.random.next() < 0.2
      ? chooseRandom(Object.values(Suit), this.random)
      : suit;
  }

  chooseCard(view: BotPlayerView): string {
    const player = viewerPlayer(view);
    const bid = player.bid ?? 0;
    const need = bid - player.tricksWon;
    const preferWinning = need > 0;
    const cards = legalCards(view);
    const selected =
      this.random.next() < 0.2
        ? chooseRandom(cards, this.random)
        : chooseCardForTarget(view, preferWinning);
    return selected.id;
  }
}
