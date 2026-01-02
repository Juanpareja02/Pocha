import type { GameState, Suit, Rank } from "./types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};

const deck = createDeck();

export const mockGameState: GameState = {
  gameId: "mock-game-id",
  accessCode: "POCHA1",
  phase: "PLAYING",
  roundNumber: 3,
  trumpSuit: "hearts",
  players: [
    {
      id: "player-1",
      name: "Tú",
      isYou: true,
      isHost: true,
      isAI: false,
      avatarUrl: "https://picsum.photos/seed/you/150/150",
      hand: deck.splice(0, 3),
      bet: 1,
      tricksWon: 0,
      score: 5,
    },
    {
      id: "player-2",
      name: "Ada Lovelace",
      isYou: false,
      isHost: false,
      isAI: true,
      avatarUrl: "https://picsum.photos/seed/ada/150/150",
      hand: deck.splice(0, 3),
      bet: 0,
      tricksWon: 1,
      score: 11,
    },
    {
      id: "player-3",
      name: "Grace Hopper",
      isYou: false,
      isHost: false,
      isAI: true,
      avatarUrl: "https://picsum.photos/seed/grace/150/150",
      hand: deck.splice(0, 3),
      bet: 2,
      tricksWon: 1,
      score: -2,
    },
    {
      id: "player-4",
      name: "Alan Turing",
      isYou: false,
      isHost: false,
      isAI: true,
      avatarUrl: "https://picsum.photos/seed/alan/150/150",
      hand: deck.splice(0, 3),
      bet: 0,
      tricksWon: 0,
      score: 10,
    },
  ],
  currentPlayerId: "player-1",
  currentTrick: [
    { playerId: "player-2", card: { suit: "clubs", rank: "K" } }
  ],
};
