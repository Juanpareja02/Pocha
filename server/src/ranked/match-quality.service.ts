import { Injectable, Optional } from '@nestjs/common';
import {
  DEFAULT_RANKED_MATCHMAKING_CONFIG,
  RankedMatchmakingConfig,
  RankedQueueEntry,
} from './ranked.types';

@Injectable()
export class MatchQualityService {
  constructor(
    @Optional()
    private readonly config: RankedMatchmakingConfig = DEFAULT_RANKED_MATCHMAKING_CONFIG,
  ) {}

  forConfig(config: RankedMatchmakingConfig): MatchQualityService {
    return new MatchQualityService(config);
  }

  allowedRatingDifference(waitMs: number): number {
    const sorted = [...this.config.expansion].sort(
      (left, right) => left.afterMs - right.afterMs,
    );
    return (
      [...sorted].reverse().find((step) => waitMs >= step.afterMs)
        ?.maxRatingDifference ?? sorted[0].maxRatingDifference
    );
  }

  canMatch(entries: readonly RankedQueueEntry[], now = Date.now()): boolean {
    if (entries.length !== this.config.playerCount) return false;
    return this.isCompatible(entries, now);
  }

  isCompatible(
    entries: readonly RankedQueueEntry[],
    now = Date.now(),
  ): boolean {
    if (entries.length === 0 || entries.length > this.config.playerCount)
      return false;
    if (new Set(entries.map((entry) => entry.seasonId)).size !== 1)
      return false;
    if (new Set(entries.map((entry) => entry.rulesetId)).size !== 1)
      return false;
    if (new Set(entries.map((entry) => entry.rulesetVersion)).size !== 1)
      return false;
    const regions = new Set(
      entries
        .map((entry) => entry.region)
        .filter((region): region is string => Boolean(region)),
    );
    if (regions.size > 1) return false;
    const minRating = Math.min(...entries.map((entry) => entry.rating));
    const maxRating = Math.max(...entries.map((entry) => entry.rating));
    const maxAllowed = Math.min(
      ...entries.map((entry) =>
        this.allowedRatingDifference(now - Date.parse(entry.queuedAt)),
      ),
    );
    return maxRating - minRating <= maxAllowed;
  }

  score(entries: readonly RankedQueueEntry[], now = Date.now()): number {
    if (entries.length === 0) return Number.POSITIVE_INFINITY;
    const ratings = entries.map((entry) => entry.rating);
    const average =
      ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    const deviation = Math.sqrt(
      ratings.reduce((sum, rating) => sum + (rating - average) ** 2, 0) /
        ratings.length,
    );
    const wait = Math.max(
      ...entries.map((entry) => now - Date.parse(entry.queuedAt)),
    );
    const provisionalCount = entries.filter(
      (entry) => entry.provisional,
    ).length;
    const hasMixedProvisionalState =
      provisionalCount > 0 && provisionalCount < entries.length;
    return (
      deviation +
      Math.max(...ratings) -
      Math.min(...ratings) -
      Math.min(wait / 1000, 30) +
      (hasMixedProvisionalState ? this.config.provisionalMixPenalty : 0)
    );
  }
}
