import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RANKED_REPOSITORY } from '../realtime/tokens';
import { UserService } from '../users/user.service';
import { RankedRepository } from './ranked.repository';
import { SeasonService } from './season.service';

export interface LeaderboardItem {
  readonly position: number;
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly rating: number;
  readonly rank: { id: string; name: string; minimumElo: number };
  readonly gamesPlayed: number;
  readonly provisional: boolean;
}

export interface LeaderboardPage {
  readonly seasonId: string;
  readonly items: readonly LeaderboardItem[];
  readonly nextCursor?: string;
  readonly myPosition?: number;
}

function globalCursor(
  rating: number,
  userId: string,
  position: number,
): string {
  return Buffer.from(`${rating}:${userId}:${position}`, 'utf8').toString(
    'base64url',
  );
}

function readGlobalCursor(
  cursor?: string,
): { rating: number; userId: string; position: number } | undefined {
  if (!cursor) return undefined;
  const [rawRating, userId, rawPosition] = Buffer.from(cursor, 'base64url')
    .toString('utf8')
    .split(':');
  const rating = Number(rawRating);
  const position = Number(rawPosition);
  return Number.isFinite(rating) && Number.isFinite(position) && Boolean(userId)
    ? { rating, userId, position }
    : undefined;
}

@Injectable()
export class LeaderboardService {
  constructor(
    @Inject(RANKED_REPOSITORY) private readonly repository: RankedRepository,
    @Inject(UserService) private readonly users: UserService,
    @Inject(SeasonService) private readonly seasons: SeasonService,
  ) {}

  async page(
    seasonId: string,
    limit = 50,
    cursor?: string,
    userId?: string,
  ): Promise<LeaderboardPage> {
    const season = this.seasons.find(seasonId);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const page = await this.repository.leaderboardPage(
      seasonId,
      safeLimit,
      cursor,
    );
    const items = page.items.map((stats, index) => {
      const user = this.users.findById(stats.userId);
      return {
        position: page.startPosition + index,
        userId: stats.userId,
        username: user?.username ?? 'jugador',
        displayName: user?.displayName ?? 'Jugador',
        rating: stats.rating,
        rank: this.seasons.rankForRating(stats.rating, season),
        gamesPlayed: stats.gamesPlayed,
        provisional: stats.placementGames < season.placementGames,
      };
    });
    const myPosition = userId
      ? await this.repository.position(userId, seasonId)
      : undefined;
    return { seasonId, items, nextCursor: page.nextCursor, myPosition };
  }

  async globalPage(
    limit = 50,
    cursor?: string,
    userId?: string,
  ): Promise<LeaderboardPage> {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const season = this.seasons.requireActive();
    const sorted = (await this.users.allFresh())
      .filter((user) => user.rankedGamesPlayed > 0)
      .sort(
        (left, right) =>
          right.elo - left.elo || left.id.localeCompare(right.id),
      );
    const decoded = readGlobalCursor(cursor);
    const cursorStart = decoded
      ? sorted.findIndex(
          (user) =>
            user.elo < decoded.rating ||
            (user.elo === decoded.rating && user.id > decoded.userId),
        )
      : 0;
    const start = decoded && cursorStart < 0 ? sorted.length : cursorStart;
    const offset = Math.max(0, start);
    const rows = sorted.slice(offset, offset + safeLimit);
    const items = rows.map((user, index) => ({
      position: offset + index + 1,
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      rating: user.elo,
      rank: this.seasons.rankForRating(user.elo, season),
      gamesPlayed: user.rankedGamesPlayed,
      provisional: user.rankedGamesPlayed < season.placementGames,
    }));
    const next = sorted[offset + safeLimit];
    const myPosition = userId
      ? sorted.findIndex((user) => user.id === userId) + 1 || undefined
      : undefined;
    return {
      seasonId: 'global',
      items,
      myPosition,
      nextCursor:
        next && rows.length > 0
          ? globalCursor(
              rows[rows.length - 1].elo,
              rows[rows.length - 1].id,
              offset + rows.length,
            )
          : undefined,
    };
  }

  async profile(
    userId: string,
    seasonId?: string,
  ): Promise<Record<string, unknown>> {
    const user = this.users.findById(userId);
    if (!user) throw new NotFoundException('User profile not found');
    const season = seasonId
      ? this.seasons.find(seasonId)
      : this.seasons.requireActive();
    const stats = await this.repository.getSeasonStats(userId, season.id);
    const rating = stats?.rating ?? user.elo;
    const rank = this.seasons.rankForRating(rating, season);
    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      season: {
        id: season.id,
        name: season.name,
        number: season.number,
        status: season.status,
        endsAt: season.endsAt,
      },
      rating,
      peakRating: stats?.peakRating ?? user.rankedBestElo,
      rank,
      provisional:
        (stats?.placementGames ?? user.rankedGamesPlayed) <
        season.placementGames,
      placementGames: stats?.placementGames ?? user.rankedGamesPlayed,
      placementTotal: season.placementGames,
      position: await this.repository.position(userId, season.id),
      gamesPlayed: stats?.gamesPlayed ?? user.rankedGamesPlayed,
      wins: stats?.wins ?? user.rankedWins,
      podiums: stats?.podiums ?? user.rankedPodiums,
      averagePosition: stats?.averagePosition ?? user.rankedAveragePosition,
      predictionAccuracy:
        stats?.predictionAccuracy ?? user.rankedPredictionAccuracy,
      bestRating: user.rankedBestElo,
    };
  }

  async history(userId: string, seasonId?: string, limit = 50) {
    return this.repository.history(
      userId,
      seasonId,
      Math.min(100, Math.max(1, limit)),
    );
  }
}
