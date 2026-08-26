# Inventario de pantallas UI

## Navegación producto

| Ruta | Pantalla | Estado |
|---|---|---|
| /splash | Splash y decisión de onboarding | Migrada |
| /onboarding | Onboarding de 4 pasos, persistido | Migrada |
| /auth | Invitado, login y crear cuenta preparados | Migrada |
| /username | Nombre visible y validación local | Migrada |
| / | Home | Migrada |
| /leaderboard | Clasificación | Integrada con ranking existente y estados reales |
| /history | Historial local y online | Migrada |
| /profile | Perfil/rango | Integrada con ranking existente y estadísticas reales |
| /settings | Apariencia, movimiento, háptica, audio y notificaciones | Migrada |
| /how-to-play | Reglas y entrada al tutorial | Migrada |
| /tutorial | Tutorial guiado con motor local real | Migrada |

## Modos de juego

| Ruta | Pantalla | Migración |
|---|---|---|
| /calculator | Calculadora física | Migrada, dominio preservado |
| /single-player | Setup, mesa, resultados | Setup, mesa y resultados migrados |
| /multiplayer | Home casual, crear/unirse/lobby/partida | Migrada, protocolo preservado |
| /online | Alias compatible del acceso multijugador | Preservado |
| /ranked | Ranked, temporada y resultados | Integrada con estados y resultados |
| /join/:code | Deep link de sala | Preservado |

## Estados transversales

Disponibles y usados: loading, error con retry, vacío, offline, reconectar, conexión, turno, selección/ilegalidad, victoria y resultado.

## Fuera de alcance

No se implementan chats, amigos, clanes, tienda, battle pass, skins, marketplace, misiones, logros complejos ni monetización.
