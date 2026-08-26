import {
  applicationDefault,
  getApp,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthPrincipal, FirebaseVerifierAdapter } from './auth.service';

const FIREBASE_APP_NAME = 'pocha-auth';
type FirebaseTokenDecoder = (token: string) => Promise<DecodedIdToken>;

/** Firebase Admin token verification for staging/production. */
export class FirebaseAdminVerifier implements FirebaseVerifierAdapter {
  private app?: App;

  constructor(
    private readonly projectId: string,
    private readonly issuer: string,
    private readonly decoder?: FirebaseTokenDecoder,
  ) {}

  async verify(token: string): Promise<AuthPrincipal> {
    if (!this.projectId || !this.issuer) {
      throw new ServiceUnavailableException(
        'Firebase authentication is not configured',
      );
    }

    try {
      const decoded = this.decoder
        ? await this.decoder(token)
        : await getAuth(this.firebaseApp()).verifyIdToken(token);
      this.assertIssuerAndAudience(decoded);
      return this.toPrincipal(decoded);
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Firebase authentication token');
    }
  }

  private firebaseApp(): App {
    if (this.app) return this.app;
    try {
      this.app = getApp(FIREBASE_APP_NAME);
    } catch {
      try {
        this.app = initializeApp(
          {
            credential: applicationDefault(),
            projectId: this.projectId,
          },
          FIREBASE_APP_NAME,
        );
      } catch {
        throw new ServiceUnavailableException(
          'Firebase application credentials are not configured',
        );
      }
    }
    return this.app;
  }

  private assertIssuerAndAudience(decoded: DecodedIdToken): void {
    if (decoded.iss !== this.issuer || decoded.aud !== this.projectId) {
      throw new UnauthorizedException('Invalid Firebase token issuer');
    }
  }

  private toPrincipal(decoded: DecodedIdToken): AuthPrincipal {
    return {
      userId: `firebase:${decoded.uid}`,
      authProvider: 'firebase',
      authProviderId: decoded.uid,
      isGuest: decoded.firebase?.sign_in_provider === 'anonymous',
    };
  }
}
