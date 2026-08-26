# Design system de La Pocha

## Principios

- La mesa es el punto de referencia: verde profundo, marfil cálido y acentos terracota.
- La interfaz habla español y prioriza acciones grandes, estados visibles y lectura rápida.
- Las cartas y los palos son vectoriales y procedurales; no dependen de imágenes remotas.
- Los componentes de juego exponen información semántica además de color, tamaño o movimiento.

## Tokens

Los tokens viven en mobile/lib/design_system/theme:

- PochaColors: mesa, marfil, terracota, oro apagado, carbón y estados semánticos.
- PochaSpacing: 4, 8, 12, 16, 24, 32 y 48 dp.
- PochaRadius: 10, 16, 24 y pill.
- PochaMotion: 120, 220 y 350 ms, respetando MediaQuery.disableAnimations.
- PochaTypography: display editorial serif del sistema y cuerpo sans-serif, con estilos `numbers` y cifras tabulares para marcadores.
- GameTableTheme, PlayingCardTheme y RankTheme: ThemeExtension para evitar colores hardcodeados en las mesas.

La aplicación usa pochaTheme(Brightness.light) y pochaTheme(Brightness.dark) con Material 3. El modo se persiste en SharedPreferences y se aplica sin reiniciar.

El copy transversal pasa por `mobile/lib/l10n/app_strings.dart`, con español
como locale inicial y delegates de Material registrados desde `main.dart`.

## Componentes

mobile/lib/design_system/components contiene superficies, botones, estados de carga/error/vacío/offline, avatar procedural, símbolos de Oros/Copas/Espadas/Bastos, carta, mano, baza, asiento, temporizador, mesa y rango.

Cada componente de juego mantiene etiquetas semánticas. Un asiento muestra explícitamente PIDIÓ y LLEVA; un temporizador calcula el tiempo desde un deadline real; una carta distingue boca abajo, seleccionada, ilegal y jugada.

## Responsive y accesibilidad

El diseño parte de 360×800 portrait y escala hasta 390×844 y 430×932. Las manos largas se solapan de forma adaptativa y las mesas se distribuyen para 3–6 jugadores. Los controles táctiles mantienen al menos 48 dp, los textos no dependen solo del color y se respeta reducción de movimiento.

## Fuente

No se añaden fuentes binarias ni una dependencia externa: los estilos display usan la familia serif disponible en el sistema y el cuerpo usa la fuente sans-serif de Flutter. Esto mantiene el APK autocontenido; si el producto incorpora una licencia tipográfica en Fase 8, solo habrá que cambiar el token tipográfico.
