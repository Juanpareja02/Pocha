# Deep links de salas

El parser compartido acepta URLs con la forma `/join/<CÓDIGO>` y normaliza el código a mayúsculas. Solo acepta seis caracteres alfanuméricos; la sala vuelve a validarse en el servidor.

Ejemplo:

```text
https://pocha.example/join/ab12cd
```

se convierte en `RoomDeepLink(code: AB12CD)` y abre la ruta Flutter `/join/AB12CD`.

Los templates de plataforma están en:

- `mobile/android/app/src/main/AndroidManifest.links.xml.template`
- `docs/deep-links/assetlinks.json.template`

Android ya incluye el intent filter parametrizado. Configura `POCHA_LINK_HOST`
y `POCHA_LINK_AUTO_VERIFY=true` solo en la build cuyo dominio real tenga
publicado `assetlinks.json`; el valor local `example.invalid` no se considera
verificado.

Antes de publicar hay que sustituir `YOUR_DOMAIN` y configurar el
`assetlinks.json` de Android. Es una configuración de dominio de despliegue; no
se marca como verificada sin ese archivo y una prueba en dispositivo.

La aplicación Android recibe los endpoints mediante `STAGING_API_URL` y
`STAGING_SOCKET_URL` con `--dart-define`; no depende de
`localhost` ni de `10.0.2.2` en el código de release. La ruta `/join/<CODE>`
valida el código, abre el flujo de autenticación y entrega el código al join de
sala. Firebase Authentication externo ya está configurado para
`la-pocha-app`; lo pendiente aquí es exclusivamente el dominio y la prueba en
dispositivo.

Para QA local se puede compilar con `POCHA_AUTH_MODE=development`; una build de
release sin ese define no intenta usar `/auth/guest` ni `/auth/development`.
