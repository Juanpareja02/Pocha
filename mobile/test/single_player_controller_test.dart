import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';
import 'package:mobile/features/single_player/application/single_player_controller.dart';
import 'package:mobile/features/single_player/data/single_player_repository.dart';
import 'package:mobile/features/single_player/domain/local_game.dart';
import 'package:mobile/features/single_player/domain/bot_strategy.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test(
    'runs a complete offline game through autoplay and records stats',
    () async {
      SharedPreferences.setMockInitialValues({});
      final controller = SinglePlayerGameController();
      await controller.restore();
      await controller.start(
        playerCount: 3,
        selectedDifficulty: BotDifficulty.easy,
        selectedSpeed: AnimationSpeed.instant,
        selectedHapticsEnabled: false,
      );
      expect(controller.state, isNotNull);
      final botNames = controller.state!.players
          .where((player) => !player.human)
          .map((player) => player.name)
          .toList();
      expect(botNames.toSet(), hasLength(botNames.length));
      expect(botNames.every((name) => !name.startsWith('Bot')), isTrue);
      await controller.runAutoplay();

      expect(controller.state, isNull);
      expect(controller.stats.gamesPlayed, 1);
      expect(controller.stats.predictions, greaterThan(0));
      expect(controller.hapticsEnabled, isFalse);
      controller.dispose();
    },
  );

  test('supports auction rules and human trump selection', () async {
    final players = List<LocalPlayer>.generate(
      3,
      (index) =>
          LocalPlayer(id: 'p$index', name: 'Jugador $index', human: index == 0),
    );
    final state = LocalGameEngine.create(
      gameId: 'auction-test',
      players: players,
      rules: GameRules.auction(playerCount: 3),
      seed: 12,
    );
    LocalGameEngine.startRound(state);
    for (var index = 0; index < players.length; index++) {
      LocalGameEngine.submitBid(state, state.currentPlayer.id, 0);
    }
    expect(state.phase, LocalGamePhase.choosingTrump);
    final chooser = state.currentPlayer.id;
    LocalGameEngine.chooseTrump(state, chooser, Suit.copas);
    expect(state.phase, LocalGamePhase.playingTrick);
    expect(state.trump, Suit.copas);
  });

  test('restores an active game behind an explicit continue action', () async {
    SharedPreferences.setMockInitialValues({});
    final first = SinglePlayerGameController();
    await first.restore();
    await first.start(
      playerCount: 3,
      selectedDifficulty: BotDifficulty.easy,
      selectedSpeed: AnimationSpeed.instant,
    );
    final savedVersion = first.state!.stateVersion;
    await first.pause();

    final restored = SinglePlayerGameController();
    await restored.restore();
    expect(restored.state, isNotNull);
    expect(restored.resumeRequired, isTrue);
    expect(restored.state!.stateVersion, savedVersion);
    await restored.resume();
    expect(restored.resumeRequired, isFalse);
    await first.abandon();
    await restored.abandon();
    first.dispose();
    restored.dispose();
  });
}
