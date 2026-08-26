import 'package:flutter/material.dart';

import 'app_colors.dart';

@immutable
class GameTableTheme extends ThemeExtension<GameTableTheme> {
  const GameTableTheme({
    required this.felt,
    required this.feltDeep,
    required this.feltBorder,
    required this.center,
    required this.onFelt,
  });

  final Color felt;
  final Color feltDeep;
  final Color feltBorder;
  final Color center;
  final Color onFelt;

  @override
  GameTableTheme copyWith({
    Color? felt,
    Color? feltDeep,
    Color? feltBorder,
    Color? center,
    Color? onFelt,
  }) => GameTableTheme(
    felt: felt ?? this.felt,
    feltDeep: feltDeep ?? this.feltDeep,
    feltBorder: feltBorder ?? this.feltBorder,
    center: center ?? this.center,
    onFelt: onFelt ?? this.onFelt,
  );

  @override
  GameTableTheme lerp(covariant GameTableTheme? other, double t) {
    if (other == null) return this;
    return GameTableTheme(
      felt: Color.lerp(felt, other.felt, t)!,
      feltDeep: Color.lerp(feltDeep, other.feltDeep, t)!,
      feltBorder: Color.lerp(feltBorder, other.feltBorder, t)!,
      center: Color.lerp(center, other.center, t)!,
      onFelt: Color.lerp(onFelt, other.onFelt, t)!,
    );
  }
}

@immutable
class PlayingCardTheme extends ThemeExtension<PlayingCardTheme> {
  const PlayingCardTheme({
    required this.surface,
    required this.border,
    required this.back,
    required this.backInk,
    required this.redSuit,
    required this.darkSuit,
    required this.figure,
  });

  final Color surface;
  final Color border;
  final Color back;
  final Color backInk;
  final Color redSuit;
  final Color darkSuit;
  final Color figure;

  @override
  PlayingCardTheme copyWith({
    Color? surface,
    Color? border,
    Color? back,
    Color? backInk,
    Color? redSuit,
    Color? darkSuit,
    Color? figure,
  }) => PlayingCardTheme(
    surface: surface ?? this.surface,
    border: border ?? this.border,
    back: back ?? this.back,
    backInk: backInk ?? this.backInk,
    redSuit: redSuit ?? this.redSuit,
    darkSuit: darkSuit ?? this.darkSuit,
    figure: figure ?? this.figure,
  );

  @override
  PlayingCardTheme lerp(covariant PlayingCardTheme? other, double t) {
    if (other == null) return this;
    return PlayingCardTheme(
      surface: Color.lerp(surface, other.surface, t)!,
      border: Color.lerp(border, other.border, t)!,
      back: Color.lerp(back, other.back, t)!,
      backInk: Color.lerp(backInk, other.backInk, t)!,
      redSuit: Color.lerp(redSuit, other.redSuit, t)!,
      darkSuit: Color.lerp(darkSuit, other.darkSuit, t)!,
      figure: Color.lerp(figure, other.figure, t)!,
    );
  }
}

@immutable
class RankTheme extends ThemeExtension<RankTheme> {
  const RankTheme({
    required this.bronze,
    required this.silver,
    required this.gold,
    required this.platinum,
    required this.diamond,
    required this.master,
    required this.grandMaster,
  });

  final Color bronze;
  final Color silver;
  final Color gold;
  final Color platinum;
  final Color diamond;
  final Color master;
  final Color grandMaster;

  Color colorFor(String id) => switch (id.toLowerCase()) {
    'bronze' => bronze,
    'silver' => silver,
    'gold' => gold,
    'platinum' => platinum,
    'diamond' => diamond,
    'master' => master,
    'grand-master' => grandMaster,
    _ => silver,
  };

  @override
  RankTheme copyWith({
    Color? bronze,
    Color? silver,
    Color? gold,
    Color? platinum,
    Color? diamond,
    Color? master,
    Color? grandMaster,
  }) => RankTheme(
    bronze: bronze ?? this.bronze,
    silver: silver ?? this.silver,
    gold: gold ?? this.gold,
    platinum: platinum ?? this.platinum,
    diamond: diamond ?? this.diamond,
    master: master ?? this.master,
    grandMaster: grandMaster ?? this.grandMaster,
  );

  @override
  RankTheme lerp(covariant RankTheme? other, double t) {
    if (other == null) return this;
    return RankTheme(
      bronze: Color.lerp(bronze, other.bronze, t)!,
      silver: Color.lerp(silver, other.silver, t)!,
      gold: Color.lerp(gold, other.gold, t)!,
      platinum: Color.lerp(platinum, other.platinum, t)!,
      diamond: Color.lerp(diamond, other.diamond, t)!,
      master: Color.lerp(master, other.master, t)!,
      grandMaster: Color.lerp(grandMaster, other.grandMaster, t)!,
    );
  }
}

GameTableTheme tableTheme(Brightness brightness) =>
    brightness == Brightness.dark
    ? const GameTableTheme(
        felt: PochaColors.table,
        feltDeep: PochaColors.tableDeep,
        feltBorder: Color(0xFF356B5B),
        center: Color(0xFF1A5143),
        onFelt: PochaColors.ivory,
      )
    : const GameTableTheme(
        felt: PochaColors.tableSoft,
        feltDeep: PochaColors.table,
        feltBorder: Color(0xFF8AB29A),
        center: Color(0xFF1F654F),
        onFelt: PochaColors.ivoryBright,
      );

PlayingCardTheme cardTheme(Brightness brightness) =>
    brightness == Brightness.dark
    ? const PlayingCardTheme(
        surface: Color(0xFFFFF9ED),
        border: Color(0xFFD0BFA7),
        back: PochaColors.terracottaDeep,
        backInk: PochaColors.ivory,
        redSuit: Color(0xFFB33B35),
        darkSuit: Color(0xFF183F36),
        figure: Color(0xFF7E5A2A),
      )
    : const PlayingCardTheme(
        surface: PochaColors.ivoryBright,
        border: PochaColors.border,
        back: PochaColors.terracotta,
        backInk: PochaColors.ivory,
        redSuit: Color(0xFFAA3D36),
        darkSuit: PochaColors.tableDeep,
        figure: Color(0xFF8A632C),
      );

PlayingCardTheme cardThemeFor(Brightness brightness) => cardTheme(brightness);
