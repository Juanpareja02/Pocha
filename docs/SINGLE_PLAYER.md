# Fase 3 — Un jugador

## Alcance entregado

La ruta `/single-player` ofrece una partida local completa con 3 a 6 jugadores:

- configuración de número de jugadores, dificultad y velocidad de animación;
- selección de Pocha clásica, subasta o reglas personalizadas (montar y sin triunfo);
- mesa virtual, turno visible, triunfo, bazas, pujas y cartas propias;
- legalidad de seguir palo y selección de cartas únicamente válidas;
- resumen de cada ronda, puntuación acumulada y podio final;
- haptics, animaciones de cartas y pausa/abandono;
- recuperación automática de la partida activa tras cerrar la aplicación.
- estadísticas offline separadas de cualquier futuro ELO online;
- avatars procedurales sin imágenes externas y nombres españoles sin duplicados.

La identidad humana es `Juan`. Los rivales usan nombres locales y el juego funciona sin red.

## Persistencia

`SinglePlayerRepository` guarda en `SharedPreferences` el estado JSON versionable, la dificultad y la velocidad. El estado conserva el RNG, la versión de transición, manos propias, contadores públicos, bazas y cartas jugadas. Al restaurarlo, la partida continúa desde el turno exacto salvo que ya esté finalizada.

## Flujo

```text
configuración -> reparto -> pujas -> bazas -> resumen de ronda
                                      └-> siguiente ronda -> resultados -> podio
```

El controlador ejecuta las acciones de bots con una pausa configurable. Las decisiones Hard de cartas se ejecutan en un isolate usando un payload JSON de la vista pública. Los bots se detienen al pausar o al pasar la app a background y se reanudan desde el botón `CONTINUAR PARTIDA`. La pantalla nunca decide reglas por su cuenta: consulta `LocalGameEngine.legalBids` y `LocalGameEngine.legalCards`.

El contrato `GameSessionPort` separa la presentación del controlador local y deja preparado un `RemoteGameController` futuro. La mesa puede recibir intenciones de ambos orígenes.

## Límites intencionados

Esta fase no incluye cuenta, matchmaking, salas privadas, sincronización online ni leaderboard ranked. El motor TypeScript del servidor queda preparado como autoridad para la Fase 4; el adaptador Dart mantiene la experiencia offline con la misma especificación JSON versionada y vectores dorados.

El audio está aislado detrás de `GameAudio`; Fase 3 usa explícitamente `NoopGameAudio` hasta disponer de assets aprobados.
