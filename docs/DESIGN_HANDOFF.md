# Handoff funcional para Stitch

Este documento inventaría la superficie funcional de ranked sin decidir todavía el sistema visual, la tipografía, la paleta o la composición final. No se ha hecho un rediseño visual ni se han generado pantallas con Stitch.

## Inventario de pantallas

| Pantalla | Entrada | Salida |
| --- | --- | --- |
| Hub competitivo | sesión autenticada y perfil ranked | buscar, cancelar, perfil, leaderboard, temporada |
| Perfil competitivo | token y temporada activa | ELO, rango, placements, posición, estadísticas e historial |
| Cola ranked | cuenta permanente, ruleset oficial | tiempo, rango de búsqueda, error, cancelación, match encontrado |
| Partida ranked | socket y snapshot autoritativo | mesa normal, reconexión, timeout, abandono y final |
| Resultado ranked | historial recién finalizado | posición, puntuación, ELO anterior/nuevo, delta, rango y abandono |
| Leaderboard | temporada, cursor y usuario | filas estables, paginación, posición propia, vacío/error |
| Temporada | temporada activa o seleccionada | nombre, estado, fechas, ruleset, placements e historial |
| Deep link de sala | URL `/join/<code>` | parser válido, código inválido, sala inexistente o lobby |

## Componentes y estados

- `RankedProfileCard`: identidad, rango, ELO, peak y contador provisional.
- `PlacementProgress`: `0/10` a `10/10`, loading y error.
- `QueueStatusCard`: segundos, rango ±ELO, cancelación, cuenta requerida y cooldown.
- `LeaderboardRow`: posición, usuario, ELO, rango, partidas y etiqueta provisional.
- `LeaderboardPagination`: cursor, loading de siguiente página, fin y error recuperable.
- `RankedResultSummary`: posición, score, ELO anterior/nuevo, delta, promotion/demotion y abandon.
- `SeasonCard`: temporada activa, próxima/finalizada, fecha ausente y ruleset.
- `HistoryRow`: fecha, rivales, posición, score, delta y estado de abandono.
- `OnlineGameState`: loading, conectando, conectado, desconectado, bot temporal, timeout, error de versión y finalizado.
- `EmptyState`: sin historial, leaderboard vacío, sin temporada activa y sin deep link válido.

## Reglas de interacción

1. El cliente no calcula resultados ni ELO.
2. Un error de red permite reintentar y conserva el contexto de la pantalla.
3. Cancelar cola es idempotente.
4. La reconexión mantiene asiento y recibe snapshot nuevo.
5. Los mensajes de cuenta invitada, cooldown y temporada inactiva deben ser accionables.

## Inventario completo de pantallas

La siguiente tabla es el inventario funcional mínimo para la siguiente iteración de diseño. Cada fila contiene objetivo, información, acción primaria, estados, loading, error y vacío.

| # | Pantalla | Objetivo y contenido | Acción primaria | Estados / loading / error / vacío |
| ---: | --- | --- | --- | --- |
| 1 | Splash | Arranque, versión y restauración de sesión | Continuar | inicial, loading, sesión expirada, servidor no disponible |
| 2 | Onboarding | Explicar calculadora, offline, online y competitivo | Empezar | páginas, saltar, loading, sin conexión |
| 3 | Login / continuar invitado | Elegir email/Google, invitado o cuenta dev | Continuar | loading, proveedor fallido, offline, cuenta invitada |
| 4 | Crear username | Definir username público y avatar | Guardar | disponible, ocupado, inválido, loading, error |
| 5 | Home | Acceder a Calculadora, 1 jugador, Multijugador, Ranking y Cómo jugar | Abrir modo | normal, restaurando, offline, error recuperable |
| 6 | Configurar calculadora | Elegir jugadores, reglas y nombres | Empezar | normal, validación, loading, configuración vacía |
| 7 | Partida calculadora | Registrar predicciones, bazas y puntuación | Añadir ronda | normal, editar, deshacer, error de reglas |
| 8 | Tabla calculadora | Consultar acumulados y clasificación | Ver resultado | normal, ronda incompleta, loading, sin rondas |
| 9 | Resultado calculadora | Mostrar puntuación final y podio | Nueva partida | normal, empate, error, sin resultado |
| 10 | Historial calculadora | Consultar, reanudar y borrar partidas locales | Abrir partida | loading, lista, vacío, error de almacenamiento |
| 11 | Configurar 1 jugador | Elegir 3–6 jugadores, dificultad y ruleset | Empezar | normal, validación, loading, error |
| 12 | Mesa 1 jugador | Jugar contra Easy/Normal/Hard y bots | Ejecutar acción | tu turno, esperando bot, pausa, error de acción |
| 13 | Predicción | Elegir bazas previstas por ronda | Confirmar predicción | normal, inválida, loading, sin opciones |
| 14 | Selección de triunfo | Elegir palo o sin triunfo cuando proceda | Confirmar triunfo | normal, no permitido, loading, error |
| 15 | Resumen de ronda | Ver bazas, acierto y puntos de la ronda | Siguiente ronda | normal, loading de transición, error, sin datos |
| 16 | Resultado 1 jugador | Ver resultado, podio y estadísticas | Repetir / volver | normal, empate, error de persistencia, sin historial |
| 17 | Multijugador | Elegir Casual, Competitivo, Crear sala o Unirse | Abrir flujo | casual, ranked, private, loading, servidor no disponible |
| 18 | Casual matchmaking | Buscar por 3–6 jugadores y ruleset | Buscar / cancelar | queueing, match found, cancelado, loading, error |
| 19 | Crear sala | Configurar jugadores, ruleset oficial y bots | Crear sala | normal, loading, reglas inválidas, error |
| 20 | Unirse a sala | Introducir código o recibir deep link | Unirse | código válido, inválido, loading, sala llena/inexistente |
| 21 | Lobby | Mostrar jugadores, ready, bots y host | Listo / empezar | waiting, completo, ready, error de permisos, vacío |
| 22 | Online game | Reutilizar mesa autoritativa, turnos y snapshots privados | Pujar / jugar / abandonar | normal, tu turno, esperando, reconnecting, opponent disconnected, timeout, round result, game result |
| 23 | Hub competitivo | Mostrar rango, ELO, temporada y placements | Buscar partida | provisional, established, loading, cuenta requerida, error |
| 24 | Ranked matchmaking | Mostrar tiempo y rango aproximado | Buscar / cancelar | queueing, match found, cancelado, cooldown, temporada no disponible, offline |
| 25 | Placements | Mostrar progreso `n/10`, ELO y estado provisional | Continuar jugando | 0/10…9/10, placement finalizado, loading, vacío |
| 26 | Resultado ranked | Posición, puntos, ELO anterior/delta/nuevo y rango | Ver historial / volver | gain, loss, promotion, demotion, abandon, loading de resultado, error |
| 27 | Perfil competitivo | Username, rango, ELO, peak, ranked, victorias, podios, accuracy y temporada | Abrir historial | provisional, established, loading, error, sin partidas |
| 28 | Estadísticas | Separar overall, casual, ranked y season | Cambiar ámbito | loading por ámbito, normal, error, vacío |
| 29 | Leaderboard | Mostrar top paginado y posición propia | Cargar más / ver global | normal, loading, empty, usuario fuera de página, error |
| 30 | Temporada | Nombre, fin, estado, rango, ELO, posición y partidas | Ver leaderboard | active, ending soon, finished, loading, sin fecha/error |
| 31 | Historial online | Separar casual/ranked y mostrar rivales, posición y delta | Abrir partida | loading, lista, vacío, error |
| 32 | Ajustes | Cuenta, audio, idioma, privacidad y cerrar sesión | Guardar | normal, loading, sesión expirada, error |
| 33 | Cómo jugar | Reglas, pujas, triunfo, bazas, puntuación y ranked | Abrir sección | normal, loading de contenido, error, sección vacía |
| 34 | Errores globales | Presentar mensajes accionables comunes | Reintentar / volver | offline, servidor no disponible, sesión expirada, cuenta requerida, temporada no disponible, matchmaking cancelado |
| 35 | Offline | Informar qué modos siguen disponibles | Ir a 1 jugador / reintentar | offline confirmado, reconectando, error, sin contenido remoto |
| 36 | Reconnect | Recuperar socket, sala, asiento y snapshot | Reintentar conexión | reconnecting, connected, failed, sesión expirada, sin partida |

## Inventario de componentes reutilizables

Base compartida: `Card`, `PlayingCard`, `PlayerSeat`, `Avatar`, `ScoreChip`, `BidChip`, `TrumpIndicator`, `RankBadge`, `EloDisplay`, `Timer`, `PrimaryButton`, `SecondaryButton`, `BottomSheet`, `Dialog`, `LeaderboardRow`, `HistoryRow`, `StatCard`, `Podium`, `EmptyState`, `ErrorState`, `OfflineBanner`, `ReconnectBanner`.

Competitivo/online: `RankedProfileCard`, `PlacementProgress`, `QueueStatusCard`, `LeaderboardPagination`, `RankedResultSummary`, `SeasonCard`, `OnlineGameState`, `GameStatusBanner`, `RulesetSelector`, `RoomCodeField`, `LobbyPlayerRow`, `LoadingState`.

Total de componentes reutilizables inventariados: 34. No se fija todavía paleta, tipografía, sombras, gradientes, estilo definitivo de cartas, ilustración ni iconografía.

## Criterio de handoff

`READY FOR STITCH: YES` para el handoff funcional: el flujo core está implementado,
cubierto por tests unitarios/E2E y probado en vivo con PostgreSQL, Redis y
Firebase externo en el harness local. El sistema visual queda deliberadamente
abierto para la siguiente fase. Antes de publicar aún hay que repetir contra el
staging público HTTPS/WSS y hacer la QA en dispositivo físico.

# DESIGN HANDOFF

Número total de pantallas: 36
Número de componentes reutilizables: 34
Flujos principales cerrados: Sí
Estados de error definidos: Sí
Ranked UX funcionalmente definido: Sí
READY FOR STITCH: YES
