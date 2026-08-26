# Security review

Revisión basada en controles OWASP para móvil, HTTP, Socket.IO, PostgreSQL y
Redis. Fecha: 2026-08-26.

| ID      | Severidad | Estado                  | Tema                                                                                                                                                                                    |
| ------- | --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-001 | High      | CONFIGURED_NOT_VERIFIED | Firebase externo `la-pocha-app` valida tokens reales de Anonymous y Email/Password en Firebase Admin; Google está configurado pero su login interactivo Android aún no se ha ejecutado. |
| SEC-002 | High      | PENDING_HUMAN_INPUT     | Firma Android real no disponible; release no reutiliza la clave debug y requiere keystore externo.                                                                                      |
| SEC-003 | Medium    | VERIFIED                | CORS HTTP/Socket.IO no acepta wildcard ni orígenes HTTP fuera de development; readiness y configuración staging fueron comprobadas.                                                     |
| SEC-004 | Medium    | VERIFIED                | DTOs usan whitelist, transformación y rechazo de campos no permitidos.                                                                                                                  |
| SEC-005 | Medium    | VERIFIED                | Acciones verifican usuario, sala, turno, versión, idempotencia y rate limit; se validó stale state y carta inválida en vivo.                                                            |
| SEC-006 | Medium    | VERIFIED                | Redis real usa namespace, TTL, locks, cleanup de claves stale y rate limiter compartido; no hace fallback automático a memoria.                                                         |
| SEC-007 | Low       | PENDING_HUMAN_INPUT     | Proveedor de crash reporting todavía no está seleccionado.                                                                                                                              |
| SEC-008 | Low       | CONFIGURED_NOT_VERIFIED | Android App Links necesitan dominio, `assetlinks.json` y dispositivo real.                                                                                                              |
| SEC-009 | High      | VERIFIED                | `server/` fuerza `deepmerge-ts@8.0.2` mediante `npm overrides`; audit de producción no encuentra vulnerabilidades altas/críticas y la batería pasa.                                     |
| SEC-010 | High      | OUT OF RELEASE SCOPE    | El frontend web legado conserva 68 vulnerabilidades de producción tras `npm audit fix` sin force; permanece deshabilitado y no se despliega como parte de la RC móvil.                  |

## Controles aplicados

- `helmet`, CORS explícito y transporte HTTPS/WSS exigido en configuración externa.
- `x-request-id` limitado y logging JSON sin bodies, tokens, passwords, cartas,
  manos ni RNG.
- Rate limit global HTTP y rate limit de comandos realtime.
- El rate limit realtime usa Redis fuera de development; una indisponibilidad rechaza la acción.
- Prisma ORM sin SQL construido con input de usuario.
- Normalización NFKD/NFKC, límites y reservados de username.
- `DELETE /users/me` anonimiza identidad sin romper resultados históricos.
- Constraints e índices definidos en la migración inicial.
- Las respuestas de sala y partida filtran la mano de cada jugador; el smoke
  comprobó que un rival no recibe cartas privadas.

## Dependencias

En `server/`, `npm audit --omit=dev --audit-level=high` no encuentra
vulnerabilidades altas ni críticas, pero reporta seis moderadas transitivas
relacionadas con `uuid`. La corrección automática propone bajar
`firebase-admin` a una versión incompatible; no se aplicó un downgrade forzado.
La dependencia exacta `deepmerge-ts@7.1.5` de `@prisma/config` se fuerza a
`8.0.2` con `overrides`; Prisma se mantiene en 6.19.3 y pasan lint, build, 93
tests unitarios y 5 E2E. El frontend web legado, auditado aparte, requiere
modernización propia antes de cualquier despliegue.

## Secret scan

La revisión no encontró claves privadas, JWT emitidos ni passwords de producción
en `mobile/` y `server/`. La cuenta de servicio Firebase está fuera del
repositorio y la configuración cliente web existente queda fuera de esta RC;
su API key no es un secreto de servidor, pero debe restringirse/parametrizarse
antes de desplegar ese frontend.

El valor `pocha:pocha` de `.env.example` es únicamente local para Docker y no se
usa fuera de development. No se imprimen tokens ni credenciales en los logs del
smoke.
