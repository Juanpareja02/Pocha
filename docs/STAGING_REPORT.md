# Informe de staging y beta Android

Fecha de corte: 2026-08-27
Repositorio: `F:\APPS\Pocha`
Backend: `https://pocha-staging.onrender.com`
Plan: Render Free + Neon Free + Upstash Free

## Resumen

El backend NestJS está desplegado en Render Free con `APP_ENV=staging` y
`NODE_ENV=production`. Usa Firebase externo, Prisma/Neon y Redis/Upstash; no
usa fallback en memoria. `/health` y `/health/ready` responden correctamente.

El smoke externo final terminó con `status: passed` usando el commit de
servidor `bc07e0b`. La prueba limpia sus datos sintéticos al terminar.

## Resultado por área

| Área | Estado | Evidencia / límite |
| --- | --- | --- |
| Backend Render HTTPS | `VERIFIED` | URL pública, health live/ready y entorno staging |
| Socket.IO/WSS | `VERIFIED` | Handshake, salas, acciones, reconexión y partidas E2E |
| Neon PostgreSQL | `VERIFIED` | Migraciones, CRUD y persistencia ranked E2E |
| Upstash Redis | `VERIFIED` | TLS, namespace `staging-pocha`, colas, TTL y limpieza |
| Firebase Anonymous | `VERIFIED` | Alta y `/auth/me` externos |
| Firebase Email/Password | `VERIFIED` | Alta, login y tokens externos |
| Firebase guest upgrade | `VERIFIED` | Identidad e historial conservados |
| Firebase Google interactivo | `PENDING HUMAN INPUT` | Requiere cuenta QA y Android |
| Flutter analyze | `VERIFIED` | Sin incidencias |
| Flutter test | `VERIFIED` | 62 tests correctos |
| APK/AAB staging | `VERIFIED` | Generados con `com.pocha.mobile` y Render |
| Android físico | `PENDING HUMAN INPUT` | `adb devices` está vacío |
| Firma y Play Internal | `PENDING HUMAN INPUT` | Faltan keystore, Play y testers |
| App Links | `NOT TESTED` | Falta dominio HTTPS real |

## E2E externo

Checks pasados:

- health y readiness;
- Firebase Auth, token inválido y upgrade de invitado;
- Socket.IO autenticado por WSS;
- sala privada con privacidad de manos;
- rechazo de stale state y carta inválida;
- reconexión conservando asiento;
- cola casual y partida completa;
- cola ranked de cuatro jugadores, abandono y partida completa;
- `/ranked/me`, historial, rating, estadísticas, leaderboard y temporada;
- persistencia de usuarios, partidas, jugadores, resultados y eventos;
- exportación sin token/ID de proveedor;
- borrado con anonymización y limpieza de datos temporales.

## Android

Se verificó localmente:

```text
flutter analyze                    OK
flutter test                       62 tests OK
dart format --set-exit-if-changed .   OK
```

La build usa `STAGING_API_URL` y `STAGING_SOCKET_URL` separados, Firebase
Android real, cleartext desactivado y etiqueta `La Pocha Staging`. El APK es
un artefacto instalable de QA; el AAB es el formato para Play, pero ambos están
sin firma de producción.

Artefactos:

```text
mobile/build/app/outputs/flutter-apk/app-release.apk
mobile/build/app/outputs/bundle/release/app-release.aab
```

Tamaños actuales: APK 59,02 MB; AAB 20,36 MB comprimidos, análisis arm64
correcto.

## Correcciones aplicadas durante la E2E

- Migraciones Render con conexión directa de Neon cuando la URL de aplicación
  usa pooler.
- Seed de `STAGING SEASON` al arrancar staging.
- Broadcast de snapshots mediante sockets locales en Render Free.
- Abandono tolerante a snapshots obsoletos.
- Confirmación directa de `room:ready`.
- Protección frente a un `disconnect` antiguo que pisa una reconexión nueva.
- Espera explícita de la transacción ranked antes de verificar `/ranked/me`.

## Sin coste

No se activó Railway. El staging actual utiliza únicamente niveles gratuitos;
Render puede suspender la instancia por inactividad y Neon/Upstash mantienen
los límites de sus planes Free. No se ha autorizado ningún pago.

## Bloqueo restante

El backend está `VERIFIED`. La parte Android de dispositivo queda
`PENDING HUMAN INPUT`: falta conectar un Android o emulador para probar UI,
login Google, cambio de red, background, force-stop e instalación real.
Consulta [QA_ANDROID_STAGING.md](QA_ANDROID_STAGING.md) para continuar.
