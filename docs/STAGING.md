# Staging

Staging debe parecerse a producción:

- `APP_ENV=staging`.
- PostgreSQL y Redis reales separados de producción.
- `AUTH_PROVIDER=external` con tenant/proyecto de pruebas.
- CORS y `PUBLIC_BASE_URL` HTTPS explícitos.
- Todos los stores Prisma/Redis; nunca memoria.
- Logs `info`, analytics no-op o proyecto aislado y datos sintéticos.
- Seed seguro de temporada y reglas; sin passwords hardcodeadas.

Para Flutter se mantiene una sola configuración de código y se separan los
entornos mediante `--dart-define`: `STAGING_API_URL`,
`STAGING_SOCKET_URL`, `POCHA_AUTH_MODE` y los parámetros de App Links. La
configuración de endpoints está centralizada; no se repiten URLs en cada
pantalla. Flavors nativos quedan como opción futura si aparecen diferencias de
branding o recursos.

```powershell
cd server
$env:APP_ENV = 'staging'
$env:NODE_ENV = 'production'
$env:DATABASE_URL = '<DATABASE_URL local o de staging>'
$env:REDIS_URL = '<REDIS_URL local o de staging>'
$env:REDIS_KEY_PREFIX = 'staging-smoke'
npm run config:check
npm run prisma:migrate:deploy
npm run staging:smoke
npm run start
```

En este equipo, PostgreSQL 16 y Redis 7 se ejecutan en la distribución WSL2
aislada `PochaStaging`. El smoke test crea, lee, actualiza y elimina datos
temporales en PostgreSQL, y valida TTL y limpieza en Redis. No es un sustituto
del staging externo.

## Smoke en vivo local

Con Firebase externo configurado y la credencial ADC fuera del repositorio se
puede ejecutar el flujo completo, usando una instancia Redis temporal en el
puerto aislado `6380` y un namespace aleatorio:

```powershell
cd server
npm run staging:local-live-smoke
```

El script arranca el backend con `NODE_ENV=production` y `APP_ENV=staging`,
ejecuta `migrate deploy` y seed, comprueba `/health/live` y `/health/ready`,
crea cuentas Firebase temporales, juega partidas privadas/casual/ranked con
Socket.IO, valida historial/rating/exportación, borrado/anonymización y privacy,
y elimina los datos de
la prueba. Una de las partidas se crea como invitado y su historial se verifica
antes y después del upgrade a una cuenta permanente. También simula una caída
de Redis y exige readiness 503 antes de comprobar la recuperación. No reinicia
ni borra la base completa. El helper local verifica la integración real, pero
no demuestra que exista un endpoint HTTPS/WSS público.

Para el staging externo se debe usar `npm run staging:live-smoke` apuntando
`STAGING_BASE_URL` a la URL HTTPS real, con PostgreSQL y Redis independientes,
`AUTH_PROVIDER=external`, `PUBLIC_BASE_URL` HTTPS y `CORS_ALLOWED_ORIGINS`
explícitos. Nunca se debe ejecutar una build staging contra localhost,
`127.0.0.1` o `10.0.2.2`.

El seed crea configuración de temporada y no usuarios con passwords.

El estado de esta preparación queda registrado en
`docs/STAGING_REPORT.md`; la QA física se documenta en
`docs/QA_ANDROID_STAGING.md` y las incidencias confirmadas en
`docs/RC_KNOWN_ISSUES.md`.
