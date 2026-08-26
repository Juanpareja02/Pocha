import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/calculator/domain/calculator_game.dart';

void main() {
  test('records a physical round with the classic score', () {
    final game = CalculatorGame.start(['Juan', 'Esther', 'Pablo']);
    final updated = game.recordRound(predictions: [1, 0, 0], tricks: [1, 0, 0]);
    expect(updated.rounds.single.lines.first.score, 15);
    expect(updated.totalFor('Juan'), 15);
  });

  test('rejects a round when real tricks do not add up', () {
    final game = CalculatorGame.start(['Juan', 'Esther', 'Pablo']);
    expect(
      () => game.recordRound(predictions: [1, 0, 0], tricks: [0, 0, 0]),
      throwsFormatException,
    );
  });

  test('supports undoing a recorded round', () {
    final game = CalculatorGame.start(['Juan', 'Esther', 'Pablo']);
    final updated = game.recordRound(predictions: [1, 0, 0], tricks: [1, 0, 0]);
    expect(updated.withoutLastRound().rounds, isEmpty);
  });

  test('exposes legal predictions without presentation rule logic', () {
    final game = CalculatorGame.start(['Juan', 'Ana', 'Pablo']);
    expect(
      game.legalPredictions(
        playerIndex: 2,
        cards: 1,
        predictions: const [1, 0, null],
      ),
      equals([1]),
    );
  });
}
