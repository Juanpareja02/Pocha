# RC known issues

Fecha: 2026-08-26.

## P0

Ninguno detectado en tests automatizados.

## P1

Ninguno detectado en tests automatizados. La beta no puede considerarse
completamente verificada hasta desplegar staging HTTPS y ejecutar QA física.

## P2

- APK y AAB actuales están sin firma de producción.

El frontend web legado permanece deshabilitado y fuera de la ruta de release;
no se considera una incidencia de esta RC.

## Dependencias externas pendientes

- Firebase Authentication está preparado para el proyecto `la-pocha-app`, con
  la aplicación Android, certificados, proveedores Anonymous/Email/Password/Google
  y adaptador de verificación. El flujo externo de guest/email/upgrade ya fue
  verificado con cuentas temporales; falta el login interactivo de Google.

## P3

Ninguno registrado sin evidencia de QA real.

## Nota

La ausencia de incidencias P0/P1 aquí significa que no han aparecido en las
pruebas disponibles; no significa que la infraestructura externa o el
dispositivo físico estén verificados.
