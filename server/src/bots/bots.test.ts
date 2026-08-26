import { describe, expect, it } from 'vitest';
import {
  classicRules,
  createGame,
  getLegalBids,
  getLegalCards,
  makeBid,
  seededRandom,
  startRound,
} from '../game-engine';
import { botView, createBotStrategy } from './index';

const players = [
  { id: 'p1', name: 'Juan' },
  { id: 'p2', name: 'Ana' },
  { id: 'p3', name: 'Carlos' },
  { id: 'p4', name: 'María' },
];

describe('bot information boundary', () => {
  it('only exposes the asking player hand and public card counts', () => {
    const state = startRound(
      createGame('bot-view', players, {
        ...classicRules(4),
        roundSequence: [2],
      }),
      seededRandom(10),
    );
    const view = botView(state, 'p1');
    expect(
      view.state.players.find((player) => player.id === 'p1')!.hand,
    ).toHaveLength(2);
    expect(
      view.state.players
        .filter((player) => player.id !== 'p1')
        .every((player) => player.hand.length === 0),
    ).toBe(true);
    expect(
      view.state.players
        .filter((player) => player.id !== 'p1')
        .every((player) => player.cardsRemaining === 2),
    ).toBe(true);
  });

  it.each(['easy', 'normal', 'hard'] as const)(
    'always chooses a legal action for %s',
    (difficulty) => {
      let state = startRound(
        createGame(`bot-${difficulty}`, players, {
          ...classicRules(4),
          roundSequence: [2],
        }),
        seededRandom(22),
      );
      const bidStrategy = createBotStrategy(difficulty, 90, {
        maxSimulations: 1,
      });
      const bidder = state.players[state.currentPlayerIndex].id;
      const bid = bidStrategy.chooseBid(botView(state, bidder));
      expect(getLegalBids(state)).toContain(bid);
      state = makeBid(state, bidder, bid, state.stateVersion);

      while (state.status === 'BIDDING') {
        const playerId = state.players[state.currentPlayerIndex].id;
        const legalBids = getLegalBids(state);
        state = makeBid(
          state,
          playerId,
          legalBids.includes(0) ? 0 : legalBids[0],
          state.stateVersion,
        );
      }
      const playerId = state.players[state.currentPlayerIndex].id;
      const cardStrategy = createBotStrategy(difficulty, 91, {
        maxSimulations: 1,
      });
      const cardId = cardStrategy.chooseCard(botView(state, playerId));
      expect(getLegalCards(state, playerId).map((card) => card.id)).toContain(
        cardId,
      );
    },
  );
});
