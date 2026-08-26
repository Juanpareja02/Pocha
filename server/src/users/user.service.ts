import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { AuthPrincipal } from '../auth/auth.service';
import { USER_REPOSITORY } from '../realtime/tokens';
import {
  InMemoryUserRepository,
  UserRecord,
  UserRepository,
} from './user.repository';

export interface RankedUserResult {
  readonly position: number;
  readonly predictionAccuracy: number;
  readonly newRating: number;
  readonly abandoned: boolean;
  readonly disconnected: boolean;
  readonly timedOut: boolean;
  readonly queuePenaltyUntil: string | null;
}

const RESERVED_USERNAMES = new Set([
  'admin',
  'system',
  'moderator',
  'support',
  'pocha',
]);

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository = new InMemoryUserRepository(),
  ) {}

  async onModuleInit(): Promise<void> {
    await this.users.initialize?.();
  }

  profile(principal: AuthPrincipal): UserRecord {
    return this.getOrCreate(principal);
  }

  findById(userId: string): UserRecord | undefined {
    return this.users.findById(userId);
  }

  getOrCreate(principal: AuthPrincipal): UserRecord {
    const existing =
      this.users.findById(principal.userId) ??
      this.users.findByAuthProvider(
        principal.authProvider,
        principal.authProviderId,
      );
    if (existing) return existing;
    return this.users.save(
      InMemoryUserRepository.createFromPrincipal(principal, 'Invitado'),
    );
  }

  upgradeGuest(
    guestPrincipal: AuthPrincipal,
    permanentPrincipal: AuthPrincipal,
  ): UserRecord {
    if (!guestPrincipal.isGuest)
      throw new BadRequestException('Only guest accounts can be upgraded');
    if (permanentPrincipal.isGuest)
      throw new BadRequestException('A permanent account is required');
    const guest = this.getOrCreate(guestPrincipal);
    const alreadyLinked = this.users.findByAuthProvider(
      permanentPrincipal.authProvider,
      permanentPrincipal.authProviderId,
    );
    if (alreadyLinked && alreadyLinked.id !== guest.id)
      throw new BadRequestException('The permanent account is already linked');
    return this.users.save({
      ...guest,
      authProvider: permanentPrincipal.authProvider,
      authProviderId: permanentPrincipal.authProviderId,
      isGuest: false,
      updatedAt: new Date().toISOString(),
    });
  }

  rename(principal: AuthPrincipal, displayName: string): UserRecord {
    const user = this.getOrCreate(principal);
    const username = this.normalizeUsername(displayName);
    if (RESERVED_USERNAMES.has(username)) {
      throw new BadRequestException('This username is reserved');
    }
    const taken = this.users.findByUsername(username);
    if (taken && taken.id !== user.id) {
      throw new BadRequestException('This username is already in use');
    }
    return this.users.save({
      ...user,
      username,
      displayName: displayName.trim(),
      updatedAt: new Date().toISOString(),
    });
  }

  normalizeUsername(value: string): string {
    const normalized = value
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .normalize('NFKC')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_ -]{3,20}$/.test(normalized)) {
      throw new BadRequestException(
        'Username must have 3-20 letters, numbers, spaces or underscores',
      );
    }
    return normalized.replace(/\s+/g, '_');
  }

  recordResult(
    userId: string,
    result: { position: number; predictionAccuracy: number },
  ): UserRecord {
    return this.users.updateStats(userId, result);
  }

  all(): readonly UserRecord[] {
    return this.users.list();
  }

  async allFresh(): Promise<readonly UserRecord[]> {
    return (await this.users.listFresh?.()) ?? this.users.list();
  }

  async flush(): Promise<void> {
    await this.users.flush?.();
  }

  statistics(userId: string): Record<string, number | null> {
    const user = this.users.findById(userId);
    if (!user) throw new BadRequestException('User profile is missing');
    return {
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
      podiums: user.podiums,
      averagePosition: user.averagePosition,
      predictionAccuracy: user.predictionAccuracy,
      disconnectRate: user.disconnectRate,
      casualGamesPlayed: user.casualGamesPlayed,
      casualWins: user.casualWins,
      casualPodiums: user.casualPodiums,
      casualAveragePosition: user.casualAveragePosition,
      casualPredictionAccuracy: user.casualPredictionAccuracy,
      rankedGamesPlayed: user.rankedGamesPlayed,
      rankedWins: user.rankedWins,
      rankedPodiums: user.rankedPodiums,
      rankedAveragePosition: user.rankedAveragePosition,
      rankedPredictionAccuracy: user.rankedPredictionAccuracy,
      rankedAbandons: user.rankedAbandons,
      rankedDisconnects: user.rankedDisconnects,
      rankedTimeouts: user.rankedTimeouts,
      rankedBestElo: user.rankedBestElo,
    };
  }

  rankedResultPreview(userId: string, result: RankedUserResult): UserRecord {
    const user = this.users.findById(userId);
    if (!user) throw new BadRequestException('User profile is missing');
    const gamesPlayed = user.rankedGamesPlayed + 1;
    const overallGames = user.gamesPlayed + 1;
    const previousRankedTotal =
      (user.rankedAveragePosition ?? 0) * user.rankedGamesPlayed;
    const previousOverallTotal = (user.averagePosition ?? 0) * user.gamesPlayed;
    return {
      ...user,
      gamesPlayed: overallGames,
      wins: user.wins + Number(result.position === 1),
      podiums: user.podiums + Number(result.position <= 3),
      averagePosition: (previousOverallTotal + result.position) / overallGames,
      predictionAccuracy:
        (user.predictionAccuracy * user.gamesPlayed +
          result.predictionAccuracy) /
        overallGames,
      elo: result.newRating,
      peakElo: Math.max(user.peakElo, result.newRating),
      rankedGamesPlayed: gamesPlayed,
      rankedWins: user.rankedWins + Number(result.position === 1),
      rankedPodiums: user.rankedPodiums + Number(result.position <= 3),
      rankedAveragePosition:
        (previousRankedTotal + result.position) / gamesPlayed,
      rankedBestElo: Math.max(user.rankedBestElo, result.newRating),
      rankedPredictionAccuracy:
        (user.rankedPredictionAccuracy * user.rankedGamesPlayed +
          result.predictionAccuracy) /
        gamesPlayed,
      rankedAbandons: user.rankedAbandons + Number(result.abandoned),
      rankedDisconnects: user.rankedDisconnects + Number(result.disconnected),
      rankedTimeouts: user.rankedTimeouts + Number(result.timedOut),
      disconnectRate:
        (user.rankedDisconnects + Number(result.disconnected)) / gamesPlayed,
      queuePenaltyUntil: result.queuePenaltyUntil,
      updatedAt: new Date().toISOString(),
    };
  }

  saveProfile(profile: UserRecord): UserRecord {
    return this.users.cache(profile);
  }

  async refresh(userId: string): Promise<UserRecord | undefined> {
    return (await this.users.refresh?.(userId)) ?? this.users.findById(userId);
  }

  async deleteAccount(userId: string): Promise<UserRecord | undefined> {
    return await this.users.deleteAccount(userId);
  }
}
