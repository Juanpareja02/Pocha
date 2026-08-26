# Protocolo WebSocket

Namespace: `/online`. Versión actual: `protocolVersion: 1`.

## Handshake

```json
{
  "auth": { "token": "...", "protocolVersion": 1 }
}
```

El servidor obtiene el usuario del token validado. Nunca usa un `userId` enviado en una acción.

## Sala

```text
room:create { playerCount, rulesetId, rulesetVersion, allowBots, botDifficulty }
room:join { code }
room:leave
room:ready { roomId }
room:addBot { difficulty }
room:removeBot { userId }
room:start { roomId }
matchmaking:join { playerCount, rulesetId, rulesetVersion }
matchmaking:cancel
ranked:join { rulesetId, rulesetVersion?, region? }
ranked:cancel
```

El servidor publica `room:created`, `room:joined`, `room:updated`, `matchmaking:queued`, `matchmaking:matched`, `matchmaking:cancelled`, `ranked:queued`, `ranked:matched` y `ranked:cancelled`.

Ranked fuerza `ranked_standard@1`, cuatro jugadores humanos y la temporada activa. `ranked:queued` contiene `seasonId`, `queueKey`, `range` y `queuedAt`. `ranked:matched` contiene una sala ya creada; no requiere un segundo ready.

## Juego

Toda acción mutante lleva `gameId`, `expectedStateVersion` y `actionId`:

```json
{
  "gameId": "game_...",
  "expectedStateVersion": 42,
  "actionId": "flutter:...",
  "bid": 2
}
```

Eventos de cliente: `game:bid`, `game:chooseTrump`, `game:playCard`, `game:sync` y `game:leave`. Respuestas: `game:started`, `game:snapshot`, `game:event` y `game:error`.

`STALE_STATE` incluye la versión actual y un snapshot actualizado. Un `actionId` repetido devuelve el snapshot sin ejecutar la transición de nuevo.

El cliente descarta snapshots cuyo `stateVersion` sea menor que el último aplicado. `room:leave` abandona el lobby; una partida iniciada se abandona mediante `game:leave` y el asiento continúa bajo control de bot.

Los códigos públicos incluyen `NOT_AUTHENTICATED`, `NOT_IN_GAME`, `NOT_YOUR_TURN`, `INVALID_PHASE`, `INVALID_CARD`, `ILLEGAL_CARD`, `INVALID_BID`, `STALE_STATE`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `GAME_ALREADY_STARTED`, `RATE_LIMITED`, `ACCOUNT_REQUIRED`, `QUEUE_COOLDOWN`, `SEASON_NOT_AVAILABLE`, `RANKED_UNAVAILABLE` y `PROTOCOL_UNSUPPORTED`.

Los endpoints HTTP competitivos son `GET /ranked/me`, `GET /ranked/leaderboard?seasonId=&limit=&cursor=`, `GET /ranked/leaderboard?scope=global`, `GET /ranked/history`, `GET /seasons/current`, `GET /seasons` y `GET /seasons/:id`. Requieren `Authorization: Bearer ...`.

`game:snapshot.state.players[*].hand` solo contiene cartas para `myPlayerId`. La serialización nunca incluye manos rivales, mazo, seed ni estado RNG.
