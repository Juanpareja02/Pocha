# QA manual Android

Requiere un dispositivo Android físico y backend de staging. Registrar fecha,
modelo, versión Android, versión app y URL de staging en cada ejecución.

## Instalación

- [ ] Instala APK/AAB de QA.
- [ ] Abre después de instalar.
- [ ] Cierra, vuelve a abrir y comprueba que la sesión/estado esperado se conserva.
- [ ] Desinstala/reinstala y comprueba el estado esperado.
- [ ] Actualiza desde una build anterior y comprueba migraciones/estado.

## Onboarding y cuenta

- [ ] Primera ejecución y persistencia del onboarding.
- [ ] Segunda ejecución sin repetir onboarding.
- [ ] Invitado, username disponible/no disponible y error de red.
- [ ] Email: alta, logout, cierre/reapertura y restore de sesión.
- [ ] Google: login interactivo y logout con cuenta QA.
- [ ] Upgrade invitado conserva historial y estadísticas.
- [ ] Eliminar cuenta pide confirmación, anonimiza, limpia los datos locales y
      cierra sesión.

## Juego local

- [ ] Calculadora: crear, guardar, deshacer, cerrar y restaurar.
- [ ] Un jugador: Easy, Normal y Hard; partida completa de 3–6 jugadores.
- [ ] Background/resume durante partida y resultado.
- [ ] Modo avión: calculadora, un jugador y reglas siguen disponibles.

## Online/ranked

- [ ] Lobby privado, añadir bot, listo y comienzo.
- [ ] Cola casual, cancelación y timeout.
- [ ] Partida online, cambio WiFi/datos y reconexión.
- [ ] Ranked, placements, ELO, temporada y leaderboard.
- [ ] Token expirado, cliente obsoleto, carta ilegal y error de servidor.

## UI y ciclo de vida

- [ ] Light/dark, text scale grande y lector de pantalla.
- [ ] Portrait/landscape y rotación durante mesa.
- [ ] Foreground/background/terminated/resume durante online.
- [ ] Force-stop, abrir de nuevo y comprobar el estado razonable sin prometer
      recuperación imposible.
- [ ] Mesa, calculadora, lobby, leaderboard y perfil sin overflow/clipping.
- [ ] No hay spinner infinito; retry y offline son accionables.

## Red

- [ ] Staging HTTPS/WSS sin cleartext.
- [ ] Airplane mode y reconexión con backoff observable.
- [ ] Wi-Fi → datos móviles durante una partida y recuperación de asiento/estado.
- [ ] App Link HTTPS `/join/<ROOM_CODE>` abre la app y resuelve la sala.

## Rendimiento y observabilidad

- [ ] `flutter run --profile` en mesa, mano, animaciones, timer, leaderboard y
      calculadora.
- [ ] Sesiones repetidas entrar/salir sin sockets, timers o controladores
      duplicados.
- [ ] Si se configura Crashlytics, crash controlado solo en staging y evento
      visible; nunca dejar un disparador de crash en release.
