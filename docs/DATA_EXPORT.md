# Exportación de datos

## Implementación

La exportación debe vivir detrás de `GET /users/me/export`, exigir autenticación y generar un documento JSON descargable con:

- perfil activo y preferencias no sensibles;
- historial de partidas, resultados, rating y estadísticas propias;
- fecha de creación y fecha de borrado si la cuenta fue anonimizada.

El endpoint consulta el repositorio de usuarios y el historial mediante los
repositorios configurados (Prisma en staging/producción), excluye tokens,
identificadores de proveedores externos, logs, snapshots, cartas privadas de
otros jugadores y secretos, y registra únicamente `data_export_requested` sin
el contenido exportado. Responde con `Content-Disposition` como JSON descargable.

## Estado

El borrado de cuenta está implementado como anonimización operativa y conserva
estadísticas históricas anonimizadas. Exportación y borrado se prueban en el
smoke de staging local contra PostgreSQL aislado; falta repetirlos contra la
instancia gestionada final y completar la validación de las políticas legales
de retención.
