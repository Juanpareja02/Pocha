import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';

Map<String, dynamic> _readJson(String path) =>
    jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

PochaCard _card(String id) {
  final parts = id.split(':');
  final rank = parts[1] == 'as' ? Rank.as_ : Rank.values.byName(parts[1]);
  return PochaCard(suit: Suit.values.byName(parts[0]), rank: rank);
}

String _rankName(Rank rank) => rank == Rank.as_ ? 'as' : rank.name;

void main() {
  test('keeps the Dart classic preset aligned with the shared JSON spec', () {
    final spec = _readJson('../shared/game-spec/rulesets/classic_v1.json');
    final rules = GameRules.classic(playerCount: 4);
    expect(rules.id, spec['id']);
    expect(rules.version, spec['version']);
    expect(
      rules.roundSequence,
      (spec['roundSequenceByPlayerCount']['4'] as List<dynamic>).cast<int>(),
    );
    expect(
      Suit.values.map((suit) => suit.name).toList(),
      (spec['deck']['suits'] as List<dynamic>).cast<String>(),
    );
    expect(
      rules.scoring.exactBase,
      (spec['scoring'] as Map<String, dynamic>)['exactBase'],
    );
    expect(
      Rank.values.map(_rankName).toList(),
      (spec['deck']['ranks'] as List<dynamic>).cast<String>(),
    );
  });

  test('keeps shared legal-card vectors equivalent', () {
    final vectors = _readJson(
      '../shared/game-spec/fixtures/engine_vectors.json',
    );
    for (final rawCase in vectors['legalCardCases'] as List<dynamic>) {
      final vector = rawCase as Map<String, dynamic>;
      final rules = GameRules.custom(
        playerCount: 3,
        mustOvertrump: vector['mustOvertrump'] as bool,
      );
      final legal = PochaRuleEngine.legalCards(
        hand: (vector['hand'] as List<dynamic>)
            .map((id) => _card(id as String))
            .toList(),
        trick: (vector['trick'] as List<dynamic>)
            .map((id) => _card(id as String))
            .toList(),
        rules: rules,
        trump: (vector['trump'] as String?) == null
            ? null
            : Suit.values.byName(vector['trump'] as String),
      );
      expect(
        legal
            .map((card) => '${card.suit.name}:${_rankName(card.rank)}')
            .toList(),
        vector['legal'],
      );
    }
  });
}
