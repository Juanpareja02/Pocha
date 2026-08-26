# Google Play checklist

Destino: Google Play Internal Testing para Android 1.0. No hay publicación
automática ni release de producción en esta fase.

- [ ] Cuenta Play Console y app id `com.pocha.mobile` confirmados.
- [ ] Play App Signing configurado; upload key fuera del repositorio.
- [ ] AAB release firmado generado y verificado.
- [ ] Version name/code incrementados desde `0.8.0+1`.
- [ ] Target SDK y matriz de dispositivos revisados.
- [ ] Store listing, icono, screenshots y categoría completados para Google Play.
- [ ] Data Safety completado a partir de `docs/GOOGLE_PLAY_DATA_SAFETY.md` y
      confirmado por el responsable.
- [ ] Política de privacidad pública con datos legales reales.
- [ ] Content rating completado.
- [ ] Declaración de anuncios: actualmente no hay publicidad implementada.
- [ ] Account deletion accesible desde Ajustes.
- [ ] Cuenta de testers e Internal Testing configurados.
- [ ] Closed Testing y staged rollout solo se planifican después de corregir la
      RC; no se ejecutan en esta fase.

## Política de versión

La build actual es `0.8.0+1`. Antes de cada subida comprobar que
`versionCode` sea mayor que el último publicado. Como guía de producto,
`0.9.x` se reserva para beta interna/closed y `1.0.0` para producción; no se
debe cambiar el número actual sin revisar el historial de Play Console.

No subir a Play Console durante esta fase.
