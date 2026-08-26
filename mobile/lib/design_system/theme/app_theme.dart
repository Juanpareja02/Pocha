import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_typography.dart';
import 'pocha_extensions.dart';

ThemeData pochaTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final base = ColorScheme.fromSeed(
    seedColor: PochaColors.table,
    brightness: brightness,
    surface: dark ? PochaColors.darkSurface : PochaColors.ivoryBright,
  );
  final scheme = base.copyWith(
    primary: dark ? const Color(0xFF80B99F) : PochaColors.table,
    onPrimary: dark ? PochaColors.tableDeep : PochaColors.ivoryBright,
    secondary: PochaColors.terracotta,
    onSecondary: PochaColors.ivoryBright,
    tertiary: PochaColors.mutedGold,
    error: PochaColors.error,
    surface: dark ? PochaColors.darkSurface : PochaColors.ivoryBright,
    onSurface: dark ? PochaColors.darkInk : PochaColors.charcoal,
    outline: dark ? const Color(0xFF5C746A) : PochaColors.border,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? PochaColors.tableDeep : PochaColors.ivory,
    textTheme: PochaTypography.textTheme(brightness),
    visualDensity: VisualDensity.standard,
    splashFactory: InkSparkle.splashFactory,
    cardTheme: CardThemeData(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: dark ? PochaColors.darkSurfaceRaised : PochaColors.ivoryBright,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: scheme.outline.withValues(alpha: 0.55)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? PochaColors.darkSurfaceRaised : PochaColors.ivoryBright,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.primary, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    ),
    appBarTheme: AppBarTheme(
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: Colors.transparent,
      foregroundColor: scheme.onSurface,
      titleTextStyle: PochaTypography.textTheme(brightness).titleLarge,
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      backgroundColor: dark ? PochaColors.darkSurface : PochaColors.ivoryBright,
      indicatorColor: dark ? const Color(0xFF355C4C) : const Color(0xFFD7E3D7),
      labelTextStyle: WidgetStatePropertyAll(
        PochaTypography.textTheme(brightness).labelSmall,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 50),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 50),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      side: BorderSide(color: scheme.outline.withValues(alpha: 0.7)),
      labelStyle: PochaTypography.textTheme(brightness).labelMedium!,
    ),
    extensions: [
      tableTheme(brightness),
      cardTheme(brightness),
      const RankTheme(
        bronze: Color(0xFF9C6B43),
        silver: Color(0xFF8B9A96),
        gold: Color(0xFFB58A35),
        platinum: Color(0xFF4C8D86),
        diamond: Color(0xFF4B78A5),
        master: Color(0xFF86528D),
        grandMaster: Color(0xFF9A4D38),
      ),
    ],
  );
}
