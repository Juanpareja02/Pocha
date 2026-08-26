# Coste de preproducción

## Obligatorio para una beta real

- PostgreSQL gestionado o VM con backups.
- Redis gestionado o instancia con persistencia/monitorización.
- Hosting HTTPS para NestJS y WebSocket.
- Dominio y certificados TLS.
- Cuenta Google Play para el lanzamiento Android.

## Opcional / posterior

- Proveedor Firebase/OIDC si no se opera uno propio.
- Crash reporting y analytics externo.
- Monitorización y alertas gestionadas.
- CDN o almacenamiento de assets de marketing.

Durante desarrollo se puede usar Docker local y free tier, siempre con staging
separado de producción. No se contrata nada automáticamente.
