import { describe, expect, it } from 'vitest';
import { InMemorySessionLookupRepository } from './repositories';

describe('session lookup repository', () => {
  it('finds sessions by game and room across the adapter boundary', () => {
    const lookup = new InMemorySessionLookupRepository();
    lookup.save({
      gameId: 'game_1',
      roomId: 'room_1',
      status: 'RUNNING',
      mode: 'ranked',
      rulesetId: 'ranked_standard',
      rulesetVersion: 1,
      playerIds: ['user_1', 'user_2'],
      seasonId: 'season_1',
      updatedAt: '2026-08-25T00:00:00.000Z',
    });

    expect(lookup.findByGameId('game_1')?.roomId).toBe('room_1');
    expect(lookup.findByRoomId('room_1')?.gameId).toBe('game_1');
    lookup.delete('game_1');
    expect(lookup.findByGameId('game_1')).toBeUndefined();
  });
});
