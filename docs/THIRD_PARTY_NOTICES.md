# Third-party notices

La aplicación utiliza paquetes con sus propias licencias, instalados mediante
`mobile/pubspec.lock` y `server/package-lock.json`. Antes de distribución
comercial se debe generar un inventario legal desde Flutter y npm y revisar sus
licencias.

No se incluyen fuentes binarias ni assets visuales externos obligatorios. Los
iconos y recursos actuales pertenecen al template/proyecto y deben revisarse
antes de publicación final.

```bash
cd mobile && flutter pub deps
cd ../server && npm ls --all
```
