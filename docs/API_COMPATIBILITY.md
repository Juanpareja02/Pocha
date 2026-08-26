# Compatibilidad de API y protocolo

El protocolo online tiene versión mínima y máxima configurables:

- `MINIMUM_SUPPORTED_PROTOCOL_VERSION`
- `LATEST_PROTOCOL_VERSION`

El servidor rechaza el handshake si el cliente no envía una versión soportada. La aplicación muestra un mensaje claro para actualizar cuando recibe `protocol_unsupported`.

La política recomendada es mantener al menos una versión anterior durante una ventana de actualización, publicar primero el servidor compatible y retirar la versión antigua solo después de comprobar adopción en staging.

La compatibilidad real con clientes publicados requiere pruebas con las versiones antiguas y un entorno staging. No se considera completada solo por cambiar el número de versión.
