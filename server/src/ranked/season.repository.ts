import { PrismaClient } from '@prisma/client';
import { DEFAULT_RANKS } from '../game-engine';
import {
  DEFAULT_RANKED_MATCHMAKING_CONFIG,
  RankedSeasonConfig,
  SeasonStatus,
} from './ranked.types';

export interface SeasonRepository {
  findById(id: string): RankedSeasonConfig | undefined;
  findActive(): RankedSeasonConfig | undefined;
  save(season: RankedSeasonConfig): RankedSeasonConfig;
  list(): readonly RankedSeasonConfig[];
  initialize?(): Promise<void>;
}

export function createDefaultSeason(): RankedSeasonConfig {
  return {
    id: 'season_1',
    name: 'Temporada 1',
    number: 1,
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: null,
    rulesetId: 'ranked_standard',
    rulesetVersion: 1,
    status: 'ACTIVE',
    placementGames: 10,
    rating: {
      defaultKFactor: 32,
      provisionalKFactor: 64,
      provisionalGames: 10,
      normalization: 1,
    },
    matchmaking: DEFAULT_RANKED_MATCHMAKING_CONFIG,
    rankTiers: DEFAULT_RANKS,
  };
}

export class InMemorySeasonRepository implements SeasonRepository {
  private readonly seasons = new Map<string, RankedSeasonConfig>([
    [createDefaultSeason().id, createDefaultSeason()],
  ]);

  findById(id: string): RankedSeasonConfig | undefined {
    return this.seasons.get(id);
  }

  findActive(): RankedSeasonConfig | undefined {
    return [...this.seasons.values()].find(
      (season) => season.status === 'ACTIVE',
    );
  }

  save(season: RankedSeasonConfig): RankedSeasonConfig {
    this.seasons.set(season.id, season);
    return season;
  }

  list(): readonly RankedSeasonConfig[] {
    return [...this.seasons.values()].sort(
      (left, right) => right.number - left.number,
    );
  }
}

/** PostgreSQL adapter. The JSON config keeps matchmaking/rating policy versioned per season. */
export class PrismaSeasonRepository implements SeasonRepository {
  private readonly cache = new Map<string, RankedSeasonConfig>();

  constructor(private readonly prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    const seasons = await this.prisma.rankedSeason.findMany({
      orderBy: { number: 'desc' },
    });
    for (const row of seasons) this.cache.set(row.id, this.fromRow(row));
    if (this.cache.size === 0) this.save(createDefaultSeason());
  }

  findById(id: string): RankedSeasonConfig | undefined {
    return this.cache.get(id);
  }

  findActive(): RankedSeasonConfig | undefined {
    return [...this.cache.values()].find(
      (season) => season.status === 'ACTIVE',
    );
  }

  save(season: RankedSeasonConfig): RankedSeasonConfig {
    this.cache.set(season.id, season);
    void this.prisma.rankedSeason.upsert({
      where: { id: season.id },
      create: this.toPersistence(season),
      update: this.toPersistence(season),
    });
    return season;
  }

  list(): readonly RankedSeasonConfig[] {
    return [...this.cache.values()].sort(
      (left, right) => right.number - left.number,
    );
  }

  private toPersistence(season: RankedSeasonConfig) {
    return {
      id: season.id,
      name: season.name,
      number: season.number,
      startsAt: new Date(season.startsAt),
      endsAt: season.endsAt ? new Date(season.endsAt) : null,
      rulesetId: season.rulesetId,
      version: season.rulesetVersion,
      status: season.status,
      placementGames: season.placementGames,
      config: season as object,
    };
  }

  private fromRow(row: {
    id: string;
    name: string;
    number: number;
    startsAt: Date;
    endsAt: Date | null;
    rulesetId: string;
    version: number;
    status: string;
    placementGames: number;
    config: unknown;
  }): RankedSeasonConfig {
    const config = row.config as Partial<RankedSeasonConfig> | null;
    return {
      ...createDefaultSeason(),
      ...config,
      id: row.id,
      name: row.name,
      number: row.number,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      rulesetId: row.rulesetId as RankedSeasonConfig['rulesetId'],
      rulesetVersion: row.version as RankedSeasonConfig['rulesetVersion'],
      status: row.status as SeasonStatus,
      placementGames: row.placementGames,
    };
  }
}
