import type { FieldValue } from 'firebase/firestore';

export type Suit = "oros" | "copas" | "espadas" | "bastos";
export type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "S" | "C" | "R";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: string; // Corresponds to User UID
  name: string;
  isYou?: boolean;
  isHost: boolean;
  isAI: boolean;
  avatarUrl: string;
  bet?: number;
  tricksWon: number;
  hand: Card[];
  score: number;
}

export interface User {
  id: string; // UID
  username: string;
  email?: string;
  avatarUrl?: string;
}

export type GamePhase = "BETTING" | "PLAYING" | "SCORING" | "FINISHED";

export interface GameLobby {
    id: string;
    accessCode: string;
    creatorId: string;
    playerIds: string[];
    status: 'LOBBY' | 'PLAYING' | 'FINISHED';
    createdAt: FieldValue;
    gameId?: string;
}

export interface GameState {
  gameId: string;
  accessCode: string;
  phase: GamePhase;
  roundNumber: number;
  maxRounds: number;
  trumpSuit?: Suit;
  dealerId: string;
  players: Player[];
  currentPlayerId: string;
  currentTrick: { playerId: string; card: Card }[];
}


export interface Game {
  id: string;
  lobbyId: string;
  playerIds: string[];
  players?: Player[]; // Denormalized player data for the game
  status: GamePhase;
  dealerId?: string;
  currentPlayerId?: string;
  currentTrick?: { playerId: string; card: Card }[];
  trumpSuit?: Suit;
  currentRound: number;
  roundSequence?: number[];
  createdAt: FieldValue;
}
