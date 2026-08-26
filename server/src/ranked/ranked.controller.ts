import {
  Controller,
  Get,
  Headers,
  Inject,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LeaderboardPage, LeaderboardService } from './leaderboard.service';
import { SeasonService } from './season.service';

@Controller('ranked')
export class RankedController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(LeaderboardService)
    private readonly leaderboard: LeaderboardService,
    @Inject(SeasonService) private readonly seasons: SeasonService,
  ) {}

  @Get('me')
  async me(
    @Headers('authorization') authorization?: string,
    @Query('seasonId') seasonId?: string,
  ) {
    const principal = await this.principal(authorization);
    return this.leaderboard.profile(principal.userId, seasonId);
  }

  @Get('leaderboard')
  async page(
    @Headers('authorization') authorization?: string,
    @Query('seasonId') seasonId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('scope') scope?: string,
  ) {
    const principal = await this.principal(authorization);
    if (scope === 'global') {
      return this.publicPage(
        await this.leaderboard.globalPage(
          Number(limit ?? 50),
          cursor,
          principal.userId,
        ),
      );
    }
    const season = seasonId
      ? this.seasons.find(seasonId)
      : this.seasons.requireActive();
    return this.publicPage(
      await this.leaderboard.page(
        season.id,
        Number(limit ?? 50),
        cursor,
        principal.userId,
      ),
    );
  }

  @Get('history')
  async history(
    @Headers('authorization') authorization?: string,
    @Query('seasonId') seasonId?: string,
    @Query('limit') limit?: string,
  ) {
    const principal = await this.principal(authorization);
    return {
      seasonId: seasonId ?? this.seasons.active()?.id,
      games: await this.leaderboard.history(
        principal.userId,
        seasonId,
        Number(limit ?? 50),
      ),
    };
  }

  private async principal(authorization?: string) {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');
    return this.auth.verifyToken(authorization.slice(7));
  }

  private publicPage(page: LeaderboardPage) {
    return {
      ...page,
      items: page.items.map((item) => {
        const publicItem = { ...item } as Record<string, unknown>;
        delete publicItem.userId;
        return publicItem;
      }),
    };
  }
}
