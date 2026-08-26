# Ranked, temporadas y rating

La Fase 6 usa un único flujo competitivo autoritativo. Flutter solicita cola y muestra resultados; no calcula reglas, posiciones ni ELO.

## Contrato oficial

- Ruleset: `ranked_standard@1`.
- Extiende `classic@1` del motor compartido (`shared/game-spec/rulesets/ranked_standard_v1.json`).
- Siempre hay exactamente cuatro jugadores humanos.
- No hay bots en una partida ranked.
- La partida histórica guarda `rulesetId`, versión y temporada.

## Matchmaking

`RankedQueue` agrupa por temporada, ruleset, versión y región compatible. `MatchQualityService` calcula la distancia máxima permitida según la espera del jugador:

| Espera | Distancia máxima |
| --- | ---: |
| 0 s | ±100 ELO |
| 10 s | ±150 ELO |
| 20 s | ±250 ELO |
| 30 s o más | ±400 ELO |

La cola consume cuatro entradas distintas de forma idempotente. Redis usa un lock distribuido para impedir que dos instancias consuman el mismo grupo. El modo memoria se reserva para tests y desarrollo.

Una cuenta invitada no puede entrar en ranked. En desarrollo se pueden crear cuentas permanentes de prueba con `POST /auth/development`; también existe `POST /auth/upgrade` para vincular un invitado con un principal permanente conservando el `User.id`, historial y estadísticas. En producción el límite es el proveedor externo configurado.

## Rating pairwise

El rating inicial es 1000. Para cada pareja `a`, `b`:

```text
E(a) = 1 / (1 + 10 ^ ((R(b) - R(a)) / 400))
A(a) = 1   si a termina delante de b
A(a) = 0   si a termina detrás de b
A(a) = 0.5 si empatan
K(a) = 64  durante las primeras 10 partidas ranked
K(a) = 32  después
Kpareja = (K(a) + K(b)) / 2
deltaPareja(a) = Kpareja * (A(a) - E(a))
delta(a) = suma(deltaPareja(a)) / ((jugadores - 1) * normalization)
```

La configuración de Temporada 1 usa `normalization = 1`. Cada delta se redondea al entero más cercano y se aplica una corrección determinista por parte decimal y `userId` para que la suma de deltas redondeados sea exactamente cero. Los empates usan 0.5 en todas sus parejas. Las primeras diez partidas son provisionales y la UI muestra el contador de placements.

Los rangos están configurados en backend como `RankDefinition { id, name, minimumElo, order }`; Flutter solo representa la respuesta recibida.

## Abandono, desconexión y timeout

- `game:leave` después del inicio es abandono explícito: el jugador termina último, conserva su asiento para que el bot continúe y recibe penalización.
- Una desconexión entra en gracia. Si vuelve, conserva el mismo asiento; si no vuelve, el bot reutiliza el asiento sin convertir automáticamente el hecho en abandono explícito.
- Un timeout se registra por separado y el bot ejecuta una acción legal.
- Cooldown de cola tras abandono: primero 0 minutos, segundo 5 minutos, siguientes 15 minutos.
- La finalización tiene `gameId` idempotente. PostgreSQL la ejecuta en transacción `Serializable` con reintento de conflictos de serialización.

## Temporadas y rangos

Temporada 1 está activa, usa diez placements y conserva su configuración versionada. Los rangos son Bronce, Plata, Oro, Platino, Diamante, Maestro y Gran Maestro, con umbrales definidos en `DEFAULT_RANKS`.

El servicio incluye soft reset para una nueva temporada:

```text
ratingNuevo = round(1000 + 0.75 * (ratingAnterior - 1000))
```

Activar una temporada finaliza la anterior y solo deja una activa. La aplicación del reset masivo debe ejecutarse como job de migración controlado antes de abrir la nueva cola.

## Leaderboard e historial

La prioridad de consulta es la temporada indicada o, si falta, la temporada activa. `scope=global` ofrece el leaderboard histórico ranked desde el perfil global; la temporada sigue siendo la vista por defecto. La ordenación es estable por `rating DESC, userId ASC`; la paginación usa cursor y devuelve la posición propia. La respuesta pública muestra username/displayName, ELO, rango, partidas y estado provisional: el `userId` solo se usa internamente para ordenar y no se serializa. El historial conserva partida, posición, puntuación, ELO anterior/nuevo, delta, rango, abandono y rivales.

Las estadísticas están separadas en global, casual, ranked y temporada. Ranked conserva partidas, victorias, podios, posición media, precisión de predicción, abandonos, desconexiones, timeouts y mejor ELO.

## Persistencia y configuración

```text
USER_STORE=memory|prisma
GAME_STORE=memory|prisma
ROOM_STORE=memory|redis
SESSION_LOOKUP_STORE=memory|redis
PRESENCE_STORE=memory|redis
CASUAL_QUEUE_STORE=memory|redis
RANKED_QUEUE_STORE=memory|redis
SEASON_STORE=memory|prisma
RANKED_STORE=memory|prisma
REDIS_URL=redis://localhost:6379
```

Los repositorios memoria permiten tests deterministas. PostgreSQL es la fuente histórica y Redis coordina salas efímeras, lookup de sesiones, presencia, colas y locks. La verificación contra servicios externos requiere levantar PostgreSQL/Redis; el entorno de esta entrega no dispone de ellos.

## API y eventos

- `GET /seasons/current`, `GET /seasons`, `GET /seasons/:id`.
- `GET /ranked/me`, `GET /ranked/leaderboard`, `GET /ranked/history`.
- Socket.IO: `ranked:join`, `ranked:queued`, `ranked:matched`, `ranked:cancel`, `ranked:cancelled`.

La arquitectura deja un `ExternalTokenVerifier` como frontera para Firebase y
Google en Android 1.0. El verificador externo real y sus credenciales no se
inventan en desarrollo.

Los eventos de producto/auditoría pasan por `AnalyticsPort`, sin SDK obligatorio: cola iniciada/cancelada, match encontrado, partida finalizada, placement terminado, promoción, descenso, abandono, desconexión, timeout, acción inválida y spam de acciones.
