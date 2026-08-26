import { describe, expect, it } from 'vitest';
import { MatchmakingService } from './matchmaking.service';
import {
  InMemoryMatchmakingQueue,
  InMemoryPresenceRepository,
  InMemoryRoomRepository,
} from '../realtime/repositories';
import { RoomService } from '../rooms/room.service';
import { InMemoryUserRepository } from '../users/user.repository';
import { UserService } from '../users/user.service';

describe('casual matchmaking', () => {
  it('groups only compatible players and supports idempotent cancellation', async () => {
    const users = new UserService(new InMemoryUserRepository());
    const presence = new InMemoryPresenceRepository();
    const rooms = new RoomService(
      new InMemoryRoomRepository(),
      presence,
      users,
    );
    const queue = new InMemoryMatchmakingQueue();
    const matchmaking = new MatchmakingService(queue, presence, rooms, users);
    const principals = ['guest_m1', 'guest_m2', 'guest_m3'].map((userId) => ({
      userId,
      authProvider: 'development' as const,
      authProviderId: userId,
      isGuest: true,
    }));
    expect(
      (
        await matchmaking.join(principals[0], {
          playerCount: 3,
          rulesetId: 'classic',
          rulesetVersion: 1,
        })
      ).queued,
    ).toBe(true);
    expect(
      (
        await matchmaking.join(principals[1], {
          playerCount: 3,
          rulesetId: 'classic',
          rulesetVersion: 1,
        })
      ).queued,
    ).toBe(true);
    const match = await matchmaking.join(principals[2], {
      playerCount: 3,
      rulesetId: 'classic',
      rulesetVersion: 1,
    });
    expect(match.queued).toBe(false);
    expect(match.room?.players).toHaveLength(3);
    await matchmaking.cancel(principals[0]);
    await matchmaking.cancel(principals[0]);
  });
});
