import 'package:flutter/widgets.dart';

/// Spanish product copy boundary.
///
/// The app starts in Spanish. Keeping copy behind this Localizations delegate
/// lets the UI move to ARB/generated translations later without touching game
/// state, controllers or domain messages.
class AppStrings {
  const AppStrings();

  static const delegate = _AppStringsDelegate();

  static AppStrings of(BuildContext context) =>
      Localizations.of<AppStrings>(context, AppStrings) ?? const AppStrings();

  String get appName => 'La Pocha';
  String get home => 'Inicio';
  String get leaderboard => 'Clasificación';
  String get history => 'Historial';
  String get profile => 'Perfil';
  String get settings => 'Ajustes';
  String get retry => 'Reintentar';
  String get back => 'Volver';
  String get loading => 'Cargando';
  String get emptyGamesTitle => 'Todavía no hay partidas';
  String get emptyGamesMessage => 'Cuando termines una partida aparecerá aquí.';
  String get reconnecting => 'Reconectando… Tu asiento se conserva.';
  String get reconnect => 'Reconectar';
  String get cardLoading => 'Cargando carta';
  String get playCard => 'JUGAR CARTA';
  String get bidQuestion => '¿Cuántas bazas crees que harás?';
  String get chooseTrump => 'Elige el triunfo';
  String get noTrump => 'Sin triunfo';
  String get localHand => 'Tu mano';
  String get bidLabel => 'PIDIÓ';
  String get tricksLabel => 'LLEVA';
  String get provisional => 'PROVISIONAL';
  String get turn => 'Tu turno';

  String cards(int count) => '$count cartas';
  String players(int count) => '$count jugadores';
  String round(int current, [int? total]) =>
      total == null ? 'Ronda $current' : 'Ronda $current de $total';
  String score(int value) => '$value puntos';
  String handSemantics(int count) => '$localHand, $count cartas';
  String bidAndTricks(int? bid, int tricks) =>
      '$bidLabel ${bid ?? '—'}  ·  $tricksLabel $tricks';
  String timerSeconds(String label, int seconds) => '$label, $seconds segundos';
}

class _AppStringsDelegate extends LocalizationsDelegate<AppStrings> {
  const _AppStringsDelegate();

  @override
  bool isSupported(Locale locale) => locale.languageCode == 'es';

  @override
  Future<AppStrings> load(Locale locale) async => const AppStrings();

  @override
  bool shouldReload(covariant LocalizationsDelegate<AppStrings> old) => false;
}
