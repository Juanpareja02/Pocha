# Informe de staging y beta Android

Fecha de corte: 2026-08-26
Alcance: Fase 8B — staging Android y beta para Google Play.

## Cómo leer los estados

Este informe usa únicamente estos estados:

- `IMPLEMENTED`: la capacidad existe en el código.
- `CONFIGURED`: la configuración está preparada, pero falta el recurso final o
  una prueba externa.
- `CONNECTED`: el código se conectó a un servicio real dentro del alcance
  disponible.
- `VERIFIED`: el flujo indicado se ejecutó y pasó.

Tener un `.env`, un template o un build local no convierte por sí solo el
staging en verificado.

## Resultado por bloque

| Bloque                          | Estado       | Evidencia ejecutada                                                                                                                                                                                                                | Límite real                                                                                                            |
| ------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Backend con modo staging        | `CONFIGURED` | Arranque con `APP_ENV=staging`, `NODE_ENV=production`, stores Prisma/Redis, auth externa y readiness                                                                                                                               | El servidor probado es local; falta hosting público HTTPS/WSS                                                          |
| PostgreSQL                      | `VERIFIED`   | Neon Free `La Pocha` en Londres: `prisma migrate deploy`, `migrate status`, CRUD, transacción y limpieza contra servicio gestionado                                                                                                  | Sigue pendiente inyectarlo en un hosting público                                                                       |
| Redis                           | `VERIFIED`   | Upstash Free Tier `pocha-staging` en Frankfurt: TLS, namespace, SET/GET/TTL/DELETE y limpieza contra servicio gestionado                                                                                                            | Sigue pendiente inyectarlo en un hosting público                                                                       |
| Firebase Auth Anonymous/Email   | `VERIFIED`   | Proyecto `la-pocha-app`: alta anónima, alta y login Email/Password, `/auth/me`, verificación Admin, token inválido, upgrade guest→permanente y persistencia de identidad                                                           | La prueba headless no sustituye QA de UI en dispositivo                                                                |
| Firebase Auth Google            | `CONFIGURED` | Proveedor habilitado, OAuth client Android disponible e ID de servidor inyectado en la build                                                                                                                                       | Falta login interactivo con una cuenta Google de QA en Android                                                         |
| HTTP y WebSocket                | `VERIFIED`   | Health live/ready, auth, perfil, sala privada, privacidad de manos, acciones stale/invalid, reconexión, partida casual y ranked completa                                                                                           | La prueba fue HTTP local; falta repetir con TLS y dominio público                                                      |
| Base de datos después del smoke | `VERIFIED`   | Las cuentas/partidas sintéticas fueron eliminadas por identificadores concretos; se conserva la temporada seed                                                                                                                     | No se ejecutó reset/drop/truncate                                                                                      |
| Flutter Android                 | `CONFIGURED` | `flutter analyze`, `flutter test`, APK/AAB release compilados con el script que resuelve exactamente `com.pocha.mobile`; `STAGING_API_URL`/`STAGING_SOCKET_URL` por `--dart-define`, label staging opcional, cleartext desactivado | Artefactos aún sin firma y sin backend público                                                                         |
| QA Android físico               | `CONFIGURED` | No hay dispositivo Android conectado (`adb devices` no devuelve dispositivos)                                                                                                                                                      | Requiere dispositivo y ejecución manual de la checklist                                                                |
| Firma Android / Play Internal   | `CONFIGURED` | Gradle no usa la clave debug como fallback y acepta keystore externo                                                                                                                                                               | Faltan keystore, contraseñas, cuenta Play y revisión interna                                                           |
| Deep links Android              | `CONFIGURED` | Parser, intent filter y template `assetlinks.json` preparados                                                                                                                                                                      | Falta dominio real, publicación HTTPS y prueba en dispositivo                                                          |
| Crash reporting                 | `CONFIGURED` | Puerto de observabilidad y eventos seguros implementados; smoke usa `noop`                                                                                                                                                         | Falta elegir y proporcionar proveedor                                                                                  |
| Privacidad y exportación        | `VERIFIED`   | Borrado/anonymización y `GET /users/me/export` validados en smoke real                                                                                                                                                             | Faltan identidad legal y URLs públicas de política/términos                                                            |
| CI y seguridad                  | `VERIFIED`   | Tests, build, lint, secret scan, `git diff --check`, audit de dependencias y workflow manual de imagen/backend preparados                                                                                                          | npm reporta 6 moderadas transitivas de `uuid`; 0 altas/críticas; el webhook de despliegue sigue pendiente de proveedor |

## Evidencia técnica

Comandos principales ejecutados:

```text
npm test                                  24 ficheros / 93 tests OK
npm run build                             OK
npm run lint                              OK
npm audit --omit=dev --audit-level=high  0 altas/críticas
npx prisma validate                       OK
npx prisma migrate status                 Database schema is up to date (Neon Free)
flutter analyze                           No issues found
flutter test                              62 tests OK
npm run staging:local-live-smoke          OK
npm run staging:smoke                     OK; Neon + Upstash TLS; CRUD + transacción + namespace staging-*
mobile/tool/build_android_release.ps1     APK y AAB OK; package `com.pocha.mobile`
mobile/tool/build_android_release.ps1 -AnalyzeSize  AAB analysis OK; 20 MB compressed arm64
```

El smoke en vivo cubre health, Firebase Auth, upgrade de invitado, handshake
Socket.IO, sala privada, privacidad de manos, stale state, carta inválida,
reconexión, cola casual, cola ranked, abandono, rating, historial, leaderboard,
exportación, borrado/anonymización, eventos persistidos en PostgreSQL y
claves/TTL de Redis. Además,
detiene y recupera el Redis aislado: readiness pasa a 503 durante la caída y
vuelve a 200 al recuperarlo, sin activar memoria. Usa datos sintéticos y
elimina sus cuentas Firebase y registros locales al terminar.

Los usuarios de prueba usan aliases temporales con el patrón
`pocha-staging-smoke-<run-id>-<index>@example.invalid`; sus UIDs y perfiles
se registran solo durante la ejecución y se eliminan en la limpieza. No se
commitean passwords.

## Integraciones realizadas

NestJS arranca con `NODE_ENV=production` y `APP_ENV=staging`, Firebase Admin,
Prisma para datos duraderos y Redis para salas, presencia, sesiones, colas y
rate limiting. Flutter recibe por defines separados la API HTTPS y el origen
Socket.IO, que usa transporte WSS en release.

## PostgreSQL

PostgreSQL 16 aislado pasó `migrate deploy`, `generate`, validación, CRUD y
persistencia de partidas, jugadores, resultados, eventos, rating e historial.
El modelo actual representa `users` y `profiles` con `User`, `results` con
`GameResult`, `ratings` con los campos de rating de `User`, `rating_history` con
`RatingHistory`, `seasons` con `RankedSeason` y `statistics` con
`SeasonPlayerStats`; el smoke comprueba cada relación y la temporada `STAGING
SEASON`. Limpia solo sus IDs conocidos; no usa reset, drop ni truncate.

Además, Neon Free `La Pocha` recibió la migración versionada y quedó al día.
El smoke gestionado confirmó CRUD, transacción y limpieza contra PostgreSQL
externo.

## Redis

Redis 7 aislado pasó SET/GET/TTL/DELETE, namespaces, salas, presencia, colas,
session lookup y rate limiting. La prueba de fallo confirmó readiness 503 sin
fallback a memoria y recuperación posterior a 200.

Además, Upstash Free Tier `pocha-staging` en Frankfurt pasó el smoke de
infraestructura mediante TLS, con sus credenciales fuera del repositorio.

## Auth

Firebase externo pasó alta anónima, alta/login Email/Password, token, validación
Admin, token inválido y guest→cuenta permanente conservando identidad e
historial: el smoke juega y persiste una partida como invitado, la ve en su
historial, hace upgrade y vuelve a verla con el token de la cuenta permanente.
La expiración se rechaza en la frontera Firebase Admin mediante test específico;
el logout interactivo requiere hardware. Google está configurado pero falta
login interactivo en Android.

## Backend

La configuración fail-fast impide stores de memoria, auth de desarrollo,
URLs locales y debug endpoints fuera de development. `/health/live` y
`/health/ready` se probaron en el backend local de staging.

## Android

La build staging se identifica como `La Pocha Staging`, conserva
`com.pocha.mobile`, usa cleartext desactivado y recibe `STAGING_API_URL` y
`STAGING_SOCKET_URL`. No se ejecutó QA física porque no hay dispositivo
conectado.

## Online QA

Smoke real completó sala privada, privacidad de manos, reconexión, partida
casual y persistencia contra PostgreSQL/Redis/Firebase externos desde el
backend local de staging.

## Ranked QA

Smoke real completó cola ranked, partida, abandono/reintento, resultado,
rating, historial, estadísticas de temporada y leaderboard.

## Deep Links

El parser, intent filter y templates están preparados para `/join/<CODE>`.
Faltan dominio HTTPS, `assetlinks.json` y prueba en dispositivo.

## Signing

Release no usa clave debug. El APK y AAB actuales son artefactos QA sin firma
de producción hasta proporcionar el keystore/upload key.

## AAB

El AAB está generado en
`mobile/build/app/outputs/bundle/release/app-release.aab`; el APK de QA está en
`mobile/build/app/outputs/flutter-apk/app-release.apk`. Ambos fueron comprobados
con package `com.pocha.mobile`; `jarsigner` confirma correctamente que aún no
están firmados. El análisis de tamaño arm64 reportó 20 MB comprimidos.

## Bugs

No se detectaron P0/P1 en las pruebas disponibles. Los P2 actuales son la
falta de firma y la QA física; están documentados en
`docs/RC_KNOWN_ISSUES.md`. El frontend web legado permanece deshabilitado y
fuera de esta release.

## Tests

Backend: 24 ficheros y 93 tests unitarios, 5 E2E WebSocket, build y lint OK.
El proyecto usa Vitest; por eso `npm test -- --runInBand` no es un argumento
válido y la ejecución equivalente verificada es `npm test` (también usada por
CI).
Flutter: 62 tests/goldens, analyze y format OK. Smoke local en vivo OK,
incluida caída/recuperación de Redis.

## External blockers

Siguen pendientes únicamente los recursos externos enumerados en la sección
`HUMAN INPUT REQUIRED`: hosting HTTPS/WSS e inyección de PostgreSQL/Redis en el
hosting, keystore/Play, dispositivo Android, dominio de deep links, proveedor
de crash reporting y datos legales.

## Final status

| Categoría             | Estado       | Alcance comprobado                                          |
| --------------------- | ------------ | ----------------------------------------------------------- |
| STAGING BACKEND       | `CONFIGURED` | Backend staging local seguro; falta URL pública             |
| STAGING DATABASE      | `VERIFIED`   | PostgreSQL local y Neon Free externo con migración/CRUD comprobados |
| STAGING REDIS         | `VERIFIED`   | Redis local y Upstash Free Tier externo con TLS/TTL comprobados     |
| STAGING AUTH          | `CONFIGURED` | Anonymous/Email verificados; Google requiere QA interactiva |
| ANDROID PHYSICAL QA   | `CONFIGURED` | Falta dispositivo físico                                    |
| DEEP LINKS            | `CONFIGURED` | Código/template listos; falta dominio y hardware            |
| ANDROID SIGNING       | `CONFIGURED` | Falta keystore externo                                      |
| PLAY INTERNAL TESTING | `CONFIGURED` | Falta cuenta Play y AAB firmado                             |

## HUMAN INPUT REQUIRED

Para terminar el staging externo y la beta instalable faltan estos valores o
recursos. No deben pegarse en Git ni en el chat:

```text
STAGING_API_URL                 URL HTTPS pública de la API
STAGING_SOCKET_URL              URL HTTPS del origen Socket.IO; transporte WSS
STAGING_DEPLOY_WEBHOOK_URL      URL HTTPS del despliegue manual elegido (CI)
STAGING_DEPLOY_WEBHOOK_TOKEN    Token opcional del despliegue manual (CI)
STAGING_HEALTHCHECK_URL         URL HTTPS completa de `/health/ready` (CI)
STAGING_DATABASE_URL            PostgreSQL staging para `migrate deploy` (CI)
DATABASE_URL                    PostgreSQL gestionado y aislado
REDIS_URL                       Redis gestionado y aislado
PUBLIC_BASE_URL                 URL HTTPS canónica del backend
CORS_ALLOWED_ORIGINS            Orígenes HTTPS de la app/web permitidos
GOOGLE_APPLICATION_CREDENTIALS  Cuenta de servicio montada desde secrets
FIREBASE_ANDROID_PROJECT        Proyecto Firebase Android final y cuenta QA
ANDROID_KEYSTORE_PATH           Keystore de upload fuera del repositorio
ANDROID_KEYSTORE_PASSWORD       Password del keystore
ANDROID_KEY_ALIAS               Alias de firma
ANDROID_KEY_PASSWORD            Password del alias
POCHA_LINK_HOST                 Dominio HTTPS real de App Links
POCHA_LINK_AUTO_VERIFY          true solo después de publicar assetlinks.json
CRASH_PROVIDER                  Proveedor y DSN, si se desea crash reporting
PLAY_CONSOLE_ACCOUNT            Cuenta para Internal testing
ANDROID_DEVICE                  Dispositivo físico para QA de aceptación
LEGAL_PRIVACY_URL / TERMS_URL   URLs públicas y titular legal
```

La configuración pública de Firebase de `la-pocha-app` y sus SHA-1/SHA-256 de
Android ya están registradas. Sus valores se deben inyectar a la build mediante
`--dart-define` o CI, nunca guardarse como secretos del servidor. Si se usa otro
proyecto para la release Android, se deben repetir esas comprobaciones sin
inventar IDs.

## Qué se implementó, configuró, conectó y verificó

- `IMPLEMENTED`: frontera AuthPort, Firebase Admin, stores persistentes, health
  real, rate limiting Redis, sesiones Socket.IO, deep-link templates, export y
  borrado.
- `CONFIGURED`: variables de entorno, Firebase `la-pocha-app`, manifest,
  Gradle, Dockerfile, CI y documentación.
- `CONNECTED`: el backend local arrancó conectado simultáneamente a PostgreSQL,
  Redis y Firebase real; la app puede recibir URLs y Firebase por defines.
- `VERIFIED`: los flujos indicados en la tabla se ejecutaron y pasaron.

## Limitaciones y decisiones

- Docker Desktop no está instalado; la validación se hizo en la distribución
  WSL2 aislada `PochaStaging`. Esto verifica integración técnica, no reemplaza
  un proveedor externo.
- No se inventaron URL públicas, certificados, keystores, cuentas de tienda ni
  credenciales externas.
- El audit de npm encuentra seis vulnerabilidades moderadas transitivas en
  `uuid`; la corrección automática propone bajar `firebase-admin` a una versión
  incompatible, por lo que no se aplicó un downgrade forzado.
- El frontend web legado queda fuera de esta beta móvil y no debe desplegarse
  hasta resolver su propia auditoría de dependencias.

Los entregables Android específicos están en `docs/ANDROID_BETA_READINESS.md`,
`docs/ANDROID_RC_REPORT.md`, `docs/GOOGLE_PLAY_DATA_SAFETY.md` y
`docs/HUMAN_LEGAL_INPUT.md`.
