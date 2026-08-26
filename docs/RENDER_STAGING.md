# Render staging — Free

Estado: `RENDER READY FOR DEPLOY`

Este documento prepara únicamente un Web Service de staging. No crea
producción, no cambia Neon, no cambia Upstash y no crea datastores de Render.
No se ha inventado una URL: Render la asignará al crear el servicio.

Render Free es adecuado para pruebas, no para producción. El servicio se
duerme tras 15 minutos sin tráfico y puede tardar aproximadamente un minuto
en despertar. El filesystem es efímero, por lo que los datos deben continuar
en Neon y Upstash. Render acepta WebSockets en un Web Service, que es lo que
necesita Socket.IO.

Referencias oficiales: [Web Services](https://render.com/docs/web-services),
[Free instances](https://render.com/docs/free),
[WebSockets](https://render.com/docs/websocket) y
[environment variables/secrets](https://render.com/docs/configure-environment-variables).

## Configuración exacta

| Campo de Render | Valor |
| --- | --- |
| Service type | Web Service |
| Repository | `https://github.com/Juanpareja02/Pocha` |
| Branch | `main` |
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm ci && npx prisma generate && npm run build` |
| Start Command | `npm run start:render` |
| Instance Type | `Free` |
| Health Check Path | `/health/ready` |

El directorio raíz `server` hace que todos los comandos anteriores se
ejecuten dentro de `F:\APPS\Pocha\server` en el repositorio, pero Render los
ejecuta en Linux. No se necesita PowerShell ni una ruta de Windows.

## Pasos en render.com

1. Entra en [render.com](https://render.com) y abre el Dashboard.
2. Pulsa **New** y elige **Web Service**.
3. En la fuente, selecciona **Connect GitHub repository**. Si Render pide
   autorizar GitHub, autoriza solo el repositorio `Juanpareja02/Pocha`.
4. En **Repository**, selecciona `Juanpareja02/Pocha`.
5. En **Branch**, selecciona `main`.
6. En **Root Directory**, escribe `server`.
7. En **Runtime**, selecciona `Node`.
8. En **Build Command**, escribe:
   `npm ci && npx prisma generate && npm run build`
9. En **Start Command**, escribe: `npm run start:render`.
10. En **Instance Type**, selecciona **Free**.
11. En **Advanced**, establece **Health Check Path** en `/health/ready`.
12. Añade las variables de entorno de la tabla siguiente y el secret file de
    Firebase.
13. Comprueba que el resumen sigue mostrando solo un Web Service Free y pulsa
    **Create Web Service**.

Si Render muestra una tarjeta, Upgrade, una instancia distinta de Free o una
acción que pueda generar costes, detén el flujo y no la aceptes.

## Variables de entorno

Añade exactamente estas variables. Nunca pegues sus valores secretos en Git,
en este documento ni en el chat.

| Nombre | Valor no secreto / procedencia | Tipo |
| --- | --- | --- |
| `APP_ENV` | `staging` | Texto |
| `NODE_ENV` | `production` | Texto; Render también lo proporciona en runtime |
| `PORT` | No añadir manualmente; Render lo proporciona | Plataforma |
| `DATABASE_URL` | Connection string de Neon `La Pocha` | Secret |
| `REDIS_URL` | URL TLS `rediss://` de Upstash `pocha-staging` | Secret |
| `REDIS_KEY_PREFIX` | `staging-pocha` | Texto |
| `PUBLIC_BASE_URL` | URL real asignada por Render: `https://<service>.onrender.com` | Texto |
| `AUTH_PROVIDER` | `external` | Texto |
| `AUTH_ISSUER_URL` | `https://securetoken.google.com/la-pocha-app` | Texto |
| `AUTH_AUDIENCE` | `la-pocha-app` | Texto |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/etc/secrets/firebase-service-account.json` | Ruta al secret file |
| `CORS_ALLOWED_ORIGINS` | Origen(es) HTTPS explícitos; inicialmente puede ser la URL real de Render | Texto |
| `LOG_LEVEL` | `info` | Texto |
| `ENABLE_DEBUG_ENDPOINTS` | `false` | Booleano |
| `USER_STORE` | `prisma` | Texto |
| `GAME_STORE` | `prisma` | Texto |
| `SEASON_STORE` | `prisma` | Texto |
| `RANKED_STORE` | `prisma` | Texto |
| `ROOM_STORE` | `redis` | Texto |
| `SESSION_LOOKUP_STORE` | `redis` | Texto |
| `PRESENCE_STORE` | `redis` | Texto |
| `CASUAL_QUEUE_STORE` | `redis` | Texto |
| `RANKED_QUEUE_STORE` | `redis` | Texto |
| `ANALYTICS_PROVIDER` | `noop` | Texto |

### Firebase secret file

En **Environment → Secret Files → Add Secret File**:

- Filename: `firebase-service-account.json`
- Contents: el JSON de la cuenta de servicio de Firebase del proyecto
  `la-pocha-app`.

El contenido es secreto y no se commitea. Render lo expone en runtime como
`/etc/secrets/firebase-service-account.json`; la aplicación existente ya usa
`GOOGLE_APPLICATION_CREDENTIALS` y Firebase Admin. No subas el archivo a
GitHub ni lo pegues en una variable ordinaria.

## Migraciones Prisma

Render no ofrece `pre-deploy command` para Web Services Free. El proyecto usa
la estrategia segura B: `start:render` ejecuta:

```sh
npx --no-install prisma migrate deploy
exec npm run start:prod
```

`prisma migrate deploy` solo aplica migraciones versionadas y es idempotente.
No se debe configurar ni ejecutar contra staging:

```text
prisma migrate reset
prisma db push
prisma migrate dev
```

`prisma` está en dependencias de producción para que el comando exista después
de `npm ci`. La build ejecuta `prisma generate` y no necesita conectarse a
Neon; la migración ocurre al iniciar el nuevo servicio.

## Runtime, red y seguridad

- `server/src/main.ts` escucha el `PORT` proporcionado por Render en
  `0.0.0.0`.
- Render termina TLS delante del proceso. Los clientes públicos deben usar
  HTTPS y WSS; no hay ninguna URL `ws://` hardcodeada para staging.
- Socket.IO usa el mismo Web Service y el namespace `/online`, con transporte
  WebSocket y fallback polling ya existente.
- Render proporciona `RENDER=true`. Solo con ese marcador y fuera de
  development se configura un salto de proxy confiable para que el rate
  limiter de Nest/Express distinga la IP del cliente. No se activa a ciegas en
  desarrollo ni en otros hosts.
- `/health/live` comprueba solo que el proceso responde.
- `/health/ready` hace únicamente `SELECT 1` en PostgreSQL y `PING` en Redis;
  si una dependencia falla responde `503` y no usa memoria como fallback.
- `enableShutdownHooks`, Prisma, los clientes Redis, el gateway Socket.IO y
  `GameSessionManager` limpian sus recursos al recibir SIGTERM.
- Usuarios, partidas, rating, sesiones y colas no dependen de archivos locales.
  El filesystem efímero de Render solo contiene el código desplegado y el
  secret file de Firebase durante el runtime.
- `LOG_LEVEL=info`; el logging del backend no imprime URLs de conexión, tokens,
  claves privadas ni cartas privadas.

## Comprobación después del despliegue

Cuando Render muestre la URL real, guárdala sin modificar el código:

```text
STAGING_API_URL=https://<service>.onrender.com
STAGING_SOCKET_URL=https://<service>.onrender.com
```

La app Flutter usa ese origen HTTPS en Socket.IO; el transporte WebSocket
público se negocia sobre WSS. No hay que escribir `ws://` manualmente.
Primero comprueba manualmente:

```text
GET https://<service>.onrender.com/health/live       -> 200
GET https://<service>.onrender.com/health/ready      -> 200
```

Después se puede ejecutar el smoke HTTP/WebSocket existente con la URL real y
las credenciales de prueba de Firebase. No se debe declarar `RENDER VERIFIED`
hasta que esos checks y el smoke externo hayan pasado.

## Por qué no hay `render.yaml`

No se crea `render.yaml`: el despliegue usa un único Web Service manual,
mantiene Neon y Upstash externos y evita que un Blueprint cree por accidente
PostgreSQL, Key Value u otros servicios de Render. La configuración anterior
es reproducible y no contiene secretos.
