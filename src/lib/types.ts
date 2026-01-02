
export type Suit = "oros" | "copas" | "espadas" | "bastos";
export type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "S" | "C" | "R";

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
  dealerId: string;
  currentPlayerId: string;
  currentTrick: { playerId: string; card: Card }[];
  trumpSuit?: Suit; // Can be undefined in "ciegas" round
  roundNumber: number;
  maxRounds: number;
}
