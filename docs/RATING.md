# Rating ranked

El cálculo está centralizado en `server/src/game-engine/rating.ts` y `RatingService` no conoce Flutter, HTTP ni Prisma.

Para cada pareja se usa:

```text
E_A = 1 / (1 + 10 ^ ((R_B - R_A) / 400))
actual = 1 si A queda delante
actual = 0 si A queda detrás
actual = 0.5 si empatan
deltaPareja = ((K_A + K_B) / 2) * (actual - E_A)
deltaJugador = suma(deltaPareja) / ((N - 1) * normalization)
```

La configuración inicial es `rating=1000`, `K=64` durante las primeras 10 partidas ranked, `K=32` después y `normalization=1`. Los deltas se redondean al entero más cercano y el remainder se reparte por mayor parte decimal, rompiendo empates por `userId`, hasta que `sum(delta)=0` exactamente.

La simulación reproducible se ejecuta con:

```bash
npm run simulate:rating -- 10000 100
```

El simulador informa partidas, jugadores, media, mediana, desviación, mínimo/máximo, movimiento absoluto medio/máximo, partidas provisionales y distribución por rango. La simulación ejecutada en esta iteración mantuvo la media en torno a 1000 y no mostró inflación neta.

Resultado reproducible con semilla `20260825` (`10000` partidas, `100` jugadores): media `1000.00`, mediana `1008`, desviación `335.05`, mínimo/máximo `456/1611`, movimiento absoluto medio `2511.60`, movimiento provisional medio `17.07`, movimiento máximo `41`, `1000` partidas provisionales. Distribución final: Bronze `50`, Silver `18`, Gold `17`, Platinum `14`, Diamond `1`.
