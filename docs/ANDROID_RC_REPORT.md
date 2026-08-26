# Android release candidate report

Fecha de corte: 2026-08-26. Este informe cubre exclusivamente la release
Android de La Pocha y su camino hacia Google Play Internal Testing.

## Backend

El backend NestJS puede arrancar con `APP_ENV=staging` y
`NODE_ENV=production`. Fuera de development exige Firebase externo, Prisma,
Redis, HTTPS, CORS explícito y debug desactivado. El workflow manual de
`.github/workflows/staging-backend.yml` valida, construye la imagen, aplica
`prisma migrate deploy` cuando se habilita el secreto y comprueba
`/health/ready` después del despliegue.

El backend probado en esta máquina es local. No se ha inventado ni publicado
una URL pública HTTPS/WSS. PostgreSQL y Redis ya están conectados a sus
instancias gratuitas gestionadas; Railway no se ha activado porque la cuenta
indica `Trial expired` y solicita `Upgrade`.

## Database

La instancia aislada PostgreSQL 16 pasó migraciones, generación de Prisma,
validación, CRUD, transacciones y persistencia de usuarios, partidas,
jugadores, resultados, eventos, rating, historial, temporada y estadísticas.
El smoke elimina únicamente IDs sintéticos conocidos y conserva la temporada
`STAGING SEASON`; no ejecuta reset, drop ni truncate general.

La instancia Neon Free `La Pocha` recibió `prisma migrate deploy` y quedó al
día. El smoke gestionado repitió create/read/update/delete y una transacción
contra PostgreSQL externo.

## Redis

La instancia aislada Redis 7 pasó conectividad, namespace, SET/GET/TTL/DELETE,
presencia, salas, colas casual/ranked, lookup de sesión, rate limiting y
limpieza. Al detener Redis, readiness respondió 503 y no hubo fallback a
memoria; tras recuperarlo respondió 200.

El Redis Upstash Free Tier `pocha-staging` quedó en Frankfurt y pasó el smoke
TLS de infraestructura. Sus credenciales solo están en variables de usuario
locales.

## Firebase

El proyecto `la-pocha-app` está configurado para Android. Anonymous y
Email/Password se probaron con cuentas temporales y Firebase Admin; también se
probó guest→historial→upgrade→historial persistente y rechazo de token
inválido. Google está configurado con cliente Android, pero falta el login
interactivo con una cuenta QA en un Android real o emulador.

## Android QA

`flutter analyze`, `flutter test` (62) y los goldens pasan. No se ha ejecutado
la checklist manual porque `adb devices` no muestra ningún dispositivo. Quedan
pendientes instalación, onboarding, logout, restore, calculadora, solitario,
online, cambio de red, background, force-stop, ranked, responsive y deep link.

## Signing

`com.pocha.mobile` se mantiene estable. Gradle recibe el keystore por variables
externas y no usa debug como fallback. Faltan upload key, Play App Signing y
los secretos de firma; no se imprimen passwords ni se guardan claves en Git.

## AAB

Artefactos actuales de QA:

- `mobile/build/app/outputs/flutter-apk/app-release.apk`
- `mobile/build/app/outputs/bundle/release/app-release.aab`

El AAB es el artefacto correcto para Play, pero los artefactos actuales no
están firmados y fueron generados sin un backend público operativo. El script
de release rechaza endpoints locales o reservados antes de crear una nueva
build; se ha ejecutado correctamente desde la raíz del repositorio con la
configuración Firebase Android real y `-AnalyzeSize` (20 MB comprimidos).

## Deep Links

El flujo Android `/join/<ROOM_CODE>`, el intent filter y el template de
`assetlinks.json` están preparados. Faltan dominio HTTPS, fingerprint de la
clave real y prueba de verificación mediante ADB.

## Crash Reporting

La aplicación solo usa un `NoopCrashReporter` por defecto y el backend no envía
datos privados. Crashlytics queda como primera opción a evaluar, pero no se
añadió sin proyecto, DSN/configuración y política de retención.

## Privacy

`GET /users/me/export` no incluye tokens ni identificadores de otros usuarios.
`DELETE /users/me` anonimiza la identidad del backend y conserva los resultados
históricos necesarios para la integridad competitiva. La política y los
Términos aún requieren los datos legales reales y una revisión final de la
retención del proveedor de autenticación. Después de una respuesta correcta,
Android limpia también el token, el nombre, la partida local y los historiales
o estadísticas offline.

## Play Console Internal Testing

La checklist está en `docs/GOOGLE_PLAY_RELEASE.md`. No se ha subido ningún
artefacto a Play Console. Antes de hacerlo deben estar disponibles el AAB
firmado, versionCode válido, política HTTPS, Data Safety, borrado de cuenta,
ficha y testers.

# ANDROID RELEASE STATUS

| Área                          | Estado                | Evidencia / pendiente                                                                 |
| ----------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Código Flutter                | `VERIFIED`            | 62 tests, analyze, formato y build Android preparados                                 |
| Backend                       | `READY`               | Configuración segura, Dockerfile, workflow y smoke local; falta hosting público       |
| PostgreSQL staging            | `VERIFIED`            | Neon Free conectado, migrado y validado con CRUD/transacción                             |
| Redis staging                 | `VERIFIED`            | Upstash Free Tier conectado y validado con TLS, TTL y limpieza                           |
| Firebase Auth                 | `PENDING HUMAN INPUT` | Anonymous/Email verificados; falta Google interactivo y confirmar configuración final |
| Backend HTTPS/WSS             | `PENDING HUMAN INPUT` | Falta dominio, TLS y endpoint público                                                 |
| Android Physical QA           | `PENDING HUMAN INPUT` | No hay dispositivo conectado                                                          |
| Android Signing               | `PENDING HUMAN INPUT` | Falta upload keystore y Play App Signing                                              |
| AAB                           | `PENDING HUMAN INPUT` | Existe, pero está sin firma y sin endpoint público                                    |
| Android App Links             | `PENDING HUMAN INPUT` | Falta dominio, `assetlinks.json` y prueba ADB                                         |
| Crash Reporting               | `PENDING HUMAN INPUT` | Falta proveedor/configuración                                                         |
| Privacy/Data Safety           | `PENDING HUMAN INPUT` | Falta identidad legal, URLs y confirmación final de retención                         |
| Play Console Internal Testing | `PENDING HUMAN INPUT` | Falta cuenta, ficha, testers y AAB firmado                                            |

# HUMAN INPUT REQUIRED

| Qué necesito                              | Dónde se obtiene                               | Dónde ponerlo                                                                                           | Cómo comprobarlo                                                        |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `STAGING_DATABASE_URL` / `DATABASE_URL`   | Neon Free `La Pocha`                          | Variable de usuario local; pendiente inyección en un hosting público                                | `prisma migrate deploy`; smoke externo OK                              |
| `REDIS_URL`                               | Upstash Free Tier `pocha-staging`             | Variable de usuario local, con namespace `staging-pocha`; pendiente inyección en hosting público   | `staging:smoke` TLS, TTL y limpieza OK                                  |
| `STAGING_API_URL` y `STAGING_SOCKET_URL`  | URL pública del hosting NestJS                 | Variables de CI/build Android mediante `--dart-define`                                                  | API responde por HTTPS y Socket.IO conecta por WSS                      |
| `PUBLIC_BASE_URL`, CORS y hosting/webhook | Proveedor de hosting elegido                   | Variables del servicio y `STAGING_DEPLOY_WEBHOOK_URL` en GitHub Environment                             | Workflow manual publica imagen y `/health/ready` pasa                   |
| Firebase Android/OAuth y cuenta QA        | Firebase Console y Google Cloud Console        | `FIREBASE_PROJECT_ID`/script de build; cuenta de servicio montada como `GOOGLE_APPLICATION_CREDENTIALS` | Login Anonymous, Email y Google interactivo; backend verifica el token  |
| Upload keystore y contraseñas             | Responsable de la cuenta Play                  | Archivo local seguro y secrets `ANDROID_KEYSTORE_*`                                                     | `jarsigner`/`apksigner` confirma AAB firmado sin imprimir passwords     |
| Dispositivo Android físico                | Dispositivo de QA con depuración ADB           | No se guarda en Git; registrar modelo/versión en el informe QA                                          | `adb devices`, `flutter devices` e instalación real                     |
| Dominio de App Links                      | Registrador/DNS bajo control del responsable   | `POCHA_LINK_HOST` y `assetlinks.json` publicado                                                         | `adb` verifica el dominio y `/join/<CODE>` abre la app                  |
| Crash reporting                           | Proveedor elegido, preferentemente Crashlytics | Configuración de CI/build y política de retención                                                       | Crash controlado solo en staging aparece en el proveedor                |
| Identidad legal, email y URLs             | Responsable legal del producto                 | `docs/HUMAN_LEGAL_INPUT.md`, política, términos y Play Console                                          | URLs HTTPS responden 200 y coinciden con Data Safety                    |
| Cuenta Play, testers y ficha              | Google Play Console                            | Play App Signing, Internal Testing y metadata                                                           | AAB firmado instalado desde Internal Testing sin publicar producción    |

## Tests

- Backend: 24 ficheros, 93 tests unitarios y 5 E2E correctos.
- Flutter: 62 tests/goldens, analyze y formato correctos.
- Prisma: validate, generate y migrate deploy correctos en la instancia local.
- Smoke en vivo: correcto, incluida recuperación de Redis.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades altas/críticas;
  quedan 6 moderadas transitivas relacionadas con `uuid`.

## NEXT ACTIONS FOR ME

1. Elegir un hosting NestJS gratuito que no exija tarjeta ni Upgrade, publicar
   el dominio HTTPS/WSS y configurar el webhook y `STAGING_HEALTHCHECK_URL`
   del workflow manual.
2. Confirmar el proyecto Firebase Android final, OAuth de Google y una cuenta
   QA; regenerar la build con sus valores públicos por `--dart-define`.
3. Ejecutar migraciones, `/health/live`, `/health/ready`, smoke HTTP/WebSocket
   y una partida casual/ranked contra el staging externo.
4. Conectar un Android físico, instalar la build staging y completar
   `docs/MANUAL_QA_ANDROID.md`, incluyendo red, background y force-stop.
5. Crear el upload keystore fuera de Git, configurar Play App Signing y generar
   un AAB firmado con `versionCode` válido.
6. Publicar `assetlinks.json` con el fingerprint real y probar `/join/<CODE>`
   mediante ADB.
7. Completar identidad legal, URLs de privacidad/términos, Data Safety, ficha y
   testers de Google Play; subir a Internal Testing solo con autorización.
