# Multijugador online

La Fase online usa un servidor autoritativo. Flutter solo envía intenciones; `GameSession` valida y aplica cada transición usando `server/src/game-engine`.

## Flujo

```text
AuthPort -> Socket.IO /online -> OnlineGateway
         -> RoomService / GameSessionManager
         -> GameSession -> game-engine
         -> snapshot privado por socket
```

`GameSession` mantiene el estado operativo, los asientos, el log estructurado, `stateVersion`, acciones idempotentes, temporizadores, desconexiones y sustitución por bot. El gateway es transporte: no contiene reglas.

El abandono explícito se registra como `PLAYER_ABANDONED`; la salida del lobby usa `room:leave`. Si la partida ya empezó, el jugador conserva su asiento y el bot continúa jugando.

## Salas y casual

- Las salas privadas usan códigos de seis caracteres sin caracteres ambiguos.
- El host configura 3–6 jugadores, `classic` o `auction`, bots y dificultad.
- Todos los jugadores deben estar listos antes de iniciar una sala privada.
- La cola casual agrupa por `playerCount`, `rulesetId` y `rulesetVersion`; se cancela con `matchmaking:cancel`.
- No se utiliza ELO, ranking ni temporadas.

## Estado privado

Cada snapshot conserva la mano del destinatario y deja vacías las manos rivales. Expone contadores públicos, cartas jugadas, turno, triunfo, `stateVersion`, `deadlineAt` y estados de conexión. No se envían seed, mazo restante ni RNG.

## Reconexión y timers

El servidor marca un socket caído como `DISCONNECTED` y conserva su asiento durante `ONLINE_DISCONNECT_GRACE_MS` (60 segundos por defecto). Al volver, el mismo usuario entra de nuevo por el código de sala y recibe el snapshot actual. Si termina la gracia, el asiento pasa temporalmente a `BOT_CONTROLLED`.

Los límites iniciales son 20 segundos para puja y carta, y 15 segundos para triunfo. Al expirar, un bot usa únicamente `PlayerView` y ejecuta una acción legal.

## Almacenamiento

Desarrollo y tests usan `InMemoryRoomRepository`, `InMemoryPresenceRepository`, `InMemoryMatchmakingQueue`, `InMemoryOnlineGameRepository` e `InMemoryUserRepository`. Son adapters sustituibles, no una decisión de producción.

El adapter de partida guarda checkpoints, event log y resultados finales por jugador; Prisma persiste además `GamePlayer` y `GameResult` dentro de la finalización.

Con `USER_STORE=prisma` y `GAME_STORE=prisma` se seleccionan adapters Prisma. `ROOM_STORE=redis`, `PRESENCE_STORE=redis`, `SESSION_LOOKUP_STORE=redis`, `CASUAL_QUEUE_STORE=redis` y `RANKED_QUEUE_STORE=redis` seleccionan adapters Redis para coordinación efímera. `SEASON_STORE=prisma` y `RANKED_STORE=prisma` activan la persistencia competitiva. El leaderboard global refresca usuarios desde Prisma; no depende de la caché local de una instancia.

El flujo ranked, el contrato de rating, las temporadas, cooldowns y el leaderboard están descritos en [RANKED.md](RANKED.md). Las deep links tienen su contrato en [DEEP_LINKS.md](DEEP_LINKS.md).

## Flutter

`RemoteGameSession` implementa `GameSessionPort<RemoteGameState>`. La pantalla online comparte el mismo contrato de intenciones que el modo local y representa conexión, reconexión, turn timer, lobby, puja, triunfo y cartas legales. La API y el socket se configuran centralmente con `--dart-define=STAGING_API_URL=...` y `--dart-define=STAGING_SOCKET_URL=...`.

## Verificación

Los tests Socket.IO conectan tres clientes reales al NestJS, crean y empiezan salas, juegan una partida completa, comprueban errores de estado obsoleto, turno, carta ilegal, duplicados y reconexión. Hay además escenarios de 3–6 jugadores para privacidad, timeout y sustitución por bot.
