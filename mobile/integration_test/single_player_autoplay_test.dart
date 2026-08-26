import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/features/single_player/application/single_player_controller.dart';
import 'package:mobile/features/single_player/data/single_player_repository.dart';
import 'package:mobile/features/single_player/domain/bot_strategy.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('completes a small single-player game with autoplay', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = SinglePlayerGameController();
    await controller.restore();
    await controller.start(
      playerCount: 3,
      selectedDifficulty: BotDifficulty.easy,
      selectedSpeed: AnimationSpeed.instant,
    );
    await controller.runAutoplay();

    expect(controller.state, isNull);
    expect(controller.stats.gamesPlayed, 1);
    controller.dispose();
  });
}
