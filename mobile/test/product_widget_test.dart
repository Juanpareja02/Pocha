import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/design_system/pocha_design_system.dart';
import 'package:mobile/features/calculator/presentation/calculator_page.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';
import 'package:mobile/features/online/domain/auth_port.dart';
import 'package:mobile/features/online/data/remote_game_session.dart';
import 'package:mobile/features/online/domain/online_protocol.dart';
import 'package:mobile/features/online/presentation/online_pages.dart';
import 'package:mobile/features/ranked/data/ranked_api.dart' as ranked_data;
import 'package:mobile/features/ranked/presentation/ranked_pages.dart';
import 'package:mobile/features/product/presentation/product_pages.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
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
        username: 'ana',
        rating: 1600,
        rankName: 'Diamante',
        gamesPlayed: 44,
        provisional: false,
      ),
      ranked_data.RankedLeaderboardRow(
        position: 7,
        username: 'juan_alvaro',
        rating: 1439,
        rankName: 'Platino',
        gamesPlayed: 36,
        provisional: false,
      ),
    ],
  );

  Widget host(Widget child) =>
      MaterialApp(theme: pochaTheme(Brightness.light), home: child);

  testWidgets('decision sheets expose legal actions and semantics', (
    tester,
  ) async {
    var selectedBid = -1;
    Suit? selectedTrump;
    await tester.pumpWidget(
      host(
        Scaffold(
          body: ListView(
            children: [
              BidSheet(
                cardsPerRound: 3,
                legalBids: const [0, 1, 3],
                onBid: (value) => selectedBid = value,
              ),
              TrumpSheet(onTrump: (suit) => selectedTrump = suit),
            ],
          ),
        ),
      ),
    );
    await tester.tap(find.widgetWithText(ChoiceChip, '1').first);
    await tester.tap(find.widgetWithText(ChoiceChip, 'Oros'));
    await tester.pump();
    expect(selectedBid, 1);
    expect(selectedTrump, Suit.oros);
    final semantics = tester.ensureSemantics();
    expect(find.bySemanticsLabel(RegExp('Opciones de puja')), findsOneWidget);
    expect(find.bySemanticsLabel('Palos de triunfo'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('non-iOS auth sheet exposes only Android release providers', (
    tester,
  ) async {
    await tester.pumpWidget(host(const AuthPage()));
    await tester.tap(find.text('INICIAR SESIÓN'));
    await tester.pumpAndSettle();
    expect(find.text('CONTINUAR CON GOOGLE'), findsOneWidget);
    expect(find.text('CONTINUAR CON APPLE'), findsNothing);
  });

  testWidgets('calculator setup accepts fast mobile input', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(host(const CalculatorPage()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('NUEVA PARTIDA'));
    await tester.pumpAndSettle();
    expect(find.text('Nueva partida'), findsOneWidget);
    final fields = find.byType(TextField);
    expect(fields, findsNWidgets(4));
    await tester.enterText(fields.at(0), 'Juan Álvaro');
    expect(find.text('Juan Álvaro'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('online lobby has an accessible loading state', (tester) async {
    final session = RemoteGameSession(
      baseUrl: 'http://127.0.0.1:1',
      socketUrl: 'http://127.0.0.1:1',
      token: 'test',
      userId: 'test',
    );
    addTearDown(session.dispose);
    await tester.pumpWidget(host(OnlineLobbyPage(session: session)));
    expect(find.text('Cargando sala'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Cargando')), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('online lobby renders host, bots and ready state', (
    tester,
  ) async {
    final session = RemoteGameSession(
      baseUrl: 'http://127.0.0.1:1',
      socketUrl: 'http://127.0.0.1:1',
      token: 'test',
      userId: 'host',
    );
    addTearDown(session.dispose);
    await tester.pumpWidget(
      host(
        OnlineLobbyPage(
          session: session,
          initialRoom: RemoteRoomView(
            roomId: 'room-1',
            code: 'ABC123',
            hostUserId: 'host',
            status: 'WAITING',
            playerCount: 4,
            rulesetId: 'classic',
            players: const [
              RemoteRoomPlayer(
                userId: 'host',
                displayName: 'Juan',
                seat: 0,
                isHost: true,
                isBot: false,
                botDifficulty: null,
                ready: true,
                connectionStatus: 'connected',
              ),
              RemoteRoomPlayer(
                userId: 'bot-1',
                displayName: 'Bot Ana',
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
      ),
    );
    expect(find.text('ABC123'), findsOneWidget);
    expect(find.textContaining('Host'), findsOneWidget);
    expect(find.text('Bot Ana'), findsOneWidget);
    expect(find.text('AÑADIR BOT'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ranked home and profile render real data widgets', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        RankedHomePage(
          initialProfile: profile,
          initialAuth: const AuthSession(
            token: 'test',
            userId: 'juan',
            displayName: 'Juan Álvaro',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('JUGAR COMPETITIVO'), findsOneWidget);
    expect(find.byType(RankBadge), findsOneWidget);

    await tester.pumpWidget(
      host(
        RankedProfilePage(
          baseUrl: '',
          token: '',
          profileFuture: Future.value(profile),
          historyFuture: Future.value(history),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Partidas ranked'), findsOneWidget);
    await tester.drag(find.byType(ListView).first, const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(find.textContaining('+11 ELO'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ranked leaderboard and result render real states', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        RankedLeaderboardPage(
          baseUrl: '',
          token: '',
          pageLoader: (_) async => leaderboard,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('ana'), findsOneWidget);
    expect(find.text('#7'), findsNWidgets(2));
    expect(find.byType(RankBadge), findsWidgets);

    await tester.pumpWidget(
      host(
        RankedResultPage(
          baseUrl: '',
          token: '',
          gameId: 'game-1',
          profileFuture: Future.value(profile),
          historyFuture: Future.value(history),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('¡ASCENSO!'), findsOneWidget);
    expect(find.textContaining('1428'), findsOneWidget);
    expect(find.textContaining('1439'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ranked season exposes placement progress', (tester) async {
    await tester.pumpWidget(
      host(
        RankedSeasonPage(
          baseUrl: '',
          token: '',
          seasonFuture: Future.value(
            const ranked_data.RankedSeasonSummary(
              id: 'season-4',
              name: 'Temporada 4',
              number: 4,
              status: 'ACTIVE',
              endsAt: null,
            ),
          ),
          profileFuture: Future.value(profile),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Temporada 4'), findsOneWidget);
    expect(find.text('Temporada 4 · ACTIVE'), findsOneWidget);
    expect(find.text('10/10'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('table remains usable with text scaling and one or many cards', (
    tester,
  ) async {
    final cards = SpanishDeck.standard40();
    await tester.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(
          size: Size(360, 800),
          textScaler: TextScaler.linear(1.8),
        ),
        child: host(
          Scaffold(
            body: PlayerHand(
              cards: cards.take(10).toList(),
              selectedCard: cards[0],
              legalCardIds: cards.take(5).map((card) => card.id).toSet(),
              onCardTap: (_) {},
              onPlaySelected: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('JUGAR CARTA'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(
          size: Size(360, 800),
          textScaler: TextScaler.linear(1.8),
        ),
        child: host(Scaffold(body: PlayerHand(cards: [cards.first]))),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
