# Android beta readiness

Fecha de corte: 2026-08-26. Alcance: Android 1.0 y Google Play Internal
Testing. Este documento no incluye plataformas que no forman parte del
lanzamiento actual.

## Estados usados

- `READY`: código y configuración preparados y comprobados en el alcance que
  depende del repositorio.
- `HUMAN INPUT REQUIRED`: falta una cuenta, secreto, decisión o dispositivo que
  debe aportar una persona con acceso.
- `EXTERNAL SERVICE REQUIRED`: falta contratar, crear o conectar un servicio
  externo.
- `BLOCKED`: no existe una alternativa técnica disponible en este entorno.

## Matriz Android

| Área                | Estado                      | Evidencia actual                                                                                                               | Para avanzar                                                                                 |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Backend staging     | `EXTERNAL SERVICE REQUIRED` | NestJS, Dockerfile, configuración fail-fast y workflow manual preparados; smoke local conectado a PostgreSQL, Redis y Firebase | Hosting público con HTTPS/WSS, variables y webhook de despliegue                             |
| PostgreSQL          | `READY`                     | Neon `La Pocha` Free en Londres; migración versionada, `migrate status`, CRUD, transacción y limpieza verificados               | Inyectar `DATABASE_URL` si se publica un backend externo                                          |
| Redis               | `READY`                     | Upstash `pocha-staging` Free Tier en Frankfurt; TLS, namespace, TTL, SET/GET/DELETE y limpieza verificados                    | Inyectar `REDIS_URL` si se publica un backend externo                                             |
| Firebase Auth       | `HUMAN INPUT REQUIRED`      | `la-pocha-app` real: Anonymous/Email verificados; Google habilitado y cliente Android resuelto                                 | Confirmar proyecto de lanzamiento, cuenta QA y configuración OAuth que se usará en Android   |
| HTTPS/WSS           | `EXTERNAL SERVICE REQUIRED` | Release rechaza HTTP, hosts locales y dominios reservados                                                                      | Publicar API y Socket.IO bajo un dominio HTTPS con TLS válido                                |
| Android build       | `READY`                     | Script reproducible, `com.pocha.mobile`, label `La Pocha Staging`, defines centralizados y cleartext desactivado               | Sustituir endpoints por los reales y regenerar                                               |
| Android signing     | `HUMAN INPUT REQUIRED`      | Gradle no usa la clave debug como fallback y acepta keystore externo                                                           | Proporcionar upload keystore, alias y secretos fuera del repositorio                         |
| Deep Links          | `EXTERNAL SERVICE REQUIRED` | Parser, intent filter y plantilla `assetlinks.json` preparados                                                                 | Registrar dominio real, publicar `assetlinks.json` con el SHA-256 real y probarlo en Android |
| Crash Reporting     | `HUMAN INPUT REQUIRED`      | Frontera `CrashReporter` segura; no se añadió un SDK sin configuración                                                         | Elegir Crashlytics u otro proveedor y proporcionar su configuración                          |
| Privacy             | `HUMAN INPUT REQUIRED`      | Exportación, borrado anonimizado e inventario técnico implementados                                                            | Confirmar identidad legal, retención y URLs públicas                                         |
| Google Play         | `HUMAN INPUT REQUIRED`      | Checklist de Internal Testing, package y AAB preparados                                                                        | Crear/confirmar app, Play App Signing, testers y ficha de Play                               |
| Physical Android QA | `HUMAN INPUT REQUIRED`      | Tests automatizados correctos; `adb devices` no detecta hardware                                                               | Conectar un Android físico y ejecutar la checklist completa                                  |

No hay un bloqueo técnico Android clasificado como `BLOCKED`. Los elementos que
impiden declarar la beta lista son servicios externos y acciones humanas
pendientes, no funcionalidades nuevas.

## Evidencia automatizada

- Backend: 24 ficheros y 93 tests unitarios; 5 E2E WebSocket.
- Flutter: 62 tests/goldens, `flutter analyze` y formato correctos.
- Smoke local en vivo: autenticación Firebase, guest→cuenta, salas, casual,
  ranked, ELO, leaderboard, historial, privacidad, exportación, borrado y
  caída/recuperación de Redis.
- `npx prisma migrate deploy`, `prisma validate` y `prisma generate` correctos.
- Auditoría de producción: 0 vulnerabilidades altas/críticas en `server/`.

## Criterio de salida Android 1.0

La beta pasa a lista para Internal Testing solo cuando las filas de servicio,
firma, QA física, privacidad y Play tengan evidencia del recurso final. Un
build local o un `.env` de ejemplo no cuenta como staging externo verificado.
