# Inventario de datos

| Dato | Motivo | Almacenamiento | Retención | Público |
|---|---|---|---|---|
| `userId` interno | Relacionar partidas y sesión | PostgreSQL/Redis | Vida de cuenta / TTL realtime | No |
| Username/display name | Identidad en mesa y ranking | PostgreSQL | Vida de cuenta; anonimizado al borrar | Username sí |
| Proveedor y subject externo | Vincular autenticación | PostgreSQL | Vida de cuenta; sustituido al borrar | No |
| Email de autenticación | Alta/login cuando se elige Email/Password | Firebase Authentication | Según la cuenta y la política del proveedor | No |
| Avatar seed | Avatar determinista | PostgreSQL | Vida de cuenta | No |
| Resultados y scores | Historial y clasificación | PostgreSQL | Integridad histórica | Limitado |
| Rating history | ELO, temporadas y auditoría | PostgreSQL | Integridad competitiva | No |
| Snapshot/eventos | Reconnect, auditoría y soporte | PostgreSQL | Política pendiente de producto | No |
| Sala, presencia y cola | Coordinación realtime | Redis con TTL | Minutos a 48 horas | No |
| Token de sesión móvil | Mantener sesión | Secure Storage | Hasta logout/borrado | No |
| Analytics mínimos | Métricas de producto | No-op/proveedor futuro | Pendiente de proveedor | No |

No se solicitan dirección, teléfono, ubicación precisa, password local ni cartas
privadas en analytics.
