# Preproduction audit

Fecha: 2026-08-26. Alcance principal: Android 1.0, `mobile/` Flutter y
`server/` NestJS/Prisma/Redis. El frontend web legado en `src/` se audita por
separado y no forma parte de esta RC. No se ha publicado nada ni se han creado
servicios de pago.

## Estado por área

| Área                           | Estado                  | Evidencia / límite real                                                                                                                                                                                                        |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Flutter productivo             | VERIFIED                | Design system, navegación, estados, offline local y tests existentes; falta QA física.                                                                                                                                         |
| Flutter red                    | CONFIGURED_NOT_VERIFIED | `STAGING_API_URL` y `STAGING_SOCKET_URL` se inyectan con `--dart-define`; falta el endpoint HTTPS/WSS real.                                                                                                                    |
| Android código                 | VERIFIED                | Manifest mínimo, HTTPS por defecto en release, nombre, versión beta y APK/AAB compilados.                                                                                                                                      |
| Android firma                  | PENDING_HUMAN_INPUT     | Release no usa la clave debug; requiere variables de keystore externas.                                                                                                                                                        |
| iOS roadmap                    | DEFERRED                | Fuera del lanzamiento Android 1.0; se conserva el código sin usarlo como bloqueo.                                                                                                                                              |
| Backend código                 | VERIFIED                | Configuración fail-fast, stores explícitos, health checks y shutdown; smoke local en vivo correcto.                                                                                                                            |
| PostgreSQL                     | VERIFIED                | PostgreSQL 16 local aislado probado con migración, CRUD y persistencia de partidas; falta repetir contra la instancia gestionada.                                                                                              |
| Redis                          | VERIFIED                | Redis 7 local aislado probado con namespace, colas, presencia, TTL, cleanup y rate limiting; falta repetir contra la instancia gestionada.                                                                                     |
| Auth externa                   | CONFIGURED_NOT_VERIFIED | Firebase `la-pocha-app`: Anonymous y Email/Password verificados con Admin, token inválido y upgrade; Google está configurado pero falta login interactivo en Android.                                                          |
| WebSockets                     | VERIFIED                | Auth, versión de protocolo, rate limiting, privacidad, reconexión y partidas casual/ranked probados en vivo local; falta TLS/WSS público.                                                                                      |
| Deep links Android             | CONFIGURED_NOT_VERIFIED | Ruta `/join/<CODE>` y `assetlinks.json` listos; falta dominio, fingerprint y dispositivo.                                                                                                                                      |
| Secrets                        | VERIFIED                | En `mobile/` y `server/` no se guardan claves privadas; `.env.example` solo usa valores locales. La configuración cliente Firebase del frontend web legado queda fuera de este alcance y está anotada en `SECURITY_REVIEW.md`. |
| Logging                        | VERIFIED                | Request id, niveles por entorno y eventos JSON sin tokens, manos ni secretos.                                                                                                                                                  |
| Analytics                      | VERIFIED                | Puerto tipado, vocabulario mínimo y filtrado de datos privados.                                                                                                                                                                |
| Crash reporting                | PENDING_HUMAN_INPUT     | Frontera preparada; proveedor externo pendiente.                                                                                                                                                                               |
| Privacidad                     | CONFIGURED_NOT_VERIFIED | Inventario y borrado implementados; política/términos aún tienen identidad legal y URLs pendientes.                                                                                                                            |
| Exportación de datos           | VERIFIED                | `GET /users/me/export` probado contra PostgreSQL local con datos reales de smoke.                                                                                                                                              |
| CI/CD                          | VERIFIED                | Pipeline automático de validación y workflow manual protegido para imagen, migraciones, despliegue y readiness; no despliega automáticamente.                                                                                  |
| Deployment                     | CONFIGURED_NOT_VERIFIED | Dockerfile y migración preparados; falta proveedor y secretos.                                                                                                                                                                 |
| Release signing                | PENDING_HUMAN_INPUT     | Play App Signing y variables documentadas; falta keystore externo.                                                                                                                                                             |
| Dependency audit mobile/server | VERIFIED                | 0 vulnerabilidades altas/críticas; npm reporta 6 moderadas transitivas de `uuid`. Prisma 6.19.3 usa override validado a `deepmerge-ts@8.0.2`.                                                                                  |
| Frontend web legado            | OUT OF RELEASE SCOPE    | Se conserva sin desplegar; sus 68 vulnerabilidades de producción quedan para una auditoría y modernización separadas.                                                                                                          |

## Protecciones de arranque

`APP_ENV=staging` o `APP_ENV=production` exige PostgreSQL/Redis, auth externa,
HTTPS, CORS explícito, `PUBLIC_BASE_URL` HTTPS y `ENABLE_DEBUG_ENDPOINTS=false`.
El servidor se niega a iniciar con adapters de memoria, auth de desarrollo o
URLs locales en producción.

## Recuperación

Las partidas online se checkpointan en PostgreSQL y se localizan mediante Redis,
pero el agregado autoritativo y sus timers viven en memoria del proceso. Tras un
reinicio, la sesión viva no se rehidrata automáticamente: el cliente recibe un
error de sesión no disponible y el snapshot queda como evidencia para soporte y
recuperación futura. No se promete HA ni reanudación automática. Si Redis o
PostgreSQL falla, readiness falla y no se activa automáticamente InMemory.

## Bloqueos externos

1. URLs públicas HTTPS/WSS y hosting.
2. PostgreSQL y Redis gestionados de staging.
3. Dominio HTTPS y publicación de `assetlinks.json`.
4. Keystore/Play App Signing y cuentas de tienda.
5. Dispositivo Android físico para QA manual.

## PREPRODUCTION STATUS

| Bloque                 | Estado              | Evidencia / límite real                                                                                                                                                                                   |
| ---------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Código funcional       | VERIFIED            | Backend compilado, 93 tests, 5 E2E y Flutter analyze/tests en verde.                                                                                                                                      |
| Config externa         | PENDING_HUMAN_INPUT | Hosting HTTPS/WSS, PostgreSQL/Redis gestionados, crash reporting y firma real requieren valores externos. Firebase Anonymous/Email ya están conectados y verificados; Google interactivo sigue pendiente. |
| QA dispositivo Android | PENDING_HUMAN_INPUT | Este entorno no tiene dispositivo Android físico.                                                                                                                                                         |
| Tiendas                | PENDING_HUMAN_INPUT | Faltan firma, metadata final, Data Safety, capturas y revisión manual.                                                                                                                                    |

La RC queda clasificada como `VERIFIED` en código y smoke técnico y
`PENDING_HUMAN_INPUT` en infraestructura pública, QA física, firma y tiendas.
Android no se considera listo para producción hasta validar los servicios
externos, QA real, firma y Play Console. El frontend web legado permanece
deshabilitado y fuera de alcance para cualquier despliegue de esta release.

## Evidencia de la última validación local

- `npm run lint`, `npm run build`: OK.
- `npm test`: 24 archivos, 93 tests OK.
- `npm run test:e2e`: 2 archivos, 5 tests OK.
- `npx prisma validate` y `npx prisma migrate status` contra PostgreSQL local: OK.
- `npm audit --omit=dev --audit-level=high` en `server/`: 0 altas/críticas; 6 moderadas transitivas.
- `flutter analyze`, `flutter test`: OK; 62 tests incluidos goldens.
- APK release y AAB release reconstruidos; ambos sin firmar hasta configurar el keystore externo.
