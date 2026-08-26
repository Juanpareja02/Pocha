import { describe, expect, it } from 'vitest';
import { classicRules } from '../src/game-engine';
import { GameService } from '../src/games/game.service';

describe('game service integration', () => {
  it('keeps transitions authoritative and returns a private view', () => {
    const games = new GameService();
    games.create(
      'integration-game',
      ['p1', 'p2', 'p3'],
      ['Juan', 'Esther', 'Pablo'],
      { ...classicRules(3), roundSequence: [1] },
    );
    games.ready('integration-game', 'p1');
    games.ready('integration-game', 'p2');
    const state = games.ready('integration-game', 'p3');
    expect(state.status).toBe('BIDDING');
    expect(
      games
        .view('integration-game', 'p1')
        .players.find((player) => player.id === 'p2')?.hand,
    ).toHaveLength(0);
  });
});
