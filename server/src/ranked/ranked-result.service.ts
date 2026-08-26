import { Inject, Injectable } from '@nestjs/common';
import { calculateFinalResults, RatingService } from '../game-engine';
import { GameFinishedResult } from '../game-sessions/game-session';
import { RoomRecord } from '../realtime/repositories';
import { RANKED_REPOSITORY } from '../realtime/tokens';
import { UserService } from '../users/user.service';
import { RankedRepository } from './ranked.repository';
import { RankedAbusePolicyService } from './abuse-policy.service';
import { RankedFinalization, RankedPlayerResult } from './ranked.types';
import { SeasonService } from './season.service';
import { AnalyticsService, NoopAnalytics } from '../analytics/analytics';

@Injectable()
export class RankedResultService {
  constructor(
    @Inject(RANKED_REPOSITORY) private readonly repository: RankedRepository,
    @Inject(UserService) private readonly users: UserService,
    @Inject(SeasonService) private readonly seasons: SeasonService,
    @Inject(RankedAbusePolicyService)
    private readonly abuse: RankedAbusePolicyService,
    @Inject(AnalyticsService)
    private readonly analytics: AnalyticsService = new AnalyticsService(
      new NoopAnalytics(),
    ),
  ) {}

  async finalize(
    result: GameFinishedResult,
    room: RoomRecord,
  ): Promise<RankedFinalization> {
    if (room.mode !== 'ranked' || !room.seasonId) {
      throw new Error('Ranked result received for a non-ranked room');
    }
    const season = this.seasons.find(room.seasonId);
    const abandoned = new Set(result.abandonedPlayerIds);
    const disconnected = new Set(result.disconnectedPlayerIds);
    const timedOut = new Set(result.timedOutPlayerIds);
    const finalResults = calculateFinalResults(result.state)
      .sort(
        (left, right) =>
          Number(abandoned.has(left.playerId)) -
            Number(abandoned.has(right.playerId)) ||
          left.position - right.position,
      )
      .map((item, index) => ({ ...item, position: index + 1 }));
    const positions = Object.fromEntries(
      finalResults.map((item) => [item.playerId, item.position]),
    );
    const profiles = room.players.map(
      (player) =>
        this.users.findById(player.userId) ??
        this.users.profile({
          userId: player.userId,
          authProvider: 'development',
          authProviderId: player.userId,
          isGuest: false,
        }),
    );
    const ratingResults = new RatingService(season.rating).calculate(
      profiles.map((profile) => ({
        id: profile.id,
        rating: profile.elo,
        gamesPlayed: profile.rankedGamesPlayed,
      })),
      positions,
    );
    const players: RankedPlayerResult[] = finalResults.map((item) => {
      const profile = profiles.find(
        (candidate) => candidate.id === item.playerId,
      )!;
      const rating = ratingResults.find(
        (candidate) => candidate.id === item.playerId,
      )!;
      const isAbandoned = abandoned.has(item.playerId);
      const queuePenaltyUntil = isAbandoned
        ? this.abuse.cooldownAfterAbandonment(profile.rankedAbandons + 1)
        : null;
      const previousRank = this.seasons.rankForRating(rating.oldRating, season);
      const nextRank = this.seasons.rankForRating(rating.newRating, season);
      return {
        userId: item.playerId,
        position: item.position,
        score: item.score,
        oldRating: rating.oldRating,
        newRating: rating.newRating,
        delta: rating.delta,
        rankId: nextRank.id,
        previousRankId: previousRank.id,
        promoted: nextRank.minimumElo > previousRank.minimumElo,
        demoted: nextRank.minimumElo < previousRank.minimumElo,
        provisional: rating.provisional,
        abandoned: isAbandoned,
        disconnected: disconnected.has(item.playerId),
        timedOut: timedOut.has(item.playerId),
        queuePenaltyUntil,
        predictionAccuracy: result.predictionAccuracy[item.playerId] ?? 0,
      };
    });
    const finalization: RankedFinalization = {
      gameId: result.gameId,
      seasonId: season.id,
      rulesetId: season.rulesetId,
      rulesetVersion: season.rulesetVersion,
      finishedAt: result.finishedAt,
      players,
    };
    const applied = await this.repository.finalize(finalization);
    if (applied !== false) {
      for (const player of players) {
        this.analytics.track('ranked_game_finished', {
          userId: player.userId,
          gameId: result.gameId,
          seasonId: season.id,
          properties: {
            position: player.position,
            delta: player.delta,
            abandoned: player.abandoned,
          },
        });
        if (player.promoted)
          this.analytics.track('rank_promoted', {
            userId: player.userId,
            gameId: result.gameId,
            seasonId: season.id,
            properties: { rankId: player.rankId },
          });
        if (player.demoted)
          this.analytics.track('rank_demoted', {
            userId: player.userId,
            gameId: result.gameId,
            seasonId: season.id,
            properties: { rankId: player.rankId },
          });
        const profile = this.users.findById(player.userId);
        if (profile && profile.rankedGamesPlayed + 1 === season.placementGames)
          this.analytics.track('placement_finished', {
            userId: player.userId,
            gameId: result.gameId,
            seasonId: season.id,
            properties: { placementGames: season.placementGames },
          });
        if (player.abandoned)
          this.analytics.track('ranked_abandonment', {
            userId: player.userId,
            gameId: result.gameId,
            seasonId: season.id,
          });
        if (player.disconnected)
          this.analytics.track('ranked_disconnect', {
            userId: player.userId,
            gameId: result.gameId,
            seasonId: season.id,
          });
        if (player.timedOut)
          this.analytics.track('ranked_timeout', {
            userId: player.userId,
            gameId: result.gameId,
            seasonId: season.id,
          });
        const updated = this.users.rankedResultPreview(player.userId, {
          position: player.position,
          predictionAccuracy: result.predictionAccuracy[player.userId] ?? 0,
          newRating: player.newRating,
          abandoned: player.abandoned,
          disconnected: player.disconnected,
          timedOut: player.timedOut,
          queuePenaltyUntil: player.queuePenaltyUntil,
        });
        this.users.saveProfile(updated);
        await this.users.refresh(player.userId);
      }
    }
    return finalization;
  }
}
