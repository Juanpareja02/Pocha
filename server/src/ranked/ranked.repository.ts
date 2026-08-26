import { PrismaClient } from '@prisma/client';
import { SeasonStatsRecord } from './ranked.types';
import { RankedFinalization } from './ranked.types';

export interface RankedHistoryRecord {
  readonly gameId: string;
  readonly seasonId: string;
  readonly userId: string;
  readonly position: number;
  readonly score: number;
  readonly delta: number;
  readonly oldRating: number;
  readonly newRating: number;
  readonly rankId: string;
  readonly previousRankId?: string;
  readonly promoted?: boolean;
  readonly demoted?: boolean;
  readonly abandoned: boolean;
  readonly createdAt: string;
  readonly opponents: readonly string[];
}

export interface RankedRepository {
  finalize(result: RankedFinalization): boolean | Promise<boolean>;
  getSeasonStats(
    userId: string,
    seasonId: string,
  ): SeasonStatsRecord | undefined | Promise<SeasonStatsRecord | undefined>;
  listSeasonStats(
    seasonId: string,
  ): readonly SeasonStatsRecord[] | Promise<readonly SeasonStatsRecord[]>;
  history(
    userId: string,
    seasonId?: string,
    limit?: number,
  ): readonly RankedHistoryRecord[] | Promise<readonly RankedHistoryRecord[]>;
  position(
    userId: string,
    seasonId: string,
  ): number | undefined | Promise<number | undefined>;
  leaderboardPage(
    seasonId: string,
    limit: number,
    cursor?: string,
  ): RankedLeaderboardPage | Promise<RankedLeaderboardPage>;
}

export interface RankedLeaderboardPage {
  readonly items: readonly SeasonStatsRecord[];
  readonly nextCursor?: string;
  readonly startPosition: number;
}

function encodeCursor(stats: SeasonStatsRecord, position: number): string {
  return Buffer.from(
    `${stats.rating}:${stats.userId}:${position}`,
    'utf8',
  ).toString('base64url');
}

function decodeCursor(
  cursor?: string,
): { rating: number; userId: string; position?: number } | undefined {
  if (!cursor) return undefined;
  const [rawRating, ...userParts] = Buffer.from(cursor, 'base64url')
    .toString('utf8')
    .split(':');
  const rating = Number(rawRating);
  const rawPosition = userParts.pop();
  const position = Number(rawPosition);
  const userId = userParts.join(':');
  return Number.isFinite(rating) && userId.length > 0
    ? {
        rating,
        userId,
        position: Number.isFinite(position) ? position : undefined,
      }
    : undefined;
}

function defaultStats(
  userId: string,
  seasonId: string,
  rating = 1000,
): SeasonStatsRecord {
  return {
    seasonId,
    userId,
    rating,
    peakRating: rating,
    placementGames: 0,
    gamesPlayed: 0,
    wins: 0,
    podiums: 0,
    averagePosition: null,
    predictionAccuracy: 0,
    updatedAt: new Date().toISOString(),
  };
}

export class InMemoryRankedRepository implements RankedRepository {
  private readonly stats = new Map<string, SeasonStatsRecord>();
  private readonly games = new Set<string>();
  private readonly histories = new Map<string, RankedHistoryRecord[]>();

  finalize(result: RankedFinalization): boolean {
    if (this.games.has(result.gameId)) return false;
    this.games.add(result.gameId);
    for (const player of result.players) {
      const key = `${result.seasonId}:${player.userId}`;
      const previous =
        this.stats.get(key) ??
        defaultStats(player.userId, result.seasonId, player.oldRating);
      const gamesPlayed = previous.gamesPlayed + 1;
      const next: SeasonStatsRecord = {
        ...previous,
        rating: player.newRating,
        peakRating: Math.max(previous.peakRating, player.newRating),
        placementGames: previous.placementGames + Number(player.provisional),
        gamesPlayed,
        wins: previous.wins + Number(player.position === 1),
        podiums: previous.podiums + Number(player.position <= 3),
        averagePosition:
          ((previous.averagePosition ?? 0) * previous.gamesPlayed +
            player.position) /
          gamesPlayed,
        predictionAccuracy:
          (previous.predictionAccuracy * previous.gamesPlayed +
            player.predictionAccuracy) /
          gamesPlayed,
        updatedAt: result.finishedAt,
      };
      this.stats.set(key, next);
      const rivals = result.players
        .filter((candidate) => candidate.userId !== player.userId)
        .map((candidate) => candidate.userId);
      const history = this.histories.get(player.userId) ?? [];
      history.unshift({
        gameId: result.gameId,
        seasonId: result.seasonId,
        userId: player.userId,
        position: player.position,
        score: player.score,
        delta: player.delta,
        oldRating: player.oldRating,
        newRating: player.newRating,
        rankId: player.rankId,
        previousRankId: player.previousRankId,
        promoted: player.promoted,
        demoted: player.demoted,
        abandoned: player.abandoned,
        createdAt: result.finishedAt,
        opponents: rivals,
      });
      this.histories.set(player.userId, history);
    }
    return true;
  }

  getSeasonStats(
    userId: string,
    seasonId: string,
  ): SeasonStatsRecord | undefined {
    return this.stats.get(`${seasonId}:${userId}`);
  }

  listSeasonStats(seasonId: string): readonly SeasonStatsRecord[] {
    return [...this.stats.values()].filter(
      (stats) => stats.seasonId === seasonId,
    );
  }

  history(
    userId: string,
    seasonId?: string,
    limit = 50,
  ): readonly RankedHistoryRecord[] {
    return (this.histories.get(userId) ?? [])
      .filter((item) => !seasonId || item.seasonId === seasonId)
      .slice(0, limit);
  }

  position(userId: string, seasonId: string): number | undefined {
    const stats = this.getSeasonStats(userId, seasonId);
    if (!stats) return undefined;
    return (
      [...this.listSeasonStats(seasonId)]
        .sort(
          (left, right) =>
            right.rating - left.rating ||
            left.userId.localeCompare(right.userId),
        )
        .findIndex((item) => item.userId === userId) + 1
    );
  }

  leaderboardPage(
    seasonId: string,
    limit: number,
    cursor?: string,
  ): RankedLeaderboardPage {
    const sorted = [...this.listSeasonStats(seasonId)].sort(
      (left, right) =>
        right.rating - left.rating || left.userId.localeCompare(right.userId),
    );
    const decoded = decodeCursor(cursor);
    const cursorStart = decoded
      ? sorted.findIndex(
          (item) =>
            item.rating < decoded.rating ||
            (item.rating === decoded.rating && item.userId > decoded.userId),
        )
      : 0;
    const start = decoded && cursorStart < 0 ? sorted.length : cursorStart;
    const page = sorted.slice(Math.max(0, start), Math.max(0, start) + limit);
    const next = sorted[Math.max(0, start) + limit];
    return {
      items: page,
      startPosition: Math.max(0, start) + 1,
      nextCursor: next
        ? encodeCursor(page[page.length - 1], Math.max(0, start) + page.length)
        : undefined,
    };
  }
}

/** PostgreSQL adapter for ranked stats, results and rating history. */
export class PrismaRankedRepository implements RankedRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async finalize(result: RankedFinalization): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.gameResult.findFirst({
              where: { gameId: result.gameId, eloDelta: { not: null } },
              select: { id: true },
            });
            if (existing) return false;
            for (const player of result.players) {
              const user = await tx.user.findUniqueOrThrow({
                where: { id: player.userId },
              });
              const previousGames = user.rankedGamesPlayed;
              const nextGames = previousGames + 1;
              const previousOverallGames = user.gamesPlayed;
              const nextOverallGames = previousOverallGames + 1;
              await tx.user.update({
                where: { id: player.userId },
                data: {
                  elo: player.newRating,
                  peakElo: Math.max(user.peakElo, player.newRating),
                  gamesPlayed: nextOverallGames,
                  wins: user.wins + Number(player.position === 1),
                  podiums: user.podiums + Number(player.position <= 3),
                  averagePosition:
                    ((user.averagePosition ?? 0) * previousOverallGames +
                      player.position) /
                    nextOverallGames,
                  predictionAccuracy:
                    (user.predictionAccuracy * previousOverallGames +
                      player.predictionAccuracy) /
                    nextOverallGames,
                  rankedGamesPlayed: nextGames,
                  rankedWins: user.rankedWins + Number(player.position === 1),
                  rankedPodiums:
                    user.rankedPodiums + Number(player.position <= 3),
                  rankedAveragePosition:
                    ((user.rankedAveragePosition ?? 0) * previousGames +
                      player.position) /
                    nextGames,
                  rankedBestElo: Math.max(user.rankedBestElo, player.newRating),
                  rankedPredictionAccuracy:
                    (user.rankedPredictionAccuracy * previousGames +
                      player.predictionAccuracy) /
                    nextGames,
                  disconnectRate:
                    (user.rankedDisconnects + Number(player.disconnected)) /
                    nextGames,
                  rankedAbandons:
                    user.rankedAbandons + Number(player.abandoned),
                  rankedDisconnects:
                    user.rankedDisconnects + Number(player.disconnected),
                  rankedTimeouts: user.rankedTimeouts + Number(player.timedOut),
                  queuePenaltyUntil: player.queuePenaltyUntil
                    ? new Date(player.queuePenaltyUntil)
                    : null,
                },
              });
              const previousSeasonStats = await tx.seasonPlayerStats.findUnique(
                {
                  where: {
                    seasonId_userId: {
                      seasonId: result.seasonId,
                      userId: player.userId,
                    },
                  },
                },
              );
              const previousSeasonGames = previousSeasonStats?.gamesPlayed ?? 0;
              const nextSeasonGames = previousSeasonGames + 1;
              await tx.seasonPlayerStats.upsert({
                where: {
                  seasonId_userId: {
                    seasonId: result.seasonId,
                    userId: player.userId,
                  },
                },
                create: {
                  seasonId: result.seasonId,
                  userId: player.userId,
                  rating: player.newRating,
                  peakRating: player.newRating,
                  placementGames: Number(player.provisional),
                  gamesPlayed: 1,
                  wins: Number(player.position === 1),
                  podiums: Number(player.position <= 3),
                  averagePosition: player.position,
                  predictionAccuracy: player.predictionAccuracy,
                },
                update: {
                  rating: player.newRating,
                  peakRating: {
                    set: Math.max(
                      previousSeasonStats?.peakRating ?? player.oldRating,
                      player.newRating,
                    ),
                  },
                  placementGames: { increment: Number(player.provisional) },
                  gamesPlayed: { increment: 1 },
                  wins: { increment: Number(player.position === 1) },
                  podiums: { increment: Number(player.position <= 3) },
                  averagePosition:
                    ((previousSeasonStats?.averagePosition ?? 0) *
                      previousSeasonGames +
                      player.position) /
                    nextSeasonGames,
                  predictionAccuracy:
                    ((previousSeasonStats?.predictionAccuracy ?? 0) *
                      previousSeasonGames +
                      player.predictionAccuracy) /
                    nextSeasonGames,
                },
              });
              await tx.gameResult.upsert({
                where: {
                  gameId_userId: {
                    gameId: result.gameId,
                    userId: player.userId,
                  },
                },
                create: {
                  gameId: result.gameId,
                  userId: player.userId,
                  position: player.position,
                  score: player.score,
                  eloDelta: player.delta,
                  oldRating: player.oldRating,
                  newRating: player.newRating,
                  rankId: player.rankId,
                  previousRankId: player.previousRankId,
                  promoted: player.promoted ?? false,
                  demoted: player.demoted ?? false,
                  abandoned: player.abandoned,
                },
                update: {
                  position: player.position,
                  score: player.score,
                  eloDelta: player.delta,
                  oldRating: player.oldRating,
                  newRating: player.newRating,
                  rankId: player.rankId,
                  previousRankId: player.previousRankId,
                  promoted: player.promoted ?? false,
                  demoted: player.demoted ?? false,
                  abandoned: player.abandoned,
                },
              });
              await tx.ratingHistory.create({
                data: {
                  userId: player.userId,
                  gameId: result.gameId,
                  seasonId: result.seasonId,
                  before: player.oldRating,
                  delta: player.delta,
                  after: player.newRating,
                },
              });
            }
            return true;
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== 'P2034' || attempt === 2) throw error;
      }
    }
    return false;
  }

  async getSeasonStats(
    userId: string,
    seasonId: string,
  ): Promise<SeasonStatsRecord | undefined> {
    const stats = await this.prisma.seasonPlayerStats.findUnique({
      where: { seasonId_userId: { seasonId, userId } },
    });
    return stats ? this.toStats(stats) : undefined;
  }

  async listSeasonStats(
    seasonId: string,
  ): Promise<readonly SeasonStatsRecord[]> {
    const stats = await this.prisma.seasonPlayerStats.findMany({
      where: { seasonId },
      orderBy: [{ rating: 'desc' }, { userId: 'asc' }],
    });
    return stats.map((value) => this.toStats(value));
  }

  async history(
    userId: string,
    seasonId?: string,
    limit = 50,
  ): Promise<readonly RankedHistoryRecord[]> {
    const rows = await this.prisma.gameResult.findMany({
      where: {
        userId,
        game: { mode: 'ranked', seasonId: seasonId ?? undefined },
      },
      include: { game: { include: { players: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      gameId: row.gameId,
      seasonId: row.game.seasonId ?? '',
      userId: row.userId,
      position: row.position,
      score: row.score,
      delta: row.eloDelta ?? 0,
      oldRating: row.oldRating ?? row.newRating ?? 1000,
      newRating: row.newRating ?? row.oldRating ?? 1000,
      rankId: row.rankId ?? 'unranked',
      previousRankId: row.previousRankId ?? undefined,
      promoted: row.promoted,
      demoted: row.demoted,
      abandoned: row.abandoned,
      createdAt: row.createdAt.toISOString(),
      opponents: row.game.players
        .filter((player) => player.userId !== userId)
        .map((player) => player.userId),
    }));
  }

  async position(
    userId: string,
    seasonId: string,
  ): Promise<number | undefined> {
    const current = await this.prisma.seasonPlayerStats.findUnique({
      where: { seasonId_userId: { seasonId, userId } },
    });
    if (!current) return undefined;
    return (
      1 +
      (await this.prisma.seasonPlayerStats.count({
        where: {
          seasonId,
          OR: [
            { rating: { gt: current.rating } },
            { rating: current.rating, userId: { lt: userId } },
          ],
        },
      }))
    );
  }

  async leaderboardPage(
    seasonId: string,
    limit: number,
    cursor?: string,
  ): Promise<RankedLeaderboardPage> {
    const decoded = decodeCursor(cursor);
    const rows = await this.prisma.seasonPlayerStats.findMany({
      where: {
        seasonId,
        ...(decoded
          ? {
              OR: [
                { rating: { lt: decoded.rating } },
                { rating: decoded.rating, userId: { gt: decoded.userId } },
              ],
            }
          : {}),
      },
      orderBy: [{ rating: 'desc' }, { userId: 'asc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit).map((value) => this.toStats(value));
    return {
      items: page,
      startPosition: decoded?.position ? decoded.position + 1 : 1,
      nextCursor:
        rows.length > limit && page.length > 0
          ? encodeCursor(
              page[page.length - 1],
              (decoded?.position ?? 0) + page.length,
            )
          : undefined,
    };
  }

  private toStats(row: {
    seasonId: string;
    userId: string;
    rating: number;
    peakRating: number;
    placementGames: number;
    gamesPlayed: number;
    wins: number;
    podiums: number;
    averagePosition: number | null;
    predictionAccuracy: number;
    updatedAt: Date;
  }): SeasonStatsRecord {
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  }
}
