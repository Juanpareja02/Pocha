import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { io, Socket } from 'socket.io-client';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

type JsonRecord = Record<string, unknown>;

interface FirebaseAccount {
  readonly uid: string;
  readonly token: string;
  readonly email?: string;
  readonly password?: string;
}

interface Snapshot {
  readonly gameId: string;
  readonly roomId: string;
  readonly stateVersion: number;
  readonly myPlayerId: string;
  readonly mySeat: number;
  readonly state: {
    readonly status: string;
    readonly currentPlayerIndex: number;
    readonly cardsPerRound: number;
    readonly leadSuit: string | null;
    readonly currentTrick: readonly unknown[];
    readonly players: readonly {
      readonly id: string;
      readonly hand: readonly { readonly id: string; readonly suit: string }[];
      readonly bid: number | null;
    }[];
  };
}

interface Room {
  readonly roomId: string;
  readonly code: string;
  readonly mode?: string;
  readonly players?: readonly {
    readonly userId: string;
    readonly ready: boolean;
  }[];
}

const baseUrl = required('STAGING_BASE_URL').replace(/\/$/, '');
const firebaseApiKey = required('POCHA_FIREBASE_WEB_API_KEY');
const redisUrl = required('REDIS_URL');
const redisNamespace = required('REDIS_KEY_PREFIX');
const parsedBaseUrl = new URL(baseUrl);
const reservedHosts = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '10.0.2.2',
  'example.com',
  'example.org',
  'example.net',
]);
if (
  parsedBaseUrl.protocol !== 'https:' ||
  parsedBaseUrl.hostname.length === 0 ||
  reservedHosts.has(parsedBaseUrl.hostname.toLowerCase()) ||
  parsedBaseUrl.hostname.endsWith('.invalid')
) {
  throw new Error(
    'staging live smoke requires a public HTTPS endpoint, never localhost or a reserved host',
  );
}
if (
  process.env.APP_ENV !== 'staging' ||
  process.env.NODE_ENV !== 'production'
) {
  throw new Error(
    'staging live smoke requires APP_ENV=staging and NODE_ENV=production',
  );
}
if (!/^staging[_-]/i.test(redisNamespace)) {
  throw new Error('REDIS_KEY_PREFIX must start with staging- or staging_');
}

const prisma = new PrismaClient();
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
const accounts: FirebaseAccount[] = [];
const smokeRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const smokeEmailPrefix = `pocha-staging-smoke-${smokeRunId}-`;
const sockets = new Set<Socket>();
const gameIds = new Set<string>();
const userIds = new Set<string>();
let stage = 'bootstrap';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function canonical(uid: string): string {
  return `firebase:${uid}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function once<T>(
  socket: Socket,
  event: string,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timeout:${event}`));
    }, timeoutMs);
    const onEvent = (value: T) => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(value);
    };
    socket.once(event, onEvent);
  });
}

async function syncSnapshot(socket: Socket, gameId: string): Promise<Snapshot> {
  const snapshot = once<Snapshot>(socket, 'game:snapshot', 15_000);
  socket.emit('game:sync', { gameId });
  return snapshot;
}

async function abandonGame(
  socket: Socket,
  gameId: string,
  initialStateVersion: number,
): Promise<void> {
  let expectedStateVersion = initialStateVersion;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const snapshot = once<Snapshot>(socket, 'game:snapshot', 15_000);
    const error = once<{
      readonly code?: string;
      readonly stateVersion?: number;
    }>(socket, 'game:error', 15_000);
    socket.emit('game:leave', {
      gameId,
      expectedStateVersion,
      actionId: `staging-smoke:ranked:abandon:${attempt}`,
    });
    const result = await Promise.race([
      snapshot.then(() => 'left' as const),
      error.then((payload) => {
        if (
          payload.code === 'STALE_STATE' &&
          typeof payload.stateVersion === 'number'
        ) {
          expectedStateVersion = payload.stateVersion;
          return 'retry' as const;
        }
        throw new Error(`ranked-abandon:${payload.code ?? 'unknown'}`);
      }),
    ]);
    if (result === 'left') return;
  }
  throw new Error('ranked-abandon:stale-retry-limit');
}

async function roomEvent<T>(
  socket: Socket,
  event: string,
  label: string,
): Promise<T> {
  const expected = once<T>(socket, event);
  const error = once<{ readonly code?: string; readonly message?: string }>(
    socket,
    'game:error',
  ).then((payload) => {
    throw new Error(
      `${label}:error:${payload.code ?? 'unknown'}:${payload.message ?? 'unknown'}`,
    );
  });
  return Promise.race([expected, error]);
}

function socketEventOrError<T>(
  socket: Socket,
  event: string,
  label: string,
  timeoutMs = 15_000,
): Promise<T> {
  const expected = once<T>(socket, event, timeoutMs);
  const error = once<{ readonly code?: string; readonly message?: string }>(
    socket,
    'game:error',
    timeoutMs,
  ).then((payload) => {
    throw new Error(
      `${label}:error:${payload.code ?? 'unknown'}:${payload.message ?? 'unknown'}`,
    );
  });
  return Promise.race([expected, error]);
}

async function firebaseRequest(
  action: string,
  body: JsonRecord,
): Promise<JsonRecord> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/${action}?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    const payload = (await response.json()) as JsonRecord;
    if (!response.ok) throw new Error(`firebase:${action}:${response.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function createAnonymousAccount(): Promise<FirebaseAccount> {
  const payload = await firebaseRequest('accounts:signUp', {
    returnSecureToken: true,
  });
  const uid = stringField(payload, 'localId');
  return { uid, token: stringField(payload, 'idToken') };
}

async function createEmailAccount(index: number): Promise<FirebaseAccount> {
  const email = `${smokeEmailPrefix}${index}@example.invalid`;
  const password = `Smoke-${Date.now()}-${index}-safe-password`;
  const payload = await firebaseRequest('accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });
  return {
    uid: stringField(payload, 'localId'),
    token: stringField(payload, 'idToken'),
    email,
    password,
  };
}

async function signInEmailAccount(
  account: FirebaseAccount,
): Promise<FirebaseAccount> {
  if (!account.email || !account.password)
    throw new Error('email-login:fixture-missing');
  const payload = await firebaseRequest('accounts:signInWithPassword', {
    email: account.email,
    password: account.password,
    returnSecureToken: true,
  });
  if (stringField(payload, 'localId') !== account.uid)
    throw new Error('email-login:identity-changed');
  return { ...account, token: stringField(payload, 'idToken') };
}

async function deleteFirebaseAccount(account: FirebaseAccount): Promise<void> {
  try {
    await firebaseRequest('accounts:delete', { idToken: account.token });
  } catch {
    // Cleanup is best effort; the report never prints tokens or account data.
  }
}

async function cleanupFirebaseRunAccounts(): Promise<void> {
  try {
    const app = initializeApp(
      {
        credential: applicationDefault(),
        projectId: process.env.AUTH_AUDIENCE,
      },
      `pocha-smoke-cleanup-${smokeRunId}`,
    );
    const auth = getAuth(app);
    const uids: string[] = [];
    let nextPageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, nextPageToken);
      for (const user of page.users) {
        if (
          user.email?.startsWith(smokeEmailPrefix) &&
          user.email.endsWith('@example.invalid')
        ) {
          uids.push(user.uid);
        }
      }
      nextPageToken = page.pageToken;
    } while (nextPageToken);
    if (uids.length > 0) {
      await auth.deleteUsers(uids);
    }
  } catch {
    // The REST cleanup above remains the fallback when ADC is unavailable.
  }
}

function stringField(value: JsonRecord, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || field.length === 0)
    throw new Error(`missing:${key}`);
  return field;
}

async function httpJson(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<{ readonly status: number; readonly body: JsonRecord }> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let body: JsonRecord = {};
    try {
      body = (JSON.parse(text) as JsonRecord) ?? {};
    } catch {
      body = { raw: text.slice(0, 100) };
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function assertStatus(
  result: { readonly status: number; readonly body: JsonRecord },
  expected: number,
  label: string,
): JsonRecord {
  if (result.status !== expected)
    throw new Error(`${label}:status:${result.status}`);
  return result.body;
}

function connect(account: FirebaseAccount): Promise<Socket> {
  const socket = io(`${baseUrl}/online`, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
    auth: { token: account.token, protocolVersion: 1 },
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      socket.disconnect();
      reject(new Error('socket:authentication-timeout'));
    }, 10_000);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('session:authenticated', onAuthenticated);
      socket.off('game:error', onGameError);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
    };
    const onAuthenticated = () => {
      cleanup();
      sockets.add(socket);
      resolve(socket);
    };
    const onGameError = () => {
      cleanup();
      socket.disconnect();
      reject(new Error('socket:authentication-error'));
    };
    const onConnectError = (error: Error) => {
      cleanup();
      socket.disconnect();
      reject(new Error(`socket:connect-error:${error.message}`));
    };
    const onDisconnect = () => {
      cleanup();
      socket.disconnect();
      reject(new Error('socket:disconnected-before-authentication'));
    };
    socket.once('session:authenticated', onAuthenticated);
    socket.once('game:error', onGameError);
    socket.once('connect_error', onConnectError);
    socket.once('disconnect', onDisconnect);
    socket.connect();
  });
}

function emitRoomReady(
  socket: Socket,
  roomId: string,
  playerCount: number,
): Promise<Room> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('room:updated', onUpdated);
      reject(new Error('room-ready-timeout'));
    }, 10_000);
    const onUpdated = (updated: Room) => {
      if (
        updated.roomId !== roomId ||
        updated.players?.length !== playerCount ||
        updated.players.some((player) => !player.ready)
      )
        return;
      clearTimeout(timer);
      socket.off('room:updated', onUpdated);
      resolve(updated);
    };
    socket.on('room:updated', onUpdated);
    socket.emit('room:ready', { roomId });
  });
}

async function privateRoom(
  clientAccounts: readonly FirebaseAccount[],
): Promise<{
  readonly clients: Socket[];
  readonly room: Room;
  readonly snapshots: Snapshot[];
}> {
  stage = 'private-room';
  const clients = await Promise.all(clientAccounts.map(connect));
  const [host, second, third] = clients;
  const created = roomEvent<Room>(host, 'room:created', 'room-create');
  host.emit('room:create', {
    playerCount: 3,
    rulesetId: 'classic',
    rulesetVersion: 1,
    allowBots: false,
    botDifficulty: 'normal',
  });
  const room = await created;
  for (const client of [second, third]) {
    const joined = roomEvent(client, 'room:joined', 'room-join');
    client.emit('room:join', { code: room.code });
    await joined;
  }
  await Promise.all(
    clients.map((client) => emitRoomReady(client, room.roomId, clients.length)),
  );
  const started = clients.map((client, index) =>
    once<Snapshot>(client, 'game:started', 15_000).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown';
      throw new Error(`private-game-start:${index}:${message}`);
    }),
  );
  host.emit('room:start', { roomId: room.roomId });
  const snapshots = await Promise.all(started);
  gameIds.add(snapshots[0].gameId);
  for (const snapshot of snapshots) {
    const own = snapshot.state.players.find(
      (player) => player.id === snapshot.myPlayerId,
    );
    if (!own || own.hand.length !== snapshot.state.cardsPerRound)
      throw new Error('private-room:own-hand-not-visible');
    if (
      snapshot.state.players.some(
        (player) =>
          player.id !== snapshot.myPlayerId && player.hand.length !== 0,
      )
    )
      throw new Error('private-room:rival-hand-leak');
  }
  return { clients, room, snapshots };
}

function bidFor(snapshot: Snapshot): number {
  const bids = snapshot.state.players
    .map((player) => player.bid)
    .filter((bid): bid is number => bid !== null);
  for (
    let candidate = 0;
    candidate <= snapshot.state.cardsPerRound;
    candidate += 1
  ) {
    if (
      bids.length !== snapshot.state.players.length - 1 ||
      bids.reduce((sum, value) => sum + value, 0) + candidate !==
        snapshot.state.cardsPerRound
    )
      return candidate;
  }
  return 0;
}

function legalCard(snapshot: Snapshot): { readonly id: string } {
  const current = snapshot.state.players[snapshot.state.currentPlayerIndex];
  const leadSuit = snapshot.state.leadSuit;
  const legal =
    snapshot.state.currentTrick.length > 0 &&
    leadSuit &&
    current.hand.some((card) => card.suit === leadSuit)
      ? current.hand.filter((card) => card.suit === leadSuit)
      : current.hand;
  const card = legal[0];
  if (!card) throw new Error('game:no-legal-card');
  return card;
}

async function driveGame(
  clients: readonly Socket[],
  clientAccounts: readonly FirebaseAccount[],
  initial: readonly Snapshot[],
  options: {
    readonly rejectInvalidAction?: boolean;
    readonly abandonIndex?: number;
    readonly reconnectIndex?: number;
  } = {},
): Promise<void> {
  const gameId = initial[0].gameId;
  // AuthService resolves linked guest/permanent Firebase identities to the
  // same canonical User.id. Use the server snapshot IDs instead of raw UIDs.
  const ids = initial.map((snapshot) => snapshot.myPlayerId);
  const handled = new Set<string>();
  let invalidSent = false;
  let invalidCode: string | undefined;
  let resolveInvalid!: (code: string) => void;
  const invalidPromise = new Promise<string>((resolve) => {
    resolveInvalid = resolve;
  });
  let finished = false;
  let resolveFinished!: () => void;
  const finishedPromise = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  const active = new Set(ids);
  let lastSnapshot: Snapshot = initial[0];
  let lastReportedVersion = -1;
  let lastReportedStatus = '';

  const observe = (client: Socket, index: number) => {
    client.on('game:event', (event: { readonly event?: string }) => {
      if (event.event === 'GAME_FINISHED' && !finished) {
        finished = true;
        resolveFinished();
      }
    });
    client.on('game:snapshot', (snapshot: Snapshot) =>
      drive(client, index, snapshot),
    );
  };

  const drive = (client: Socket, index: number, snapshot: Snapshot): void => {
    lastSnapshot = snapshot;
    const userId = ids[index];
    if (!active.has(userId)) return;
    const state = snapshot.state;
    if (
      state.status !== lastReportedStatus ||
      snapshot.stateVersion - lastReportedVersion >= 25
    ) {
      lastReportedStatus = state.status;
      lastReportedVersion = snapshot.stateVersion;
      console.error(
        `game-progress:${snapshot.stateVersion}:${state.status}:${state.currentPlayerIndex}`,
      );
    }
    const current = state.players[state.currentPlayerIndex];
    if (
      current.id !== userId ||
      !['BIDDING', 'CHOOSE_TRUMP', 'PLAYING_TRICK'].includes(state.status)
    )
      return;
    const key = `${userId}:${snapshot.stateVersion}:${state.status}`;
    if (handled.has(key)) return;
    handled.add(key);
    if (state.status === 'BIDDING') {
      client.emit('game:bid', {
        gameId,
        expectedStateVersion: snapshot.stateVersion,
        actionId: `staging-smoke:${index}:${snapshot.stateVersion}:bid`,
        bid: bidFor(snapshot),
      });
    } else if (state.status === 'CHOOSE_TRUMP') {
      client.emit('game:chooseTrump', {
        gameId,
        expectedStateVersion: snapshot.stateVersion,
        actionId: `staging-smoke:${index}:${snapshot.stateVersion}:trump`,
        suit: 'oros',
      });
    } else {
      const card = legalCard(snapshot);
      if (options.rejectInvalidAction && !invalidSent) {
        invalidSent = true;
        const invalid = once<{ readonly code?: string }>(client, 'game:error');
        client.emit('game:playCard', {
          gameId,
          expectedStateVersion: snapshot.stateVersion,
          actionId: `staging-smoke:${index}:${snapshot.stateVersion}:invalid`,
          cardId: 'not-owned-card',
        });
        void invalid.then((error) => {
          invalidCode = error.code;
          resolveInvalid(error.code ?? 'unknown');
          client.emit('game:playCard', {
            gameId,
            expectedStateVersion: snapshot.stateVersion,
            actionId: `staging-smoke:${index}:${snapshot.stateVersion}:card`,
            cardId: card.id,
          });
        });
        return;
      }
      client.emit('game:playCard', {
        gameId,
        expectedStateVersion: snapshot.stateVersion,
        actionId: `staging-smoke:${index}:${snapshot.stateVersion}:card`,
        cardId: card.id,
      });
    }
  };

  for (let index = 0; index < clients.length; index += 1)
    observe(clients[index], index);
  if (options.abandonIndex !== undefined) {
    const index = options.abandonIndex;
    const abandonSnapshot = await syncSnapshot(clients[index], gameId);
    await abandonGame(clients[index], gameId, abandonSnapshot.stateVersion);
    active.delete(ids[index]);
  }
  initial.forEach((snapshot, index) => drive(clients[index], index, snapshot));

  if (options.reconnectIndex !== undefined) {
    const index = options.reconnectIndex;
    const old = clients[index];
    const roomCode = await roomCodeForGame(gameId);
    old.disconnect();
    await sleep(25);
    const replacement = await connect(clientAccounts[index]);
    sockets.add(replacement);
    const rejoined = once<Snapshot>(replacement, 'game:snapshot', 15_000);
    replacement.emit('room:join', { code: roomCode });
    const reconnectSnapshot = await rejoined;
    if (reconnectSnapshot.mySeat !== initial[index].mySeat)
      throw new Error('reconnect:seat-changed');
    observe(replacement, index);
    drive(replacement, index, reconnectSnapshot);
  }

  await Promise.race([
    finishedPromise,
    sleep(90_000).then(() => {
      throw new Error(
        'game:finish-timeout:last=' +
          lastSnapshot.stateVersion +
          ':' +
          lastSnapshot.state.status,
      );
    }),
  ]);
  if (
    options.rejectInvalidAction &&
    (invalidCode ?? (await invalidPromise)) !== 'INVALID_CARD'
  )
    throw new Error(`invalid-action:${invalidCode ?? 'missing'}`);
  for (const socket of sockets) socket.disconnect();
  sockets.clear();
}

async function roomCodeForGame(gameId: string): Promise<string> {
  const keys = await redis.keys(`${redisNamespace}:room:*`);
  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    const room = JSON.parse(raw) as Room & { readonly gameId?: string };
    if (room.gameId === gameId) return room.code;
  }
  throw new Error('reconnect:room-not-found');
}

async function queueMatch(
  clientAccounts: readonly FirebaseAccount[],
  ranked: boolean,
): Promise<{ readonly clients: Socket[]; readonly snapshots: Snapshot[] }> {
  stage = ranked ? 'ranked-queue' : 'casual-queue';
  const clients = await Promise.all(clientAccounts.map(connect));
  const event = ranked ? 'ranked:queued' : 'matchmaking:queued';
  const joinEvent = ranked ? 'ranked:join' : 'matchmaking:join';
  const queued = clients
    .slice(0, clients.length - 1)
    .map((client, index) =>
      socketEventOrError(
        client,
        event,
        `${ranked ? 'ranked' : 'casual'}-queue:${index}`,
      ),
    );
  for (const client of clients.slice(0, clients.length - 1)) {
    client.emit(
      joinEvent,
      ranked
        ? { rulesetId: 'ranked_standard', rulesetVersion: 1 }
        : { playerCount: 3, rulesetId: 'classic', rulesetVersion: 1 },
    );
  }
  await Promise.all(queued);
  const started = clients.map((client, index) =>
    socketEventOrError<Snapshot>(
      client,
      'game:started',
      `${ranked ? 'ranked' : 'casual'}-game-start:${index}`,
    ),
  );
  const last = clients[clients.length - 1];
  last.emit(
    joinEvent,
    ranked
      ? { rulesetId: 'ranked_standard', rulesetVersion: 1 }
      : { playerCount: 3, rulesetId: 'classic', rulesetVersion: 1 },
  );
  const snapshots = await Promise.all(started);
  if (new Set(snapshots.map((snapshot) => snapshot.gameId)).size !== 1)
    throw new Error(`${ranked ? 'ranked' : 'casual'}-queue:different-games`);
  gameIds.add(snapshots[0].gameId);
  return { clients, snapshots };
}

async function verifyHealthAndAuth(): Promise<void> {
  stage = 'health-and-auth';
  let liveResult: { readonly status: number; readonly body: JsonRecord } | null =
    null;
  let readyResult: { readonly status: number; readonly body: JsonRecord } | null =
    null;
  let lastHealthFailure = 'unknown';
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      liveResult = await httpJson('/health/live');
      readyResult = await httpJson('/health/ready');
      const environment = liveResult.body.environment;
      if (
        liveResult.status === 200 &&
        readyResult.status === 200 &&
        environment === 'staging'
      ) {
        break;
      }
      lastHealthFailure = `live:${liveResult.status}:ready:${readyResult.status}:environment:${String(environment)}`;
    } catch (error) {
      lastHealthFailure = error instanceof Error ? error.message : 'request-error';
    }
    if (attempt < 14) await sleep(5_000);
  }
  if (!liveResult || !readyResult || liveResult.status !== 200 || readyResult.status !== 200)
    throw new Error(`health-startup-timeout:${lastHealthFailure}`);
  const live = assertStatus(liveResult, 200, 'health-live');
  if (live.environment !== 'staging')
    throw new Error('health-live:not-staging');
  const readyBody = assertStatus(readyResult, 200, 'health-ready');
  const checks = readyBody.checks as JsonRecord | undefined;
  if (
    readyBody.status !== 'ready' ||
    checks?.database !== 'ok' ||
    checks?.redis !== 'ok'
  ) {
    throw new Error('health-ready:dependencies-not-ready');
  }
  const guest = await createAnonymousAccount();
  accounts.push(guest);
  const permanent = await createEmailAccount(0);
  accounts.push(await signInEmailAccount(permanent));
  const guestProfile = assertStatus(
    await httpJson('/auth/me', guest.token),
    200,
    'guest-me',
  );
  if ((guestProfile.user as JsonRecord).isGuest !== true)
    throw new Error('guest-me:not-guest');
  if (typeof (guestProfile.user as JsonRecord).username !== 'string')
    throw new Error('guest-me:missing-username');
  const stats = assertStatus(
    await httpJson('/users/me/stats', guest.token),
    200,
    'guest-stats',
  );
  if (typeof (stats.stats as JsonRecord | undefined)?.gamesPlayed !== 'number')
    throw new Error('guest-stats:invalid-shape');
  const season = assertStatus(
    await httpJson('/seasons/current'),
    200,
    'current-season',
  );
  if (typeof season.id !== 'string')
    throw new Error('current-season:invalid-shape');
  userIds.add(canonical(guest.uid));
  const invalid = await httpJson('/auth/me', 'invalid-token');
  if (invalid.status !== 401) throw new Error('invalid-token:not-rejected');
}

async function upgradeGuestAfterHistory(gameId: string): Promise<void> {
  stage = 'guest-upgrade-after-history';
  const guest = accounts[0];
  const permanent = accounts[1];
  await waitForHistoryGame(guest.token, gameId, 'guest-history-before-upgrade');
  const upgraded = assertStatus(
    await httpJson('/auth/upgrade', guest.token, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ externalToken: permanent.token }),
    }),
    201,
    'guest-upgrade',
  );
  const upgradedUser = upgraded.user as JsonRecord;
  if (
    upgradedUser.id !== canonical(guest.uid) ||
    upgradedUser.isGuest !== false
  )
    throw new Error('guest-upgrade:identity-not-preserved');
  const permanentProfile = assertStatus(
    await httpJson('/auth/me', permanent.token),
    200,
    'permanent-me',
  );
  if ((permanentProfile.user as JsonRecord).id !== canonical(guest.uid))
    throw new Error('permanent-me:identity-not-linked');
  await waitForHistoryGame(
    permanent.token,
    gameId,
    'permanent-history-after-upgrade',
  );
}

async function waitForHistoryGame(
  token: string,
  gameId: string,
  label: string,
): Promise<JsonRecord> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await httpJson('/users/me/history', token);
    if (result.status === 200 && Array.isArray(result.body.games)) {
      const games = result.body.games as JsonRecord[];
      if (games.some((game) => game.gameId === gameId)) return result.body;
    }
    await sleep(250);
  }
  throw new Error(`guest-history:${label}:game-not-persisted`);
}

async function createRemainingAccounts(): Promise<void> {
  stage = 'account-fixtures';
  for (let index = 1; index < 4; index += 1) {
    const account = await createEmailAccount(index);
    accounts.push(account);
    const profile = assertStatus(
      await httpJson('/auth/me', account.token),
      200,
      `account-${index}-me`,
    );
    if ((profile.user as JsonRecord).isGuest !== false)
      throw new Error(`account-${index}:not-permanent`);
    userIds.add(canonical(account.uid));
  }
}

async function verifyPersistenceAndPrivacy(
  account: FirebaseAccount,
): Promise<void> {
  stage = 'history-export';
  const history = assertStatus(
    await httpJson('/users/me/history', account.token),
    200,
    'history',
  );
  if (!Array.isArray(history.games)) throw new Error('history:invalid-shape');
  const exported = assertStatus(
    await httpJson('/users/me/export', account.token),
    200,
    'export',
  );
  const serialized = JSON.stringify(exported);
  if (serialized.includes(account.token)) throw new Error('export:token-leak');
  if (serialized.includes('authProviderId'))
    throw new Error('export:provider-id-leak');
}

async function verifyRankedApi(account: FirebaseAccount): Promise<void> {
  stage = 'ranked-api';
  const profile = assertStatus(
    await httpJson('/ranked/me', account.token),
    200,
    'ranked-me',
  );
  if (typeof profile.rating !== 'number' || profile.gamesPlayed !== 1)
    throw new Error('ranked-me:missing-persistent-rating');
  const history = assertStatus(
    await httpJson('/ranked/history', account.token),
    200,
    'ranked-history',
  );
  if (!Array.isArray(history.games) || history.games.length !== 1)
    throw new Error('ranked-history:missing-game');
  const game = history.games[0] as JsonRecord;
  if (game.abandoned !== true)
    throw new Error('ranked-history:abandonment-not-recorded');
  const leaderboard = assertStatus(
    await httpJson('/ranked/leaderboard', account.token),
    200,
    'ranked-leaderboard',
  );
  if (!Array.isArray(leaderboard.items) || leaderboard.items.length !== 4)
    throw new Error('ranked-leaderboard:missing-players');
  for (const item of leaderboard.items as JsonRecord[]) {
    if (
      'userId' in item ||
      'authProviderId' in item ||
      'email' in item ||
      'ip' in item
    )
      throw new Error('ranked-leaderboard:private-field-leak');
  }
}

async function verifyAccountDeletion(): Promise<void> {
  stage = 'account-deletion';
  const account = accounts[4];
  const userId = canonical(account.uid);
  const deleted = assertStatus(
    await httpJson('/users/me', account.token, { method: 'DELETE' }),
    200,
    'account-delete',
  );
  if (
    deleted.deleted !== true ||
    deleted.historicalData !== 'anonymized' ||
    typeof deleted.deletedAt !== 'string'
  ) {
    throw new Error('account-delete:invalid-response');
  }
  const row = await prisma.user.findUnique({ where: { id: userId } });
  if (
    !row ||
    !row.deletedAt ||
    row.displayName !== 'Jugador eliminado' ||
    row.authProvider !== 'development' ||
    row.isGuest !== true ||
    row.rankedGamesPlayed !== 1
  ) {
    throw new Error('account-delete:anonymization-or-history-failed');
  }
}

async function verifyDatabaseArtifacts(): Promise<void> {
  stage = 'database-artifacts';
  const games = await prisma.game.findMany({
    where: { id: { in: [...gameIds] } },
  });
  if (games.length < 3 || games.some((game) => game.status !== 'FINISHED'))
    throw new Error('database:finished-games-not-persisted');
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
  });
  if (users.length !== userIds.size)
    throw new Error('database:users-not-persisted');
  const seasonStats = await prisma.seasonPlayerStats.count({
    where: { userId: { in: [...userIds] } },
  });
  if (seasonStats !== 4) throw new Error('database:ranked-stats-not-persisted');
  const gamePlayers = await prisma.gamePlayer.count({
    where: { gameId: { in: [...gameIds] } },
  });
  if (gamePlayers < games.length * 3)
    throw new Error('database:game-players-not-persisted');
  const results = await prisma.gameResult.count({
    where: { gameId: { in: [...gameIds] } },
  });
  if (results < games.length * 3)
    throw new Error('database:results-not-persisted');
  const ratingHistory = await prisma.ratingHistory.count({
    where: { userId: { in: [...userIds] } },
  });
  if (ratingHistory < 4)
    throw new Error('database:rating-history-not-persisted');
  const season = await prisma.rankedSeason.findUnique({
    where: { id: 'season_1' },
    select: { name: true },
  });
  if (season?.name !== 'STAGING SEASON')
    throw new Error('database:staging-season-not-persisted');
  const events = await prisma.gameEvent.count({
    where: { gameId: { in: [...gameIds] } },
  });
  if (events === 0) throw new Error('database:game-events-not-persisted');
}

async function cleanup(): Promise<void> {
  for (const socket of sockets) socket.disconnect();
  await Promise.all(accounts.map(deleteFirebaseAccount));
  await cleanupFirebaseRunAccounts();
  if (gameIds.size > 0)
    await prisma.game.deleteMany({ where: { id: { in: [...gameIds] } } });
  if (userIds.size > 0)
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(
      cursor,
      'MATCH',
      `${redisNamespace}:*`,
      'COUNT',
      100,
    );
    cursor = next;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
  await prisma.$disconnect();
  redis.disconnect();
}

let signalCleanupStarted = false;
function cleanupOnSignal(): void {
  if (signalCleanupStarted) return;
  signalCleanupStarted = true;
  void cleanup().finally(() => process.exit(130));
}

process.once('SIGINT', cleanupOnSignal);
process.once('SIGTERM', cleanupOnSignal);

async function run(): Promise<void> {
  await verifyHealthAndAuth();
  await createRemainingAccounts();
  const preUpgradePlayers = [accounts[0], accounts[2], accounts[3]];
  const guestHistoryGame = await privateRoom(preUpgradePlayers);
  await driveGame(
    guestHistoryGame.clients,
    preUpgradePlayers,
    guestHistoryGame.snapshots,
  );
  await upgradeGuestAfterHistory(guestHistoryGame.snapshots[0].gameId);
  // The backend preserves the guest's canonical User.id, but ranked must use
  // the permanent Firebase token that completed the upgrade.
  const upgradedAccount = accounts[1];
  const threePlayers = [upgradedAccount, accounts[2], accounts[3]];
  const fourPlayers = [...threePlayers, accounts[4]];
  const privateGame = await privateRoom(threePlayers);
  const stale = once<{ readonly code?: string }>(
    privateGame.clients[0],
    'game:error',
  );
  privateGame.clients[0].emit('game:bid', {
    gameId: privateGame.snapshots[0].gameId,
    expectedStateVersion: -1,
    actionId: 'staging-smoke:stale',
    bid: 0,
  });
  if ((await stale).code !== 'STALE_STATE')
    throw new Error('stale-state:not-rejected');
  await driveGame(privateGame.clients, threePlayers, privateGame.snapshots, {
    rejectInvalidAction: true,
    reconnectIndex: 0,
  });
  await sleep(250);

  const casual = await queueMatch(threePlayers, false);
  await driveGame(casual.clients, threePlayers, casual.snapshots);
  await sleep(250);

  const ranked = await queueMatch(fourPlayers, true);
  await driveGame(ranked.clients, fourPlayers, ranked.snapshots, {
    abandonIndex: 3,
    reconnectIndex: 0,
  });
  await sleep(500);
  await verifyRankedApi(fourPlayers[3]);
  await verifyPersistenceAndPrivacy(upgradedAccount);
  await verifyDatabaseArtifacts();
  await verifyAccountDeletion();
}

run()
  .then(async () => {
    await cleanup();
    console.log(
      JSON.stringify({
        status: 'passed',
        checks: [
          'health',
          'firebase-auth',
          'guest-upgrade',
          'socket-auth',
          'private-room',
          'stale-and-invalid-actions',
          'reconnect',
          'casual-queue',
          'ranked-match',
          'ranked-rating-history-leaderboard',
          'postgres-persistence',
          'privacy-export',
          'account-deletion',
        ],
      }),
    );
  })
  .catch(async (error: unknown) => {
    try {
      await cleanup();
    } catch {
      // Keep the failure report deterministic and free of credentials.
    }
    const message = error instanceof Error ? error.message : 'unknown-error';
    console.error(JSON.stringify({ status: 'failed', stage, error: message }));
    process.exitCode = 1;
  });
