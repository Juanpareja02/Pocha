# Informe Android Release Candidate

Fecha de corte: 2026-08-27
Proyecto: `F:\APPS\Pocha`
Paquete Android: `com.pocha.mobile`

## Resultado

El backend staging está público y validado. Render Free sirve
`https://pocha-staging.onrender.com` con HTTPS y Socket.IO/WSS; Neon Free,
Upstash Free y Firebase `la-pocha-app` están conectados.

La E2E externa terminó con `status: passed` y cubrió autenticación, upgrade de
invitado, salas privadas, privacidad de manos, acciones stale/invalid,
reconexión, casual, ranked con abandono, rating, historial, leaderboard,
PostgreSQL, Redis, exportación y borrado/anonymización.

## Android generado

Build realizada con:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File mobile/tool/build_android_release.ps1 `
  -Artifact both `
  -ServerUrl https://pocha-staging.onrender.com `
  -SocketUrl https://pocha-staging.onrender.com `
  -ProjectId la-pocha-app `
  -AppLabel "La Pocha Staging" `
  -AnalyzeSize
```

Artefactos:

- [APK staging](/F:/APPS/Pocha/mobile/build/app/outputs/flutter-apk/app-release.apk) — 59,02 MB.
- [AAB staging](/F:/APPS/Pocha/mobile/build/app/outputs/bundle/release/app-release.aab) — 20,36 MB comprimidos; análisis arm64 correcto.

Ambos contienen la configuración pública de Firebase Android de
`com.pocha.mobile`, API HTTPS y origen Socket.IO HTTPS que se convierte en
WSS en release. No contienen credenciales privadas. Están sin firma de
producción y son solo para QA.

## Validación automatizada

| Área | Estado | Evidencia |
| --- | --- | --- |
| Backend Render HTTPS/WSS | `VERIFIED` | Health y smoke E2E externo |
| Neon PostgreSQL | `VERIFIED` | Migraciones y persistencia E2E |
| Upstash Redis | `VERIFIED` | TLS, salas, colas, sesiones, TTL y limpieza |
| Firebase Anonymous/Email | `VERIFIED` | Smoke externo con cuentas temporales |
| Firebase Google interactivo | `PENDING HUMAN INPUT` | Requiere cuenta QA y Android |
| Flutter analyze | `VERIFIED` | Sin incidencias |
| Flutter tests | `VERIFIED` | 63 tests correctos |
| APK/AAB staging | `VERIFIED` | Release generado con endpoints públicos |
| Android físico | `PENDING HUMAN INPUT` | No hay dispositivo en `adb devices` |
| Firma Android | `PENDING HUMAN INPUT` | Falta upload keystore |
| App Links | `NOT TESTED` | Falta dominio real y `assetlinks.json` |
| Play Internal Testing | `PENDING HUMAN INPUT` | Falta cuenta, testers y AAB firmado |

## Siguiente acción

Conecta un Android o inicia un emulador, acepta la autorización ADB e instala
el APK siguiendo [QA_ANDROID_STAGING.md](QA_ANDROID_STAGING.md). Hasta ese
momento, el estado correcto es `ANDROID PHYSICAL QA PENDING` y `WAITING ONLY
FOR DEVICE`.

La firma, Play Console, App Links, crash reporting y datos legales se mantienen
fuera de esta fase porque requieren recursos externos y no son necesarios para
seguir desarrollando gratis.
