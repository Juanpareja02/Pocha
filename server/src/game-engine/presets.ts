import { GameRules, Rank } from './types';

const classicScoring = {
  exactBase: 10,
  exactPerTrick: 5,
  missPenaltyPerTrick: 5,
  roundMultiplier: 1,
  pochaBonusEnabled: false,
  pochaBonus: 0,
} as const;

export function classicRules(playerCount = 4): GameRules {
  const maximumCards = Math.min(8, Math.floor(40 / playerCount));
  if (playerCount < 3 || playerCount > 6 || maximumCards < 1) {
    throw new Error('La Pocha admite entre 3 y 6 jugadores');
  }
  const ascending = Array.from(
    { length: maximumCards },
    (_, index) => index + 1,
  );
  return {
    id: 'classic',
    version: 1,
    playerCount,
    roundSequence: [...ascending, ...ascending.slice(0, -1).reverse()],
    ranks: Object.values(Rank),
    trumpMode: 'revealed',
    auctionEnabled: false,
    allowNoTrump: false,
    mustFollowSuit: true,
    mustOvertrump: false,
    lastBidCannotMatchTrickCount: true,
    scoring: classicScoring,
  };
}

export function auctionRules(playerCount = 4): GameRules {
  return {
    ...classicRules(playerCount),
    id: 'auction',
    version: 1,
    trumpMode: 'chosen-by-bid-winner',
    auctionEnabled: true,
  };
}

export const RULESET_PRESETS = {
  classic: classicRules,
  auction: auctionRules,
} as const;
