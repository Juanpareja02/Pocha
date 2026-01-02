
import type { GameState, Suit, Rank } from "./types";

const SUITS: Suit[] = ["oros", "copas", "espadas", "bastos"];
const RANKS: Rank[] = ["1", "2", "3", "4", "5", "6", "7", "S", "C", "R"];

const createDeck = () => {
  const deck: { suit: Suit; rank: Rank }[] = [];
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
  phase: "BETTING",
  roundNumber: 3,
  maxRounds: 10,
  trumpSuit: "oros",
  dealerId: "player-4",
  players: [
    {
      id: "player-1",
      name: "Tú",
      isYou: true,
      isHost: true,
      isAI: false,
      avatarUrl: "https://picsum.photos/seed/you/150/150",
      hand: deck.splice(0, 3),
      bet: undefined,
      tricksWon: 0,
      score: 0,
    },
    {
      id: "player-2",
      name: "Ada Lovelace",
      isYou: false,
      isHost: false,
      isAI: false,
      avatarUrl: "https://picsum.photos/seed/ada/150/150",
      hand: deck.splice(0, 3),
      bet: undefined,
      tricksWon: 0,
      score: 0,
    },
    {
      id: "player-3",
      name: "Grace Hopper",
      isYou: false,
      isHost: false,
      isAI: false,
      avatarUrl: "https://picsum.photos/seed/grace/150/150",
      hand: deck.splice(0, 3),
      bet: undefined,
      tricksWon: 0,
      score: 0,
    },
    {
      id: "player-4",
      name: "Alan Turing",
      isYou: false,
      isHost: false,
      isAI: false,
      avatarUrl: "https://picsum.photos/seed/alan/150/150",
      hand: deck.splice(0, 3),
      bet: undefined,
      tricksWon: 0,
      score: 0,
    },
  ],
  currentPlayerId: "player-1", // Player to the right of dealer
  currentTrick: [],
};
