# QA Android contra staging

Estado actual: `PENDING HUMAN INPUT`
Backend: `https://pocha-staging.onrender.com`
Paquete: `com.pocha.mobile`

## Evidencia ya verificada

- `flutter analyze`: sin incidencias.
- `flutter test`: 62 tests correctos.
- APK y AAB release generados con Firebase Android real, API HTTPS y
  Socket.IO/WSS de Render staging.
- Smoke E2E externo del backend: `VERIFIED` para Auth, salas, partidas,
  reconexión, casual, ranked, persistencia, Redis, exportación y borrado.
- `flutter devices`: solo Windows, Chrome y Edge.
- `adb devices`: lista vacía.

## Cómo continuar cuando conectes un Android

1. Activa Opciones de desarrollador y Depuración USB.
2. Conecta el teléfono por USB, acepta la huella RSA y comprueba:

   ```text
   adb devices
   flutter devices
   ```

3. Instala el APK:

   ```text
   adb install -r mobile/build/app/outputs/flutter-apk/app-release.apk
   ```

4. Ejecuta manualmente este recorrido contra staging:

   - alta anónima, Email/Password, logout y restauración de sesión;
   - login Google interactivo;
   - onboarding, tema, navegación y responsive;
   - calculadora: ronda, puntuación, undo, background, restauración e
     historial;
   - solitario: Easy, Normal y Hard, cartas legales, pausa y restauración;
   - online: crear sala, unirse, ready, partida y reconexión;
   - cambio Wi‑Fi/datos, modo avión, background y force-stop;
   - ranked: cola, partida, ELO, historial y leaderboard;
   - deep link HTTPS `/join/<CODE>` cuando exista dominio real verificado.

5. Anota modelo, versión Android, resultado y cualquier captura en el informe
   de QA. No pegues tokens ni contraseñas.

## Límite actual

La E2E de Node confirma el backend real, pero no puede declarar aprobada la UI
Android, el login Google ni la reconexión de la aplicación sin hardware o un
emulador conectado.
