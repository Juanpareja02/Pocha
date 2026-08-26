import { describe, expect, it } from 'vitest';
import { classicRules, createGame } from '../game-engine';
import { UserService } from '../users/user.service';
import { InMemoryUserRepository } from '../users/user.repository';
import { InMemoryRankedRepository } from './ranked.repository';
import { RankedResultService } from './ranked-result.service';
import { RankedAbusePolicyService } from './abuse-policy.service';
import { InMemorySeasonRepository } from './season.repository';
import { SeasonService } from './season.service';

describe('ranked result finalization', () => {
  it('updates season history once and moves an explicit abandoner to last place', async () => {
    const users = new UserService(new InMemoryUserRepository());
    const seasonRepository = new InMemorySeasonRepository();
    const seasons = new SeasonService(seasonRepository);
    const repository = new InMemoryRankedRepository();
    const service = new RankedResultService(
      repository,
      users,
      seasons,
      new RankedAbusePolicyService(),
    );
    const players = ['a', 'b', 'c', 'd'].map((userId, seat) => {
      users.profile({
        userId,
        authProvider: 'development',
        authProviderId: userId,
        isGuest: false,
      });
      return {
        userId,
        displayName: userId,
        username: userId,
        avatarSeed: seat,
        seat,
        isHost: seat === 0,
        isBot: false as const,
        ready: true,
        connectionStatus: 'CONNECTED' as const,
      };
    });
    const room = {
      protocolVersion: 1 as const,
      roomId: 'room-ranked',
      code: 'RANK01',
      hostUserId: 'a',
      status: 'STARTED' as const,
      mode: 'ranked' as const,
      seasonId: 'season_1',
      config: {
        playerCount: 4,
        rulesetId: 'ranked_standard' as const,
        rulesetVersion: 1,
        allowBots: false,
        botDifficulty: 'normal' as const,
      },
      players,
      createdAt: new Date().toISOString(),
    };
    const state = createGame(
      'game-ranked',
      players.map((player) => ({
        id: player.userId,
        name: player.displayName,
      })),
      { ...classicRules(4), id: 'ranked_standard' },
    );
    const result = {
      gameId: 'game-ranked',
      roomId: room.roomId,
      state,
      finishedAt: new Date().toISOString(),
      predictionAccuracy: { a: 1, b: 0.5, c: 0, d: 0 },
      abandonedPlayerIds: ['a'],
      disconnectedPlayerIds: ['a'],
      timedOutPlayerIds: [],
    };
    const finalized = await service.finalize(result, room);
    await service.finalize(result, room);
    expect(repository.history('a', 'season_1')).toHaveLength(1);
    expect(repository.history('a', 'season_1')[0].position).toBe(4);
    expect(users.findById('a')!.rankedGamesPlayed).toBe(1);
    expect(users.findById('a')!.rankedAbandons).toBe(1);
    expect(
      finalized.players.find((player) => player.userId === 'a')?.previousRankId,
    ).toBe('silver');
    expect(
      finalized.players.find((player) => player.userId === 'a')?.demoted,
    ).toBe(true);
  });

  it('is idempotent when the same game is finalized concurrently', async () => {
    const users = new UserService(new InMemoryUserRepository());
    const seasons = new SeasonService(new InMemorySeasonRepository());
    const repository = new InMemoryRankedRepository();
    const service = new RankedResultService(
      repository,
      users,
      seasons,
      new RankedAbusePolicyService(),
    );
    const players = ['a', 'b', 'c', 'd'].map((userId, seat) => {
      users.profile({
        userId,
        authProvider: 'development',
        authProviderId: userId,
        isGuest: false,
      });
      return {
        userId,
        displayName: userId,
        username: userId,
        avatarSeed: seat,
        seat,
        isHost: seat === 0,
        isBot: false as const,
        ready: true,
        connectionStatus: 'CONNECTED' as const,
      };
    });
    const room = {
      protocolVersion: 1 as const,
      roomId: 'room-concurrent',
      code: 'CONCUR',
      hostUserId: 'a',
      status: 'STARTED' as const,
      mode: 'ranked' as const,
      seasonId: 'season_1',
      config: {
        playerCount: 4,
        rulesetId: 'ranked_standard' as const,
        rulesetVersion: 1,
        allowBots: false,
        botDifficulty: 'normal' as const,
      },
      players,
      createdAt: new Date().toISOString(),
    };
    const state = createGame(
      'game-concurrent',
      players.map((player) => ({
        id: player.userId,
        name: player.displayName,
      })),
      { ...classicRules(4), id: 'ranked_standard' },
    );
    const result = {
      gameId: 'game-concurrent',
      roomId: room.roomId,
      state,
      finishedAt: new Date().toISOString(),
      predictionAccuracy: {},
      abandonedPlayerIds: [],
      disconnectedPlayerIds: [],
      timedOutPlayerIds: [],
    };
    await Promise.all(
      Array.from({ length: 8 }, () => service.finalize(result, room)),
    );
    expect(repository.history('a', 'season_1')).toHaveLength(1);
    expect(users.findById('a')!.rankedGamesPlayed).toBe(1);
  });
});
