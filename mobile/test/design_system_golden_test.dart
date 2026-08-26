import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/design_system/pocha_design_system.dart';
import 'package:mobile/features/calculator/presentation/calculator_page.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';
import 'package:mobile/features/online/data/remote_game_session.dart';
import 'package:mobile/features/online/domain/auth_port.dart';
import 'package:mobile/features/online/domain/online_protocol.dart';
import 'package:mobile/features/online/presentation/online_pages.dart';
import 'package:mobile/features/product/presentation/product_pages.dart';
import 'package:mobile/features/ranked/data/ranked_api.dart' as ranked_data;
import 'package:mobile/features/ranked/presentation/ranked_pages.dart';
import 'package:mobile/features/single_player/application/single_player_controller.dart';
import 'package:mobile/features/single_player/domain/local_game.dart';
import 'package:mobile/features/single_player/presentation/single_player_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  final cards = SpanishDeck.standard40();
  final profile = ranked_data.RankedProfile(
    username: 'juan_alvaro',
    displayName: 'Juan Álvaro',
    rating: 1439,
    peakRating: 1510,
    rankName: 'Platino',
    position: 7,
    provisional: false,
    placementGames: 10,
    placementTotal: 10,
    gamesPlayed: 36,
    wins: 14,
    podiums: 24,
    averagePosition: 2.2,
    predictionAccuracy: 0.68,
    seasonName: 'Temporada de verano',
    seasonEndsAt: DateTime(2026, 9, 30),
  );
  final history = <ranked_data.RankedHistoryRow>[
    ranked_data.RankedHistoryRow(
      gameId: 'game-1',
      position: 2,
      score: 42,
      delta: 11,
      oldRating: 1428,
      newRating: 1439,
      rankId: 'platinum',
      previousRankId: 'gold',
      promoted: true,
      demoted: false,
      abandoned: false,
      createdAt: DateTime(2026, 8, 25),
    ),
  ];
  final leaderboard = ranked_data.RankedLeaderboardPage(
    myPosition: 7,
    items: const [
      ranked_data.RankedLeaderboardRow(
        position: 1,
        username: 'Ana',
        rating: 1600,
        rankName: 'Diamante',
        gamesPlayed: 44,
        provisional: false,
      ),
      ranked_data.RankedLeaderboardRow(
        position: 7,
        username: 'Juan Álvaro',
        rating: 1439,
        rankName: 'Platino',
        gamesPlayed: 36,
        provisional: false,
      ),
    ],
  );

  Future<void> pumpGolden(
    WidgetTester tester,
    Widget child,
    String name, {
    bool settle = false,
  }) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(
      MaterialApp(theme: pochaTheme(Brightness.light), home: child),
    );
    if (settle) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump();
    }
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/$name.png'),
    );
  }

  Widget table(int playerCount) {
    final names = List.generate(playerCount, (index) => 'Jugador $index');
    return Scaffold(
      appBar: AppBar(title: Text('Mesa de $playerCount')),
      body: Padding(
        padding: const EdgeInsets.all(PochaSpacing.sm),
        child: PochaGameTable(
          playerCount: playerCount,
          opponents: [
            for (var index = 1; index < playerCount; index++)
              PochaPlayerSeat(
                name: names[index],
                avatarSeed: index,
                bid: index % 3,
                tricksWon: index % 2,
                score: index * 10,
                isCurrent: index == 1,
                isBot: index.isEven,
              ),
          ],
          trick: TrickArea(
            cards: [
              TrickCardView(playerName: names[1], card: cards[5]),
              TrickCardView(playerName: names[2], card: cards[12]),
            ],
          ),
          localSeat: PochaPlayerSeat(
            name: names[0],
            bid: 2,
            tricksWon: 1,
            score: 25,
            isCurrent: true,
          ),
        ),
      ),
    );
  }

  testWidgets('golden home', (tester) async {
    await pumpGolden(tester, const HomePage(), 'home');
  });

  testWidgets('golden onboarding', (tester) async {
    await pumpGolden(tester, const OnboardingPage(), 'onboarding');
  });

  testWidgets('golden calculator', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await pumpGolden(
      tester,
      const CalculatorPage(),
      'calculator',
      settle: true,
    );
  });

  testWidgets('golden single player setup', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await pumpGolden(
      tester,
      const ProviderScope(child: SinglePlayerPage()),
      'single_player_setup',
      settle: true,
    );
  });

  testWidgets('golden game table four players', (tester) async {
    await pumpGolden(tester, table(4), 'game_table_4');
  });

  testWidgets('golden game table six players', (tester) async {
    await pumpGolden(tester, table(6), 'game_table_6');
  });

  testWidgets('golden multiplayer home', (tester) async {
    await pumpGolden(tester, const OnlineHomePage(), 'multiplayer');
  });

  testWidgets('golden lobby ready state', (tester) async {
    final session = RemoteGameSession(
      baseUrl: 'http://127.0.0.1:1',
      socketUrl: 'http://127.0.0.1:1',
      token: 'golden',
      userId: 'golden',
    );
    addTearDown(session.dispose);
    await pumpGolden(
      tester,
      OnlineLobbyPage(
        session: session,
        initialRoom: const RemoteRoomView(
          roomId: 'room-1',
          code: 'POCHA7',
          hostUserId: 'golden',
          status: 'WAITING',
          playerCount: 4,
          rulesetId: 'classic',
          players: [
            RemoteRoomPlayer(
              userId: 'golden',
              displayName: 'Juan Álvaro',
              seat: 0,
              isHost: true,
              isBot: false,
              botDifficulty: null,
              ready: true,
              connectionStatus: 'connected',
            ),
            RemoteRoomPlayer(
              userId: 'bot-1',
              displayName: 'Ana',
              seat: 1,
              isHost: false,
              isBot: true,
              botDifficulty: 'normal',
              ready: true,
              connectionStatus: 'connected',
            ),
          ],
        ),
      ),
      'lobby',
      settle: true,
    );
  });

  testWidgets('golden settings', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await pumpGolden(tester, const SettingsPage(), 'settings', settle: true);
  });

  testWidgets('golden how to play', (tester) async {
    await pumpGolden(tester, const HowToPlayPage(), 'how_to_play');
  });

  testWidgets('golden ranked state', (tester) async {
    await pumpGolden(
      tester,
      RankedHomePage(
        initialProfile: profile,
        initialAuth: const AuthSession(
          token: 'golden',
          userId: 'golden',
          displayName: 'Juan Álvaro',
        ),
      ),
      'ranked',
    );
  });

  testWidgets('golden leaderboard', (tester) async {
    await pumpGolden(
      tester,
      RankedLeaderboardPage(
        baseUrl: '',
        token: '',
        pageLoader: (_) async => leaderboard,
      ),
      'leaderboard',
      settle: true,
    );
  });

  testWidgets('golden profile state', (tester) async {
    await pumpGolden(
      tester,
      RankedProfilePage(
        baseUrl: '',
        token: '',
        profileFuture: Future.value(profile),
        historyFuture: Future.value(history),
      ),
      'profile',
      settle: true,
    );
  });

  testWidgets('golden round and ranked result states', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final roundController = await _goldenController(
      LocalGamePhase.roundResults,
    );
    await pumpGolden(
      tester,
      ProviderScope(
        overrides: [
          singlePlayerControllerProvider.overrideWith((ref) => roundController),
        ],
        child: const SinglePlayerPage(),
      ),
      'round_result',
      settle: true,
    );
    await pumpGolden(
      tester,
      RankedResultPage(
        baseUrl: '',
        token: '',
        gameId: 'game-1',
        profileFuture: Future.value(profile),
        historyFuture: Future.value(history),
      ),
      'ranked_result',
      settle: true,
    );
  });
}

Future<SinglePlayerGameController> _goldenController(
  LocalGamePhase phase,
) async {
  final controller = SinglePlayerGameController();
  await controller.restore();
  controller.state = LocalGameEngine.create(
    gameId: 'golden-round',
    players: [
      LocalPlayer(id: 'human', name: 'Juan', human: true),
      LocalPlayer(id: 'bot-0', name: 'Ana', human: false),
      LocalPlayer(id: 'bot-1', name: 'Carlos', human: false),
    ],
    rules: GameRules(
      id: 'golden',
      version: 1,
      playerCount: 3,
      roundSequence: const [1],
    ),
    seed: 7,
  );
  LocalGameEngine.startRound(controller.state!);
  controller.state!.phase = phase;
  controller.state!.roundIndex = 0;
  controller.state!.cardsPerRound = 1;
  controller.state!.lastRoundScores = {'human': 15, 'bot-0': 0, 'bot-1': 0};
  for (final player in controller.state!.players) {
    player.bid = 0;
    player.tricksWon = 0;
  }
  controller.notifyListeners();
  return controller;
}
