import { describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../users/user.repository';
import { UserService } from '../users/user.service';
import { InMemoryRankedRepository } from './ranked.repository';
import { LeaderboardService } from './leaderboard.service';
import { InMemorySeasonRepository } from './season.repository';
import { SeasonService } from './season.service';

function finalization(
  gameId: string,
  players: readonly string[],
  rating = 1000,
) {
  return {
    gameId,
    seasonId: 'season_1',
    rulesetId: 'ranked_standard' as const,
    rulesetVersion: 1 as const,
    finishedAt: new Date().toISOString(),
    players: players.map((userId, index) => ({
      userId,
      position: index + 1,
      score: 40 - index,
      oldRating: rating,
      newRating: rating - index * 10,
      delta: -index * 10,
      rankId: 'silver',
      provisional: false,
      abandoned: false,
      disconnected: false,
      timedOut: false,
      queuePenaltyUntil: null,
      predictionAccuracy: 0.5,
    })),
  };
}

describe('LeaderboardService', () => {
  it('paginates with stable positions and exposes the requesting player position', async () => {
    const users = new UserService(new InMemoryUserRepository());
    for (const userId of ['charlie', 'alpha', 'bravo']) {
      users.profile({
        userId,
        authProvider: 'development',
        authProviderId: userId,
        isGuest: false,
      });
    }
    const repository = new InMemoryRankedRepository();
    repository.finalize(finalization('game-1', ['charlie', 'alpha', 'bravo']));
    const seasons = new SeasonService(new InMemorySeasonRepository());
    const service = new LeaderboardService(repository, users, seasons);

    const first = await service.page('season_1', 2, undefined, 'bravo');
    expect(first.items.map((item) => item.userId)).toEqual([
      'charlie',
      'alpha',
    ]);
    expect(first.items.map((item) => item.position)).toEqual([1, 2]);
    expect(first.myPosition).toBe(3);
    expect(first.nextCursor).toBeDefined();

    const second = await service.page('season_1', 2, first.nextCursor);
    expect(second.items.map((item) => item.userId)).toEqual(['bravo']);
    expect(second.items[0].position).toBe(3);
  });

  it('keeps users without ranked games out of the ranked board until they play', async () => {
    const users = new UserService(new InMemoryUserRepository());
    users.profile({
      userId: 'new-user',
      authProvider: 'development',
      authProviderId: 'new-user',
      isGuest: false,
    });
    const repository = new InMemoryRankedRepository();
    const seasons = new SeasonService(new InMemorySeasonRepository());
    const service = new LeaderboardService(repository, users, seasons);
    const page = await service.page('season_1', 50, undefined, 'new-user');
    expect(page.items).toHaveLength(0);
    expect(page.myPosition).toBeUndefined();
  });

  it('can expose the global ranked board using the same stable ordering', async () => {
    const users = new UserService(new InMemoryUserRepository());
    for (const [userId, rating] of [
      ['alpha', 1200],
      ['bravo', 1200],
      ['charlie', 900],
    ] as const) {
      const profile = users.profile({
        userId,
        authProvider: 'development',
        authProviderId: userId,
        isGuest: false,
      });
      users.saveProfile(
        users.rankedResultPreview(userId, {
          position: 1,
          predictionAccuracy: 1,
          newRating: rating,
          abandoned: false,
          disconnected: false,
          timedOut: false,
          queuePenaltyUntil: null,
        }),
      );
      void profile;
    }
    const service = new LeaderboardService(
      new InMemoryRankedRepository(),
      users,
      new SeasonService(new InMemorySeasonRepository()),
    );
    const page = await service.globalPage(2, undefined, 'bravo');
    expect(page.items.map((item) => item.userId)).toEqual(['alpha', 'bravo']);
    expect(page.myPosition).toBe(2);
  });
});
