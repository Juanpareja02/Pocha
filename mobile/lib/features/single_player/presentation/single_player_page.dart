import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/haptics/haptics_service.dart';
import '../../../design_system/pocha_design_system.dart';
import '../application/single_player_controller.dart';
import '../data/single_player_repository.dart';
import '../domain/bot_strategy.dart';
import '../domain/local_game.dart';
import '../../game/domain/pocha_engine.dart';

class SinglePlayerPage extends ConsumerStatefulWidget {
  const SinglePlayerPage({super.key});

  @override
  ConsumerState<SinglePlayerPage> createState() => _SinglePlayerPageState();
}

class _SinglePlayerPageState extends ConsumerState<SinglePlayerPage>
    with WidgetsBindingObserver {
  int _playerCount = 4;
  BotDifficulty _difficulty = BotDifficulty.normal;
  AnimationSpeed _speed = AnimationSpeed.normal;
  GameRulesPreset _rulesPreset = GameRulesPreset.classic;
  bool _customMustOvertrump = false;
  bool _customAllowNoTrump = false;
  bool _hapticsEnabled = true;
  PochaCard? _selectedCard;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future<void>.microtask(
      () => ref.read(singlePlayerControllerProvider).restore(),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      final controller = ref.read(singlePlayerControllerProvider);
      if (controller.state != null && !controller.paused) {
        controller.pause();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<SinglePlayerGameController>(singlePlayerControllerProvider, (
      previous,
      next,
    ) {
      final previousPhase = previous?.state?.phase;
      if (next.state?.phase == LocalGamePhase.trickResults &&
          previousPhase != LocalGamePhase.trickResults &&
          next.hapticsEnabled) {
        hapticsService.trickWon(enabled: next.hapticsEnabled);
      }
      if (previous?.errorMessage == null &&
          next.errorMessage != null &&
          next.hapticsEnabled) {
        hapticsService.invalidAction(enabled: next.hapticsEnabled);
      }
    });
    final controller = ref.watch(singlePlayerControllerProvider);
    if (!controller.ready || controller.loading) {
      return const Scaffold(
        body: PochaLoadingState(label: 'Cargando partida local'),
      );
    }
    final state = controller.state;
    if (state == null) return _buildSetup(context, controller);
    if (controller.resumeRequired) {
      return _buildResume(context, controller, state);
    }
    if (state.phase == LocalGamePhase.roundResults) {
      return _buildRoundResults(context, controller, state);
    }
    if (state.phase == LocalGamePhase.gameResults ||
        state.phase == LocalGamePhase.finished) {
      return _buildGameResults(context, controller, state);
    }
    return _buildTable(context, controller, state);
  }

  Widget _buildSetup(
    BuildContext context,
    SinglePlayerGameController controller,
  ) {
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/')),
        title: const Text('1 Jugador'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          PochaSpacing.lg,
          PochaSpacing.sm,
          PochaSpacing.lg,
          PochaSpacing.xxl,
        ),
        children: [
          const PochaEyebrow('Entrenamiento offline'),
          const SizedBox(height: PochaSpacing.xs),
          Text(
            'Entrena en la mesa',
            style: Theme.of(context).textTheme.displayMedium,
          ),
          const SizedBox(height: PochaSpacing.sm),
          Text(
            'Juega una partida completa contra rivales que solo usan la información pública.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: PochaSpacing.md),
          const PochaOfflineBanner(
            message:
                'Sin conexión necesaria. Tu progreso se guarda en este dispositivo.',
          ),
          const SizedBox(height: PochaSpacing.lg),
          DropdownButtonFormField<int>(
            initialValue: _playerCount,
            decoration: const InputDecoration(
              labelText: 'Número de jugadores',
              border: OutlineInputBorder(),
            ),
            items: [3, 4, 5, 6]
                .map(
                  (value) => DropdownMenuItem(
                    value: value,
                    child: Text('$value jugadores'),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => _playerCount = value ?? 4),
          ),
          const SizedBox(height: PochaSpacing.sm),
          DropdownButtonFormField<BotDifficulty>(
            initialValue: _difficulty,
            decoration: const InputDecoration(
              labelText: 'Dificultad de los bots',
              border: OutlineInputBorder(),
            ),
            items: BotDifficulty.values
                .map(
                  (value) => DropdownMenuItem(
                    value: value,
                    child: Text(_difficultyLabel(value)),
                  ),
                )
                .toList(),
            onChanged: (value) =>
                setState(() => _difficulty = value ?? BotDifficulty.normal),
          ),
          const SizedBox(height: PochaSpacing.sm),
          DropdownButtonFormField<AnimationSpeed>(
            initialValue: _speed,
            decoration: const InputDecoration(
              labelText: 'Velocidad de animaciones',
              border: OutlineInputBorder(),
            ),
            items: AnimationSpeed.values
                .map(
                  (value) => DropdownMenuItem(
                    value: value,
                    child: Text(_speedLabel(value)),
                  ),
                )
                .toList(),
            onChanged: (value) =>
                setState(() => _speed = value ?? AnimationSpeed.normal),
          ),
          const SizedBox(height: PochaSpacing.sm),
          DropdownButtonFormField<GameRulesPreset>(
            initialValue: _rulesPreset,
            decoration: const InputDecoration(
              labelText: 'Reglas',
              border: OutlineInputBorder(),
            ),
            items: GameRulesPreset.values
                .map(
                  (value) => DropdownMenuItem(
                    value: value,
                    child: Text(_rulesPresetLabel(value)),
                  ),
                )
                .toList(),
            onChanged: (value) =>
                setState(() => _rulesPreset = value ?? GameRulesPreset.classic),
          ),
          if (_rulesPreset == GameRulesPreset.custom) ...[
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              title: const Text('Obligar a montar triunfo'),
              value: _customMustOvertrump,
              onChanged: (value) =>
                  setState(() => _customMustOvertrump = value),
            ),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              title: const Text('Permitir jugar sin triunfo'),
              value: _customAllowNoTrump,
              onChanged: (value) => setState(() => _customAllowNoTrump = value),
            ),
          ],
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('Vibración háptica'),
            value: _hapticsEnabled,
            onChanged: (value) => setState(() => _hapticsEnabled = value),
          ),
          const SizedBox(height: 14),
          PochaSurface(
            color: Theme.of(context).colorScheme.secondaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(PochaSpacing.md),
              child: Text(_rulesDescription(_rulesPreset)),
            ),
          ),
          if (controller.errorMessage != null)
            _ErrorBanner(
              message: controller.errorMessage!,
              onRetry: controller.retry,
              onExit: () async {
                await controller.abandon();
                if (context.mounted) context.go('/');
              },
            ),
          if (controller.stats.gamesPlayed > 0)
            PochaSurface(
              child: ListTile(
                title: const Text('Estadísticas offline'),
                subtitle: Text(
                  '${controller.stats.gamesPlayed} partidas · '
                  '${controller.stats.wins} victorias · '
                  '${controller.stats.podiums} podios · '
                  'posición media ${controller.stats.averagePosition.toStringAsFixed(1)} · '
                  '${(controller.stats.predictionAccuracy * 100).toStringAsFixed(0)}% de aciertos · '
                  'mejor puntuación ${controller.stats.bestScore ?? 0}',
                ),
              ),
            ),
          const SizedBox(height: PochaSpacing.sm),
          PochaPrimaryButton(
            label: 'Empezar partida',
            icon: Icons.play_arrow,
            onPressed: () => controller.start(
              playerCount: _playerCount,
              selectedDifficulty: _difficulty,
              selectedSpeed: _speed,
              selectedRulesPreset: _rulesPreset,
              customMustOvertrump: _customMustOvertrump,
              customAllowNoTrump: _customAllowNoTrump,
              selectedHapticsEnabled: _hapticsEnabled,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResume(
    BuildContext context,
    SinglePlayerGameController controller,
    LocalGameState state,
  ) => Scaffold(
    appBar: AppBar(title: const Text('Continuar partida')),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(PochaSpacing.lg),
        child: PochaSurface(
          child: Padding(
            padding: const EdgeInsets.all(PochaSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.restore, size: 48),
                const SizedBox(height: 12),
                const Text(
                  'Tienes una partida guardada',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Ronda ${state.roundIndex + 1} · ${state.players.length} jugadores · '
                  '${state.rules.id}',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 18),
                PochaPrimaryButton(
                  label: 'CONTINUAR PARTIDA',
                  icon: Icons.play_arrow,
                  onPressed: controller.resume,
                ),
                PochaTextButton(
                  label: 'SALIR DE LA PARTIDA',
                  onPressed: controller.abandon,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );

  Widget _buildTable(
    BuildContext context,
    SinglePlayerGameController controller,
    LocalGameState state,
  ) {
    final legalIds = controller.legalHumanCards.map((card) => card.id).toSet();
    final human = state.players.firstWhere((player) => player.human);
    final opponents = state.players.where((player) => !player.human).toList();
    final firstIllegal = human.hand.cast<PochaCard?>().firstWhere(
      (card) => card != null && !legalIds.contains(card.id),
      orElse: () => null,
    );
    final illegalExplanation = firstIllegal == null
        ? null
        : LocalGameEngine.legalCardExplanation(
            state,
            human.id,
            firstIllegal.id,
          );
    final trickCards = [
      for (final played in state.currentTrick)
        TrickCardView(
          playerName: state.players
              .firstWhere((player) => player.id == played.playerId)
              .name,
          card: played.card,
        ),
    ];
    final winnerName = state.lastTrickWinnerId == null
        ? null
        : state.players
              .firstWhere((player) => player.id == state.lastTrickWinnerId)
              .name;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Ronda ${state.roundIndex + 1}/${state.rules.roundSequence.length}',
        ),
        actions: [
          IconButton(
            onPressed: () => _showPause(context, controller),
            icon: const Icon(Icons.pause_circle_outline),
            tooltip: 'Pausa',
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              PochaSpacing.sm,
              PochaSpacing.xs,
              PochaSpacing.sm,
              PochaSpacing.md,
            ),
            child: Column(
              children: [
                _GameHeader(state: state),
                SizedBox(
                  height: state.players.length >= 5 ? 420 : 380,
                  child: PochaGameTable(
                    playerCount: state.players.length,
                    opponents: [
                      for (final player in opponents)
                        PochaPlayerSeat(
                          name: player.name,
                          avatarSeed: player.avatarSeed,
                          bid: player.bid,
                          tricksWon: player.tricksWon,
                          score: player.score,
                          isCurrent: state.currentPlayer.id == player.id,
                          isBot: true,
                        ),
                    ],
                    trick: TrickArea(
                      cards: trickCards,
                      winnerName: state.phase == LocalGamePhase.trickResults
                          ? winnerName
                          : null,
                      emptyLabel: 'La baza aparecerá aquí',
                    ),
                    localSeat: PochaPlayerSeat(
                      name: human.name,
                      avatarSeed: human.avatarSeed,
                      bid: human.bid,
                      tricksWon: human.tricksWon,
                      score: human.score,
                      isCurrent: state.currentPlayer.id == human.id,
                    ),
                  ),
                ),
                if (controller.errorMessage != null)
                  _ErrorBanner(
                    message: controller.errorMessage!,
                    onRetry: controller.retry,
                    onExit: () async {
                      await controller.abandon();
                      if (context.mounted) context.go('/');
                    },
                  ),
                if (state.phase == LocalGamePhase.bidding &&
                    controller.humanTurn)
                  BidSheet(
                    cardsPerRound: state.cardsPerRound,
                    legalBids: controller.legalHumanBids,
                    restrictionMessage: controller.humanBidRestrictionMessage,
                    illegalExplanation: controller.humanBidExplanation,
                    onBid: controller.submitBid,
                  ),
                if (state.phase == LocalGamePhase.choosingTrump &&
                    controller.humanTurn)
                  TrumpSheet(
                    allowNoTrump: state.rules.allowNoTrump,
                    onTrump: controller.chooseTrump,
                  ),
                if (state.phase == LocalGamePhase.playingTrick &&
                    controller.humanTurn)
                  PlayerHand(
                    cards: human.hand,
                    legalCardIds: legalIds,
                    selectedCard: _selectedCard,
                    helperText:
                        illegalExplanation ??
                        'Toca una carta para seleccionarla.',
                    onCardTap: _selectCard,
                    onPlaySelected: () => _playSelected(controller),
                  ),
                if (!controller.humanTurn &&
                    state.phase != LocalGamePhase.bidding &&
                    state.phase != LocalGamePhase.trickResults)
                  const PochaLoadingState(label: 'El rival está pensando'),
                if (controller.thinking)
                  const Padding(
                    padding: EdgeInsets.only(top: PochaSpacing.xs),
                    child: Text('Pensando…', textAlign: TextAlign.center),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoundResults(
    BuildContext context,
    SinglePlayerGameController controller,
    LocalGameState state,
  ) {
    return Scaffold(
      appBar: AppBar(title: const Text('Resumen de ronda')),
      body: ListView(
        cacheExtent: 1200,
        padding: const EdgeInsets.fromLTRB(
          PochaSpacing.lg,
          PochaSpacing.sm,
          PochaSpacing.lg,
          PochaSpacing.xxl,
        ),
        children: [
          const PochaEyebrow('Resultado de la ronda'),
          const SizedBox(height: PochaSpacing.xs),
          Text(
            'Ronda ${state.roundIndex + 1}',
            style: Theme.of(context).textTheme.displayMedium,
          ),
          const SizedBox(height: PochaSpacing.lg),
          PochaSurface(
            child: Column(
              children: state.players.map((player) {
                final roundScore = state.lastRoundScores[player.id] ?? 0;
                return ListTile(
                  title: Text(player.name),
                  subtitle: Text(
                    'Cantó ${player.bid ?? 0} · Hizo ${player.tricksWon}',
                  ),
                  trailing: Text(
                    '${roundScore >= 0 ? '+' : ''}$roundScore  ·  ${player.score}',
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: PochaSpacing.lg),
          PochaPrimaryButton(
            label: state.nextRoundCards == null
                ? 'Ver clasificación'
                : 'Siguiente ronda',
            icon: Icons.arrow_forward,
            onPressed: () => controller.continueAfterRound(),
          ),
        ],
      ),
    );
  }

  Widget _buildGameResults(
    BuildContext context,
    SinglePlayerGameController controller,
    LocalGameState state,
  ) {
    final ordered = [...state.players]
      ..sort((left, right) => right.score.compareTo(left.score));
    final human = state.players.firstWhere((player) => player.human);
    return Scaffold(
      appBar: AppBar(title: const Text('Partida terminada')),
      body: ListView(
        cacheExtent: 1200,
        padding: const EdgeInsets.fromLTRB(
          PochaSpacing.lg,
          PochaSpacing.sm,
          PochaSpacing.lg,
          PochaSpacing.xxl,
        ),
        children: [
          const PochaEyebrow('Resultado final'),
          const SizedBox(height: PochaSpacing.xs),
          Text(
            'Clasificación final',
            style: Theme.of(context).textTheme.displayMedium,
          ),
          const SizedBox(height: PochaSpacing.lg),
          PochaPrimaryButton(
            label: 'Jugar de nuevo',
            icon: Icons.replay,
            onPressed: () async {
              await controller.finish();
              if (mounted) setState(() {});
            },
          ),
          const SizedBox(height: PochaSpacing.sm),
          ...List.generate(
            ordered.length,
            (index) => PochaSurface(
              child: ListTile(
                leading: Text(
                  index == 0
                      ? '🥇'
                      : index == 1
                      ? '🥈'
                      : index == 2
                      ? '🥉'
                      : '${index + 1}º',
                  style: const TextStyle(fontSize: 24),
                ),
                title: Text(ordered[index].name),
                subtitle: Text(
                  ordered[index].human
                      ? 'Tú'
                      : 'Bot · ${_difficultyLabel(controller.difficulty)}',
                ),
                trailing: Text(
                  '${ordered[index].score} pts',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ),
          const SizedBox(height: PochaSpacing.sm),
          PochaSurface(
            child: ListTile(
              title: const Text('Tus estadísticas'),
              subtitle: Text(
                'Puntuación: ${human.score} · '
                'Predicciones acertadas: ${state.humanPredictionsHit}/${state.humanPredictions} · '
                '(${state.humanPredictions == 0 ? 0 : (state.humanPredictionsHit * 100 / state.humanPredictions).toStringAsFixed(0)}%) · '
                'Bazas: ${state.humanPredictedTricks} anunciadas / '
                '${state.humanWonTricks} hechas\n'
                'Mejor ronda: ${state.humanBestRoundScore ?? 0} · '
                'Peor ronda: ${state.humanWorstRoundScore ?? 0}',
              ),
            ),
          ),
          PochaTextButton(
            label: 'VOLVER AL INICIO',
            onPressed: () => context.go('/'),
          ),
        ],
      ),
    );
  }

  void _selectCard(PochaCard card) {
    if (ref.read(singlePlayerControllerProvider).hapticsEnabled) {
      hapticsService.cardSelected(enabled: true);
    }
    setState(() => _selectedCard = _selectedCard?.id == card.id ? null : card);
  }

  Future<void> _playSelected(SinglePlayerGameController controller) async {
    final card = _selectedCard;
    if (card == null) return;
    hapticsService.cardPlayed(enabled: controller.hapticsEnabled);
    setState(() => _selectedCard = null);
    await controller.playCard(card);
  }

  Future<void> _showPause(
    BuildContext context,
    SinglePlayerGameController controller,
  ) async {
    await controller.pause();
    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Partida pausada',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () {
                  Navigator.pop(context);
                  controller.resume();
                },
                child: const Text('Continuar'),
              ),
              OutlinedButton(
                onPressed: () {
                  Navigator.pop(context);
                  controller.restart();
                },
                child: const Text('Reiniciar'),
              ),
              OutlinedButton(
                onPressed: () {
                  Navigator.pop(context);
                  controller.abandon();
                },
                child: const Text('Salir de la partida'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GameHeader extends StatelessWidget {
  const _GameHeader({required this.state});

  final LocalGameState state;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        alignment: WrapAlignment.center,
        children: [
          Chip(label: Text('Ronda ${state.roundIndex + 1}')),
          Chip(label: Text('${state.cardsPerRound} cartas')),
          Chip(
            label: Text(
              'Puntuación: ${state.players.firstWhere((player) => player.human).score}',
            ),
          ),
          Chip(
            label: Text('Repartidor: ${state.players[state.dealerIndex].name}'),
          ),
          Chip(label: Text('Triunfo: ${_suitLabel(state.trump)}')),
          Chip(label: Text('Turno: ${state.currentPlayer.name}')),
          Chip(label: Text('Bazas: ${state.tricksCompleted}')),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, this.onRetry, this.onExit});

  final String message;
  final Future<void> Function()? onRetry;
  final Future<void> Function()? onExit;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: PochaSpacing.sm),
    child: PochaErrorView(
      message: message,
      onRetry: onRetry == null ? null : () => onRetry!(),
      onBack: onExit == null ? null : () => onExit!(),
    ),
  );
}

String _difficultyLabel(BotDifficulty difficulty) => switch (difficulty) {
  BotDifficulty.easy => 'Fácil',
  BotDifficulty.normal => 'Normal',
  BotDifficulty.hard => 'Difícil',
};
String _rulesPresetLabel(GameRulesPreset preset) => switch (preset) {
  GameRulesPreset.classic => 'Pocha clásica',
  GameRulesPreset.auction => 'Subasta',
  GameRulesPreset.custom => 'Personalizada',
};
String _rulesDescription(GameRulesPreset preset) => switch (preset) {
  GameRulesPreset.classic =>
    'Pocha clásica · 40 cartas · triunfo revelado · seguir palo de salida',
  GameRulesPreset.auction =>
    'Subasta · el ganador de la puja elige triunfo · seguir palo de salida',
  GameRulesPreset.custom =>
    'Personalizada · 40 cartas · opciones de montaje y sin triunfo',
};
String _speedLabel(AnimationSpeed speed) => switch (speed) {
  AnimationSpeed.normal => 'Normal',
  AnimationSpeed.fast => 'Rápida',
  AnimationSpeed.instant => 'Instantánea',
};
String _suitLabel(Suit? suit) => switch (suit) {
  null => 'Sin triunfo',
  Suit.oros => 'Oros',
  Suit.copas => 'Copas',
  Suit.espadas => 'Espadas',
  Suit.bastos => 'Bastos',
};
