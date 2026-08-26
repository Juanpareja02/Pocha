import {
  Inject,
  Injectable,
  OnModuleInit,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RANKED_SEASON_REPOSITORY } from '../realtime/tokens';
import { RankDefinition } from '../game-engine';
import { RankedSeasonConfig } from './ranked.types';
import { SeasonRepository } from './season.repository';

@Injectable()
export class SeasonService implements OnModuleInit {
  constructor(
    @Inject(RANKED_SEASON_REPOSITORY)
    private readonly seasons: SeasonRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seasons.initialize?.();
  }

  active(): RankedSeasonConfig | undefined {
    return this.seasons.findActive();
  }

  requireActive(): RankedSeasonConfig {
    const season = this.active();
    if (!season)
      throw new ServiceUnavailableException('No ranked season is active');
    return season;
  }

  find(id: string): RankedSeasonConfig {
    const season = this.seasons.findById(id);
    if (!season) throw new NotFoundException('Ranked season not found');
    return season;
  }

  list(): readonly RankedSeasonConfig[] {
    return this.seasons.list();
  }

  rankForRating(rating: number, season: RankedSeasonConfig): RankDefinition {
    return (
      [...season.rankTiers]
        .sort((left, right) => right.minimumElo - left.minimumElo)
        .find((tier) => rating >= tier.minimumElo) ?? season.rankTiers[0]
    );
  }

  softResetRating(oldRating: number, baseRating = 1000, factor = 0.75): number {
    return Math.round(baseRating + factor * (oldRating - baseRating));
  }

  activate(seasonId: string): RankedSeasonConfig {
    const next = this.find(seasonId);
    for (const current of this.seasons.list()) {
      if (current.id === next.id) {
        this.seasons.save({ ...current, status: 'ACTIVE' });
      } else if (current.status === 'ACTIVE') {
        this.seasons.save({
          ...current,
          status: 'FINISHED',
          endsAt: new Date().toISOString(),
        });
      }
    }
    return this.find(seasonId);
  }
}
