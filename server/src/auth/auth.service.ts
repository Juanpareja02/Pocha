import {
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AUTH_TOKEN_VERIFIER, USER_REPOSITORY } from '../realtime/tokens';
import {
  InMemoryUserRepository,
  UserRepository,
} from '../users/user.repository';

export interface AuthPrincipal {
  readonly userId: string;
  readonly authProvider: 'development' | 'firebase' | 'apple' | 'google';
  readonly authProviderId: string;
  readonly isGuest: boolean;
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthPrincipal>;
}

/** Development-only token verifier. Production never accepts this format. */
export class DevelopmentTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<AuthPrincipal> {
    const [, rawId] = token.split(':', 2);
    const userId = rawId?.trim();
    if (
      !token.startsWith('dev:') ||
      !userId ||
      !/^[a-zA-Z0-9_-]{3,80}$/.test(userId)
    ) {
      throw new UnauthorizedException('Invalid development token');
    }
    return {
      userId,
      authProvider: 'development',
      authProviderId: userId,
      isGuest: userId.startsWith('guest_'),
    };
  }
}

export interface FirebaseVerifierAdapter {
  verify(token: string): Promise<AuthPrincipal>;
}

/** Firebase Admin SDK boundary; the adapter is injected by the deployment. */
export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(private readonly adapter?: FirebaseVerifierAdapter) {}

  async verify(token: string): Promise<AuthPrincipal> {
    if (this.adapter) return this.adapter.verify(token);
    void token;
    throw new UnauthorizedException(
      'Firebase/OIDC authentication is not configured for this server',
    );
  }
}

/** Boundary for Firebase, Google or Apple/OIDC verification. */
export class ExternalTokenVerifier implements TokenVerifier {
  constructor(private readonly firebase = new FirebaseTokenVerifier()) {}

  async verify(token: string): Promise<AuthPrincipal> {
    return this.firebase.verify(token);
  }
}

@Injectable()
export class AuthService {
  private readonly development = new DevelopmentTokenVerifier();

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository = new InMemoryUserRepository(),
    @Optional()
    @Inject(AUTH_TOKEN_VERIFIER)
    private readonly external: TokenVerifier = new ExternalTokenVerifier(),
    @Optional()
    private readonly config?: ConfigService,
  ) {}

  async verifyToken(token: unknown): Promise<AuthPrincipal> {
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Authentication token is required');
    }
    const principal =
      this.isProductionLike() || this.authProvider() === 'external'
        ? await this.external.verify(token)
        : await this.development.verify(token);
    return this.resolveCanonicalPrincipal(principal);
  }

  async verifyExternalToken(token: unknown): Promise<AuthPrincipal> {
    if (typeof token !== 'string' || token.length === 0)
      throw new UnauthorizedException(
        'External authentication token is required',
      );
    const principal =
      this.isProductionLike() || this.authProvider() === 'external'
        ? await this.external.verify(token)
        : await this.development.verify(token);
    return principal;
  }

  createDevelopmentGuest(): { token: string; principal: AuthPrincipal } {
    if (this.isProductionLike()) {
      throw new UnauthorizedException(
        'Development guest authentication is disabled in production',
      );
    }
    const userId = `guest_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    return {
      token: `dev:${userId}`,
      principal: {
        userId,
        authProvider: 'development',
        authProviderId: userId,
        isGuest: true,
      },
    };
  }

  createDevelopmentAccount(userId: string): {
    token: string;
    principal: AuthPrincipal;
  } {
    if (this.isProductionLike()) {
      throw new UnauthorizedException(
        'Development authentication is disabled in production',
      );
    }
    const normalized = userId.trim();
    if (
      !/^[a-zA-Z0-9_-]{3,40}$/.test(normalized) ||
      normalized.startsWith('guest_')
    ) {
      throw new UnauthorizedException('Invalid development account id');
    }
    return {
      token: `dev:${normalized}`,
      principal: {
        userId: normalized,
        authProvider: 'development',
        authProviderId: normalized,
        isGuest: false,
      },
    };
  }

  private resolveCanonicalPrincipal(principal: AuthPrincipal): AuthPrincipal {
    const user =
      this.users.findById(principal.userId) ??
      this.users.findByAuthProvider(
        principal.authProvider,
        principal.authProviderId,
      );
    if (user?.deletedAt) {
      throw new UnauthorizedException('Account has been deleted');
    }
    return user
      ? { ...principal, userId: user.id, isGuest: user.isGuest }
      : principal;
  }

  private authProvider(): string {
    return (
      this.config?.get<string>('AUTH_PROVIDER') ??
      process.env.AUTH_PROVIDER ??
      'development'
    );
  }

  private isProductionLike(): boolean {
    const appEnv =
      this.config?.get<string>('APP_ENV') ??
      process.env.APP_ENV ??
      (process.env.NODE_ENV === 'production' ? 'production' : 'development');
    return appEnv !== 'development';
  }
}
