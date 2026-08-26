# Observabilidad

## Estado actual

- Backend: logs JSON por petición con `x-request-id`, método, ruta, estado y duración; `LOG_LEVEL` filtra los eventos por entorno.
- Backend: `/health/live` comprueba proceso vivo y `/health/ready` comprueba PostgreSQL y Redis fuera de desarrollo.
- Backend: `MetricsService` registra `active_connections`, `active_games`, `queue_size_casual`, `queue_size_ranked`, `game_completion_rate`, partidas iniciadas/completadas, reconexiones, desconexiones, rate limits y errores con nombres acotados y de baja cardinalidad. `/metrics` solo se habilita con `METRICS_ENABLED=true` y exige `METRICS_TOKEN` fuera de desarrollo.
- Backend: el rate limiter realtime usa memoria en development y Redis compartido en staging/production; si Redis no responde, la acción se rechaza y no se activa un fallback local.
- Flutter: `CrashReporter` y `AnalyticsClient` son puertos sin SDK ni envío externo por defecto.
- Eventos mínimos: `onboarding_completed`, inicio/fin de calculadora, inicio/fin de partida individual, inicio/fin de cola casual, fin de partida casual, inicio/fin de cola ranked, fin de partida ranked y eventos de seguridad.

## Reglas de datos

No se registran tokens, contraseñas, secretos, correos, cartas/manos, RNG, datos de pago ni payloads completos. Un proveedor externo solo se puede conectar detrás de los puertos existentes y debe conservar esta regla.

## Pendiente externo

Crashlytics es la primera opción a evaluar porque Firebase ya forma parte de la
arquitectura. No se integra mientras falten el proyecto Android final, la
configuración de release y la política de retención. No se incorporarán varios
proveedores a la vez. Hasta entonces el comportamiento es no-op y no bloquea
el arranque.
