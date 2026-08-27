# Informe E2E externo de staging

Fecha: 2026-08-27  
Backend: `bc07e0b`  
URL pública: `https://pocha-staging.onrender.com`  
Proveedor: Render Free, Frankfurt

## Resultado

`VERIFIED` — el smoke externo terminó con `status: passed` usando Firebase,
Neon PostgreSQL y Upstash Redis reales. No se imprimieron credenciales.

Checks ejecutados:

- health live/ready y entorno `staging`;
- Firebase Anonymous, Email/Password, token inválido y upgrade invitado →
  cuenta permanente conservando identidad e historial;
- autenticación Socket.IO por WSS, sala privada y privacidad de manos;
- rechazo de estado obsoleto y acción inválida;
- reconexión conservando asiento, abandono explícito y recuperación;
- matchmaking casual y ranked de cuatro jugadores;
- persistencia de partidas, jugadores, resultados, eventos, rating, historial,
  temporada y estadísticas en Neon;
- `/ranked/me`, `/ranked/history` y leaderboard sin campos privados;
- exportación sin tokens/IDs del proveedor y borrado con anonymización;
- limpieza de cuentas Firebase, registros sintéticos PostgreSQL y claves Redis
  del namespace `staging-pocha`.

La prueba confirma el backend externo y el protocolo WSS. No sustituye la
prueba visual/interactiva de Flutter en Android.

## Cambios que hicieron estable la prueba

- `game:leave` acepta una intención de abandono aunque el snapshot del cliente
  esté desactualizado; las acciones de juego siguen protegidas por
  `STALE_STATE`.
- Un `room:ready` devuelve confirmación directa al socket solicitante.
- Un `disconnect` antiguo no pisa la reconexión si ya existe otro socket activo
  del mismo jugador y partida.
- El smoke espera la confirmación de persistencia ranked en Neon antes de leer
  rating e historial.

## Estado final

| Área | Estado | Evidencia / límite |
| --- | --- | --- |
| Render HTTPS + Socket.IO/WSS | `VERIFIED` | Health y smoke externo contra la URL pública |
| Neon PostgreSQL | `VERIFIED` | Migraciones y artefactos ranked persistidos |
| Upstash Redis | `VERIFIED` | Colas, salas, sesiones, rate limiting y limpieza |
| Firebase Anonymous + Email/Password | `VERIFIED` | Flujo externo automatizado |
| Firebase Google interactivo | `PENDING HUMAN INPUT` | Requiere cuenta QA y dispositivo Android |
| Flutter analyze/test | `VERIFIED` | Analyze sin incidencias y 62 tests correctos |
| APK/AAB staging | `VERIFIED` | Generados con `com.pocha.mobile` y Render staging |
| Android físico | `PENDING HUMAN INPUT` | `adb devices` no muestra dispositivos |
| Firma Android / Play Internal | `PENDING HUMAN INPUT` | Faltan keystore, cuenta Play y testers |
| App Links HTTPS | `NOT TESTED` | Falta dominio real y `assetlinks.json` publicado |

## Servicios sin coste

La configuración validada usa los planes gratuitos de Render, Neon y Upstash.
Railway no forma parte del despliegue activo. Los límites, suspensión por
inactividad y políticas de cada plan gratuito siguen aplicando.

