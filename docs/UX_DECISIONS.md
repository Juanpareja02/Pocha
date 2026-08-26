# Decisiones UX de Fase 7

## Navegación

Home, Clasificación, Historial y Perfil forman la navegación principal. La barra inferior no aparece dentro de una partida para mantener el foco de mesa. Ajustes, reglas y tutorial son rutas secundarias.

## Acceso

El invitado es el camino de menor fricción. Email y Google tienen puntos de
entrada preparados mediante AuthPort para Android 1.0; no se simulan
credenciales ni se promete autenticación de producción.

## Mesa

La mesa usa una única composición reutilizable para 3–6 jugadores. El asiento local se coloca abajo, los rivales alrededor y la baza en el centro. La mano vive debajo de la mesa para no competir con los asientos. Una carta se selecciona con un toque y se juega con una acción confirmada: esto evita jugadas accidentales.

## Información

PIDIÓ y LLEVA siempre están juntos. Los turnos se expresan con borde, estado textual y temporizador. Las cartas ilegales se atenúan, pero además exponen el motivo en texto.

## Movimiento y feedback

Las transiciones son cortas, no imprescindibles para entender el estado y se reducen automáticamente cuando el sistema lo solicita. Las respuestas hápticas pasan por HapticsService; el audio existente se conserva y sus preferencias quedan separadas.

## Datos y compatibilidad

La migración es progresiva: los controladores, repositorios, motor local, protocolo online y APIs existentes se mantienen. La UI nueva consume sus estados; no reescribe reglas ni añade una capa de datos paralela.

## Identidad visual

La propuesta es propia de La Pocha: paño verde, marfil, terracota y oro apagado, con cartas españolas vectoriales. No utiliza Stitch ni HTML/CSS/recursos de Stitch.
