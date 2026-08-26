import { describe, expect, it } from 'vitest';
import {
  AuthService,
  ExternalTokenVerifier,
  FirebaseTokenVerifier,
} from './auth.service';
import { FirebaseAdminVerifier } from './firebase-admin.adapter';
import { InMemoryUserRepository } from '../users/user.repository';
import { UserService } from '../users/user.service';

describe('authentication boundary', () => {
  it('verifies development guest tokens and rejects malformed identities', async () => {
    const auth = new AuthService();
    expect((await auth.verifyToken('dev:guest_auth01')).isGuest).toBe(true);
    await expect(auth.verifyToken('dev:bad id')).rejects.toThrow();
  });

  it('normalizes usernames and rejects reserved or duplicate names', () => {
    const users = new UserService(new InMemoryUserRepository());
    const first = {
      userId: 'guest_name01',
      authProvider: 'development' as const,
      authProviderId: 'guest_name01',
      isGuest: true,
    };
    const second = {
      userId: 'guest_name02',
      authProvider: 'development' as const,
      authProviderId: 'guest_name02',
      isGuest: true,
    };
    expect(users.rename(first, 'Juan Álvaro').username).toBe('juan_alvaro');
    expect(() => users.rename(second, 'admin')).toThrow();
    expect(() => users.rename(second, 'Juan Álvaro')).toThrow();
  });

  it('upgrades a guest in place and preserves the canonical user identity', async () => {
    const repository = new InMemoryUserRepository();
    const auth = new AuthService(repository);
    const users = new UserService(repository);
    const guestSession = auth.createDevelopmentGuest();
    const guest = users.getOrCreate(guestSession.principal);
    users.recordResult(guest.id, { position: 1, predictionAccuracy: 1 });
    const permanent = auth.createDevelopmentAccount('permanent01');
    const upgraded = users.upgradeGuest(
      guestSession.principal,
      permanent.principal,
    );

    expect(upgraded.id).toBe(guest.id);
    expect(upgraded.isGuest).toBe(false);
    expect(upgraded.username).toBe(guest.username);
    expect(upgraded.gamesPlayed).toBe(1);
    const verified = await auth.verifyToken(permanent.token);
    expect(verified.userId).toBe(guest.id);
    expect(verified.isGuest).toBe(false);
  });

  it('accepts a deployment-provided Firebase/OIDC adapter at the auth boundary', async () => {
    const previousProvider = process.env.AUTH_PROVIDER;
    process.env.AUTH_PROVIDER = 'external';
    const auth = new AuthService(
      new InMemoryUserRepository(),
      new ExternalTokenVerifier(
        new FirebaseTokenVerifier({
          verify: async (token) => ({
            userId: `firebase:${token}`,
            authProvider: 'firebase',
            authProviderId: token,
            isGuest: false,
          }),
        }),
      ),
    );

    try {
      expect((await auth.verifyExternalToken('id-token')).authProvider).toBe(
        'firebase',
      );
    } finally {
      if (previousProvider === undefined) delete process.env.AUTH_PROVIDER;
      else process.env.AUTH_PROVIDER = previousProvider;
    }
  });

  it('anonymizes account data while preserving historical counters', async () => {
    const repository = new InMemoryUserRepository();
    const auth = new AuthService(repository);
    const users = new UserService(repository);
    const session = auth.createDevelopmentGuest();
    const user = users.getOrCreate(session.principal);
    users.recordResult(user.id, { position: 2, predictionAccuracy: 0.5 });

    const deleted = await users.deleteAccount(user.id);

    expect(deleted?.displayName).toBe('Jugador eliminado');
    expect(deleted?.username).toMatch(/^deleted_/);
    expect(deleted?.gamesPlayed).toBe(1);
    await expect(auth.verifyToken(session.token)).rejects.toThrow(/deleted/);
  });

  it('maps a verified Firebase token to a permanent principal', async () => {
    const verifier = new FirebaseAdminVerifier(
      'pocha-staging',
      'https://securetoken.google.com/pocha-staging',
      async () =>
        ({
          uid: 'firebase-user-01',
          aud: 'pocha-staging',
          iss: 'https://securetoken.google.com/pocha-staging',
          firebase: { sign_in_provider: 'google.com' },
        }) as never,
    );

    await expect(verifier.verify('id-token')).resolves.toEqual({
      userId: 'firebase:firebase-user-01',
      authProvider: 'firebase',
      authProviderId: 'firebase-user-01',
      isGuest: false,
    });
  });

  it('rejects a Firebase token with a wrong issuer or audience', async () => {
    const verifier = new FirebaseAdminVerifier(
      'pocha-staging',
      'https://securetoken.google.com/pocha-staging',
      async () =>
        ({
          uid: 'firebase-user-01',
          aud: 'another-project',
          iss: 'https://securetoken.google.com/another-project',
        }) as never,
    );

    await expect(verifier.verify('id-token')).rejects.toThrow(
      'Invalid Firebase token issuer',
    );
  });

  it('rejects an expired Firebase token', async () => {
    const verifier = new FirebaseAdminVerifier(
      'pocha-staging',
      'https://securetoken.google.com/pocha-staging',
      async () => {
        const error = new Error('Firebase ID token has expired');
        Object.assign(error, { code: 'auth/id-token-expired' });
        throw error;
      },
    );

    await expect(verifier.verify('expired-token')).rejects.toThrow(
      'Invalid Firebase authentication token',
    );
  });

  it('fails closed when the external provider is unavailable', async () => {
    await expect(
      new FirebaseTokenVerifier().verify('unconfigured-token'),
    ).rejects.toThrow(/not configured/);
  });
});
