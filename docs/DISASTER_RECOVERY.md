# Recuperación pragmática

## PostgreSQL perdido

Restaurar el último backup, ejecutar `npm run prisma:migrate:deploy`, comprobar
constraints y validar partidas ranked. Sin backup no se reconstruyen de forma
fiable rating history ni resultados históricos.

## Redis perdido

La fuente duradera sigue siendo PostgreSQL. Se pierden colas, presencia, locks y
lookup efímero; readiness permanece fallido hasta que Redis vuelva. No se activa
InMemory en staging/producción.

## Reinicio de backend

Las sesiones en memoria se cierran limpiamente. Los snapshots y eventos
checkpointados quedan en PostgreSQL, pero no existe rehidratación automática de
la partida viva en este RC; el cliente recibe un error de sesión no disponible.
El snapshot sirve como evidencia para soporte y para una futura rehidratación
basada en eventos. No se promete HA ni reanudación automática.

## Backups

Configurar backup diario, retención definida por el proveedor y restauración
periódica en una base separada. Documentar RPO/RTO antes de beta.
