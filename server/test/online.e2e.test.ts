import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { io, Socket } from 'socket.io-client';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

interface Snapshot {
  gameId: string;
  roomId: string;
  stateVersion: number;
  myPlayerId: string;
  mySeat: number;
  state: {
    status: string;
    currentPlayerIndex: number;
    cardsPerRound: number;
    leadSuit: string | null;
    currentTrick: Array<unknown>;
    players: Array<{
      id: string;
      hand: Array<{ id: string; suit: string }>;
      bid: number | null;
    }>;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function once<T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs = 5_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const onEvent = (value: T) => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(value);
    };
    socket.once(event, onEvent);
  });
}

function connect(baseUrl: string, userId: string): Promise<Socket> {
  const socket = io(`${baseUrl}/online`, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token: `dev:${userId}`, protocolVersion: 1 },
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for session:authenticated'));
    }, 5_000);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('session:authenticated', onAuthenticated);
      socket.off('game:error', onGameError);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
    };
    const onAuthenticated = (_value: { protocolVersion: number }) => {
      cleanup();
      resolve(socket);
    };
    const onGameError = (error: { code?: string; message?: string }) => {
      cleanup();
      reject(
        new Error(`Socket authentication failed: ${JSON.stringify(error)}`),
      );
    };
    const onConnectError = (error: Error) => {
      cleanup();
      reject(new Error(`Socket connection failed: ${error.message}`));
    };
    const onDisconnect = (reason: string) => {
      cleanup();
      reject(new Error(`Socket disconnected before authentication: ${reason}`));
    };
    socket.once('session:authenticated', onAuthenticated);
    socket.once('game:error', onGameError);
    socket.once('connect_error', onConnectError);
    socket.once('disconnect', onDisconnect);
    socket.connect();
  });
}

describe('online Socket.IO multiplayer', () => {
  let app: NestExpressApplication;
  let baseUrl = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ONLINE_ROUND_RESULT_MS = '0';
    process.env.ONLINE_DISCONNECT_GRACE_MS = '20';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('connects three authenticated clients, creates a room, joins, readies and starts', async () => {
    const clients = await Promise.all(
      ['guest_a01', 'guest_b01', 'guest_c01'].map((id) => connect(baseUrl, id)),
    );
    const [host, second, third] = clients;
    const createdPromise = once<{ roomId: string; code: string }>(
      host,
      'room:created',
    );
    host.emit('room:create', {
      playerCount: 3,
      rulesetId: 'classic',
      rulesetVersion: 1,
      allowBots: false,
      botDifficulty: 'normal',
    });
    const room = await createdPromise;
    const joins = [second, third].map((client) => {
      const joined = once(client, 'room:joined');
      client.emit('room:join', { code: room.code });
      return joined;
    });
    await Promise.all(joins);
    for (const client of clients) {
      const updated = once(client, 'room:updated');
      client.emit('room:ready', { roomId: room.roomId });
      await updated;
    }
    const started = clients.map((client) =>
      once<Snapshot>(client, 'game:started', 10_000),
    );
    host.emit('room:start', { roomId: room.roomId });
    const snapshots = await Promise.all(started);
    expect(snapshots).toHaveLength(3);
    expect(new Set(snapshots.map((snapshot) => snapshot.gameId)).size).toBe(1);
    for (const snapshot of snapshots) {
      expect(snapshot.state.status).toBe('BIDDING');
      const own = snapshot.state.players.find(
        (player) => player.id === snapshot.myPlayerId,
      )!;
      expect(own.hand).toHaveLength(snapshot.state.cardsPerRound);
      for (const rival of snapshot.state.players.filter(
        (player) => player.id !== snapshot.myPlayerId,
      )) {
        expect(rival.hand).toHaveLength(0);
      }
    }
    for (const client of clients) client.disconnect();
  }, 30_000);

  it('plays a full three-client game, rejects stale/out-of-turn actions, and reconnects the same seat', async () => {
    const ids = ['guest_d01', 'guest_e01', 'guest_f01'];
    let clients = await Promise.all(ids.map((id) => connect(baseUrl, id)));
    const [host, second, third] = clients;
    const createdPromise = once<{ roomId: string; code: string }>(
      host,
      'room:created',
    );
    host.emit('room:create', {
      playerCount: 3,
      rulesetId: 'classic',
      rulesetVersion: 1,
      allowBots: false,
      botDifficulty: 'normal',
    });
    const room = await createdPromise;
    for (const client of [second, third]) {
      const joined = once(client, 'room:joined');
      client.emit('room:join', { code: room.code });
      await joined;
    }
    for (const client of clients) {
      const updated = once(client, 'room:updated');
      client.emit('room:ready', { roomId: room.roomId });
      await updated;
    }
    const started = clients.map((client) =>
      once<Snapshot>(client, 'game:started', 10_000),
    );
    host.emit('room:start', { roomId: room.roomId });
    const initial = await Promise.all(started);
    const gameId = initial[0].gameId;
    const currentId =
      initial[0].state.players[initial[0].state.currentPlayerIndex].id;
    const staleError = once<{ code: string }>(host, 'game:error');
    host.emit('game:bid', {
      gameId,
      expectedStateVersion: -1,
      actionId: 'e2e:stale:0001',
      bid: 0,
    });
    expect((await staleError).code).toBe('STALE_STATE');
    const outTurnClient = initial.find(
      (snapshot) => snapshot.myPlayerId !== currentId,
    )!;
    const outTurnSocket = clients[initial.indexOf(outTurnClient)];
    const outTurnError = once<{ code: string }>(outTurnSocket, 'game:error');
    outTurnSocket.emit('game:bid', {
      gameId,
      expectedStateVersion: initial[0].stateVersion,
      actionId: 'e2e:turn:0001',
      bid: 0,
    });
    expect((await outTurnError).code).toBe('NOT_YOUR_TURN');

    let finished = false;
    let illegalSent = false;
    let illegalCode: string | undefined;
    let resolveIllegal!: (code: string) => void;
    const illegalPromise = new Promise<string>((resolve) => {
      resolveIllegal = resolve;
    });
    const handled = new Set<string>();
    const finishedPromise = new Promise<void>((resolve) => {
      for (const client of clients) {
        client.on('game:event', (event: { event: string }) => {
          if (event.event === 'GAME_FINISHED' && !finished) {
            finished = true;
            resolve();
          }
        });
      }
    });
    const driveSnapshot = (
      client: Socket,
      userId: string,
      snapshot: Snapshot,
    ) => {
      const gameIdForAction = snapshot.gameId;
      const state = snapshot.state;
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
        const bids = state.players
          .map((player) => player.bid)
          .filter((bid): bid is number => bid !== null);
        let bid = 0;
        for (
          let candidate = 0;
          candidate <= state.cardsPerRound;
          candidate += 1
        ) {
          if (
            bids.length !== state.players.length - 1 ||
            bids.reduce((sum, value) => sum + value, 0) + candidate !==
              state.cardsPerRound
          ) {
            bid = candidate;
            break;
          }
        }
        client.emit('game:bid', {
          gameId: gameIdForAction,
          expectedStateVersion: snapshot.stateVersion,
          actionId: `e2e:${userId}:${snapshot.stateVersion}:bid`,
          bid,
        });
      } else if (state.status === 'CHOOSE_TRUMP') {
        client.emit('game:chooseTrump', {
          gameId: gameIdForAction,
          expectedStateVersion: snapshot.stateVersion,
          actionId: `e2e:${userId}:${snapshot.stateVersion}:trump`,
          suit: 'oros',
        });
      } else {
        const own = current.hand;
        const legal =
          state.currentTrick.length > 0 &&
          state.leadSuit &&
          own.some((card) => card.suit === state.leadSuit)
            ? own.filter((card) => card.suit === state.leadSuit)
            : own;
        if (!illegalSent) {
          illegalSent = true;
          const error = once<{ code: string }>(client, 'game:error');
          client.emit('game:playCard', {
            gameId: gameIdForAction,
            expectedStateVersion: snapshot.stateVersion,
            actionId: `e2e:${userId}:${snapshot.stateVersion}:illegal`,
            cardId: 'not-owned-card',
          });
          void error.then((payload) => {
            illegalCode = payload.code;
            resolveIllegal(payload.code);
            client.emit('game:playCard', {
              gameId: gameIdForAction,
              expectedStateVersion: snapshot.stateVersion,
              actionId: `e2e:${userId}:${snapshot.stateVersion}:card`,
              cardId: legal[0].id,
            });
          });
          return;
        }
        client.emit('game:playCard', {
          gameId: gameIdForAction,
          expectedStateVersion: snapshot.stateVersion,
          actionId: `e2e:${userId}:${snapshot.stateVersion}:card`,
          cardId: legal[0].id,
        });
      }
    };
    const attachDriver = (client: Socket, userId: string) => {
      client.on('game:snapshot', (snapshot: Snapshot) => {
        driveSnapshot(client, userId, snapshot);
      });
    };
    clients.forEach((client, index) => attachDriver(client, ids[index]));
    initial.forEach((snapshot, index) =>
      driveSnapshot(clients[index], ids[index], snapshot),
    );

    clients[0].disconnect();
    await sleep(5);
    const replacement = await connect(baseUrl, ids[0]);
    const rejoined = once<Snapshot>(replacement, 'game:snapshot', 10_000);
    replacement.emit('room:join', { code: room.code });
    const reconnectSnapshot = await rejoined;
    expect(reconnectSnapshot.myPlayerId).toBe(ids[0]);
    expect(reconnectSnapshot.mySeat).toBe(0);
    clients = [replacement, clients[1], clients[2]];
    attachDriver(replacement, ids[0]);

    await expect(finishedPromise).resolves.toBeUndefined();
    expect(finished).toBe(true);
    expect(illegalCode ?? (await illegalPromise)).toBe('INVALID_CARD');
    for (const client of clients) client.disconnect();
  }, 120_000);

  it('matches three real Socket.IO clients in the casual queue', async () => {
    const clients = await Promise.all(
      ['guest_q01', 'guest_q02', 'guest_q03'].map((id) => connect(baseUrl, id)),
    );
    const queued = clients
      .slice(0, 2)
      .map((client) => once<{ queued: boolean }>(client, 'matchmaking:queued'));
    clients[0].emit('matchmaking:join', {
      playerCount: 3,
      rulesetId: 'classic',
      rulesetVersion: 1,
    });
    clients[1].emit('matchmaking:join', {
      playerCount: 3,
      rulesetId: 'classic',
      rulesetVersion: 1,
    });
    expect((await Promise.all(queued)).every((result) => result.queued)).toBe(
      true,
    );
    const matched = clients.map((client) =>
      once<Snapshot>(client, 'game:started', 10_000),
    );
    clients[2].emit('matchmaking:join', {
      playerCount: 3,
      rulesetId: 'classic',
      rulesetVersion: 1,
    });
    const snapshots = await Promise.all(matched);
    expect(new Set(snapshots.map((snapshot) => snapshot.gameId)).size).toBe(1);
    for (const client of clients) client.disconnect();
  }, 30_000);

  it('runs a ranked match for four accounts, reconnects, applies abandonment once and updates leaderboard', async () => {
    const ids = ['rank_a01', 'rank_b01', 'rank_c01', 'rank_d01'];
    let clients = await Promise.all(ids.map((id) => connect(baseUrl, id)));
    const queued = clients
      .slice(0, 3)
      .map((client) => once<{ queued: boolean }>(client, 'ranked:queued'));
    for (const client of clients.slice(0, 3))
      client.emit('ranked:join', {
        rulesetId: 'ranked_standard',
        rulesetVersion: 1,
      });
    expect((await Promise.all(queued)).every((result) => result.queued)).toBe(
      true,
    );

    const matched = clients.map((client) =>
      once(client, 'ranked:matched', 10_000),
    );
    const started = clients.map((client) =>
      once<Snapshot>(client, 'game:started', 10_000),
    );
    clients[3].emit('ranked:join', {
      rulesetId: 'ranked_standard',
      rulesetVersion: 1,
    });
    const rooms = await Promise.all(matched);
    const snapshots = await Promise.all(started);
    expect(
      new Set(rooms.map((room: { mode?: string }) => room.mode)).size,
    ).toBe(1);
    expect(rooms[0].mode).toBe('ranked');
    const gameId = snapshots[0].gameId;
    const abandoner = snapshots[3];
    clients[3].emit('game:leave', {
      gameId,
      expectedStateVersion: abandoner.stateVersion,
      actionId: 'ranked:abandon:0001',
    });

    let finished = false;
    const finishedPromise = new Promise<void>((resolve) => {
      for (const client of clients) {
        client.on('game:event', (event: { event: string }) => {
          if (event.event === 'GAME_FINISHED' && !finished) {
            finished = true;
            resolve();
          }
        });
      }
    });
    const handled = new Set<string>();
    const drive = (client: Socket, userId: string, snapshot: Snapshot) => {
      const state = snapshot.state;
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
        const bids = state.players
          .map((player) => player.bid)
          .filter((bid): bid is number => bid !== null);
        let bid = 0;
        for (
          let candidate = 0;
          candidate <= state.cardsPerRound;
          candidate += 1
        ) {
          if (
            bids.length !== state.players.length - 1 ||
            bids.reduce((sum, value) => sum + value, 0) + candidate !==
              state.cardsPerRound
          ) {
            bid = candidate;
            break;
          }
        }
        client.emit('game:bid', {
          gameId,
          expectedStateVersion: snapshot.stateVersion,
          actionId: `ranked:${userId}:${snapshot.stateVersion}:bid`,
          bid,
        });
      } else if (state.status === 'CHOOSE_TRUMP') {
        client.emit('game:chooseTrump', {
          gameId,
          expectedStateVersion: snapshot.stateVersion,
          actionId: `ranked:${userId}:${snapshot.stateVersion}:trump`,
          suit: 'oros',
        });
      } else {
        const own = current.hand;
        const legal =
          state.currentTrick.length > 0 &&
          state.leadSuit &&
          own.some((card) => card.suit === state.leadSuit)
            ? own.filter((card) => card.suit === state.leadSuit)
            : own;
        client.emit('game:playCard', {
          gameId,
          expectedStateVersion: snapshot.stateVersion,
          actionId: `ranked:${userId}:${snapshot.stateVersion}:card`,
          cardId: legal[0].id,
        });
      }
    };
    const attach = (client: Socket, userId: string) =>
      client.on('game:snapshot', (snapshot: Snapshot) =>
        drive(client, userId, snapshot),
      );
    clients.forEach((client, index) => {
      if (index !== 3) attach(client, ids[index]);
    });
    snapshots.forEach((snapshot, index) => {
      if (index !== 3) drive(clients[index], ids[index], snapshot);
    });

    clients[0].disconnect();
    await sleep(5);
    const replacement = await connect(baseUrl, ids[0]);
    const reconnectSnapshot = once<Snapshot>(
      replacement,
      'game:snapshot',
      10_000,
    );
    replacement.emit('room:join', { code: rooms[0].code });
    expect((await reconnectSnapshot).mySeat).toBe(0);
    clients = [replacement, clients[1], clients[2], clients[3]];
    attach(replacement, ids[0]);

    await expect(finishedPromise).resolves.toBeUndefined();
    expect(finished).toBe(true);
    await sleep(50);
    for (const id of ids) {
      const response = await fetch(`${baseUrl}/ranked/me`, {
        headers: { authorization: `Bearer dev:${id}` },
      });
      expect(response.status).toBe(200);
      const profile = (await response.json()) as {
        gamesPlayed: number;
        rating: number;
        provisional: boolean;
      };
      expect(profile.gamesPlayed).toBe(1);
      expect(profile.rating).toBeTypeOf('number');
      expect(profile.provisional).toBe(true);
    }
    const historyResponse = await fetch(`${baseUrl}/ranked/history`, {
      headers: { authorization: 'Bearer dev:rank_d01' },
    });
    const history = (await historyResponse.json()) as {
      games: Array<{ abandoned: boolean }>;
    };
    expect(history.games).toHaveLength(1);
    expect(history.games[0].abandoned).toBe(true);
    const leaderboardResponse = await fetch(`${baseUrl}/ranked/leaderboard`, {
      headers: { authorization: 'Bearer dev:rank_a01' },
    });
    const leaderboard = (await leaderboardResponse.json()) as {
      items: Array<unknown>;
      myPosition: number;
    };
    expect(leaderboard.items).toHaveLength(4);
    expect(leaderboard.myPosition).toBeGreaterThan(0);
    for (const item of leaderboard.items as Array<Record<string, unknown>>) {
      expect(item).not.toHaveProperty('userId');
      expect(item).not.toHaveProperty('authProviderId');
      expect(item).not.toHaveProperty('email');
      expect(item).not.toHaveProperty('ip');
    }
    for (const client of clients) client.disconnect();
  }, 180_000);
});
