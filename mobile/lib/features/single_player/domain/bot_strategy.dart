import '../../game/domain/pocha_engine.dart';
import 'local_game.dart';

enum BotDifficulty { easy, normal, hard }

class BotPlayerView {
  BotPlayerView({required this.playerId, required LocalGameState state})
    : state = state.publicView(playerId);

  final String playerId;
  final LocalGameState state;

  LocalPlayer get player =>
      state.players.firstWhere((candidate) => candidate.id == playerId);
}

abstract class BotStrategy {
  const BotStrategy();

  BotDifficulty get difficulty;
  int chooseBid(BotPlayerView view, LocalRandom random);
  Suit? chooseTrump(BotPlayerView view, LocalRandom random);
  PochaCard chooseCard(BotPlayerView view, LocalRandom random);
}

class EasyBotStrategy extends BotStrategy {
  const EasyBotStrategy();

  @override
  BotDifficulty get difficulty => BotDifficulty.easy;

  @override
  int chooseBid(BotPlayerView view, LocalRandom random) {
    final estimate = _estimateBid(view);
    final noisy =
        estimate + (random.next() < 0.35 ? (random.next() < 0.5 ? -1 : 1) : 0);
    return _closestLegal(view.state, noisy);
  }

  @override
  Suit? chooseTrump(BotPlayerView view, LocalRandom random) =>
      _chooseBestTrump(view);

  @override
  PochaCard chooseCard(BotPlayerView view, LocalRandom random) {
    final legal = LocalGameEngine.legalCards(view.state, view.playerId);
    if (legal.length == 1 || random.next() < 0.18) {
      return legal[(random.next() * legal.length).floor()];
    }
    return _chooseForTarget(view);
  }
}

class NormalBotStrategy extends BotStrategy {
  const NormalBotStrategy();

  @override
  BotDifficulty get difficulty => BotDifficulty.normal;

  @override
  int chooseBid(BotPlayerView view, LocalRandom random) =>
      _closestLegal(view.state, _estimateBid(view));

  @override
  Suit? chooseTrump(BotPlayerView view, LocalRandom random) =>
      _chooseBestTrump(view);

  @override
  PochaCard chooseCard(BotPlayerView view, LocalRandom random) =>
      _chooseForTarget(view);
}

class HardBotStrategy extends BotStrategy {
  const HardBotStrategy({
    this.maxSimulations = 12,
    this.maxActionsPerRollout = 160,
  });

  final int maxSimulations;
  final int maxActionsPerRollout;

  @override
  BotDifficulty get difficulty => BotDifficulty.hard;

  @override
  int chooseBid(BotPlayerView view, LocalRandom random) =>
      _closestLegal(view.state, _estimateBid(view));

  @override
  Suit? chooseTrump(BotPlayerView view, LocalRandom random) =>
      _chooseBestTrump(view);

  @override
  PochaCard chooseCard(BotPlayerView view, LocalRandom random) {
    final legal = LocalGameEngine.legalCards(view.state, view.playerId);
    if (legal.length == 1 || maxSimulations <= 0) {
      return _chooseForTarget(view);
    }
    final results =
        legal.map((candidate) {
          var exact = 0;
          var score = 0.0;
          for (var index = 0; index < maxSimulations; index++) {
            final hypothetical = _determinize(view, random);
            final result = _rollout(
              hypothetical,
              view.playerId,
              candidate.id,
              random,
              maxActionsPerRollout,
            );
            if (result.exact) exact++;
            score += result.score;
          }
          return (
            card: candidate,
            exactRate: exact / maxSimulations,
            averageScore: score / maxSimulations,
          );
        }).toList()..sort(
          (left, right) => right.exactRate.compareTo(left.exactRate) != 0
              ? right.exactRate.compareTo(left.exactRate)
              : right.averageScore.compareTo(left.averageScore),
        );
    return results.first.card;
  }
}

({bool exact, double score}) _rollout(
  LocalGameState state,
  String playerId,
  String firstCardId,
  LocalRandom random,
  int maxActionsPerRollout,
) {
  LocalGameEngine.playCard(state, playerId, firstCardId);
  const normal = NormalBotStrategy();
  var actions = 1;
  while (state.phase == LocalGamePhase.playingTrick &&
      actions < maxActionsPerRollout) {
    final player = state.currentPlayer;
    final view = BotPlayerView(playerId: player.id, state: state);
    final card = normal.chooseCard(view, random);
    LocalGameEngine.playCard(state, player.id, card.id);
    actions++;
  }
  if (state.phase != LocalGamePhase.roundResults) {
    return (exact: false, score: double.negativeInfinity);
  }
  final player = state.players.firstWhere(
    (candidate) => candidate.id == playerId,
  );
  return (
    exact: player.bid == player.tricksWon,
    score: (state.lastRoundScores[playerId] ?? 0).toDouble(),
  );
}

LocalGameState _determinize(BotPlayerView view, LocalRandom random) {
  final state = LocalGameState.fromJson(view.state.toJson());
  final own = state.players.firstWhere((player) => player.id == view.playerId);
  final visibleIds = {
    ...own.hand.map((card) => card.id),
    ...state.playedCards.map((played) => played.card.id),
  };
  final unknown = SpanishDeck.standard40()
      .where((card) => !visibleIds.contains(card.id))
      .toList();
  for (var index = unknown.length - 1; index > 0; index--) {
    final swapIndex = (random.next() * (index + 1)).floor();
    final card = unknown[index];
    unknown[index] = unknown[swapIndex];
    unknown[swapIndex] = card;
  }
  var offset = 0;
  for (final player in state.players) {
    if (player.id == view.playerId) {
      player.hand = [...own.hand];
      continue;
    }
    final end = offset + player.cardsRemaining;
    player.hand = unknown.sublist(offset, end);
    offset = end;
  }
  if (offset > unknown.length) {
    throw StateError('No se pudieron repartir las cartas ocultas');
  }
  return state;
}

int _estimateBid(BotPlayerView view) {
  final trump = view.state.trump;
  final estimate = view.player.hand.fold<double>(0, (total, card) {
    final base = switch (standardRankStrength[card.rank]) {
      10 => 0.82,
      9 => 0.72,
      8 => 0.53,
      7 => 0.38,
      6 => 0.27,
      5 => 0.19,
      4 => 0.13,
      3 => 0.1,
      2 => 0.07,
      _ => 0.04,
    };
    return total + base + (trump == card.suit ? 0.3 : 0);
  });
  return estimate.round().clamp(0, view.state.cardsPerRound).toInt();
}

Suit? _chooseBestTrump(BotPlayerView view) {
  if (view.state.rules.trumpMode == TrumpMode.none) return null;
  var bestSuit = Suit.oros;
  var bestValue = -1;
  for (final suit in Suit.values) {
    final value = view.player.hand
        .where((card) => card.suit == suit)
        .fold<int>(0, (sum, card) => sum + standardRankStrength[card.rank]!);
    if (value > bestValue) {
      bestValue = value;
      bestSuit = suit;
    }
  }
  return bestSuit;
}

int _closestLegal(LocalGameState state, int value) {
  final legal = LocalGameEngine.legalBids(state);
  if (legal.isEmpty) throw StateError('El bot no tiene predicciones legales');
  final sorted = [...legal]
    ..sort(
      (left, right) => (left - value).abs().compareTo((right - value).abs()),
    );
  return sorted.first;
}

PochaCard _chooseForTarget(BotPlayerView view) {
  final legal = LocalGameEngine.legalCards(view.state, view.playerId);
  final need = (view.player.bid ?? 0) - view.player.tricksWon;
  final candidates =
      legal
          .map(
            (card) => (
              card: card,
              wins: LocalGameEngine.wouldWinCurrentTrick(view.state, card),
              strength: standardRankStrength[card.rank]!,
            ),
          )
          .toList()
        ..sort((left, right) {
          if (left.wins != right.wins) {
            return need > 0 ? (right.wins ? -1 : 1) : (left.wins ? 1 : -1);
          }
          return left.strength.compareTo(right.strength);
        });
  return candidates.first.card;
}
