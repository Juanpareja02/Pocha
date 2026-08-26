import { describe, expect, it, vi } from 'vitest';
import { UserController } from './user.controller';
import { InMemoryAnalytics, AnalyticsService } from '../analytics/analytics';
import { InMemoryUserRepository } from './user.repository';
import { UserService } from './user.service';

describe('user controller data export', () => {
  it('exports only the authenticated user data and records an audit event', async () => {
    const users = new UserService(new InMemoryUserRepository());
    const principal = {
      userId: 'user-1',
      authProvider: 'development' as const,
      authProviderId: 'user-1',
      isGuest: false,
    };
    users.getOrCreate(principal);
    const analyticsPort = new InMemoryAnalytics();
    const auth = { verifyToken: vi.fn(() => principal) };
    const games = {
      history: vi.fn(async () => [
        {
          gameId: 'game-1',
          roomId: 'room-1',
          mode: 'casual' as const,
          rulesetId: 'classic',
          rulesetVersion: 1,
          players: [
            { userId: 'user-1', seat: 0 },
            { userId: 'other-user', seat: 1 },
          ],
          snapshot: {
            privateCards: ['must-not-export'],
          } as never,
          createdAt: '2026-08-25T00:00:00.000Z',
          status: 'FINISHED' as const,
          finishedAt: '2026-08-25T00:10:00.000Z',
          results: [
            { userId: 'user-1', position: 1, score: 12 },
            { userId: 'other-user', position: 2, score: 8 },
          ],
        },
      ]),
    };
    const controller = new UserController(
      auth as never,
      users,
      games,
      new AnalyticsService(analyticsPort),
    );

    const exported = await controller.exportData('Bearer dev:user-1');
    const json = JSON.stringify(exported);

    expect(exported.profile).not.toHaveProperty('authProviderId');
    expect(exported.games[0]).toMatchObject({
      gameId: 'game-1',
      opponentCount: 1,
      result: { userId: 'user-1', position: 1, score: 12 },
    });
    expect(json).not.toContain('must-not-export');
    expect(json).not.toContain('other-user');
    expect(analyticsPort.events).toHaveLength(1);
    expect(analyticsPort.events[0].name).toBe('data_export_requested');
  });

  it('rejects an unauthenticated export request', async () => {
    const controller = new UserController(
      { verifyToken: vi.fn() } as never,
      new UserService(new InMemoryUserRepository()),
      { history: vi.fn() } as never,
    );

    await expect(controller.exportData()).rejects.toThrow(
      'Authentication required',
    );
  });
});
