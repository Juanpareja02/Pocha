# Especificación y paridad del motor

## Decisión

Flutter y NestJS se ejecutan en runtimes distintos, por lo que no se fuerza una tecnología de código compartido. La fuente común es una especificación JSON versionada en `shared/game-spec/` y un conjunto de vectores dorados en `shared/game-spec/fixtures/engine_vectors.json`.

Cada runtime mantiene un adaptador idiomático:

- TypeScript: `server/src/game-engine` es la autoridad online.
- Dart: `mobile/lib/features/game/domain` ejecuta la misma semántica offline.

Los adapters deben coincidir en nombres de palos/rangos, jerarquía, secuencias, acciones legales, subasta y puntuación. Los vectores dorados prueban los casos que no pueden divergir. Cuando cambia una regla se crea una nueva versión del JSON; no se modifica retroactivamente una partida histórica. Flutter ofrece los presets clásica, subasta y personalizada a través del mismo objeto `GameRules` serializable.

Esta solución evita duplicar una librería exótica o introducir una capa WASM difícil de depurar en móvil. El servidor seguirá siendo la autoridad en online aunque el cliente ejecute el mismo contrato offline.

## Estado público y privado

`buildPlayerView(state, playerId)` conserva la mano del jugador solicitado, oculta manos rivales, expone `cardsRemaining` y conserva únicamente cartas jugadas públicamente. Los bots reciben exactamente esa vista, nunca el `GameState` privado completo.

## Aleatoriedad

El motor recibe un `RandomSource`. Tests y simulaciones usan `seededRandom(seed)`. El adaptador online utiliza `node:crypto`; ningún bot recibe ese origen ni el mazo real.

## Invariantes

Durante una ronda:

- cada carta repartida tiene un identificador único;
- una carta solo puede salir de la mano de su propietario;
- cada baza termina con exactamente un ganador;
- la suma de bazas ganadas coincide con el número de bazas terminadas;
- `stateVersion` aumenta en cada transición;
- una acción fuera de fase, turno o versión se rechaza.

## Evolución

Los bots y la UI consumen acciones del motor (`makeBid`/`submitBid`, `chooseTrump` y `playCard`) en vez de duplicar reglas. La mesa local expone además un estado transitorio `trickResults` para animar la baza antes de comenzar la siguiente; la puntuación sigue ocurriendo en el dominio. Para online se reutiliza el mismo motor TypeScript en el servicio autoritativo.
