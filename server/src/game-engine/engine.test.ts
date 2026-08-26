import { describe, expect, it } from 'vitest';
import {
  buildPlayerView,
  calculateFinalResults,
  calculateRoundScores,
  calculateScore,
  classicRules,
  compareCards,
  createSpanishDeck,
  createGame,
  getLegalBids,
  getLegalCards,
  makeBid,
  playCard,
  Rank,
  RuleViolationError,
  seededRandom,
  startNextRound,
  startRound,
  STANDARD_40_RANKS,
  Suit,
} from './index';

const players = [
  { id: 'p1', name: 'Juan' },
  { id: 'p2', name: 'Esther' },
  { id: 'p3', name: 'Pablo' },
  { id: 'p4', name: 'Laura' },
];

function startSingleRound(seed = 1) {
  const rules = { ...classicRules(4), roundSequence: [2] };
  let state = startRound(
    createGame('game', players, rules),
    seededRandom(seed),
  );
  for (let index = 0; index < players.length; index += 1) {
    state = makeBid(
      state,
      state.players[state.currentPlayerIndex].id,
      0,
      state.stateVersion,
    );
  }
  return state;
}

function playUntilRoundEnd(state: ReturnType<typeof startSingleRound>) {
  let current = state;
  while (current.status === 'PLAYING_TRICK') {
    const playerId = current.players[current.currentPlayerIndex].id;
    const [card] = getLegalCards(current, playerId);
    current = playCard(current, playerId, card.id, current.stateVersion);
  }
  return current;
}

describe('GameEngine', () => {
  it('builds a complete 40-card Spanish deck with four suits and ten ranks', () => {
    const deck = createSpanishDeck();
    expect(deck).toHaveLength(40);
    expect(new Set(deck.map((card) => card.id)).size).toBe(40);
    expect(new Set(deck.map((card) => card.suit)).size).toBe(4);
    for (const suit of Object.values(Suit)) {
      expect(deck.filter((card) => card.suit === suit)).toHaveLength(10);
    }
    expect(STANDARD_40_RANKS).toHaveLength(10);
  });

  it('keeps the traditional strength order from strongest to weakest', () => {
    const order = [
      Rank.As,
      Rank.Tres,
      Rank.Rey,
      Rank.Caballo,
      Rank.Sota,
      Rank.Siete,
      Rank.Seis,
      Rank.Cinco,
      Rank.Cuatro,
      Rank.Dos,
    ];
    for (let index = 0; index < order.length - 1; index += 1) {
      expect(
        compareCards(
          { id: `a-${index}`, suit: Suit.Oros, rank: order[index] },
          { id: `b-${index}`, suit: Suit.Oros, rank: order[index + 1] },
          Suit.Oros,
          null,
        ).rank,
      ).toBe(order[index]);
    }
  });

  it.each([3, 4, 5, 6])('deals a valid round for %s players', (playerCount) => {
    const rules = { ...classicRules(playerCount), roundSequence: [2] };
    const roundPlayers = Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index}`,
      name: `P${index}`,
    }));
    const state = startRound(
      createGame(`deal-${playerCount}`, roundPlayers, rules),
      seededRandom(playerCount),
    );
    const dealt = state.players.flatMap((player) => player.hand);
    expect(dealt).toHaveLength(playerCount * 2);
    expect(new Set(dealt.map((card) => card.id)).size).toBe(dealt.length);
    expect(state.players.every((player) => player.cardsRemaining === 2)).toBe(
      true,
    );
  });

  it('creates the standard Spanish 40-card deck through a round deal', () => {
    const state = startSingleRound();
    const dealt = state.players.flatMap((player) => player.hand);
    expect(dealt).toHaveLength(8);
    expect(new Set(dealt.map((card) => card.id)).size).toBe(dealt.length);
  });

  it('adapts the classic sequence to six players without over-dealing', () => {
    const rules = classicRules(6);
    expect(Math.max(...rules.roundSequence)).toBe(6);
    const sixPlayers = players.slice(0, 3).concat([
      { id: 'p5', name: 'Ana' },
      { id: 'p6', name: 'Carlos' },
      { id: 'p7', name: 'María' },
    ]);
    const state = startRound(
      createGame('six-player-game', sixPlayers, rules),
      seededRandom(17),
    );
    expect(state.players.flatMap((player) => player.hand)).toHaveLength(6);
  });

  it('uses the traditional card hierarchy', () => {
    const as = { id: 'a', suit: Suit.Oros, rank: Rank.As };
    const tres = { id: '3', suit: Suit.Oros, rank: Rank.Tres };
    const rey = { id: 'r', suit: Suit.Oros, rank: Rank.Rey };
    expect(compareCards(as, tres, Suit.Oros, null)).toEqual(as);
    expect(compareCards(tres, rey, Suit.Oros, null)).toEqual(tres);
  });

  it('lets the lead suit beat an off-suit card and lets trump beat normal suits', () => {
    const lead = { id: 'copas:dos', suit: Suit.Copas, rank: Rank.Dos };
    const offSuit = { id: 'oros:as', suit: Suit.Oros, rank: Rank.As };
    const trump = { id: 'espadas:dos', suit: Suit.Espadas, rank: Rank.Dos };
    expect(compareCards(lead, offSuit, Suit.Copas, null)).toEqual(lead);
    expect(compareCards(lead, trump, Suit.Copas, Suit.Espadas)).toEqual(trump);
  });

  it('scores exact bids, misses, multipliers and pocha bonus centrally', () => {
    const rules = classicRules(4);
    expect(calculateScore(rules.scoring, 0, 0, 1)).toBe(10);
    expect(calculateScore(rules.scoring, 1, 1, 1)).toBe(15);
    expect(calculateScore(rules.scoring, 2, 4, 4)).toBe(-10);
    expect(
      calculateScore({ ...rules.scoring, roundMultiplier: 2 }, 1, 1, 1),
    ).toBe(30);
    expect(
      calculateScore(
        { ...rules.scoring, pochaBonusEnabled: true, pochaBonus: 25 },
        2,
        2,
        2,
      ),
    ).toBe(45);
  });

  it('rejects the final bid that would make the total equal the trick count', () => {
    const rules = { ...classicRules(4), roundSequence: [1] };
    let state = startRound(createGame('game', players, rules), seededRandom(2));
    for (let index = 0; index < 3; index += 1) {
      state = makeBid(
        state,
        state.players[state.currentPlayerIndex].id,
        0,
        state.stateVersion,
      );
    }
    expect(getLegalBids(state)).toEqual([0]);
    expect(() =>
      makeBid(
        state,
        state.players[state.currentPlayerIndex].id,
        1,
        state.stateVersion,
      ),
    ).toThrow(RuleViolationError);
  });

  it('only offers cards that follow the lead suit when possible', () => {
    let state = startSingleRound(7);
    const firstPlayer = state.players[state.currentPlayerIndex];
    state = playCard(
      state,
      firstPlayer.id,
      firstPlayer.hand[0].id,
      state.stateVersion,
    );
    const nextPlayer = state.players[state.currentPlayerIndex];
    const lead = state.leadSuit!;
    const legal = getLegalCards(state, nextPlayer.id);
    if (nextPlayer.hand.some((card) => card.suit === lead)) {
      expect(legal.every((card) => card.suit === lead)).toBe(true);
    }
  });

  it('enforces mounting when a higher trump exists and allows the lowest trump otherwise', () => {
    const rules = {
      ...classicRules(4),
      roundSequence: [1],
      mustOvertrump: true,
    };
    const base = createGame('mounting', players, rules);
    const makeScenario = (
      hand: ReturnType<typeof createSpanishDeck>[number][],
      trick: ReturnType<typeof createSpanishDeck>[number][],
    ) => ({
      ...base,
      status: 'PLAYING_TRICK' as const,
      roundIndex: 0,
      cardsPerRound: 1,
      trumpSuit: Suit.Oros,
      leadSuit: trick[0].suit,
      currentPlayerIndex: trick.length,
      currentTrick: trick.map((card, index) => ({
        playerId: `p${index}`,
        card,
      })),
      playedCards: trick.map((card, index) => ({
        playerId: `p${index}`,
        card,
      })),
      players: base.players.map((player, index) => ({
        ...player,
        hand: index === trick.length ? hand : [],
        cardsRemaining: index === trick.length ? hand.length : 0,
      })),
    });
    const higher = makeScenario(
      [
        { id: 'copas:dos', suit: Suit.Copas, rank: Rank.Dos },
        { id: 'oros:dos', suit: Suit.Oros, rank: Rank.Dos },
        { id: 'oros:tres', suit: Suit.Oros, rank: Rank.Tres },
      ],
      [
        { id: 'espadas:rey', suit: Suit.Espadas, rank: Rank.Rey },
        { id: 'oros:rey', suit: Suit.Oros, rank: Rank.Rey },
      ],
    );
    expect(getLegalCards(higher, 'p3').map((card) => card.id)).toEqual([
      'oros:tres',
    ]);
    const noHigher = makeScenario(
      [
        { id: 'copas:dos', suit: Suit.Copas, rank: Rank.Dos },
        { id: 'oros:dos', suit: Suit.Oros, rank: Rank.Dos },
      ],
      [
        { id: 'espadas:as', suit: Suit.Espadas, rank: Rank.As },
        { id: 'oros:as', suit: Suit.Oros, rank: Rank.As },
      ],
    );
    expect(getLegalCards(noHigher, 'p3').map((card) => card.id)).toEqual([
      'oros:dos',
    ]);
  });

  it('plays a complete round, resolves every trick and scores it', () => {
    const result = playUntilRoundEnd(startSingleRound(11));
    expect(result.status).toBe('ROUND_RESULTS');
    expect(result.tricksCompleted).toBe(2);
    expect(
      result.players.reduce((sum, player) => sum + player.tricksWon, 0),
    ).toBe(2);
    expect(
      calculateRoundScores(result).every((score) => score.score >= -10),
    ).toBe(true);
  });

  it('supports next-round and final-game transitions', () => {
    const rules = { ...classicRules(4), roundSequence: [2, 2] };
    let firstRound = startRound(
      createGame('game', players, rules),
      seededRandom(13),
    );
    for (let index = 0; index < players.length; index += 1) {
      firstRound = makeBid(
        firstRound,
        firstRound.players[firstRound.currentPlayerIndex].id,
        0,
        firstRound.stateVersion,
      );
    }
    const result = playUntilRoundEnd(firstRound);
    const next = startNextRound(result, seededRandom(14));
    expect(next.status).toBe('BIDDING');
    let secondRound = next;
    for (let index = 0; index < players.length; index += 1) {
      secondRound = makeBid(
        secondRound,
        secondRound.players[secondRound.currentPlayerIndex].id,
        0,
        secondRound.stateVersion,
      );
    }
    const finished = playUntilRoundEnd(secondRound);
    const gameResults = startNextRound(finished, seededRandom(16));
    expect(gameResults.status).toBe('GAME_RESULTS');
    expect(calculateFinalResults(gameResults)[0].position).toBe(1);
  });

  it('rejects stale actions and hides opponents hands in private views', () => {
    const state = startSingleRound();
    const current = state.players[state.currentPlayerIndex];
    expect(() =>
      playCard(state, current.id, current.hand[0].id, state.stateVersion - 1),
    ).toThrow(RuleViolationError);
    const view = buildPlayerView(state, 'p1');
    expect(view.players.find((player) => player.id === 'p1')!.hand.length).toBe(
      2,
    );
    expect(
      view.players
        .filter((player) => player.id !== 'p1')
        .every((player) => player.hand.length === 0),
    ).toBe(true);
  });

  it('rejects impossible phase, ownership, duplicate bid and finished-game actions', () => {
    const bidding = startRound(
      createGame('bidding', players, {
        ...classicRules(4),
        roundSequence: [2],
      }),
      seededRandom(2),
    );
    expect(() =>
      playCard(
        bidding,
        bidding.players[bidding.currentPlayerIndex].id,
        'oros:as',
        bidding.stateVersion,
      ),
    ).toThrow(RuleViolationError);
    expect(() => makeBid(bidding, 'missing', 0, bidding.stateVersion)).toThrow(
      RuleViolationError,
    );
    let playing = bidding;
    for (let index = 0; index < players.length; index += 1) {
      playing = makeBid(
        playing,
        playing.players[playing.currentPlayerIndex].id,
        0,
        playing.stateVersion,
      );
    }
    expect(() =>
      makeBid(
        playing,
        playing.players[playing.currentPlayerIndex].id,
        0,
        playing.stateVersion,
      ),
    ).toThrow(RuleViolationError);
    expect(() =>
      playCard(
        playing,
        playing.players[playing.currentPlayerIndex].id,
        'oros:as',
        playing.stateVersion,
      ),
    ).toThrow(RuleViolationError);
  });

  it('keeps invariants across deterministic simulations', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const result = playUntilRoundEnd(startSingleRound(seed));
      expect(result.players.flatMap((player) => player.hand)).toHaveLength(0);
      expect(result.currentTrick).toHaveLength(0);
      expect(result.playedCards).toHaveLength(8);
      expect(new Set(result.playedCards.map(({ card }) => card.id)).size).toBe(
        8,
      );
      expect(
        result.players.reduce((sum, player) => sum + player.tricksWon, 0),
      ).toBe(2);
    }
  });
});
