export type Suit = "spades" | "hearts" | "clubs" | "diamonds";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isAI: boolean;
  isYou: boolean; // Helper for UI rendering
  avatarUrl: string;
  bet?: number;
  tricksWon: number;
  hand: Card[];
  score: number;
}

export type GamePhase = "LOBBY" | "BETTING" | "PLAYING" | "SCORING";

export interface GameState {
  gameId: string;
  accessCode: string;
  phase: GamePhase;
  players: Player[];
  currentPlayerId: string;
  currentTrick: { playerId: string; card: Card }[];
  trumpSuit: Suit;
  roundNumber: number;
}
