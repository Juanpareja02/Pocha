import { randomInt } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AuthPrincipal } from '../auth/auth.service';

export interface UserRecord {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarSeed: number;
  readonly authProvider: AuthPrincipal['authProvider'];
  readonly authProviderId: string;
  readonly isGuest: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly podiums: number;
  readonly averagePosition: number | null;
  readonly predictionAccuracy: number;
  readonly disconnectRate: number;
  readonly casualGamesPlayed: number;
  readonly casualWins: number;
  readonly casualPodiums: number;
  readonly casualAveragePosition: number | null;
  readonly casualPredictionAccuracy: number;
  readonly elo: number;
  readonly peakElo: number;
  readonly rankedGamesPlayed: number;
  readonly rankedWins: number;
  readonly rankedPodiums: number;
  readonly rankedAveragePosition: number | null;
  readonly rankedBestElo: number;
  readonly rankedPredictionAccuracy: number;
  readonly rankedAbandons: number;
  readonly rankedDisconnects: number;
  readonly rankedTimeouts: number;
  readonly queuePenaltyUntil: string | null;
}

export interface UserRepository {
  findById(id: string): UserRecord | undefined;
  findByAuthProvider(
    authProvider: UserRecord['authProvider'],
    authProviderId: string,
  ): UserRecord | undefined;
  findByUsername(username: string): UserRecord | undefined;
  save(user: UserRecord): UserRecord;
  cache(user: UserRecord): UserRecord;
  refresh?(userId: string): UserRecord | Promise<UserRecord | undefined>;
  list(): readonly UserRecord[];
  listFresh?(): readonly UserRecord[] | Promise<readonly UserRecord[]>;
  flush?(): Promise<void>;
  updateStats(
    userId: string,
    result: { position: number; predictionAccuracy: number },
  ): UserRecord;
  deleteAccount(
    userId: string,
  ): UserRecord | undefined | Promise<UserRecord | undefined>;
  initialize?(): Promise<void>;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>();

  findById(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  findByAuthProvider(
    authProvider: UserRecord['authProvider'],
    authProviderId: string,
  ): UserRecord | undefined {
    return [...this.users.values()].find(
      (user) =>
        user.authProvider === authProvider &&
        user.authProviderId === authProviderId,
    );
  }

  findByUsername(username: string): UserRecord | undefined {
    const normalized = username.toLowerCase();
    return [...this.users.values()].find(
      (user) => user.username.toLowerCase() === normalized,
    );
  }

  save(user: UserRecord): UserRecord {
    this.users.set(user.id, user);
    return user;
  }

  updateStats(
    userId: string,
    result: { position: number; predictionAccuracy: number },
  ): UserRecord {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    const gamesPlayed = user.gamesPlayed + 1;
    const previousTotal = (user.averagePosition ?? 0) * user.gamesPlayed;
    const casualGamesPlayed = user.casualGamesPlayed + 1;
    const next: UserRecord = {
      ...user,
      gamesPlayed,
      wins: user.wins + Number(result.position === 1),
      podiums: user.podiums + Number(result.position <= 3),
      averagePosition: (previousTotal + result.position) / gamesPlayed,
      predictionAccuracy:
        (user.predictionAccuracy * user.gamesPlayed +
          result.predictionAccuracy) /
        gamesPlayed,
      disconnectRate: user.disconnectRate,
      casualGamesPlayed,
      casualWins: user.casualWins + Number(result.position === 1),
      casualPodiums: user.casualPodiums + Number(result.position <= 3),
      casualAveragePosition:
        ((user.casualAveragePosition ?? 0) * user.casualGamesPlayed +
          result.position) /
        casualGamesPlayed,
      casualPredictionAccuracy:
        (user.casualPredictionAccuracy * user.casualGamesPlayed +
          result.predictionAccuracy) /
        casualGamesPlayed,
      updatedAt: new Date().toISOString(),
    };
    return this.save(next);
  }

  cache(user: UserRecord): UserRecord {
    this.users.set(user.id, user);
    return user;
  }

  static createGuest(id: string, displayName: string): UserRecord {
    return InMemoryUserRepository.createFromPrincipal(
      {
        userId: id,
        authProvider: 'development',
        authProviderId: id,
        isGuest: true,
      },
      displayName,
    );
  }

  static createFromPrincipal(
    principal: AuthPrincipal,
    displayName: string,
  ): UserRecord {
    const now = new Date().toISOString();
    const prefix = principal.isGuest ? 'guest_' : 'user_';
    const suffix =
      principal.userId.replace(/[^a-zA-Z0-9]/g, '').slice(-10) || 'player';
    return {
      id: principal.userId,
      username: `${prefix}${suffix}`.slice(0, 20).toLowerCase(),
      displayName: displayName.trim() || 'Invitado',
      avatarSeed: randomInt(0, 1_000_000),
      authProvider: principal.authProvider,
      authProviderId: principal.authProviderId,
      isGuest: principal.isGuest,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      gamesPlayed: 0,
      wins: 0,
      podiums: 0,
      averagePosition: null,
      predictionAccuracy: 0,
      disconnectRate: 0,
      casualGamesPlayed: 0,
      casualWins: 0,
      casualPodiums: 0,
      casualAveragePosition: null,
      casualPredictionAccuracy: 0,
      elo: 1000,
      peakElo: 1000,
      rankedGamesPlayed: 0,
      rankedWins: 0,
      rankedPodiums: 0,
      rankedAveragePosition: null,
      rankedBestElo: 1000,
      rankedPredictionAccuracy: 0,
      rankedAbandons: 0,
      rankedDisconnects: 0,
      rankedTimeouts: 0,
      queuePenaltyUntil: null,
    };
  }

  list(): readonly UserRecord[] {
    return [...this.users.values()];
  }

  listFresh(): readonly UserRecord[] {
    return this.list();
  }

  deleteAccount(userId: string): UserRecord | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updatedAt = new Date().toISOString();
    const anonymized: UserRecord = {
      ...user,
      username: `deleted_${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`
        .toLowerCase()
        .slice(0, 20),
      displayName: 'Jugador eliminado',
      authProvider: 'development',
      authProviderId: `deleted:${user.id}`,
      isGuest: true,
      deletedAt: updatedAt,
      updatedAt,
    };
    this.users.set(userId, anonymized);
    return anonymized;
  }
}

/** PostgreSQL-backed user store with a small read cache for synchronous domain services. */
export class PrismaUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>();
  private pendingWrites: Promise<void> = Promise.resolve();

  constructor(private readonly prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    const rows = await this.prisma.user.findMany();
    for (const row of rows) {
      this.users.set(row.id, {
        id: row.id,
        username: row.username,
        displayName: row.displayName,
        avatarSeed: row.avatarSeed,
        authProvider: row.authProvider as UserRecord['authProvider'],
        authProviderId: row.authProviderId ?? row.id,
        isGuest: row.isGuest,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
        gamesPlayed: row.gamesPlayed,
        wins: row.wins,
        podiums: row.podiums,
        averagePosition: row.averagePosition,
        predictionAccuracy: row.predictionAccuracy,
        disconnectRate: row.disconnectRate,
        casualGamesPlayed: row.casualGamesPlayed,
        casualWins: row.casualWins,
        casualPodiums: row.casualPodiums,
        casualAveragePosition: row.casualAveragePosition,
        casualPredictionAccuracy: row.casualPredictionAccuracy,
        elo: row.elo,
        peakElo: row.peakElo,
        rankedGamesPlayed: row.rankedGamesPlayed,
        rankedWins: row.rankedWins,
        rankedPodiums: row.rankedPodiums,
        rankedAveragePosition: row.rankedAveragePosition,
        rankedBestElo: row.rankedBestElo,
        rankedPredictionAccuracy: row.rankedPredictionAccuracy,
        rankedAbandons: row.rankedAbandons,
        rankedDisconnects: row.rankedDisconnects,
        rankedTimeouts: row.rankedTimeouts,
        queuePenaltyUntil: row.queuePenaltyUntil?.toISOString() ?? null,
      });
    }
  }

  findById(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  findByAuthProvider(
    authProvider: UserRecord['authProvider'],
    authProviderId: string,
  ): UserRecord | undefined {
    return [...this.users.values()].find(
      (user) =>
        user.authProvider === authProvider &&
        user.authProviderId === authProviderId,
    );
  }

  findByUsername(username: string): UserRecord | undefined {
    const normalized = username.toLowerCase();
    return [...this.users.values()].find(
      (user) => user.username.toLowerCase() === normalized,
    );
  }

  async refresh(userId: string): Promise<UserRecord | undefined> {
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!row) return undefined;
    const user: UserRecord = {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarSeed: row.avatarSeed,
      authProvider: row.authProvider as UserRecord['authProvider'],
      authProviderId: row.authProviderId ?? row.id,
      isGuest: row.isGuest,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      gamesPlayed: row.gamesPlayed,
      wins: row.wins,
      podiums: row.podiums,
      averagePosition: row.averagePosition,
      predictionAccuracy: row.predictionAccuracy,
      disconnectRate: row.disconnectRate,
      casualGamesPlayed: row.casualGamesPlayed,
      casualWins: row.casualWins,
      casualPodiums: row.casualPodiums,
      casualAveragePosition: row.casualAveragePosition,
      casualPredictionAccuracy: row.casualPredictionAccuracy,
      elo: row.elo,
      peakElo: row.peakElo,
      rankedGamesPlayed: row.rankedGamesPlayed,
      rankedWins: row.rankedWins,
      rankedPodiums: row.rankedPodiums,
      rankedAveragePosition: row.rankedAveragePosition,
      rankedBestElo: row.rankedBestElo,
      rankedPredictionAccuracy: row.rankedPredictionAccuracy,
      rankedAbandons: row.rankedAbandons,
      rankedDisconnects: row.rankedDisconnects,
      rankedTimeouts: row.rankedTimeouts,
      queuePenaltyUntil: row.queuePenaltyUntil?.toISOString() ?? null,
    };
    return this.cache(user);
  }

  list(): readonly UserRecord[] {
    return [...this.users.values()];
  }

  async listFresh(): Promise<readonly UserRecord[]> {
    await this.initialize();
    return this.list();
  }

  save(user: UserRecord): UserRecord {
    this.cache(user);
    const persistence = this.toPersistence(user);
    this.pendingWrites = this.pendingWrites.then(() =>
      this.prisma.user
        .upsert({
          where: { id: user.id },
          create: persistence,
          update: persistence,
        })
        .then(() => undefined),
    );
    return user;
  }

  cache(user: UserRecord): UserRecord {
    this.users.set(user.id, user);
    return user;
  }

  async flush(): Promise<void> {
    await this.pendingWrites;
  }

  updateStats(
    userId: string,
    result: { position: number; predictionAccuracy: number },
  ): UserRecord {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    const gamesPlayed = user.gamesPlayed + 1;
    const casualGamesPlayed = user.casualGamesPlayed + 1;
    return this.save({
      ...user,
      gamesPlayed,
      wins: user.wins + Number(result.position === 1),
      podiums: user.podiums + Number(result.position <= 3),
      averagePosition:
        ((user.averagePosition ?? 0) * user.gamesPlayed + result.position) /
        gamesPlayed,
      predictionAccuracy:
        (user.predictionAccuracy * user.gamesPlayed +
          result.predictionAccuracy) /
        gamesPlayed,
      disconnectRate: user.disconnectRate,
      casualGamesPlayed,
      casualWins: user.casualWins + Number(result.position === 1),
      casualPodiums: user.casualPodiums + Number(result.position <= 3),
      casualAveragePosition:
        ((user.casualAveragePosition ?? 0) * user.casualGamesPlayed +
          result.position) /
        casualGamesPlayed,
      casualPredictionAccuracy:
        (user.casualPredictionAccuracy * user.casualGamesPlayed +
          result.predictionAccuracy) /
        casualGamesPlayed,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteAccount(userId: string): Promise<UserRecord | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const updatedAt = new Date().toISOString();
    const anonymized: UserRecord = {
      ...existing,
      username: `deleted_${existing.id.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`
        .toLowerCase()
        .slice(0, 20),
      displayName: 'Jugador eliminado',
      authProvider: 'development',
      authProviderId: `deleted:${existing.id}`,
      isGuest: true,
      deletedAt: updatedAt,
      updatedAt,
    };
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: anonymized.username,
        displayName: anonymized.displayName,
        authProvider: anonymized.authProvider,
        authProviderId: anonymized.authProviderId,
        isGuest: true,
        deletedAt: new Date(updatedAt),
      },
    });
    return this.cache(anonymized);
  }

  private toPersistence(user: UserRecord) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarSeed: user.avatarSeed,
      authProvider: user.authProvider,
      authProviderId: user.authProviderId,
      isGuest: user.isGuest,
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
      elo: user.elo,
      peakElo: user.peakElo,
      rankedGamesPlayed: user.rankedGamesPlayed,
      rankedWins: user.rankedWins,
      rankedPodiums: user.rankedPodiums,
      rankedAveragePosition: user.rankedAveragePosition,
      rankedBestElo: user.rankedBestElo,
      rankedPredictionAccuracy: user.rankedPredictionAccuracy,
      rankedAbandons: user.rankedAbandons,
      rankedDisconnects: user.rankedDisconnects,
      rankedTimeouts: user.rankedTimeouts,
      queuePenaltyUntil: user.queuePenaltyUntil
        ? new Date(user.queuePenaltyUntil)
        : null,
      deletedAt: user.deletedAt ? new Date(user.deletedAt) : null,
    };
  }
}
