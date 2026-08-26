# Bots de La Pocha

## Contrato común

Los bots reciben una `BotPlayerView`, no el estado privado completo. La vista contiene la mano propia, las cartas jugadas, el triunfo, el turno, las bazas y `cardsRemaining` de cada rival. Las manos rivales permanecen vacías.

Cada decisión debe pasar por las acciones del motor: puja legal, elección de triunfo cuando el ruleset la requiere y carta legal. Si no hay acción válida el motor rechaza la transición.

## Dificultades

- **Easy**: valoración básica de fuerza y triunfo, ruido controlado y selección ocasionalmente aleatoria entre cartas legales.
- **Normal**: estimación determinista de la puja y selección de cartas orientada a cumplir la predicción, conservando cartas fuertes cuando no necesita ganar.
- **Hard**: combina la heurística anterior con determinización de las cartas desconocidas, muestreo de manos según los contadores públicos y rollouts acotados contra decisiones Normal. Ordena los candidatos por tasa de predicción exacta y después por puntuación media.

El Hard del servidor usa por defecto 24 simulaciones y un máximo de 160 acciones por rollout. El Hard de Flutter usa 12 simulaciones con el mismo límite de acciones para mantener una respuesta adecuada en móvil; ambos respetan la misma información pública y la misma legalidad del motor.

La aleatoriedad se inyecta y se puede sembrar. El RNG de reparto se conserva solo en el estado local persistido y se elimina de `BotPlayerView`; cada asiento tiene un RNG de decisiones separado. Esto permite reproducir partidas y detectar deadlocks sin que el bot acceda a la mano real, al mazo futuro ni al RNG de la partida.

## Simulaciones

Desde `server/`:

```bash
npm run simulate -- --games 1000 --players 4 --difficulty easy
npm run simulate -- --games 1000 --players 4 --difficulty normal
npm run simulate -- --games 1000 --players 4 --difficulty hard --max-simulations 24
npm run simulate -- --games 1000 --players 4 --difficulties hard,normal,easy,normal --max-simulations 8
```

El perfil `--difficulties` asigna una dificultad por asiento. Cada ejecución informa partidas completadas, errores, deadlocks, rondas, puntuación, acierto de predicciones, posiciones globales y distribución por asiento. Si ocurre un deadlock, el fallo conserva la seed, un snapshot mínimo y los últimos eventos.

## Benchmark observado

Resultados aproximados obtenidos en este repositorio; no son una prueba matemática de superioridad. Las rondas son las 15 del preset clásico de cuatro jugadores.

| Perfil | Partidas | Simulaciones Hard | Completadas | Deadlocks | Duración media | Puntuación media | Acierto |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy vs Easy | 1000 | — | 1000 | 0 | 15 ms | 16,80 | 35,96 % |
| Normal vs Normal | 1000 | — | 1000 | 0 | 15 ms | 23,16 | 35,77 % |
| Normal vs Easy | 100 | — | 100 | 0 | 27 ms | 21,81 | 36,42 % |
| Hard vs Normal | 10 | 1 | 10 | 0 | 343 ms | 16,38 | 35,00 % |
| Hard vs Hard | 10 | 1 | 10 | 0 | 673 ms | 26,75 | 37,17 % |

Las posiciones por asiento se registran aparte porque el reparto y el orden de salida influyen en muestras pequeñas. Para comparar cambios de estrategia usa la misma seed y aumenta el número de partidas.

No se implementa matchmaking ranked en esta fase.
