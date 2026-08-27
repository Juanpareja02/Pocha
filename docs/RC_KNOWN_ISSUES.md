# Incidencias conocidas de la RC

Fecha: 2026-08-27

## P0 / P1

Ninguna detectada en la E2E externa ni en la validación automatizada local.

## P2

- La QA física Android está pendiente porque no hay ningún dispositivo
  conectado por ADB.
- El APK y el AAB son artefactos de QA sin firma de producción. No deben
  subirse a Play Console hasta crear el upload keystore.

## Pendiente de validación humana

- Login Google interactivo en Android.
- Instalación y recorrido completo en un Android real: onboarding, calculadora,
  solitario, online, reconexión, cambio de red, background, force-stop y
  ranked.
- App Link HTTPS `/join/<CODE>` con dominio real y `assetlinks.json`.
- Firma, Play Internal Testing, ficha, testers y revisión legal.

## Estado

El backend externo está `VERIFIED`. La aplicación Flutter compila y sus tests
están `VERIFIED`. La RC Android completa queda `PENDING HUMAN INPUT` hasta
realizar las pruebas que necesitan un dispositivo y credenciales de publicación.

El frontend web legado permanece deshabilitado y fuera de esta RC.

