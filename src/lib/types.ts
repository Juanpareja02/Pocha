import type { Timestamp } from 'firebase/firestore';

export type Suit = "oros" | "copas" | "espadas" | "bastos";
export type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "S" | "C" | "R";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: string; // Corresponds to User UID
  name: string;
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

export type GamePhase = "LOBBY" | "BETTING" | "PLAYING" | "SCORING" | "FINISHED";

export interface GameLobby {
    id: string;
    accessCode: string;
    creatorId: string;
    playerIds: string[];
    status: 'LOBBY' | 'PLAYING' | 'FINISHED';
    createdAt: Timestamp | { toDate: () => Date };
}

export interface Game {
  id: string;
  lobbyId: string;
  playerIds: string[];
  players: Player[]; // Denormalized player data for the game
  status: GamePhase;
  dealerId: string;
  currentPlayerId: string;
  currentTrick: { playerId: string; card: Card }[];
  trumpSuit?: Suit;
  currentRound: number;
  roundSequence: number[];
  createdAt: Timestamp | { toDate: () => Date };
}
