#!/usr/bin/env sh

set -eu

# Render Free no ofrece pre-deploy commands para Web Services. Ejecutamos solo
# la migración versionada e idempotente antes de arrancar el proceso HTTP.
npx --no-install prisma migrate deploy
exec npm run start:prod
