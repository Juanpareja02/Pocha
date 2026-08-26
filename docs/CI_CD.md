# CI/CD

CI valida código y artefactos de QA; no publica ni despliega por defecto.

## Pull request

- Flutter: pub get, format, analyze, tests, goldens y debug build con
  `POCHA_AUTH_MODE=development` únicamente para QA.
- Backend: npm ci, lint, unit, E2E, build, Prisma validate y generate.
- Lockfiles y `git diff --check`.

## Release futura

El workflow de AAB debe usar GitHub Secrets para variables de firma y
`STAGING_API_URL` y `STAGING_SOCKET_URL`. Nunca guardar keystore, private keys ni credenciales de auth
en YAML. La aprobación final seguirá siendo manual.

## Backend staging manual

`.github/workflows/staging-backend.yml` está preparado para ejecutarse con
`workflow_dispatch`. Primero repite lint, tests, E2E, audit, Prisma y build;
después construye y publica `server/Dockerfile` en GHCR con un tag inmutable
basado en el SHA del commit. No despliega automáticamente.

Solo si se activa explícitamente el input `deploy` y el environment protegido
`staging` lo aprueba, el workflow llama a un webhook de la plataforma elegida.
Configurar allí, fuera del repositorio:

```text
STAGING_DEPLOY_WEBHOOK_URL    URL HTTPS del servicio de despliegue elegido
STAGING_DEPLOY_WEBHOOK_TOKEN  Token opcional de ese servicio
STAGING_HEALTHCHECK_URL       URL HTTPS completa terminada en /health/ready
STAGING_DATABASE_URL          PostgreSQL staging para migrate deploy seguro
```

Antes de llamar al webhook, el workflow ejecuta `prisma migrate deploy` y
`prisma generate` contra `STAGING_DATABASE_URL`. No ejecuta reset, drop ni
truncate. Después espera hasta 60 segundos a que `STAGING_HEALTHCHECK_URL`
responda HTTP 2xx; el endpoint `/health/ready` solo debe responder así cuando
PostgreSQL y Redis estén disponibles.

El webhook recibe `{ image, gitSha, environment }` y debe arrancar la imagen
con las variables de staging documentadas en `STAGING_REPORT.md`. La elección
del proveedor, PostgreSQL/Redis gestionados y TLS sigue siendo externa; el
workflow no inventa ni almacena esos valores.
