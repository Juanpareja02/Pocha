# Arquitectura de La Pocha

## Principios

1. El servidor es la autoridad en partidas online.
2. El motor de reglas es puro y no conoce Flutter, NestJS, WebSockets ni la base de datos.
3. Las reglas se versionan; una partida histórica conserva el ruleset que la creó.
4. Cada acción lleva la versión de estado conocida por el cliente.
5. El cliente envía intenciones y recibe una vista privada del estado.

## Monorepo

```text
Pocha/
├── mobile/                 # Flutter, Android e iOS
├── server/                 # NestJS + Socket.IO + Prisma
│   ├── src/game-engine/    # dominio puro de La Pocha
│   ├── src/auth/           # AuthService y proveedores de token
│   ├── src/rooms/          # salas privadas y configuración
│   ├── src/matchmaking/    # cola casual sustituible
│   ├── src/game-sessions/  # agregado autoritativo, timers y reconexión
│   ├── src/realtime/       # Socket.IO, rate limit y adapters efímeros
│   ├── src/ranked/         # ranked, temporadas, rating y leaderboard
│   ├── src/analytics/      # eventos de producto y auditoría sin SDK
│   ├── src/users/          # perfiles y estadísticas
│   ├── src/games/          # persistencia de partidas y eventos
│   └── prisma/             # modelo PostgreSQL versionado
├── docs/
├── docker-compose.yml
└── src/                    # frontend web existente
```

## Preproducción y despliegue

`APP_ENV=development` permite adapters en memoria para trabajar localmente. `staging` y `production` exigen PostgreSQL, Redis, autenticación externa, CORS explícito, URL pública HTTPS y adapters duraderos; el servidor falla al arrancar si falta una de estas condiciones. `/health/live` indica proceso vivo y `/health/ready` evita enviar tráfico cuando falta una dependencia.

PostgreSQL conserva el histórico y Redis coordina sesiones, presencia y colas con TTL y namespace. El agregado autoritativo y sus timers viven en memoria; tras un reinicio no se rehidrata automáticamente una partida viva. El snapshot persistido queda disponible para soporte y una futura estrategia de recuperación, pero no se promete alta disponibilidad ni reanudación automática.

El frontend web actual se conserva de momento porque contiene pantallas ya construidas. La aplicación de publicación objetivo es `mobile/`.

La experiencia de un jugador vive en `mobile/lib/features/single_player/`: dominio local, estrategias, persistencia y presentación. Comparte el contrato de reglas versionado de `shared/game-spec/` y no duplica las reglas dentro de los widgets. `GameSessionPort` permite añadir un controlador remoto sin acoplar la mesa a bots locales.

## Capas del servidor

- `game-engine`: tipos, baraja, reglas, bazas, puntuación y rating. No hace I/O.
- `game-sessions`: agregado `GameSession` que protege el motor, timers, asientos, desconexiones, bots sustitutos y eventos.
- `realtime`: `OnlineGateway` es transporte Socket.IO autenticado y delega los comandos tipados.
- `rooms` y `matchmaking`: lobby privado, códigos y cola casual por ruleset.
- `ranked`: cola fija, calidad de match, resultados, temporadas, rangos y leaderboard.
- `analytics`: puerto `AnalyticsPort` para eventos ranked y seguridad; memoria/no-op hasta elegir proveedor.
- Prisma/PostgreSQL: persistencia de usuarios, partidas, eventos y resultados.
- Redis: matchmaking, presencia, locks distribuidos, rate limiting y sesiones efímeras.

La cola casual está activa sin ELO. La cola ranked es fija de cuatro jugadores, con ruleset oficial versionado, rating pairwise, temporadas y leaderboard.

`UserRepository`, `OnlineGameRepository`, `PrismaRankedRepository` y `PrismaSeasonRepository` son los adapters PostgreSQL/Prisma. `PrismaRankedRepository` concentra las responsabilidades de rating, resultados, historial, estadísticas y consultas de leaderboard; `PrismaUserRepository` aporta el perfil/global leaderboard. `RedisRoomRepository`, `RedisPresenceRepository`, `RedisMatchmakingQueue`, `RedisRankedQueue` y `RedisSessionLookupRepository` cubren coordinación efímera entre instancias; memoria sigue siendo la implementación de tests.

## Flujo autoritativo

```text
cliente -> intención + stateVersion
        -> gateway autenticado
        -> OnlineGateway
        -> GameSession
        -> GameEngine (validación + transición)
        -> snapshot privado para ese jugador
```

Las manos rivales nunca forman parte de un snapshot privado. El estado compartido solo contiene cartas jugadas y contadores públicos.

## Estado y concurrencia

`GameState.status` es una máquina de estados explícita. Las transiciones incrementan `stateVersion`. El servidor rechaza una versión obsoleta y la acción se puede repetir de forma segura después de sincronizar.

## Seguridad

- CSPRNG en el adaptador online; el motor recibe el origen de aleatoriedad por inyección.
- DTOs validados en NestJS.
- Rate limiting en HTTP y WebSockets.
- Tokens nunca se guardan en logs.
- `actionId` evita doble tap y reenvíos; `stateVersion` rechaza comandos obsoletos.
- Las cartas privadas se construyen con `buildPlayerView(state, playerId)`.

## Decisiones iniciales

- PostgreSQL + Prisma para datos duraderos.
- Redis para coordinación de tiempo real, no como fuente histórica.
- Socket.IO para reconexión y eventos tipados en la primera versión.
- `LocalGameSession` y `RemoteGameSession` implementan el mismo contrato genérico `GameSessionPort<S>`.
- Flutter con Riverpod y `go_router`; la calculadora y el modo local persisten ahora con `SharedPreferences`, dejando SQLite/Drift para una futura ampliación si el volumen histórico lo requiere.
- Audio detrás de `GameAudio`, con implementación `NoopGameAudio` hasta aprobar assets locales.
