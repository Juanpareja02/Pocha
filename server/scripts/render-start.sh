#!/usr/bin/env sh

set -eu

# Render Free no ofrece pre-deploy commands para Web Services. Ejecutamos solo
# la migración versionada e idempotente antes de arrancar el proceso HTTP.
# Durante un rolling deploy puede coexistir otra instancia aplicando la misma
# migración y Prisma puede devolver P1002 por su advisory lock; reintentamos
# ese arranque transitorio sin ocultar un fallo permanente.
migration_attempt=1
while ! npx --no-install prisma migrate deploy; do
  if [ "$migration_attempt" -ge 6 ]; then
    echo "Prisma migration failed after ${migration_attempt} attempts" >&2
    exit 1
  fi
  echo "Prisma migration attempt ${migration_attempt} failed; retrying in 5s" >&2
  migration_attempt=$((migration_attempt + 1))
  sleep 5
done

# The free Render service has no pre-deploy hook. Keep the isolated staging
# season available for ranked matchmaking; the seed is an idempotent upsert and
# is deliberately not run for a production process.
if [ "${APP_ENV:-}" = "staging" ]; then
  npx --no-install prisma db seed
fi

exec npm run start:prod
