# Roadmap

## Fase 0 — Arquitectura

- [x] Monorepo con Flutter, NestJS, Docker y CI base.
- [x] Documentación de arquitectura y decisiones.
- [x] Modelo inicial de PostgreSQL con Prisma.
- [ ] Observabilidad, autenticación externa y despliegue.

## Fase 1 — Motor

- [x] Baraja española de 40 cartas y jerarquía configurable.
- [x] Reglas configurables y preset clásico.
- [x] Reparto determinista mediante RNG inyectable.
- [x] Pujas, triunfo, cartas legales, bazas y puntuación.
- [x] Transiciones de ronda y final de partida.
- [x] Rating multijugador pairwise centralizado.
- [x] Tests unitarios e invariantes básicos.

## Fase 2 — Calculadora

- [x] Persistencia local y guardado automático.
- [x] Tabla por rondas, deshacer e historial.
- [x] Podio y puntuación acumulada.
- [ ] Edición directa de cualquier ronda y estadísticas avanzadas.

## Fase 3 — Un jugador

- [x] Mesa virtual y cartas propias.
- [x] Easy, Normal y Hard Bot sin información oculta.
- [x] Partida completa offline de 3 a 6 jugadores.
- [x] Persistencia, pausa, animaciones, haptics, resumen y podio.
- [x] Simulaciones deterministas, perfiles mixtos y detección de deadlocks.
- [x] Presets clásica, subasta y personalizada; estadísticas offline y autoplay de pruebas.
- [x] Contrato `GameSessionPort`, audio desacoplado e isolate para decisiones Hard.
- [ ] Mejoras de accesibilidad, sonido y tutorial guiado.

## Fase 4 — Backend online

- [x] Auth abstraída, invitados de desarrollo y modelo de usuario Prisma.
- [x] Socket.IO autenticado, `GameSession` autoritativa y snapshots privados.
- [x] Timers, eventos idempotentes, auditoría y rate limiting.
- [x] Repositorios in-memory para tests y adapters Prisma/Redis configurables.

## Fase 5 — Casual y privadas

- [x] Salas privadas por código, lobby, bots y rulesets oficiales.
- [x] Cola casual simple por jugadores y ruleset, con cancelación.
- [x] Reconexión y sustitución temporal mediante bot.
- [x] Parser y templates de deep links; presencia Redis configurable.

## Fase 6 — Ranked

- [x] Matchmaking de cuatro jugadores por ELO con expansión de rango y calidad.
- [x] Ruleset ranked oficial versionado y cálculo pairwise zero-sum.
- [x] Placements, rangos, temporadas, soft reset y leaderboard con cursor.
- [x] Historial, estadísticas separadas, abandono/desconexión/timeout y cooldown.
- [x] UI Flutter funcional, deep-link parser, handoff funcional y simulaciones.
- [x] Smoke técnico con PostgreSQL/Redis reales aislados y Firebase externo.
- [ ] Verificación del staging público HTTPS/WSS y QA en dispositivos físicos.

## Fase 7 — Pulido

- Tutorial, accesibilidad, haptics, sonido, animaciones y perfiles.

## Fase 8A — Preproducción / release candidate

- [x] Configuración tipada por entorno y rechazo de adapters inseguros fuera de desarrollo.
- [x] Migración PostgreSQL, índices, TTL/namespace Redis, health checks y apagado ordenado.
- [x] Revisión de seguridad, privacidad, deep links, CI, Docker, costes y recuperación.
- [x] Fronteras de crash reporting y analytics sin SDK ni envío de datos por defecto.
- [x] Harness local de staging con PostgreSQL/Redis reales y auth externa, sin datos persistentes de smoke.
- [ ] Staging externo con PostgreSQL/Redis gestionados, dominio HTTPS/WSS y secretos montados.
- [ ] Firma y QA en dispositivo Android para Google Play Internal Testing.

## Fase 8B — Android 1.0

- Builds firmadas, staging externo, QA física, proveedor de crash reporting,
  Data Safety y despliegue controlado en Google Play.

## iOS — post-1.0

El trabajo iOS queda diferido y no forma parte del roadmap de lanzamiento
Android actual.
