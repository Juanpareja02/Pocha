# La Pocha

Monorepo para la aplicación móvil y el backend autoritativo de La Pocha.

## Estructura

- `mobile/`: aplicación Flutter; Android 1.0 es el lanzamiento actual.
- `server/`: API NestJS, WebSockets y motor autoritativo.
- `docs/`: arquitectura, decisiones y roadmap.
- `src/`: frontend web existente, conservado mientras se completa la migración móvil.

El frontend web legado (`src/`) queda fuera de la RC móvil/backend y no debe
desplegarse hasta completar su auditoría y actualización independiente.

## Desarrollo rápido

```bash
docker compose up -d postgres redis
Copy-Item .env.example server/.env
cd server
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run config:check
npm test
npm run build
```

Para Flutter:

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
```

Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/ROADMAP.md](docs/ROADMAP.md) para el contexto completo.

La preparación de Release Candidate Android está en [docs/PRODUCTION_AUDIT.md](docs/PRODUCTION_AUDIT.md),
[docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md) y [docs/MANUAL_QA_ANDROID.md](docs/MANUAL_QA_ANDROID.md). El plan de capturas está en
[docs/SCREENSHOT_PLAN.md](docs/SCREENSHOT_PLAN.md). No se publican artefactos ni se
configuran credenciales externas automáticamente.

La evidencia de staging y beta Android está en
[docs/STAGING_REPORT.md](docs/STAGING_REPORT.md). Para repetir el smoke local
con PostgreSQL, Redis y Firebase real: `cd server` y
`npm run staging:local-live-smoke`. Ese helper no sustituye el staging público
HTTPS/WSS ni la QA en un dispositivo Android.

La preparación específica de la beta Android está en
[docs/ANDROID_BETA_READINESS.md](docs/ANDROID_BETA_READINESS.md),
[docs/ANDROID_RC_REPORT.md](docs/ANDROID_RC_REPORT.md) y
[docs/GOOGLE_PLAY_DATA_SAFETY.md](docs/GOOGLE_PLAY_DATA_SAFETY.md).

La Fase 3 está descrita en [docs/SINGLE_PLAYER.md](docs/SINGLE_PLAYER.md) y la arquitectura de bots y simulaciones en [docs/BOTS.md](docs/BOTS.md).

El multijugador online está descrito en [docs/ONLINE_MULTIPLAYER.md](docs/ONLINE_MULTIPLAYER.md), [docs/WEBSOCKET_PROTOCOL.md](docs/WEBSOCKET_PROTOCOL.md) y [docs/AUTH.md](docs/AUTH.md).

La arquitectura competitiva está descrita en [docs/RANKED.md](docs/RANKED.md), el inventario funcional en [docs/DESIGN_HANDOFF.md](docs/DESIGN_HANDOFF.md) y las deep links en [docs/DEEP_LINKS.md](docs/DEEP_LINKS.md).
