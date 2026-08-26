import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/design_system/pocha_design_system.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';

void main() {
  final cards = SpanishDeck.standard40();

  Widget host(Widget child) => MaterialApp(
    theme: pochaTheme(Brightness.light),
    home: Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(PochaSpacing.md),
          child: child,
        ),
      ),
    ),
  );

  testWidgets('renders Spanish cards, back and semantic states', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        Wrap(
          spacing: PochaSpacing.sm,
          children: [
            PlayingCardWidget(card: cards[0]),
            PlayingCardWidget(card: cards[1], selected: true),
            PlayingCardWidget(card: cards[7], legal: false),
            const PlayingCardWidget.faceDown(),
          ],
        ),
      ),
    );

    final semantics = tester.ensureSemantics();
    expect(find.bySemanticsLabel(RegExp('As de Oros')), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Carta boca abajo')), findsOneWidget);
    expect(find.text('S'), findsWidgets);
    expect(tester.takeException(), isNull);
    semantics.dispose();
  });

  testWidgets('adapts a long hand and exposes confirm action', (tester) async {
    await tester.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final hand = cards.take(10).toList();
    await tester.pumpWidget(
      host(
        PlayerHand(
          cards: hand,
          legalCardIds: hand.take(6).map((card) => card.id).toSet(),
          selectedCard: hand[0],
          onCardTap: (_) {},
          onPlaySelected: () {},
          helperText: 'Debes asistir a copas.',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('JUGAR CARTA'), findsOneWidget);
    final semantics = tester.ensureSemantics();
    expect(find.bySemanticsLabel(RegExp('Tu mano, 10 cartas')), findsOneWidget);
    semantics.dispose();
    expect(tester.takeException(), isNull);
  });

  testWidgets('renders table layouts for 3, 4, 5 and 6 players', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    for (final playerCount in [3, 4, 5, 6]) {
      final names = List.generate(
        playerCount,
        (index) => 'Jugador con nombre largo $index',
      );
      await tester.pumpWidget(
        host(
          SizedBox(
            height: 520,
            child: PochaGameTable(
              playerCount: playerCount,
              opponents: [
                for (var index = 1; index < playerCount; index++)
                  PochaPlayerSeat(
                    name: names[index],
                    avatarSeed: index,
                    bid: index,
                    tricksWon: index % 2,
                    score: index * 10,
                    isCurrent: index == 1,
                    isBot: true,
                  ),
              ],
              trick: TrickArea(
                cards: [
                  TrickCardView(playerName: names[1], card: cards[1]),
                  TrickCardView(playerName: names[2], card: cards[2]),
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
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('PIDIÓ'), findsWidgets);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('honours the three supported portrait widths', (tester) async {
    for (final size in [
      const Size(360, 800),
      const Size(390, 844),
      const Size(430, 932),
    ]) {
      await tester.binding.setSurfaceSize(size);
      await tester.pumpWidget(
        host(
          const PochaSurface(
            child: PochaErrorView(
              message: 'No se ha podido conectar.',
              onRetry: _noop,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('No se ha podido conectar.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
    await tester.binding.setSurfaceSize(null);
  });
}

void _noop() {}
