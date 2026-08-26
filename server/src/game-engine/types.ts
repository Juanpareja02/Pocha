export enum Suit {
  Oros = 'oros',
  Copas = 'copas',
  Espadas = 'espadas',
  Bastos = 'bastos',
}

export const SUITS = Object.values(Suit);

export enum Rank {
  As = 'as',
  Dos = 'dos',
  Tres = 'tres',
  Cuatro = 'cuatro',
  Cinco = 'cinco',
  Seis = 'seis',
  Siete = 'siete',
  Sota = 'sota',
  Caballo = 'caballo',
  Rey = 'rey',
}

export const STANDARD_40_RANKS = [
  Rank.As,
  Rank.Dos,
  Rank.Tres,
  Rank.Cuatro,
  Rank.Cinco,
  Rank.Seis,
  Rank.Siete,
  Rank.Sota,
  Rank.Caballo,
  Rank.Rey,
] as const;

/** Higher number means a stronger card. */
export const STANDARD_RANK_STRENGTH: Readonly<Record<Rank, number>> = {
  [Rank.As]: 10,
  [Rank.Tres]: 9,
  [Rank.Rey]: 8,
  [Rank.Caballo]: 7,
  [Rank.Sota]: 6,
  [Rank.Siete]: 5,
  [Rank.Seis]: 4,
  [Rank.Cinco]: 3,
  [Rank.Cuatro]: 2,
  [Rank.Dos]: 1,
};

export interface Card {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
}

export type RandomSource = () => number;

export type GameStatus =
  | 'LOBBY'
  | 'DEALING'
  | 'BIDDING'
  | 'CHOOSE_TRUMP'
  | 'PLAYING_TRICK'
  | 'ROUND_RESULTS'
  | 'GAME_RESULTS'
  | 'FINISHED';

export type TrumpMode = 'revealed' | 'chosen-by-bid-winner' | 'none';

export interface ScoringRules {
  readonly exactBase: number;
  readonly exactPerTrick: number;
  readonly missPenaltyPerTrick: number;
  readonly roundMultiplier: number;
  readonly pochaBonusEnabled: boolean;
  readonly pochaBonus: number;
}

export interface GameRules {
  readonly id: string;
  readonly version: number;
  readonly playerCount: number;
  readonly roundSequence: readonly number[];
  readonly ranks: readonly Rank[];
  readonly trumpMode: TrumpMode;
  readonly auctionEnabled: boolean;
  readonly allowNoTrump: boolean;
  readonly mustFollowSuit: boolean;
  readonly mustOvertrump: boolean;
  readonly lastBidCannotMatchTrickCount: boolean;
  readonly scoring: ScoringRules;
}

export interface PlayerState {
  readonly id: string;
  readonly name: string;
  readonly seat: number;
  readonly hand: Card[];
  /** Public count; the hand itself is private outside the player view. */
  readonly cardsRemaining: number;
  readonly bid: number | null;
  readonly tricksWon: number;
  readonly score: number;
}

export interface PlayedCard {
  readonly playerId: string;
  readonly card: Card;
}

export interface GameState {
  readonly gameId: string;
  readonly rulesetId: string;
  readonly rulesetVersion: number;
  readonly rules: GameRules;
  readonly status: GameStatus;
  readonly stateVersion: number;
  readonly players: PlayerState[];
  readonly roundIndex: number;
  readonly cardsPerRound: number;
  readonly dealerIndex: number;
  readonly currentPlayerIndex: number;
  readonly trumpSuit: Suit | null;
  readonly leadSuit: Suit | null;
  readonly currentTrick: PlayedCard[];
  /** Cards from completed and current tricks; never contains hidden cards. */
  readonly playedCards: PlayedCard[];
  readonly tricksCompleted: number;
  readonly lastRoundScores: Record<string, number>;
}

export interface RoundScore {
  readonly playerId: string;
  readonly bid: number;
  readonly tricksWon: number;
  readonly score: number;
}

export interface FinalResult {
  readonly playerId: string;
  readonly position: number;
  readonly score: number;
}

export class RuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleViolationError';
  }
}
