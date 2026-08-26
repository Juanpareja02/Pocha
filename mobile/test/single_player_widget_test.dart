import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';
import 'package:mobile/features/single_player/application/single_player_controller.dart';
import 'package:mobile/features/single_player/domain/local_game.dart';
import 'package:mobile/features/single_player/presentation/single_player_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('shows the single-player setup controls', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: SinglePlayerPage())),
    );
    await tester.pumpAndSettle();

    expect(find.text('1 Jugador'), findsOneWidget);
    expect(find.text('Número de jugadores'), findsOneWidget);
    expect(find.text('Dificultad de los bots'), findsOneWidget);
    expect(find.text('Entrena en la mesa'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pump();
    expect(find.text('Empezar partida'), findsOneWidget);
  });

  testWidgets('exposes rules selector and remains usable on a narrow screen', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: SinglePlayerPage())),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pump();
    expect(find.text('Reglas'), findsOneWidget);
    expect(find.text('Pocha clásica'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shows the bidding panel when it is the human turn', (
    tester,
  ) async {
    final controller = await _controllerFor(LocalGamePhase.bidding);
    await tester.pumpWidget(_host(controller));
    await tester.pumpAndSettle();
    expect(find.text('¿Cuántas bazas crees que harás?'), findsOneWidget);
    expect(find.byType(ChoiceChip), findsWidgets);
  });

  testWidgets('explains an illegal card through the domain result', (
    tester,
  ) async {
    final controller = await _controllerFor(LocalGamePhase.playingTrick);
    await tester.pumpWidget(_host(controller));
    await tester.pumpAndSettle();
    expect(find.text('Debes asistir a copas.'), findsOneWidget);
  });

  testWidgets('renders round summary and final classification', (tester) async {
    final roundController = await _controllerFor(LocalGamePhase.roundResults);
    await tester.pumpWidget(_host(roundController));
    await tester.pumpAndSettle();
    expect(find.text('Resumen de ronda'), findsOneWidget);
    expect(find.text('Ver clasificación'), findsOneWidget);

    final finalController = await _controllerFor(LocalGamePhase.gameResults);
    await tester.pumpWidget(_host(finalController));
    await tester.pumpAndSettle();
    expect(find.text('Clasificación final'), findsOneWidget);
    expect(find.text('Jugar de nuevo'), findsOneWidget);
  });
}

Widget _host(SinglePlayerGameController controller) => ProviderScope(
  key: UniqueKey(),
  overrides: [singlePlayerControllerProvider.overrideWith((ref) => controller)],
  child: MaterialApp(home: SinglePlayerPage(key: UniqueKey())),
);

Future<SinglePlayerGameController> _controllerFor(LocalGamePhase phase) async {
  SharedPreferences.setMockInitialValues({});
  final controller = SinglePlayerGameController();
  await controller.restore();
  final players = [
    LocalPlayer(id: 'human', name: 'Juan', human: true),
    LocalPlayer(id: 'bot-0', name: 'Ana', human: false),
    LocalPlayer(id: 'bot-1', name: 'Carlos', human: false),
  ];
  final state = LocalGameEngine.create(
    gameId: 'widget-state',
    players: players,
    rules: GameRules(
      id: 'widget',
      version: 1,
      playerCount: 3,
      roundSequence: const [1],
    ),
    seed: 4,
  );
  LocalGameEngine.startRound(state);
  state.currentPlayerIndex = 0;
  if (phase == LocalGamePhase.playingTrick) {
    state.phase = phase;
    state.currentTrick.add(
      LocalPlayedCard(
        playerId: 'bot-0',
        card: const PochaCard(suit: Suit.copas, rank: Rank.as_),
      ),
    );
    state.leadSuit = Suit.copas;
    state.players[0].hand = [
      const PochaCard(suit: Suit.copas, rank: Rank.dos),
      const PochaCard(suit: Suit.oros, rank: Rank.as_),
    ];
    state.players[0].cardsRemaining = 2;
  } else if (phase == LocalGamePhase.roundResults) {
    state.phase = phase;
    state.roundIndex = 0;
    state.cardsPerRound = 1;
    state.lastRoundScores = {'human': 15, 'bot-0': 0, 'bot-1': 0};
    for (final player in state.players) {
      player.bid = 0;
      player.tricksWon = 0;
    }
  } else if (phase == LocalGamePhase.gameResults) {
    state.phase = phase;
    state.players[0].score = 25;
    state.players[1].score = 10;
    state.players[2].score = 0;
  }
  controller.state = state;
  controller.notifyListeners();
  return controller;
}
