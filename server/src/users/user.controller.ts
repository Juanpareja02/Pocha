import {
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  UnauthorizedException,
  Header,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ONLINE_GAME_REPOSITORY } from '../realtime/tokens';
import { OnlineGameRepository } from '../games/online-game.repository';
import { UserService } from './user.service';
import { AnalyticsService, NoopAnalytics } from '../analytics/analytics';

@Controller('users')
export class UserController {
  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService,
    @Inject(UserService)
    private readonly users: UserService,
    @Inject(ONLINE_GAME_REPOSITORY)
    private readonly games: OnlineGameRepository,
    @Inject(AnalyticsService)
    private readonly analytics: AnalyticsService = new AnalyticsService(
      new NoopAnalytics(),
    ),
  ) {}

  @Get('me/history')
  async history(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');
    const principal = await this.auth.verifyToken(authorization.slice(7));
    this.users.getOrCreate(principal);
    return {
      protocolVersion: 1,
      games: await this.games.history(principal.userId),
    };
  }

  @Get('me/stats')
  async stats(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');
    const principal = await this.auth.verifyToken(authorization.slice(7));
    this.users.getOrCreate(principal);
    return {
      protocolVersion: 1,
      stats: this.users.statistics(principal.userId),
    };
  }

  @Get('me/export')
  @Header('Content-Type', 'application/json; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="pocha-data-export.json"',
  )
  async exportData(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');
    const principal = await this.auth.verifyToken(authorization.slice(7));
    const profile =
      (await this.users.refresh(principal.userId)) ??
      this.users.findById(principal.userId);
    if (!profile) throw new UnauthorizedException('Account not found');
    const games = await this.games.history(principal.userId);
    this.analytics.track('data_export_requested', {
      userId: principal.userId,
      properties: { gameCount: games.length },
    });
    return {
      protocolVersion: 1,
      exportedAt: new Date().toISOString(),
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarSeed: profile.avatarSeed,
        isGuest: profile.isGuest,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        deletedAt: profile.deletedAt,
      },
      statistics: this.users.statistics(principal.userId),
      rating: {
        elo: profile.elo,
        peakElo: profile.peakElo,
        rankedBestElo: profile.rankedBestElo,
      },
      games: games.map((game) => ({
        gameId: game.gameId,
        mode: game.mode,
        rulesetId: game.rulesetId,
        rulesetVersion: game.rulesetVersion,
        createdAt: game.createdAt,
        finishedAt: game.finishedAt,
        seasonId: game.seasonId,
        playerCount: game.players.length,
        opponentCount: Math.max(0, game.players.length - 1),
        result: game.results?.find((result) => result.userId === profile.id),
      })),
    };
  }

  @Delete('me')
  async deleteAccount(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');
    const principal = await this.auth.verifyToken(authorization.slice(7));
    const user = await this.users.deleteAccount(principal.userId);
    if (!user) throw new UnauthorizedException('Account not found');
    return {
      protocolVersion: 1,
      deleted: true,
      deletedAt: user.deletedAt,
      historicalData: 'anonymized',
    };
  }
}
