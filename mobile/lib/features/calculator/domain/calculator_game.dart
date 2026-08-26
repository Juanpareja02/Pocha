import '../../game/domain/pocha_engine.dart';

class CalculatorLine {
  const CalculatorLine({
    required this.playerName,
    required this.prediction,
    required this.tricks,
    required this.score,
  });

  final String playerName;
  final int prediction;
  final int tricks;
  final int score;

  Map<String, Object> toJson() => {
    'playerName': playerName,
    'prediction': prediction,
    'tricks': tricks,
    'score': score,
  };

  factory CalculatorLine.fromJson(Map<String, dynamic> json) => CalculatorLine(
    playerName: json['playerName'] as String,
    prediction: json['prediction'] as int,
    tricks: json['tricks'] as int,
    score: json['score'] as int,
  );
}

class CalculatorRound {
  const CalculatorRound({required this.cards, required this.lines});

  final int cards;
  final List<CalculatorLine> lines;

  Map<String, Object> toJson() => {
    'cards': cards,
    'lines': lines.map((line) => line.toJson()).toList(),
  };

  factory CalculatorRound.fromJson(Map<String, dynamic> json) =>
      CalculatorRound(
        cards: json['cards'] as int,
        lines: (json['lines'] as List<dynamic>)
            .map(
              (line) => CalculatorLine.fromJson(
                Map<String, dynamic>.from(line as Map),
              ),
            )
            .toList(growable: false),
      );
}

class CalculatorGame {
  const CalculatorGame({
    required this.id,
    required this.players,
    required this.roundSequence,
    required this.rounds,
    required this.createdAt,
  });

  final String id;
  final List<String> players;
  final List<int> roundSequence;
  final List<CalculatorRound> rounds;
  final DateTime createdAt;

  factory CalculatorGame.start(List<String> playerNames) {
    final names = playerNames
        .map((name) => name.trim())
        .toList(growable: false);
    if (names.length < 3 || names.length > 6) {
      throw const FormatException('La partida necesita entre 3 y 6 jugadores');
    }
    if (names.any((name) => name.isEmpty) ||
        names.toSet().length != names.length) {
      throw const FormatException(
        'Los nombres deben ser únicos y no estar vacíos',
      );
    }
    return CalculatorGame(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      players: names,
      roundSequence: _classicSequence(names.length),
      rounds: const [],
      createdAt: DateTime.now(),
    );
  }

  bool get isFinished => rounds.length >= roundSequence.length;
  int? get nextRoundCards => isFinished ? null : roundSequence[rounds.length];

  /// Returns the predictions that are currently valid for one player.
  ///
  /// Keeping this rule in the calculator domain means the presentation layer
  /// only renders the actions exposed by the game state.
  List<int> legalPredictions({
    required int playerIndex,
    required int cards,
    required List<int?> predictions,
  }) {
    final values = List<int>.generate(cards + 1, (value) => value);
    final isLastPlayer = playerIndex == players.length - 1;
    final previous = predictions.take(playerIndex);
    if (isLastPlayer && previous.every((value) => value != null)) {
      final remaining =
          cards -
          previous.cast<int>().fold<int>(0, (sum, value) => sum + value);
      values.remove(remaining);
    }
    return values;
  }

  int totalFor(String playerName) => rounds.fold<int>(
    0,
    (total, round) =>
        total +
        round.lines.firstWhere((line) => line.playerName == playerName).score,
  );

  CalculatorGame recordRound({
    required List<int> predictions,
    required List<int> tricks,
  }) {
    final cards = nextRoundCards;
    if (cards == null) throw StateError('La partida ya ha terminado');
    if (predictions.length != players.length ||
        tricks.length != players.length) {
      throw const FormatException('Faltan resultados de algún jugador');
    }
    if (predictions.any((value) => value < 0 || value > cards) ||
        tricks.any((value) => value < 0 || value > cards)) {
      throw const FormatException('El resultado no es válido para esta ronda');
    }
    if (tricks.fold<int>(0, (sum, value) => sum + value) != cards) {
      throw FormatException('Las bazas reales deben sumar $cards');
    }
    const scoring = ScoringRules();
    final lines = List<CalculatorLine>.generate(players.length, (index) {
      final prediction = predictions[index];
      final actual = tricks[index];
      return CalculatorLine(
        playerName: players[index],
        prediction: prediction,
        tricks: actual,
        score: scoring.score(bid: prediction, tricks: actual),
      );
    }, growable: false);
    return CalculatorGame(
      id: id,
      players: players,
      roundSequence: roundSequence,
      rounds: [
        ...rounds,
        CalculatorRound(cards: cards, lines: lines),
      ],
      createdAt: createdAt,
    );
  }

  CalculatorGame withoutLastRound() {
    if (rounds.isEmpty) return this;
    return CalculatorGame(
      id: id,
      players: players,
      roundSequence: roundSequence,
      rounds: rounds.sublist(0, rounds.length - 1),
      createdAt: createdAt,
    );
  }

  Map<String, Object> toJson() => {
    'id': id,
    'players': players,
    'roundSequence': roundSequence,
    'rounds': rounds.map((round) => round.toJson()).toList(),
    'createdAt': createdAt.toIso8601String(),
  };

  factory CalculatorGame.fromJson(Map<String, dynamic> json) => CalculatorGame(
    id: json['id'] as String,
    players: (json['players'] as List<dynamic>).cast<String>(),
    roundSequence: (json['roundSequence'] as List<dynamic>).cast<int>(),
    rounds: (json['rounds'] as List<dynamic>)
        .map(
          (round) =>
              CalculatorRound.fromJson(Map<String, dynamic>.from(round as Map)),
        )
        .toList(growable: false),
    createdAt: DateTime.parse(json['createdAt'] as String),
  );
}

List<int> _classicSequence(int playerCount) {
  final maximumCards = (40 ~/ playerCount).clamp(1, 8).toInt();
  final ascending = List<int>.generate(maximumCards, (index) => index + 1);
  return [
    ...ascending,
    ...ascending.take(ascending.length - 1).toList().reversed,
  ];
}
