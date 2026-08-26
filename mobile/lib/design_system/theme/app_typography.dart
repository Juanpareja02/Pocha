import 'package:flutter/material.dart';

import 'app_colors.dart';

abstract final class PochaTypography {
  static TextTheme textTheme(Brightness brightness) {
    final ink = brightness == Brightness.dark
        ? PochaColors.darkInk
        : PochaColors.charcoal;
    final muted = brightness == Brightness.dark
        ? const Color(0xFFB8C5BE)
        : PochaColors.charcoalSoft;
    return TextTheme(
      displayLarge: TextStyle(
        fontFamily: 'serif',
        fontSize: 42,
        height: 1.12,
        fontWeight: FontWeight.w700,
        color: ink,
        letterSpacing: -1.2,
      ),
      displayMedium: TextStyle(
        fontFamily: 'serif',
        fontSize: 32,
        height: 1.16,
        fontWeight: FontWeight.w700,
        color: ink,
        letterSpacing: -0.8,
      ),
      headlineSmall: TextStyle(
        fontFamily: 'serif',
        fontSize: 26,
        height: 1.2,
        fontWeight: FontWeight.w700,
        color: ink,
      ),
      titleLarge: TextStyle(
        fontFamily: 'serif',
        fontSize: 22,
        height: 1.25,
        fontWeight: FontWeight.w700,
        color: ink,
      ),
      titleMedium: TextStyle(
        fontSize: 17,
        height: 1.25,
        fontWeight: FontWeight.w700,
        color: ink,
      ),
      bodyLarge: TextStyle(fontSize: 16, height: 1.5, color: ink),
      bodyMedium: TextStyle(fontSize: 14, height: 1.45, color: muted),
      labelLarge: TextStyle(
        fontSize: 14,
        height: 1.2,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.2,
        color: ink,
      ),
      labelMedium: TextStyle(
        fontSize: 12,
        height: 1.2,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.4,
        color: muted,
      ),
      labelSmall: TextStyle(
        fontSize: 11,
        height: 1.2,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.7,
        color: muted,
      ),
    );
  }

  static TextStyle scoreboard(BuildContext context) => TextStyle(
    fontFamily: 'monospace',
    fontFeatures: const [FontFeature.tabularFigures()],
    fontSize: 20,
    fontWeight: FontWeight.w800,
    color: Theme.of(context).colorScheme.onSurface,
  );

  static TextStyle numbers(BuildContext context) => TextStyle(
    fontFeatures: const [FontFeature.tabularFigures()],
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: Theme.of(context).colorScheme.onSurface,
  );
}
