import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/game/domain/pocha_engine.dart';
import 'package:mobile/features/single_player/domain/bot_strategy.dart';
import 'package:mobile/features/single_player/domain/local_game.dart';

void main() {
  test(
    'all difficulties choose only legal bids and cards from public views',
    () {
      final players = List<LocalPlayer>.generate(
        4,
        (index) =>
            LocalPlayer(id: 'p$index', name: 'Jugador $index', human: false),
      );
      final state = LocalGameEngine.create(
        gameId: 'bot-test',
        players: players,
        rules: GameRules(
          id: 'bot-test',
          version: 1,
          playerCount: 4,
          roundSequence: const [2],
        ),
        seed: 99,
      );
      LocalGameEngine.startRound(state);
      final strategies = <BotStrategy>[
        const EasyBotStrategy(),
        const NormalBotStrategy(),
        const HardBotStrategy(maxSimulations: 8),
      ];
      expect(BotPlayerView(playerId: 'p0', state: state).state.randomState, 0);
      expect(
        BotPlayerView(playerId: 'p0', state: state).state.decisionRandomStates,
        isEmpty,
      );

      for (var index = 0; index < 3; index++) {
        final player = state.currentPlayer;
        final view = BotPlayerView(playerId: player.id, state: state);
        final random = LocalRandom(state.randomState);
        final bid = strategies[index].chooseBid(view, random);
        expect(LocalGameEngine.legalBids(state), contains(bid));
        state.randomState = random.state;
        LocalGameEngine.submitBid(state, player.id, bid);
      }
      final last = state.currentPlayer;
      final lastView = BotPlayerView(playerId: last.id, state: state);
      final lastRandom = LocalRandom(state.randomState);
      final lastBid = const NormalBotStrategy().chooseBid(lastView, lastRandom);
      expect(LocalGameEngine.legalBids(state), contains(lastBid));
      state.randomState = lastRandom.state;
      LocalGameEngine.submitBid(state, last.id, lastBid);

      while (state.phase == LocalGamePhase.playingTrick ||
          state.phase == LocalGamePhase.trickResults) {
        if (state.phase == LocalGamePhase.trickResults) {
          LocalGameEngine.continueAfterTrick(state);
          continue;
        }
        final player = state.currentPlayer;
        final strategy =
            strategies[state.currentPlayerIndex % strategies.length];
        final view = BotPlayerView(playerId: player.id, state: state);
        final legal = LocalGameEngine.legalCards(state, player.id);
        final random = LocalRandom(state.randomState);
        final card = strategy.chooseCard(view, random);
        expect(legal.map((candidate) => candidate.id), contains(card.id));
        state.randomState = random.state;
        LocalGameEngine.playCard(state, player.id, card.id);
      }
      expect(state.phase, LocalGamePhase.roundResults);
    },
  );
}
