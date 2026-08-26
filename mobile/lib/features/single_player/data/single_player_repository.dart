import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/bot_strategy.dart';
import '../domain/local_game.dart';

enum AnimationSpeed { normal, fast, instant }

class SavedSinglePlayer {
  const SavedSinglePlayer({
    required this.state,
    required this.difficulty,
    required this.speed,
    required this.hapticsEnabled,
  });

  final LocalGameState state;
  final BotDifficulty difficulty;
  final AnimationSpeed speed;
  final bool hapticsEnabled;
}

class SinglePlayerStats {
  const SinglePlayerStats({
    this.gamesPlayed = 0,
    this.wins = 0,
    this.podiums = 0,
    this.totalPosition = 0,
    this.predictions = 0,
    this.predictionsHit = 0,
    this.bestScore,
  });

  final int gamesPlayed;
  final int wins;
  final int podiums;
  final int totalPosition;
  final int predictions;
  final int predictionsHit;
  final int? bestScore;

  double get averagePosition =>
      gamesPlayed == 0 ? 0 : totalPosition / gamesPlayed;
  double get predictionAccuracy =>
      predictions == 0 ? 0 : predictionsHit / predictions;

  SinglePlayerStats recordGame({
    required int position,
    required int score,
    required int gamePredictions,
    required int gamePredictionsHit,
  }) => SinglePlayerStats(
    gamesPlayed: gamesPlayed + 1,
    wins: wins + (position == 1 ? 1 : 0),
    podiums: podiums + (position <= 3 ? 1 : 0),
    totalPosition: totalPosition + position,
    predictions: predictions + gamePredictions,
    predictionsHit: predictionsHit + gamePredictionsHit,
    bestScore: bestScore == null || score > bestScore! ? score : bestScore,
  );

  Map<String, dynamic> toJson() => {
    'gamesPlayed': gamesPlayed,
    'wins': wins,
    'podiums': podiums,
    'totalPosition': totalPosition,
    'predictions': predictions,
    'predictionsHit': predictionsHit,
    'bestScore': bestScore,
  };

  factory SinglePlayerStats.fromJson(Map<String, dynamic> json) =>
      SinglePlayerStats(
        gamesPlayed: json['gamesPlayed'] as int? ?? 0,
        wins: json['wins'] as int? ?? 0,
        podiums: json['podiums'] as int? ?? 0,
        totalPosition: json['totalPosition'] as int? ?? 0,
        predictions: json['predictions'] as int? ?? 0,
        predictionsHit: json['predictionsHit'] as int? ?? 0,
        bestScore: json['bestScore'] as int?,
      );
}

class SinglePlayerRepository {
  static const _key = 'pocha.single_player.active';
  static const _statsKey = 'pocha.single_player.stats';

  Future<SavedSinglePlayer?> load() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_key);
    if (raw == null) return null;
    final json = jsonDecode(raw) as Map<String, dynamic>;
    return SavedSinglePlayer(
      state: LocalGameState.fromJson(
        Map<String, dynamic>.from(json['state'] as Map),
      ),
      difficulty: BotDifficulty.values.byName(json['difficulty'] as String),
      speed: AnimationSpeed.values.byName(json['speed'] as String),
      hapticsEnabled: json['hapticsEnabled'] as bool? ?? true,
    );
  }

  Future<void> save(
    LocalGameState state,
    BotDifficulty difficulty,
    AnimationSpeed speed, {
    bool hapticsEnabled = true,
  }) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(
      _key,
      jsonEncode({
        'state': state.toJson(),
        'difficulty': difficulty.name,
        'speed': speed.name,
        'hapticsEnabled': hapticsEnabled,
      }),
    );
  }

  Future<SinglePlayerStats> loadStats() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_statsKey);
    if (raw == null) return const SinglePlayerStats();
    return SinglePlayerStats.fromJson(
      Map<String, dynamic>.from(jsonDecode(raw) as Map),
    );
  }

  Future<SinglePlayerStats> recordGame({
    required int position,
    required int score,
    required int predictions,
    required int predictionsHit,
  }) async {
    final stats = (await loadStats()).recordGame(
      position: position,
      score: score,
      gamePredictions: predictions,
      gamePredictionsHit: predictionsHit,
    );
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_statsKey, jsonEncode(stats.toJson()));
    return stats;
  }

  Future<void> clear() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_key);
  }

  Future<void> clearAccountData() async {
    final preferences = await SharedPreferences.getInstance();
    await Future.wait([
      preferences.remove(_key),
      preferences.remove(_statsKey),
    ]);
  }
}
