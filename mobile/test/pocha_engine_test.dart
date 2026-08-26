import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';

void main() {
  test('creates a Spanish 40-card deck without duplicates', () {
    final deck = SpanishDeck.standard40();
    expect(deck.length, 40);
    expect(deck.map((card) => card.id).toSet().length, 40);
  });

  test('calculates the classic score', () {
    const scoring = ScoringRules();
    expect(scoring.score(bid: 2, tricks: 2), 20);
    expect(scoring.score(bid: 2, tricks: 0), -10);
  });

  test('matches multiplier, bonus and miss scoring rules', () {
    const scoring = ScoringRules(
      roundMultiplier: 2,
      pochaBonusEnabled: true,
      pochaBonus: 25,
    );
    expect(scoring.score(bid: 0, tricks: 0, cardsPerRound: 1), 20);
    expect(scoring.score(bid: 2, tricks: 2, cardsPerRound: 2), 90);
    expect(scoring.score(bid: 3, tricks: 1, cardsPerRound: 3), -20);
  });

  test('requires following suit when the player can do so', () {
    const rules = GameRules(
      id: 'test',
      version: 1,
      playerCount: 4,
      roundSequence: [1],
    );
    final hand = [
      const PochaCard(suit: Suit.oros, rank: Rank.as_),
      const PochaCard(suit: Suit.copas, rank: Rank.tres),
    ];
    final legal = PochaRuleEngine.legalCards(
      hand: hand,
      trick: [const PochaCard(suit: Suit.oros, rank: Rank.dos)],
      rules: rules,
    );
    expect(legal.single.suit, Suit.oros);
  });

  test(
    'requires the lowest available higher trump when mounting is enabled',
    () {
      final rules = GameRules.custom(playerCount: 3, mustOvertrump: true);
      final legal = PochaRuleEngine.legalCards(
        hand: [
          const PochaCard(suit: Suit.copas, rank: Rank.dos),
          const PochaCard(suit: Suit.oros, rank: Rank.dos),
          const PochaCard(suit: Suit.oros, rank: Rank.tres),
        ],
        trick: [
          const PochaCard(suit: Suit.espadas, rank: Rank.rey),
          const PochaCard(suit: Suit.oros, rank: Rank.rey),
        ],
        rules: rules,
        trump: Suit.oros,
      );
      expect(legal.map((card) => card.id), ['oros:tres']);
    },
  );
}
