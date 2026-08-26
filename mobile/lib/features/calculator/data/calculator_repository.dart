import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/calculator_game.dart';

class CalculatorRepository {
  static const _activeKey = 'pocha.calculator.active';
  static const _historyKey = 'pocha.calculator.history';

  Future<CalculatorGame?> loadActive() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_activeKey);
    if (raw == null) return null;
    return CalculatorGame.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> saveActive(CalculatorGame game) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_activeKey, jsonEncode(game.toJson()));
  }

  Future<void> clearActive() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_activeKey);
  }

  Future<void> clearAccountData() async {
    final preferences = await SharedPreferences.getInstance();
    await Future.wait([
      preferences.remove(_activeKey),
      preferences.remove(_historyKey),
    ]);
  }

  Future<List<CalculatorGame>> loadHistory() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_historyKey);
    if (raw == null) return const [];
    return (jsonDecode(raw) as List<dynamic>)
        .map(
          (game) =>
              CalculatorGame.fromJson(Map<String, dynamic>.from(game as Map)),
        )
        .toList(growable: false);
  }

  Future<void> archive(CalculatorGame game) async {
    final history = [
      game,
      ...(await loadHistory()),
    ].take(50).toList(growable: false);
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(
      _historyKey,
      jsonEncode(history.map((item) => item.toJson()).toList()),
    );
    await preferences.remove(_activeKey);
  }
}
