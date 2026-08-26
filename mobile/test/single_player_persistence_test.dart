import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';
import 'package:mobile/features/single_player/data/single_player_repository.dart';
import 'package:mobile/features/single_player/domain/bot_strategy.dart';
import 'package:mobile/features/single_player/domain/local_game.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('persists an active custom game and offline statistics', () async {
    SharedPreferences.setMockInitialValues({});
    final repository = SinglePlayerRepository();
    final players = [
      LocalPlayer(id: 'human', name: 'Juan', human: true, avatarSeed: 11),
      LocalPlayer(id: 'bot-0', name: 'Ana', human: false, avatarSeed: 22),
      LocalPlayer(id: 'bot-1', name: 'Carlos', human: false, avatarSeed: 33),
    ];
    final state = LocalGameEngine.create(
      gameId: 'persisted',
      players: players,
      rules: GameRules.custom(
        playerCount: 3,
        mustOvertrump: true,
        allowNoTrump: true,
      ),
      seed: 77,
    );
    LocalGameEngine.startRound(state);
    await repository.save(
      state,
      BotDifficulty.hard,
      AnimationSpeed.fast,
      hapticsEnabled: false,
    );
    final saved = await repository.load();
    expect(saved, isNotNull);
    expect(saved!.state.toJson(), state.toJson());
    expect(saved.difficulty, BotDifficulty.hard);
    expect(saved.speed, AnimationSpeed.fast);
    expect(saved.hapticsEnabled, isFalse);

    final stats = await repository.recordGame(
      position: 2,
      score: 42,
      predictions: 10,
      predictionsHit: 6,
    );
    expect(stats.gamesPlayed, 1);
    expect(stats.podiums, 1);
    expect(stats.averagePosition, 2);
    expect(stats.predictionAccuracy, 0.6);
    expect((await repository.loadStats()).bestScore, 42);
  });

  test('account cleanup removes active game and offline statistics', () async {
    SharedPreferences.setMockInitialValues({});
    final repository = SinglePlayerRepository();
    final players = [
      LocalPlayer(id: 'human', name: 'Juan', human: true, avatarSeed: 11),
      LocalPlayer(id: 'bot-0', name: 'Ana', human: false, avatarSeed: 22),
      LocalPlayer(id: 'bot-1', name: 'Carlos', human: false, avatarSeed: 33),
    ];
    final state = LocalGameEngine.create(
      gameId: 'account-cleanup',
      players: players,
      rules: GameRules.classic(playerCount: 3),
      seed: 88,
    );
    await repository.save(state, BotDifficulty.normal, AnimationSpeed.normal);
    await repository.recordGame(
      position: 1,
      score: 42,
      predictions: 3,
      predictionsHit: 2,
    );

    await repository.clearAccountData();

    expect(await repository.load(), isNull);
    expect((await repository.loadStats()).gamesPlayed, 0);
  });
}
