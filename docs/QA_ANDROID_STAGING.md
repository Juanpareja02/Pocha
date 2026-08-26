# QA Android staging

Estado: `PENDING_HUMAN_INPUT`.

No existe todavía un dispositivo Android físico conectado ni un backend staging
HTTPS público. La checklist automatizada de Flutter sigue verde, y el backend
local se ha probado con Firebase real, PostgreSQL real, Redis real y
Socket.IO; ninguna de esas pruebas sustituye la QA de dispositivo real ni la
validación TLS.

## Evidencia automatizada disponible

- `flutter analyze`: sin incidencias.
- `flutter test`: 62 tests correctos.
- `npm run staging:local-live-smoke`: health, autenticación, salas, partidas
  casual/ranked, reconexión, privacidad, persistencia, exportación y borrado
  anonimizado correctos.
- `adb devices`: no hay dispositivo conectado.

No se presenta como ejecutada ninguna prueba de pantalla, red móvil, tamaño,
memoria, deep link ni instalación firmada en hardware real.

## Pendiente de ejecutar en dispositivo

- Inicio, onboarding, navegación y tema claro/oscuro.
- Calculadora: crear ronda, puntuación, undo, background, restauración e
  historial.
- Solitario: Easy, Normal y Hard; cartas legales, pausa y restauración.
- Online: crear sala, unirse, ready, partida y reconexión.
- Cambio Wi-Fi/datos y modo avión.
- Ranked: cola, partida, ELO, historial y leaderboard.
- Responsive: mesa, calculadora, lobby, leaderboard y perfil.
- Deep link HTTPS `/join/<CODE>` con dominio verificado.

No hay resultados reales que reportar todavía; no se simula una aprobación.
