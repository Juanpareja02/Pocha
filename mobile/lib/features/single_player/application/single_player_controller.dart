import 'package:flutter/foundation.dart';

import '../../../core/observability/analytics.dart';
import 'package:flutter_riverpod/legacy.dart' as legacy;

import '../data/single_player_repository.dart';
import '../domain/bot_strategy.dart';
import '../domain/local_game.dart';
import '../domain/game_session_port.dart';
import '../../game/domain/pocha_engine.dart';

final singlePlayerControllerProvider =
    legacy.ChangeNotifierProvider<SinglePlayerGameController>((ref) {
      final controller = SinglePlayerGameController();
      return controller;
    });

class SinglePlayerGameController extends ChangeNotifier
    implements GameSessionPort<LocalGameState> {
  final SinglePlayerRepository _repository = SinglePlayerRepository();
  @override
  LocalGameState? state;
  BotDifficulty difficulty = BotDifficulty.normal;
  AnimationSpeed speed = AnimationSpeed.normal;
  GameRulesPreset rulesPreset = GameRulesPreset.classic;
  bool hapticsEnabled = true;
  bool loading = false;
  bool thinking = false;
  bool paused = false;
  bool autoplay = false;
  bool resumeRequired = false;
  String? errorMessage;
  SinglePlayerStats stats = const SinglePlayerStats();
  List<BotStrategy> _strategies = const [];
  bool _restored = false;
  int _playerCount = 4;
  bool _customMustOvertrump = false;
  bool _customAllowNoTrump = false;

  bool get ready => _restored && !loading;
  @override
  bool get humanTurn => state != null && state!.currentPlayer.human;
  List<PochaCard> get legalHumanCards => state == null || !humanTurn
      ? const []
      : LocalGameEngine.legalCards(state!, state!.currentPlayer.id);
  List<int> get legalHumanBids => state == null || !humanTurn
      ? const []
      : LocalGameEngine.legalBids(state!);

  String? get humanBidRestrictionMessage {
    final current = state;
    if (current == null ||
        current.players.where((player) => player.bid != null).length !=
            current.players.length - 1) {
      return null;
    }
    return 'El último jugador no puede hacer coincidir la suma con las '
        '${current.cardsPerRound} bazas.';
  }

  String? get humanBidExplanation {
    final current = state;
    if (current == null || legalHumanBids.length >= current.cardsPerRound + 1) {
      return null;
    }
    for (var value = 0; value <= current.cardsPerRound; value++) {
      if (!legalHumanBids.contains(value)) {
        return LocalGameEngine.bidExplanation(current, value);
      }
    }
    return null;
  }

  Future<void> restore() async {
    if (_restored) return;
    loading = true;
    notifyListeners();
    try {
      final saved = await _repository.load();
      stats = await _repository.loadStats();
      if (saved != null && saved.state.phase != LocalGamePhase.finished) {
        state = saved.state;
        paused = true;
        resumeRequired = true;
        _playerCount = saved.state.players.length;
        _customMustOvertrump = saved.state.rules.mustOvertrump;
        _customAllowNoTrump = saved.state.rules.allowNoTrump;
        difficulty = saved.difficulty;
        speed = saved.speed;
        hapticsEnabled = saved.hapticsEnabled;
        rulesPreset = switch (saved.state.rules.id) {
          'auction' => GameRulesPreset.auction,
          'custom' => GameRulesPreset.custom,
          _ => GameRulesPreset.classic,
        };
        _strategies = _createStrategies(state!.players.length - 1);
      }
      _restored = true;
      errorMessage = null;
    } catch (error) {
      errorMessage = 'No se ha podido recuperar la partida guardada.';
      _restored = true;
    } finally {
      loading = false;
      notifyListeners();
    }
    if (state != null && !paused) await advanceBots();
  }

  Future<void> start({
    required int playerCount,
    required BotDifficulty selectedDifficulty,
    required AnimationSpeed selectedSpeed,
    GameRulesPreset selectedRulesPreset = GameRulesPreset.classic,
    bool customMustOvertrump = false,
    bool customAllowNoTrump = false,
    bool selectedHapticsEnabled = true,
  }) async {
    loading = true;
    notifyListeners();
    paused = false;
    resumeRequired = false;
    autoplay = false;
    difficulty = selectedDifficulty;
    speed = selectedSpeed;
    rulesPreset = selectedRulesPreset;
    hapticsEnabled = selectedHapticsEnabled;
    _playerCount = playerCount;
    _customMustOvertrump = customMustOvertrump;
    _customAllowNoTrump = customAllowNoTrump;
    final seed = DateTime.now().microsecondsSinceEpoch & 0xFFFFFFFF;
    final nameRandom = LocalRandom(seed);
    final names = _shuffledNames(nameRandom);
    final players = <LocalPlayer>[
      LocalPlayer(
        id: 'human',
        name: 'Juan',
        human: true,
        avatarSeed: nameRandom.nextInt(0x7FFFFFFF),
      ),
    ];
    for (var index = 0; index < playerCount - 1; index++) {
      players.add(
        LocalPlayer(
          id: 'bot-$index',
          name: names[index],
          human: false,
          avatarSeed: nameRandom.nextInt(0x7FFFFFFF),
        ),
      );
    }
    state = LocalGameEngine.create(
      gameId: 'local-${DateTime.now().microsecondsSinceEpoch}',
      players: players,
      rules: _rulesFor(
        playerCount,
        selectedRulesPreset,
        customMustOvertrump: customMustOvertrump,
        customAllowNoTrump: customAllowNoTrump,
      ),
      seed: seed,
    );
    state!.decisionRandomStates = {
      for (var index = 0; index < players.length; index++)
        players[index].id: _decisionSeed(seed, index),
    };
    _strategies = _createStrategies(playerCount - 1);
    LocalGameEngine.startRound(state!);
    await _persist();
    analyticsClient.track(
      AnalyticsEvent.singleGameStarted,
      properties: {
        'player_count': players.length,
        'difficulty': selectedDifficulty.name,
        'ruleset': selectedRulesPreset.name,
      },
    );
    loading = false;
    errorMessage = null;
    notifyListeners();
    await advanceBots();
  }

  @override
  Future<void> submitBid(int bid) async {
    await _runHumanAction(
      () => LocalGameEngine.submitBid(state!, 'human', bid),
    );
  }

  @override
  Future<void> chooseTrump(Suit? trump) async {
    await _runHumanAction(
      () => LocalGameEngine.chooseTrump(state!, 'human', trump),
    );
  }

  @override
  Future<void> playCard(PochaCard card) async {
    await _runHumanAction(
      () => LocalGameEngine.playCard(state!, 'human', card.id),
    );
  }

  Future<void> continueAfterRound() async {
    if (state?.phase != LocalGamePhase.roundResults) return;
    LocalGameEngine.startNextRound(state!);
    await _persistAndAdvance();
  }

  Future<void> finish() async {
    if (state?.phase != LocalGamePhase.gameResults) return;
    final completed = state!;
    final ordered = [...completed.players]
      ..sort((left, right) => right.score.compareTo(left.score));
    final human = completed.players.firstWhere((player) => player.human);
    stats = await _repository.recordGame(
      position: ordered.indexWhere((player) => player.human) + 1,
      score: human.score,
      predictions: completed.humanPredictions,
      predictionsHit: completed.humanPredictionsHit,
    );
    analyticsClient.track(
      AnalyticsEvent.singleGameFinished,
      properties: {
        'position': ordered.indexWhere((player) => player.human) + 1,
        'score': human.score,
      },
    );
    LocalGameEngine.finish(completed);
    await _repository.clear();
    state = null;
    autoplay = false;
    notifyListeners();
  }

  @override
  Future<void> pause() async {
    paused = true;
    await _persist();
    notifyListeners();
  }

  @override
  Future<void> resume() async {
    paused = false;
    resumeRequired = false;
    notifyListeners();
    await advanceBots();
  }

  Future<void> restart() async {
    final playerCount = _playerCount;
    final selectedDifficulty = difficulty;
    final selectedSpeed = speed;
    final selectedRulesPreset = rulesPreset;
    final customMustOvertrump = _customMustOvertrump;
    final customAllowNoTrump = _customAllowNoTrump;
    final selectedHapticsEnabled = hapticsEnabled;
    await abandon();
    await start(
      playerCount: playerCount,
      selectedDifficulty: selectedDifficulty,
      selectedSpeed: selectedSpeed,
      selectedRulesPreset: selectedRulesPreset,
      customMustOvertrump: customMustOvertrump,
      customAllowNoTrump: customAllowNoTrump,
      selectedHapticsEnabled: selectedHapticsEnabled,
    );
  }

  @override
  Future<void> abandon() async {
    paused = true;
    state = null;
    autoplay = false;
    resumeRequired = false;
    errorMessage = null;
    await _repository.clear();
    notifyListeners();
  }

  Future<void> advanceBots({bool includeHuman = false}) async {
    while (state != null &&
        !paused &&
        (state!.phase == LocalGamePhase.trickResults ||
            includeHuman ||
            !humanTurn) &&
        state!.phase != LocalGamePhase.roundResults &&
        state!.phase != LocalGamePhase.gameResults &&
        state!.phase != LocalGamePhase.finished) {
      try {
        if (state!.phase == LocalGamePhase.trickResults) {
          await _waitForAnimation();
          if (paused || state == null) break;
          LocalGameEngine.continueAfterTrick(state!);
          await _persist();
          notifyListeners();
          continue;
        }

        final game = state!;
        final player = game.currentPlayer;
        final botIndex = game.players
            .where((candidate) => !candidate.human)
            .toList()
            .indexWhere((candidate) => candidate.id == player.id);
        final strategy = player.human
            ? const NormalBotStrategy()
            : botIndex < 0
            ? null
            : _strategies[botIndex];
        if (strategy == null) break;
        await _waitForAnimation();
        if (paused || state == null) break;
        thinking = true;
        notifyListeners();
        await Future<void>.delayed(Duration.zero);
        final random = LocalRandom(
          state!.decisionRandomStates[player.id] ?? state!.randomState,
        );
        final view = BotPlayerView(playerId: player.id, state: state!);
        if (state!.phase == LocalGamePhase.bidding) {
          final bid = strategy.chooseBid(view, random);
          state!.decisionRandomStates[player.id] = random.state;
          LocalGameEngine.submitBid(state!, player.id, bid);
        } else if (state!.phase == LocalGamePhase.choosingTrump) {
          final trump = strategy.chooseTrump(view, random);
          state!.decisionRandomStates[player.id] = random.state;
          LocalGameEngine.chooseTrump(state!, player.id, trump);
        } else if (state!.phase == LocalGamePhase.playingTrick) {
          if (strategy is HardBotStrategy) {
            final decision = await compute(_hardCardDecision, {
              'state': view.state.toJson(),
              'playerId': player.id,
              'randomState': random.state,
              'maxSimulations': strategy.maxSimulations,
              'maxActionsPerRollout': strategy.maxActionsPerRollout,
            });
            state!.decisionRandomStates[player.id] =
                decision['randomState'] as int;
            LocalGameEngine.playCard(
              state!,
              player.id,
              decision['cardId'] as String,
            );
          } else {
            final card = strategy.chooseCard(view, random);
            state!.decisionRandomStates[player.id] = random.state;
            LocalGameEngine.playCard(state!, player.id, card.id);
          }
        } else {
          thinking = false;
          break;
        }
        thinking = false;
        await _persist();
        notifyListeners();
      } catch (error) {
        thinking = false;
        errorMessage = 'Se ha producido un error en la partida.';
        paused = true;
        await _persist();
        notifyListeners();
        break;
      }
    }
  }

  Future<void> runAutoplay() async {
    if (state == null) return;
    autoplay = true;
    paused = false;
    errorMessage = null;
    while (state != null && !paused) {
      if (state!.phase == LocalGamePhase.roundResults) {
        LocalGameEngine.startNextRound(state!);
        await _persist();
        notifyListeners();
        continue;
      }
      if (state!.phase == LocalGamePhase.gameResults) {
        await finish();
        break;
      }
      await advanceBots(includeHuman: true);
      if (state == null || state!.phase == LocalGamePhase.finished) break;
      if (state!.phase == LocalGamePhase.roundResults ||
          state!.phase == LocalGamePhase.gameResults) {
        continue;
      }
      if (paused) break;
    }
  }

  Future<void> retry() async {
    if (state == null) return;
    errorMessage = null;
    paused = false;
    notifyListeners();
    await advanceBots(includeHuman: autoplay);
  }

  List<BotStrategy> _createStrategies(int count) => List<BotStrategy>.generate(
    count,
    (_) => switch (difficulty) {
      BotDifficulty.easy => const EasyBotStrategy(),
      BotDifficulty.normal => const NormalBotStrategy(),
      BotDifficulty.hard => const HardBotStrategy(maxSimulations: 12),
    },
  );

  Future<void> _runHumanAction(void Function() action) async {
    if (state == null || paused || !humanTurn) return;
    try {
      action();
      errorMessage = null;
      await _persistAndAdvance();
    } catch (error) {
      errorMessage = 'Esta acción no es válida.';
      notifyListeners();
    }
  }

  Future<void> _persistAndAdvance() async {
    await _persist();
    notifyListeners();
    await advanceBots();
  }

  Future<void> _persist() async {
    if (state != null && state!.phase != LocalGamePhase.finished) {
      await _repository.save(
        state!,
        difficulty,
        speed,
        hapticsEnabled: hapticsEnabled,
      );
    }
  }

  GameRules _rulesFor(
    int playerCount,
    GameRulesPreset preset, {
    required bool customMustOvertrump,
    required bool customAllowNoTrump,
  }) => switch (preset) {
    GameRulesPreset.classic => GameRules.classic(playerCount: playerCount),
    GameRulesPreset.auction => GameRules.auction(playerCount: playerCount),
    GameRulesPreset.custom => GameRules.custom(
      playerCount: playerCount,
      mustOvertrump: customMustOvertrump,
      allowNoTrump: customAllowNoTrump,
    ),
  };

  List<String> _shuffledNames(LocalRandom random) {
    final names = [
      'Ana',
      'Carlos',
      'María',
      'Pablo',
      'Lucía',
      'Javi',
      'Laura',
      'Álvaro',
      'Carmen',
      'Diego',
      'Sofía',
      'Miguel',
    ];
    for (var index = names.length - 1; index > 0; index--) {
      final swap = random.nextInt(index + 1);
      final name = names[index];
      names[index] = names[swap];
      names[swap] = name;
    }
    return names;
  }

  int _decisionSeed(int seed, int seat) =>
      (seed ^ ((seat + 1) * 0x9E3779B9)) & 0xFFFFFFFF;

  Future<void> _waitForAnimation() async {
    final milliseconds = switch (speed) {
      AnimationSpeed.normal => 220,
      AnimationSpeed.fast => 45,
      AnimationSpeed.instant => 0,
    };
    if (milliseconds > 0) {
      await Future<void>.delayed(Duration(milliseconds: milliseconds));
    }
  }
}

Map<String, dynamic> _hardCardDecision(Map<String, dynamic> payload) {
  final state = LocalGameState.fromJson(
    Map<String, dynamic>.from(payload['state'] as Map),
  );
  final random = LocalRandom(payload['randomState'] as int);
  final strategy = HardBotStrategy(
    maxSimulations: payload['maxSimulations'] as int,
    maxActionsPerRollout: payload['maxActionsPerRollout'] as int,
  );
  final playerId = payload['playerId'] as String;
  final card = strategy.chooseCard(
    BotPlayerView(playerId: playerId, state: state),
    random,
  );
  return {'cardId': card.id, 'randomState': random.state};
}
