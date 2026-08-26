import { describe, expect, it } from 'vitest';
import { classicRules } from '../game-engine';
import { GameSession } from '../game-sessions/game-session';

describe('online private snapshots', () => {
  it.each([3, 4, 5, 6])('hides every rival hand with %s players', (count) => {
    const players = Array.from({ length: count }, (_, seat) => ({
      userId: `p${seat}`,
      displayName: `P${seat}`,
      seat,
      isBot: false,
    }));
    const session = new GameSession({
      gameId: `privacy-${count}`,
      roomId: `room-${count}`,
      players,
      rules: { ...classicRules(count), roundSequence: [2] },
      seed: count,
    });
    session.start();
    for (const player of players) {
      const serialized = JSON.stringify(session.snapshot(player.userId));
      for (const rival of players.filter(
        (candidate) => candidate.userId !== player.userId,
      )) {
        expect(serialized).not.toContain(
          `\"${rival.userId}\":{\"id\":\"${rival.userId}\"`,
        );
        expect(
          session
            .snapshot(player.userId)
            .state.players.find((candidate) => candidate.id === rival.userId)!
            .hand,
        ).toHaveLength(0);
      }
    }
  });
});
