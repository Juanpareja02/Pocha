import {
  Card,
  compareCards,
  getLegalBids,
  getLegalCards,
  GameState,
  Rank,
  RuleViolationError,
  Suit,
  STANDARD_RANK_STRENGTH,
} from '../game-engine';
import { BotPlayerView, BotRandomSource } from './types';

export const RANK_PROBABILITY: Readonly<Record<Rank, number>> = {
  [Rank.As]: 0.82,
  [Rank.Tres]: 0.72,
  [Rank.Rey]: 0.53,
  [Rank.Caballo]: 0.38,
  [Rank.Sota]: 0.27,
  [Rank.Siete]: 0.19,
  [Rank.Seis]: 0.13,
  [Rank.Cinco]: 0.1,
  [Rank.Cuatro]: 0.07,
  [Rank.Dos]: 0.04,
};

export function viewerPlayer(view: BotPlayerView) {
  const player = view.state.players.find(
    (candidate) => candidate.id === view.playerId,
  );
  if (!player) throw new RuleViolationError('Bot player is not in the game');
  return player;
}

export function legalBids(view: BotPlayerView): number[] {
  const bids = getLegalBids(view.state);
  if (bids.length === 0) throw new RuleViolationError('Bot has no legal bid');
  return bids;
}

export function legalCards(view: BotPlayerView): Card[] {
  const cards = getLegalCards(view.state, view.playerId);
  if (cards.length === 0) throw new RuleViolationError('Bot has no legal card');
  return cards;
}

export function estimateBid(
  view: BotPlayerView,
  random: BotRandomSource,
  noise: number,
): number {
  const player = viewerPlayer(view);
  const trump = view.state.trumpSuit;
  const raw = player.hand.reduce((total, card) => {
    const base = RANK_PROBABILITY[card.rank];
    const trumpBonus = trump !== null && card.suit === trump ? 0.3 : 0;
    const suitLengthBonus =
      player.hand.filter((candidate) => candidate.suit === card.suit).length >=
      3
        ? 0.06
        : 0;
    return total + Math.min(0.98, base + trumpBonus + suitLengthBonus);
  }, 0);
  const noisy =
    raw + (random.next() - 0.5) * noise * Math.max(1, player.hand.length);
  return clampToLegal(Math.round(noisy), legalBids(view));
}

export function chooseBestTrump(view: BotPlayerView): Suit | null {
  const suits = Object.values(Suit);
  let best: Suit = suits[0];
  let bestValue = Number.NEGATIVE_INFINITY;
  const player = viewerPlayer(view);
  for (const suit of suits) {
    const value = player.hand
      .filter((card) => card.suit === suit)
      .reduce((total, card) => total + STANDARD_RANK_STRENGTH[card.rank], 0);
    if (value > bestValue) {
      best = suit;
      bestValue = value;
    }
  }
  return best;
}

export function clampToLegal(value: number, legal: readonly number[]): number {
  return [...legal].sort(
    (a, b) => Math.abs(a - value) - Math.abs(b - value) || a - b,
  )[0];
}

export function wouldWinCurrentTrick(state: GameState, card: Card): boolean {
  if (state.currentTrick.length === 0) return true;
  const leadSuit = state.leadSuit ?? state.currentTrick[0].card.suit;
  let best = state.currentTrick[0].card;
  for (const played of state.currentTrick.slice(1)) {
    best = compareCards(best, played.card, leadSuit, state.trumpSuit);
  }
  return compareCards(best, card, leadSuit, state.trumpSuit).id === card.id;
}

export function chooseCardForTarget(
  view: BotPlayerView,
  preferWinning: boolean,
): Card {
  const cards = legalCards(view);
  const ranked = cards
    .map((card) => ({
      card,
      wins: wouldWinCurrentTrick(view.state, card),
      strength: STANDARD_RANK_STRENGTH[card.rank],
    }))
    .sort((left, right) => {
      if (left.wins !== right.wins)
        return preferWinning
          ? Number(right.wins) - Number(left.wins)
          : Number(left.wins) - Number(right.wins);
      return preferWinning
        ? left.strength - right.strength
        : left.strength - right.strength;
    });
  return ranked[0].card;
}
