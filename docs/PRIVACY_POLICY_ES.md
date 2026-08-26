# Política de privacidad — borrador MVP

**Pendientes legales:** `[NOMBRE DEL DESARROLLADOR/EMPRESA]`,
`[EMAIL DE CONTACTO]` y `[DOMINIO OFICIAL]` deben sustituirse antes de publicar.

La Pocha utiliza únicamente los datos necesarios para crear una cuenta, mostrar
el nombre de juego, mantener partidas online, conservar el historial y calcular
la clasificación. El detalle está en [`DATA_INVENTORY.md`](DATA_INVENTORY.md).

No se piden dirección, teléfono ni ubicación precisa. Los tokens se almacenan en
el almacén seguro del dispositivo y no se escriben en logs. El email solo se
usa si la persona elige autenticarse con Email/Password y lo gestiona Firebase
Authentication; no se copia al perfil público. Las cartas privadas, emails,
tokens y secretos de sala no se envían a analytics.

La cuenta puede eliminarse desde Ajustes. La identidad visible se anonimiza y
los resultados necesarios para mantener las partidas históricas se conservan
sin el identificador personal original. Tras confirmar el borrado también se
limpian del dispositivo el nombre guardado, la partida local y los historiales
o estadísticas offline.

El backend utiliza PostgreSQL para datos duraderos y Redis para coordinación
efímera. El proveedor de autenticación, analytics y crash reporting debe
indicarse aquí al contratarlo. Este documento es un borrador, no una política
legal final.

Contacto: `[EMAIL DE CONTACTO]`.
