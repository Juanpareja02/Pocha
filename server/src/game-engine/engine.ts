import {
  Card,
  FinalResult,
  GameRules,
  GameState,
  PlayerState,
  PlayedCard,
  RuleViolationError,
  RoundScore,
  Suit,
  STANDARD_RANK_STRENGTH,
} from './types';
import { createSpanishDeck, shuffle } from './deck';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function bump<T extends GameState>(state: T, changes: Partial<GameState>): T {
  return {
    ...state,
    ...changes,
    stateVersion: state.stateVersion + 1,
  } as T;
}

function playerIndex(state: GameState, playerId: string): number {
  return state.players.findIndex((player) => player.id === playerId);
}

function requirePlayer(state: GameState, playerId: string): number {
  const index = playerIndex(state, playerId);
  if (index < 0) {
    throw new RuleViolationError('Player does not belong to this game');
  }
  return index;
}

function requireVersion(state: GameState, expectedVersion?: number): void {
  if (expectedVersion !== undefined && expectedVersion !== state.stateVersion) {
    throw new RuleViolationError(
      `Stale state version: expected ${state.stateVersion}, received ${expectedVersion}`,
    );
  }
}

function requireTurn(state: GameState, playerId: string): number {
  const index = requirePlayer(state, playerId);
  if (index !== state.currentPlayerIndex) {
    throw new RuleViolationError("It is not this player's turn");
  }
  return index;
}

function withPlayer(
  state: GameState,
  index: number,
  changes: Partial<PlayerState>,
): PlayerState[] {
  return state.players.map((player, playerIndexValue) =>
    playerIndexValue === index ? { ...player, ...changes } : player,
  );
}

function nextPlayer(
  state: GameState,
  index = state.currentPlayerIndex,
): number {
  return (index + 1) % state.players.length;
}

function rankStrength(card: Card): number {
  return STANDARD_RANK_STRENGTH[card.rank];
}

function hasSuit(hand: readonly Card[], suit: Suit): boolean {
  return hand.some((card) => card.suit === suit);
}

function highestTrumpInTrick(state: GameState): Card | null {
  if (state.trumpSuit === null) return null;
  return (
    state.currentTrick
      .filter(({ card }) => card.suit === state.trumpSuit)
      .map(({ card }) => card)
      .sort((a, b) => rankStrength(b) - rankStrength(a))[0] ?? null
  );
}

function calculateWinner(
  state: GameState,
  trick: readonly PlayedCard[],
): number {
  const leadSuit = trick[0].card.suit;
  let winner = trick[0];
  for (const played of trick.slice(1)) {
    const candidateIsTrump =
      state.trumpSuit !== null && played.card.suit === state.trumpSuit;
    const winnerIsTrump =
      state.trumpSuit !== null && winner.card.suit === state.trumpSuit;
    const candidateWins =
      (candidateIsTrump && !winnerIsTrump) ||
      (candidateIsTrump === winnerIsTrump &&
        played.card.suit === winner.card.suit &&
        rankStrength(played.card) > rankStrength(winner.card)) ||
      (!candidateIsTrump &&
        !winnerIsTrump &&
        played.card.suit === leadSuit &&
        winner.card.suit !== leadSuit);
    if (candidateWins) winner = played;
  }
  return state.players.findIndex((player) => player.id === winner.playerId);
}

function scoreRound(state: GameState): {
  players: PlayerState[];
  scores: Record<string, number>;
} {
  const scores: Record<string, number> = {};
  const players = state.players.map((player) => {
    const bid = player.bid ?? 0;
    const score = calculateScore(
      state.rules.scoring,
      bid,
      player.tricksWon,
      state.cardsPerRound,
    );
    scores[player.id] = score;
    return { ...player, score: player.score + score };
  });
  return { players, scores };
}

export function calculateScore(
  scoring: GameRules['scoring'],
  bid: number,
  tricksWon: number,
  cardsPerRound: number,
): number {
  const exact = bid === tricksWon;
  const rawScore = exact
    ? scoring.exactBase + scoring.exactPerTrick * tricksWon
    : -scoring.missPenaltyPerTrick * Math.abs(bid - tricksWon);
  const pochaBonus =
    scoring.pochaBonusEnabled && exact && bid === cardsPerRound
      ? scoring.pochaBonus
      : 0;
  return (rawScore + pochaBonus) * scoring.roundMultiplier;
}

function assertCanStartRound(state: GameState): void {
  if (state.status !== 'LOBBY' && state.status !== 'ROUND_RESULTS') {
    throw new RuleViolationError(`Cannot start a round from ${state.status}`);
  }
  if (state.roundIndex + 1 >= state.rules.roundSequence.length) {
    throw new RuleViolationError('There are no rounds remaining');
  }
}

export function createGame(
  gameId: string,
  playerNames: readonly { id: string; name: string }[],
  rules: GameRules,
): GameState {
  if (playerNames.length !== rules.playerCount) {
    throw new RuleViolationError(
      `Ruleset requires exactly ${rules.playerCount} players`,
    );
  }
  const ids = new Set(playerNames.map((player) => player.id));
  if (ids.size !== playerNames.length) {
    throw new RuleViolationError('Player ids must be unique');
  }
  const players: PlayerState[] = playerNames.map((player, seat) => ({
    id: player.id,
    name: player.name,
    seat,
    hand: [],
    cardsRemaining: 0,
    bid: null,
    tricksWon: 0,
    score: 0,
  }));
  return {
    gameId,
    rulesetId: rules.id,
    rulesetVersion: rules.version,
    rules,
    status: 'LOBBY',
    stateVersion: 0,
    players,
    roundIndex: -1,
    cardsPerRound: 0,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    trumpSuit: null,
    leadSuit: null,
    currentTrick: [],
    playedCards: [],
    tricksCompleted: 0,
    lastRoundScores: {},
  };
}

export function startRound(state: GameState, random: () => number): GameState {
  assertCanStartRound(state);
  const roundIndex = state.roundIndex + 1;
  const cardsPerRound = state.rules.roundSequence[roundIndex];
  const deck = shuffle(createSpanishDeck(state.rules.ranks), random);
  const totalCards = cardsPerRound * state.players.length;
  if (totalCards > deck.length) {
    throw new RuleViolationError(
      'The round requires more cards than the configured deck contains',
    );
  }
  const dealerIndex =
    state.roundIndex < 0 ? 0 : nextPlayer(state, state.dealerIndex);
  const firstPlayer = nextPlayer(state, dealerIndex);
  const players = state.players.map((player, index) => ({
    ...player,
    hand: deck.slice(index * cardsPerRound, (index + 1) * cardsPerRound),
    cardsRemaining: cardsPerRound,
    bid: null,
    tricksWon: 0,
  }));
  const trumpSuit =
    state.rules.trumpMode === 'revealed'
      ? (deck[totalCards]?.suit ?? deck[0].suit)
      : null;
  return bump(state, {
    status: 'BIDDING',
    players,
    roundIndex,
    cardsPerRound,
    dealerIndex,
    currentPlayerIndex: firstPlayer,
    trumpSuit,
    leadSuit: null,
    currentTrick: [],
    playedCards: [],
    tricksCompleted: 0,
    lastRoundScores: {},
  });
}

export function getLegalBids(state: GameState): number[] {
  if (state.status !== 'BIDDING') return [];
  const bidder = state.players[state.currentPlayerIndex];
  const submitted = state.players.filter((player) => player.bid !== null);
  const submittedTotal = submitted.reduce(
    (total, player) => total + (player.bid ?? 0),
    0,
  );
  return Array.from(
    { length: state.cardsPerRound + 1 },
    (_, bid) => bid,
  ).filter((bid) => {
    if (
      state.rules.lastBidCannotMatchTrickCount &&
      submitted.length === state.players.length - 1 &&
      submittedTotal + bid === state.cardsPerRound
    ) {
      return false;
    }
    return bidder.bid === null;
  });
}

export function makeBid(
  state: GameState,
  playerId: string,
  bid: number,
  expectedVersion?: number,
): GameState {
  requireVersion(state, expectedVersion);
  requireTurn(state, playerId);
  if (state.status !== 'BIDDING')
    throw new RuleViolationError('Bids are not accepted now');
  if (!getLegalBids(state).includes(bid))
    throw new RuleViolationError('Illegal bid');
  const index = playerIndex(state, playerId);
  const players = withPlayer(state, index, { bid });
  const allBidsSubmitted = players.every((player) => player.bid !== null);
  if (!allBidsSubmitted) {
    return bump(state, { players, currentPlayerIndex: nextPlayer(state) });
  }
  if (state.rules.auctionEnabled) {
    const winner = players.reduce((best, player) =>
      player.bid! > best.bid! ? player : best,
    );
    return bump(state, {
      players,
      status: 'CHOOSE_TRUMP',
      currentPlayerIndex: playerIndex(state, winner.id),
    });
  }
  return bump(state, {
    players,
    status: 'PLAYING_TRICK',
    currentPlayerIndex: nextPlayer(state, state.dealerIndex),
  });
}

export function chooseTrump(
  state: GameState,
  playerId: string,
  suit: Suit | null,
  expectedVersion?: number,
): GameState {
  requireVersion(state, expectedVersion);
  requireTurn(state, playerId);
  if (state.status !== 'CHOOSE_TRUMP')
    throw new RuleViolationError('Trump cannot be chosen now');
  if (suit === null && !state.rules.allowNoTrump) {
    throw new RuleViolationError('This ruleset requires a trump suit');
  }
  if (suit !== null && !Object.values(Suit).includes(suit)) {
    throw new RuleViolationError('Unknown trump suit');
  }
  return bump(state, {
    status: 'PLAYING_TRICK',
    trumpSuit: suit,
    currentPlayerIndex: nextPlayer(state, state.dealerIndex),
  });
}

export function getLegalCards(state: GameState, playerId: string): Card[] {
  if (state.status !== 'PLAYING_TRICK') return [];
  const index = requirePlayer(state, playerId);
  if (index !== state.currentPlayerIndex) return [];
  const hand = state.players[index].hand;
  if (
    state.currentTrick.length === 0 ||
    state.leadSuit === null ||
    !state.rules.mustFollowSuit
  ) {
    return [...hand];
  }
  const hasLead = hasSuit(hand, state.leadSuit);
  if (hasLead) return hand.filter((card) => card.suit === state.leadSuit);
  if (
    state.rules.mustOvertrump &&
    state.trumpSuit !== null &&
    hasSuit(hand, state.trumpSuit)
  ) {
    const highestTrump = highestTrumpInTrick(state);
    const trumpCards = hand.filter((card) => card.suit === state.trumpSuit);
    if (highestTrump === null) return [...hand];
    const higher = trumpCards.filter(
      (card) => rankStrength(card) > rankStrength(highestTrump),
    );
    return higher.length > 0 ? higher : trumpCards;
  }
  return [...hand];
}

export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  expectedVersion?: number,
): GameState {
  requireVersion(state, expectedVersion);
  const currentPlayerIndex = requireTurn(state, playerId);
  if (state.status !== 'PLAYING_TRICK')
    throw new RuleViolationError('Cards cannot be played now');
  const card = state.players[currentPlayerIndex].hand.find(
    (candidate) => candidate.id === cardId,
  );
  if (!card) throw new RuleViolationError('The player does not hold this card');
  if (
    !getLegalCards(state, playerId).some((candidate) => candidate.id === cardId)
  ) {
    throw new RuleViolationError('The card does not follow the rules');
  }
  const playersWithoutCard = withPlayer(state, currentPlayerIndex, {
    hand: state.players[currentPlayerIndex].hand.filter(
      (candidate) => candidate.id !== cardId,
    ),
    cardsRemaining: state.players[currentPlayerIndex].hand.length - 1,
  });
  const currentTrick = [...state.currentTrick, { playerId, card }];
  const playedCards = [...state.playedCards, { playerId, card }];
  const leadSuit = state.leadSuit ?? card.suit;
  if (currentTrick.length < state.players.length) {
    return bump(state, {
      players: playersWithoutCard,
      currentTrick,
      playedCards,
      leadSuit,
      currentPlayerIndex: nextPlayer(state),
    });
  }
  const winnerIndex = calculateWinner(
    { ...state, players: playersWithoutCard },
    currentTrick,
  );
  const playersWithTrick = withPlayer(
    { ...state, players: playersWithoutCard },
    winnerIndex,
    { tricksWon: playersWithoutCard[winnerIndex].tricksWon + 1 },
  );
  const tricksCompleted = state.tricksCompleted + 1;
  const isRoundComplete = playersWithTrick.every(
    (player) => player.hand.length === 0,
  );
  if (isRoundComplete) {
    const scored = scoreRound({
      ...state,
      players: playersWithTrick,
      tricksCompleted,
    });
    return bump(state, {
      players: scored.players,
      status: 'ROUND_RESULTS',
      currentTrick: [],
      playedCards,
      leadSuit: null,
      currentPlayerIndex: winnerIndex,
      tricksCompleted,
      lastRoundScores: scored.scores,
    });
  }
  return bump(state, {
    players: playersWithTrick,
    currentTrick: [],
    playedCards,
    leadSuit: null,
    currentPlayerIndex: winnerIndex,
    tricksCompleted,
  });
}

export function calculateRoundScores(state: GameState): RoundScore[] {
  return state.players.map((player) => ({
    playerId: player.id,
    bid: player.bid ?? 0,
    tricksWon: player.tricksWon,
    score: state.lastRoundScores[player.id] ?? 0,
  }));
}

export function startNextRound(
  state: GameState,
  random: () => number,
): GameState {
  if (state.status !== 'ROUND_RESULTS')
    throw new RuleViolationError('The current round is not complete');
  if (state.roundIndex + 1 >= state.rules.roundSequence.length) {
    return bump(state, { status: 'GAME_RESULTS' });
  }
  return startRound(state, random);
}

export function finishGame(state: GameState): GameState {
  if (state.status !== 'GAME_RESULTS')
    throw new RuleViolationError('The game is not ready to finish');
  return bump(state, { status: 'FINISHED' });
}

export function calculateFinalResults(state: GameState): FinalResult[] {
  return [...state.players]
    .sort((a, b) => b.score - a.score || a.seat - b.seat)
    .map((player, index) => ({
      playerId: player.id,
      position: index + 1,
      score: player.score,
    }));
}

export function buildPlayerView(state: GameState, playerId: string): GameState {
  requirePlayer(state, playerId);
  const privatePlayers = state.players.map((player) => ({
    ...player,
    hand: player.id === playerId ? clone(player.hand) : [],
  }));
  return { ...clone(state), players: privatePlayers };
}

export function compareCards(
  first: Card,
  second: Card,
  leadSuit: Suit,
  trumpSuit: Suit | null,
): Card {
  const firstTrump = trumpSuit !== null && first.suit === trumpSuit;
  const secondTrump = trumpSuit !== null && second.suit === trumpSuit;
  if (firstTrump !== secondTrump) return firstTrump ? first : second;
  if (first.suit !== second.suit) {
    if (first.suit === leadSuit) return first;
    if (second.suit === leadSuit) return second;
    return first;
  }
  return rankStrength(first) >= rankStrength(second) ? first : second;
}

export { rankStrength };
