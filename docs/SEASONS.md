# Temporadas ranked

`SeasonService` trabaja con estados `UPCOMING`, `ACTIVE` y `FINISHED`. Solo una temporada puede estar activa. La configuración persistida contiene ruleset/version, placements, rating, expansión de matchmaking y rangos.

Temporada 1 (`season_1`) está activa por defecto con nombre temporal `Temporada 1`, ruleset `ranked_standard@1`, cuatro jugadores y 10 placements.

Cuando `APP_ENV=staging`, el seed conserva el mismo identificador técnico para
mantener la compatibilidad del ruleset, pero marca la temporada como
`STAGING SEASON`. La base de datos de staging debe estar separada de producción;
ese registro no se reutiliza en producción.

Al activar una temporada nueva, la anterior pasa a `FINISHED`. La política de soft reset preparada es:

```text
newRating = round(baseRating + factor * (oldRating - baseRating))
```

con `baseRating=1000` y `factor=0.75`. El reset masivo debe ejecutarse como job transaccional antes de abrir la cola de la nueva temporada; no se aplica automáticamente en Temporada 1.

La API es `GET /seasons/current`, `GET /seasons`, `GET /seasons/:id`. El leaderboard y el perfil priorizan la temporada indicada y después la temporada activa.
