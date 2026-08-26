# Configuración gratuita de staging

Fecha de configuración: 2026-08-26. Esta configuración no añade ningún
método de pago ni activa un plan de pago.

## Recursos creados

| Servicio | Recurso | Plan y región | Estado |
| --- | --- | --- | --- |
| Neon | `La Pocha` | Free, AWS Europe West 2 (London) | Conectado y migrado |
| Upstash | `pocha-staging` | Free Tier, AWS EU-CENTRAL-1 (Frankfurt) | Conectado y verificado |
| Railway | — | Trial expired; solicita Upgrade | No se ha activado |

Neon muestra en su plan gratuito 0,5 GB de almacenamiento, escalado a cero,
hasta 2 CU y 10 ramas. Upstash muestra para este Redis Free Tier 256 MB,
50 GB de ancho de banda y 500.000 comandos mensuales. Los límites pueden
cambiar; la consola del proveedor es la referencia final.

## Credenciales locales

Las conexiones no se guardan en el repositorio ni en este documento. Se han
guardado como variables de usuario de Windows:

```text
POCHA_STAGING_DATABASE_URL
POCHA_STAGING_REDIS_URL
```

El `.gitignore` existente excluye `.env*` salvo `.env.example`, así como las
cuentas de servicio de Firebase.

## Comprobaciones realizadas

Desde `server/` se ejecutaron correctamente:

```text
npm run prisma:migrate:deploy
npm run prisma:migrate:status
npm run staging:smoke
```

La migración aplicada es `20260825160000_initial_release_candidate`. El smoke
verifica CRUD, transacción y limpieza de PostgreSQL, además de SET/GET,
actualización, TTL y DELETE de Redis mediante TLS. No ejecuta `reset`, `drop` ni
`truncate`.

## Repetir la comprobación

```powershell
Set-Location F:\APPS\Pocha\server
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\staging-managed.ps1 -Action status
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\staging-managed.ps1 -Action migrate
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\staging-managed.ps1 -Action smoke
```

Railway no se ha configurado porque la cuenta muestra `Trial expired` y solo
ofrece `Upgrade`. Para mantener el objetivo de coste cero, el backend puede
seguir desarrollándose y probándose localmente contra Neon y Upstash. Falta
un hosting público gratuito que no exija pago para habilitar HTTPS/WSS y la
prueba Android remota.
