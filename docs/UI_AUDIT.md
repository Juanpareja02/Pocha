# Auditoría UI — Fase 7

## Alcance

La publicación móvil objetivo es `mobile/`. La lógica de juego, `GameSessionPort`, bots, calculadora, sesiones remotas y ranked ya existen y no se reescriben en esta fase.

## Pantallas encontradas

- `HomePage`: acceso a calculadora, un jugador y online.
- `CalculatorPage`: inicio, configuración, entrada de rondas, tabla, historial y resultado.
- `SinglePlayerPage`: configuración, reanudar, mesa, resumen de ronda y resultado final.
- `OnlineHomePage`: casual, sala privada, ranked e historial.
- `CreateRoomPage`, `JoinRoomPage`, `OnlineLobbyPage`, `CasualMatchPage`.
- `OnlineGamePage`: mesa remota, reconexión, timers y acciones autoritativas.
- `RankedHomePage`, `RankedProfilePage`, `RankedLeaderboardPage`, `RankedSeasonPage`, `RankedResultPage`.

## Problemas detectados

1. `ThemeData` y colores estaban definidos en `main.dart`; las páginas repetían `Card`, `ListTile`, `TextStyle`, radios y colores.
2. La navegación era una mezcla de `go_router`, `Navigator` y botones secundarios sin acción.
3. No existían shell de navegación, splash, onboarding persistido, auth/username, perfil global, ajustes ni tutorial.
4. La mesa local y remota usaban badges y cartas provisionales; usaban símbolos Unicode de póker y no tenían un sistema de carta reutilizable.
5. No había `ThemeExtension` para mesa, carta o rangos; la UI no tenía estrategia dark/light ni reduced motion.
6. Loading, error, empty, offline y reconnect no compartían componentes ni mensajes accionables.
7. Los layouts de mesa dependían de alineaciones fijas y no tenían una geometría reutilizable para 3–6 jugadores.
8. No había avatar procedural, badges vectoriales, `TurnTimer`, `PlayerHand`, `TrickArea` ni semantics dedicados.
9. Tests de UI insuficientes: no había golden tests, cobertura de mesa 3–6, semantics ni pruebas de overflow responsive.

## Componentes duplicados o provisionales

- `_ModeCard`, `_ProfileCard`, `_ErrorBox`, `_ErrorBanner`, `Card` y `ListTile` estilizados localmente.
- `_GameCard`, `_MiniCard`, `_RemoteCard` y `_RemoteMiniCard` duplicaban la representación de cartas.
- `_PlayerBadge` y el avatar del lobby duplicaban identidad de jugador.
- Panels de puja/triunfo y botones de loading no compartían estados.

## Arquitectura UI prevista

```text
AppShell / GoRouter
        ↓
Design system y componentes Pocha
        ↓
Controllers / Riverpod / estado de pantalla
        ↓
GameSessionPort, CalculatorRepository, RankedApi, RemoteGameSession
        ↓
Motor local o servidor autoritativo
```

Los widgets solo presentan `legalCards`, `legalBids`, `availableActions` y vistas ya calculadas por dominio/controlador. La lógica de reglas permanece fuera de la UI.

## Orden de migración

1. Tokens, tema, componentes feedback/avatar/carta/mesa.
2. Shell de navegación, splash, onboarding, auth y Home.
3. Mesa y cartas local/remota.
4. Calculadora, single player, online y ranked.
5. Perfil, historial, estadísticas, ajustes y Cómo jugar.
6. Accessibility, responsive, motion, haptics, tests y documentación.

## Restricciones

- No se usa Stitch ni se buscan/importan assets de Stitch.
- No se descargan fuentes, imágenes ni sonidos externos.
- No se altera el motor, bots, rating, matchmaking, WebSocket ni Prisma salvo una corrección demostrada.
