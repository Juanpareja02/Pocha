# Rulesets

Los rulesets son datos versionados, no condicionales dispersos en las pantallas.

## Classic v1

- Baraja española de 40 cartas.
- Secuencia `1,2,3,4,5,6,7,8,7,6,5,4,3,2,1`.
- Se sigue el palo de salida si es posible.
- El triunfo gana a cualquier carta que no sea triunfo.
- Jerarquía: As, 3, Rey, Caballo, Sota, 7, 6, 5, 4, 2.
- Acierto: `10 + 5 × bazas`.
- Fallo: `-5 × diferencia absoluta`.

## Extensión

Un ruleset puede activar subasta, triunfo elegido, rondas sin triunfo, ronda de indios, obligación de montar, multiplicadores y bonus por pocha. El identificador y la versión se almacenan junto a cada partida.
