import { describe, expect, it } from 'vitest';
import { InMemoryPresenceRepository } from './repositories';
import { RealtimeRateLimiter } from './rate-limiter';

describe('realtime safety boundaries', () => {
  it('limits commands per user and action inside the configured window', () => {
    const limiter = new RealtimeRateLimiter();

    expect(limiter.allow('user-1:game:playCard', 2, 10_000)).toBe(true);
    expect(limiter.allow('user-1:game:playCard', 2, 10_000)).toBe(true);
    expect(limiter.allow('user-1:game:playCard', 2, 10_000)).toBe(false);
    expect(limiter.allow('user-2:game:playCard', 2, 10_000)).toBe(true);
  });

  it('keeps presence status separate from active-game membership', () => {
    const presence = new InMemoryPresenceRepository();

    presence.set('user-1', 'ONLINE');
    expect(presence.hasActiveGame('user-1')).toBe(false);
    presence.set('user-1', 'DISCONNECTED', 'room-1', 'game-1');
    expect(presence.get('user-1')?.status).toBe('DISCONNECTED');
    expect(presence.hasActiveGame('user-1')).toBe(false);
    presence.set('user-1', 'IN_GAME', 'room-1', 'game-1');
    expect(presence.hasActiveGame('user-1')).toBe(true);
    presence.clear('user-1');
    expect(presence.get('user-1')).toBeUndefined();
  });
});
