import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';
import 'package:mobile/features/single_player/domain/bot_strategy.dart';
import 'package:mobile/features/single_player/domain/local_game.dart';

LocalGameState _newGame({List<int> rounds = const [2]}) {
  final players = List<LocalPlayer>.generate(
    4,
    (index) =>
        LocalPlayer(id: 'p$index', name: 'Jugador $index', human: index == 0),
  );
  return LocalGameEngine.create(
    gameId: 'test-game',
    players: players,
    rules: GameRules(
      id: 'test',
      version: 1,
      playerCount: 4,
      roundSequence: rounds,
    ),
    seed: 17,
  );
}

void _playBots(LocalGameState state, List<BotStrategy> strategies) {
  while (state.phase == LocalGamePhase.bidding ||
      state.phase == LocalGamePhase.playingTrick ||
      state.phase == LocalGamePhase.trickResults) {
    if (state.phase == LocalGamePhase.trickResults) {
      LocalGameEngine.continueAfterTrick(state);
      continue;
    }
    final player = state.currentPlayer;
    final strategy = strategies[state.currentPlayerIndex];
    final random = LocalRandom(state.randomState);
    final view = BotPlayerView(playerId: player.id, state: state);
    if (state.phase == LocalGamePhase.bidding) {
      final legal = LocalGameEngine.legalBids(state);
      final bid = strategy.chooseBid(view, random);
      expect(legal, contains(bid));
      state.randomState = random.state;
      LocalGameEngine.submitBid(state, player.id, bid);
    } else {
      final legal = LocalGameEngine.legalCards(state, player.id);
      final card = strategy.chooseCard(view, random);
      expect(legal.map((candidate) => candidate.id), contains(card.id));
      state.randomState = random.state;
      LocalGameEngine.playCard(state, player.id, card.id);
    }
  }
}

void main() {
  test('deals a valid round and keeps public card counts', () {
    for (final playerCount in [3, 4, 5, 6]) {
      final players = List<LocalPlayer>.generate(
        playerCount,
        (index) => LocalPlayer(
          id: 'p$index',
          name: 'Jugador $index',
          human: index == 0,
        ),
      );
      final state = LocalGameEngine.create(
        gameId: 'deal-$playerCount',
        players: players,
        rules: GameRules.classic(playerCount: playerCount),
        seed: playerCount,
      );
      LocalGameEngine.startRound(state);

      expect(state.phase, LocalGamePhase.bidding);
      expect(
        state.players.fold<int>(0, (sum, player) => sum + player.hand.length),
        state.cardsPerRound * playerCount,
      );
      expect(
        state.players.every(
          (player) => player.cardsRemaining == state.cardsPerRound,
        ),
        isTrue,
      );
      expect(
        state.players
            .expand((player) => player.hand)
            .map((card) => card.id)
            .toSet(),
        hasLength(state.cardsPerRound * playerCount),
      );
    }
  });

  test('enforces the last bid rule and hides opponents hands', () {
    final state = _newGame();
    LocalGameEngine.startRound(state);
    for (var index = 0; index < 3; index++) {
      LocalGameEngine.submitBid(state, state.currentPlayer.id, 0);
    }
    expect(LocalGameEngine.legalBids(state), isNot(contains(2)));
    final view = state.publicView('p0');
    expect(
      view.players.firstWhere((player) => player.id == 'p0').hand,
      isNotEmpty,
    );
    expect(
      view.players
          .where((player) => player.id != 'p0')
          .every((player) => player.hand.isEmpty),
      isTrue,
    );
    expect(
      view.players
          .where((player) => player.id != 'p0')
          .every((player) => player.cardsRemaining == state.cardsPerRound),
      isTrue,
    );
  });

  test(
    'plays a complete round with legal actions and preserves state JSON',
    () {
      final state = _newGame();
      LocalGameEngine.startRound(state);
      _playBots(state, List<BotStrategy>.filled(4, const NormalBotStrategy()));

      expect(state.phase, LocalGamePhase.roundResults);
      expect(state.playedCards, hasLength(8));
      expect(
        state.playedCards.map((item) => item.card.id).toSet(),
        hasLength(8),
      );
      expect(
        state.players.fold<int>(0, (sum, player) => sum + player.tricksWon),
        2,
      );
      expect(state.players.every((player) => player.hand.isEmpty), isTrue);
      expect(
        state.players.every((player) => player.cardsRemaining == 0),
        isTrue,
      );

      final restored = LocalGameState.fromJson(state.toJson());
      expect(restored.toJson(), state.toJson());
      expect(restored.nextRoundCards, isNull);
    },
  );

  test('moves from the final round to game results and finished', () {
    final state = _newGame(rounds: const [1, 1]);
    final strategies = List<BotStrategy>.filled(4, const EasyBotStrategy());
    LocalGameEngine.startRound(state);
    _playBots(state, strategies);
    LocalGameEngine.startNextRound(state);
    _playBots(state, strategies);
    expect(state.phase, LocalGamePhase.roundResults);
    LocalGameEngine.startNextRound(state);
    expect(state.phase, LocalGamePhase.gameResults);
    LocalGameEngine.finish(state);
    expect(state.phase, LocalGamePhase.finished);
  });
}
