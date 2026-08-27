import { describe, expect, it } from 'vitest';
import { createBotStrategy, botView } from '../bots';
import { classicRules, createSpanishDeck, getLegalBids } from '../game-engine';
import { GameFinishedResult, GameSession } from './game-session';

const players = ['p1', 'p2', 'p3'].map((userId, seat) => ({
  userId,
  displayName: userId,
  seat,
  isBot: false,
}));

function commandFor(
  session: GameSession,
  playerId: string,
  strategy: ReturnType<typeof createBotStrategy>,
) {
  const state = session.currentState;
  const view = botView(state, playerId);
  const common = {
    gameId: session.gameId,
    playerId,
    expectedStateVersion: state.stateVersion,
    actionId: `test:${state.stateVersion}:${playerId}`,
  };
  if (state.status === 'BIDDING')
    return { ...common, type: 'bid' as const, bid: strategy.chooseBid(view) };
  if (state.status === 'CHOOSE_TRUMP')
    return {
      ...common,
      type: 'chooseTrump' as const,
      suit: strategy.chooseTrump(view) ?? 'none',
    };
  const cardId = strategy.chooseCard(view);
  return { ...common, type: 'playCard' as const, cardId };
}

describe('GameSession', () => {
  it('runs a complete authoritative session and only exposes private hands to their owner', async () => {
    const session = new GameSession({
      gameId: 'game-test',
      roomId: 'room-test',
      players,
      rules: { ...classicRules(3), roundSequence: [1] },
      seed: 17,
      timers: {
        roundResultMs: 0,
        bidMs: 100,
        playCardMs: 100,
        chooseTrumpMs: 100,
      },
    });
    session.start();
    const strategies = new Map(
      players.map((player) => [
        player.userId,
        createBotStrategy('normal', player.seat + 10),
      ]),
    );
    let guard = 0;
    while (session.currentState.status !== 'FINISHED' && guard < 100) {
      guard += 1;
      if (
        session.currentState.status === 'ROUND_RESULTS' ||
        session.currentState.status === 'GAME_RESULTS'
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        continue;
      }
      const current =
        session.currentState.players[session.currentState.currentPlayerIndex]
          .id;
      session.dispatch(commandFor(session, current, strategies.get(current)!));
    }
    expect(session.currentState.status).toBe('FINISHED');
    expect(
      session.eventLog.some((event) => event.event === 'GAME_FINISHED'),
    ).toBe(true);
    for (const player of players) {
      const view = session.snapshot(player.userId).state;
      expect(
        view.players.find((candidate) => candidate.id === player.userId)!.hand
          .length,
      ).toBe(0);
      expect(
        view.players
          .filter((candidate) => candidate.id !== player.userId)
          .every((candidate) => candidate.hand.length === 0),
      ).toBe(true);
    }
  });

  it('rejects stale, out-of-turn, illegal and duplicate actions without changing state twice', () => {
    const session = new GameSession({
      gameId: 'game-security',
      roomId: 'room-security',
      players,
      rules: { ...classicRules(3), roundSequence: [1] },
      seed: 4,
    });
    session.start();
    const current =
      session.currentState.players[session.currentState.currentPlayerIndex];
    const other = session.currentState.players.find(
      (player) => player.id !== current.id,
    )!;
    const initialVersion = session.currentState.stateVersion;
    expect(() =>
      session.dispatch({
        gameId: session.gameId,
        type: 'bid',
        playerId: current.id,
        bid: 0,
        expectedStateVersion: -1,
        actionId: 'test:stale-01',
      }),
    ).toThrowError(/out of date/);
    expect(() =>
      session.dispatch({
        gameId: session.gameId,
        type: 'bid',
        playerId: other.id,
        bid: 0,
        expectedStateVersion: session.currentState.stateVersion,
        actionId: 'test:turn-0001',
      }),
    ).toThrowError(/not your turn/);
    const accepted = session.dispatch({
      gameId: session.gameId,
      type: 'bid',
      playerId: current.id,
      bid: getLegalBids(session.currentState)[0],
      expectedStateVersion: session.currentState.stateVersion,
      actionId: 'test:duplicate-01',
    });
    expect(accepted.duplicate).toBe(false);
    const repeated = session.dispatch({
      gameId: session.gameId,
      type: 'bid',
      playerId: current.id,
      bid: 0,
      expectedStateVersion: 0,
      actionId: 'test:duplicate-01',
    });
    expect(repeated.duplicate).toBe(true);
    expect(session.currentState.stateVersion).toBe(initialVersion + 1);
    let playing = session.currentState;
    while (playing.status === 'BIDDING') {
      const bidder = playing.players[playing.currentPlayerIndex];
      const bid = getLegalBids(playing)[0];
      session.dispatch({
        gameId: session.gameId,
        type: 'bid',
        playerId: bidder.id,
        bid,
        expectedStateVersion: playing.stateVersion,
        actionId: `test:bid:${playing.stateVersion}:x`,
      });
      playing = session.currentState;
    }
    const cardPlayer = playing.players[playing.currentPlayerIndex];
    const owned = new Set(cardPlayer.hand.map((card) => card.id));
    const invalidCard = createSpanishDeck().find(
      (card) => !owned.has(card.id),
    )!;
    expect(() =>
      session.dispatch({
        gameId: session.gameId,
        type: 'playCard',
        playerId: cardPlayer.id,
        cardId: invalidCard.id,
        expectedStateVersion: playing.stateVersion,
        actionId: 'test:invalid-card-01',
      }),
    ).toThrowError(/own/);
  });

  it('moves a disconnected seat to bot control and lets it reconnect without creating a new seat', async () => {
    const session = new GameSession({
      gameId: 'game-reconnect',
      roomId: 'room-reconnect',
      players,
      rules: { ...classicRules(3), roundSequence: [1] },
      seed: 5,
      timers: { disconnectGraceMs: 1, roundResultMs: 0 },
    });
    session.start();
    const current =
      session.currentState.players[session.currentState.currentPlayerIndex].id;
    session.disconnect(current);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(
      session
        .snapshot(current)
        .players.find((player) => player.userId === current)?.status,
    ).toBe('BOT_CONTROLLED');
    expect(session.reconnect(current).mySeat).toBe(
      players.find((player) => player.userId === current)!.seat,
    );
    expect(session.snapshot(current).players).toHaveLength(3);
  });

  it('accepts a stale leave intent while keeping stale protection for actions', () => {
    const session = new GameSession({
      gameId: 'game-stale-leave',
      roomId: 'room-stale-leave',
      players,
      rules: { ...classicRules(3), roundSequence: [1] },
      seed: 7,
      timers: { roundResultMs: 0 },
    });
    session.start();
    const playerId = session.currentState.players[0].id;

    const result = session.dispatch({
      gameId: session.gameId,
      type: 'leave',
      playerId,
      expectedStateVersion: -1,
      actionId: 'test:stale-leave',
    });

    expect(
      result.snapshot.players.find((player) => player.userId === playerId)
        ?.status,
    ).toBe('BOT_CONTROLLED');
    expect(
      session.eventLog.some((event) => event.event === 'PLAYER_ABANDONED'),
    ).toBe(true);
  });

  it('marks a disconnected player who never returns as abandoned', async () => {
    const finished = new Promise<GameFinishedResult>((resolve) => {
      const session = new GameSession({
        gameId: 'game-disconnect-classification',
        roomId: 'room-disconnect-classification',
        players,
        rules: { ...classicRules(3), roundSequence: [1] },
        seed: 13,
        timers: { disconnectGraceMs: 1, roundResultMs: 0 },
        onFinished: resolve,
      });
      session.start();
      for (const player of players) session.disconnect(player.userId);
    });
    const result = await finished;
    expect(result.abandonedPlayerIds).toHaveLength(3);
    expect(result.disconnectedPlayerIds).toHaveLength(3);
  });

  it('executes a legal timeout action instead of blocking the session', async () => {
    const session = new GameSession({
      gameId: 'game-timeout',
      roomId: 'room-timeout',
      players,
      rules: { ...classicRules(3), roundSequence: [1] },
      seed: 9,
      timers: { bidMs: 1, playCardMs: 20, chooseTrumpMs: 20 },
    });
    session.start();
    await new Promise((resolve) => setTimeout(resolve, 8));
    expect(
      session.eventLog.some((event) => event.event === 'TURN_TIMED_OUT'),
    ).toBe(true);
    expect(session.currentState.stateVersion).toBeGreaterThan(1);
  });
});
