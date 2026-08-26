import { RatingConfig, RankDefinition } from '../game-engine';

export const RANKED_RULESET_ID = 'ranked_standard';
export const RANKED_RULESET_VERSION = 1;
export const RANKED_PLAYER_COUNT = 4;

export type SeasonStatus = 'UPCOMING' | 'ACTIVE' | 'FINISHED';

export interface RankedSeasonConfig {
  readonly id: string;
  readonly name: string;
  readonly number: number;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly rulesetId: typeof RANKED_RULESET_ID;
  readonly rulesetVersion: typeof RANKED_RULESET_VERSION;
  readonly status: SeasonStatus;
  readonly placementGames: number;
  readonly rating: RatingConfig;
  readonly matchmaking: RankedMatchmakingConfig;
  readonly rankTiers: readonly RankDefinition[];
}

export interface SeasonStatsRecord {
  readonly seasonId: string;
  readonly userId: string;
  readonly rating: number;
  readonly peakRating: number;
  readonly placementGames: number;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly podiums: number;
  readonly averagePosition: number | null;
  readonly predictionAccuracy: number;
  readonly updatedAt: string;
}

export interface RankedQueueEntry {
  readonly userId: string;
  readonly seasonId: string;
  readonly rulesetId: typeof RANKED_RULESET_ID;
  readonly rulesetVersion: typeof RANKED_RULESET_VERSION;
  readonly rating: number;
  readonly gamesPlayed: number;
  readonly provisional: boolean;
  readonly queuedAt: string;
  readonly region?: string;
}

export interface RankedMatchmakingConfig {
  readonly playerCount: typeof RANKED_PLAYER_COUNT;
  readonly expansion: readonly {
    afterMs: number;
    maxRatingDifference: number;
  }[];
  readonly maximumWaitMs: number;
  readonly provisionalMixPenalty: number;
}

export const DEFAULT_RANKED_MATCHMAKING_CONFIG: RankedMatchmakingConfig = {
  playerCount: RANKED_PLAYER_COUNT,
  expansion: [
    { afterMs: 0, maxRatingDifference: 100 },
    { afterMs: 10_000, maxRatingDifference: 150 },
    { afterMs: 20_000, maxRatingDifference: 250 },
    { afterMs: 30_000, maxRatingDifference: 400 },
  ],
  maximumWaitMs: 120_000,
  provisionalMixPenalty: 25,
};

export interface RankedPlayerResult {
  readonly userId: string;
  readonly position: number;
  readonly score: number;
  readonly oldRating: number;
  readonly newRating: number;
  readonly delta: number;
  readonly rankId: string;
  readonly previousRankId?: string;
  readonly promoted?: boolean;
  readonly demoted?: boolean;
  readonly provisional: boolean;
  readonly abandoned: boolean;
  readonly disconnected: boolean;
  readonly timedOut: boolean;
  readonly queuePenaltyUntil: string | null;
  readonly predictionAccuracy: number;
}

export interface RankedFinalization {
  readonly gameId: string;
  readonly seasonId: string;
  readonly rulesetId: typeof RANKED_RULESET_ID;
  readonly rulesetVersion: typeof RANKED_RULESET_VERSION;
  readonly finishedAt: string;
  readonly players: readonly RankedPlayerResult[];
}
