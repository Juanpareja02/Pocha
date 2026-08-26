import { describe, expect, it } from 'vitest';
import { classicRules, createGame } from '../game-engine';
import { InMemoryOnlineGameRepository } from './online-game.repository';

describe('online game persistence adapter', () => {
  it('checkpoints, logs, finishes and exposes only finished history', () => {
    const repository = new InMemoryOnlineGameRepository();
    const state = createGame(
      'game-persistence',
      [
        { id: 'user-1', name: 'Uno' },
        { id: 'user-2', name: 'Dos' },
        { id: 'user-3', name: 'Tres' },
      ],
      { ...classicRules(3), roundSequence: [1] },
    );
    repository.create({
      gameId: state.gameId,
      roomId: 'room-persistence',
      mode: 'casual',
      rulesetId: state.rulesetId,
      rulesetVersion: state.rulesetVersion,
      players: state.players.map((player) => ({
        userId: player.id,
        seat: player.seat,
      })),
      snapshot: state,
      createdAt: '2026-08-25T00:00:00.000Z',
      status: 'RUNNING',
    });
    repository.appendEvent({
      gameId: state.gameId,
      roomId: 'room-persistence',
      event: 'GAME_CREATED',
      stateVersion: 0,
      createdAt: '2026-08-25T00:00:00.000Z',
    });

    expect(repository.history('user-1')).toHaveLength(0);
    repository.finish(state.gameId, state, '2026-08-25T00:01:00.000Z');

    const history = repository.history('user-1');
    expect(history).toHaveLength(1);
    expect(history[0].roomId).toBe('room-persistence');
    expect(history[0].status).toBe('FINISHED');
    expect(history[0].results).toHaveLength(3);
    expect(history[0].finishedAt).toBe('2026-08-25T00:01:00.000Z');
    expect(repository.eventLog).toHaveLength(1);
  });
});
