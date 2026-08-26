import 'package:flutter/material.dart';

import '../../../core/observability/analytics.dart';
import '../../../design_system/pocha_design_system.dart';
import '../data/calculator_repository.dart';
import '../domain/calculator_game.dart';

class CalculatorPage extends StatefulWidget {
  const CalculatorPage({super.key});

  @override
  State<CalculatorPage> createState() => _CalculatorPageState();
}

enum _CalculatorScreen { home, setup, game, history, results }

class _CalculatorPageState extends State<CalculatorPage> {
  final _repository = CalculatorRepository();
  final _nameControllers = List.generate(
    6,
    (index) => TextEditingController(
      text: const ['Juan', 'Esther', 'Pablo', 'Laura', 'Ana', 'Carlos'][index],
    ),
  );
  _CalculatorScreen _screen = _CalculatorScreen.home;
  CalculatorGame? _activeGame;
  List<CalculatorGame> _history = const [];
  List<int?> _predictions = const [];
  List<int?> _tricks = const [];
  int _playerCount = 4;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _nameControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final active = await _repository.loadActive();
    final history = await _repository.loadHistory();
    if (!mounted) return;
    setState(() {
      _activeGame = active;
      _history = history;
      _loading = false;
    });
  }

  void _openNewGame() => setState(() {
    _error = null;
    _screen = _CalculatorScreen.setup;
  });

  void _startGame() {
    try {
      final game = CalculatorGame.start(
        _nameControllers
            .take(_playerCount)
            .map((controller) => controller.text)
            .toList(),
      );
      _openGame(game);
      analyticsClient.track(
        AnalyticsEvent.calculatorGameStarted,
        properties: {'player_count': game.players.length},
      );
    } on FormatException catch (error) {
      setState(() => _error = error.message);
    }
  }

  void _openGame(CalculatorGame game) {
    setState(() {
      _activeGame = game;
      _predictions = List<int?>.filled(game.players.length, null);
      _tricks = List<int?>.filled(game.players.length, null);
      _error = null;
      _screen = game.isFinished
          ? _CalculatorScreen.results
          : _CalculatorScreen.game;
    });
  }

  Future<void> _saveRound() async {
    final game = _activeGame!;
    try {
      if (_predictions.any((value) => value == null) ||
          _tricks.any((value) => value == null)) {
        throw const FormatException(
          'Introduce la predicción y las bazas de todos los jugadores',
        );
      }
      final updated = game.recordRound(
        predictions: _predictions.cast<int>(),
        tricks: _tricks.cast<int>(),
      );
      if (updated.isFinished) {
        await _repository.archive(updated);
        analyticsClient.track(
          AnalyticsEvent.calculatorGameFinished,
          properties: {'player_count': updated.players.length},
        );
      } else {
        await _repository.saveActive(updated);
      }
      if (!mounted) return;
      setState(() {
        _activeGame = updated;
        _history = [
          updated,
          ..._history.where((item) => item.id != updated.id),
        ];
        _predictions = List<int?>.filled(updated.players.length, null);
        _tricks = List<int?>.filled(updated.players.length, null);
        _error = null;
        _screen = updated.isFinished
            ? _CalculatorScreen.results
            : _CalculatorScreen.game;
      });
    } on FormatException catch (error) {
      setState(() => _error = error.message);
    }
  }

  Future<void> _undo() async {
    final game = _activeGame!;
    final updated = game.withoutLastRound();
    await _repository.saveActive(updated);
    if (!mounted) return;
    setState(() {
      _activeGame = updated;
      _predictions = List<int?>.filled(updated.players.length, null);
      _tricks = List<int?>.filled(updated.players.length, null);
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: PochaLoadingState(label: 'Cargando calculadora'),
      );
    }
    return switch (_screen) {
      _CalculatorScreen.home => _buildHome(context),
      _CalculatorScreen.setup => _buildSetup(context),
      _CalculatorScreen.game => _buildGame(context),
      _CalculatorScreen.history => _buildHistory(context),
      _CalculatorScreen.results => _buildResults(context),
    };
  }

  Widget _buildHome(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('La Calculadora')),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(
        PochaSpacing.lg,
        PochaSpacing.sm,
        PochaSpacing.lg,
        PochaSpacing.xxl,
      ),
      children: [
        const PochaEyebrow('La cuenta de la mesa'),
        const SizedBox(height: PochaSpacing.xs),
        Text(
          'Puntuación sin perder el ritmo',
          style: Theme.of(context).textTheme.displayMedium,
        ),
        const SizedBox(height: PochaSpacing.sm),
        Text(
          'Lleva una partida física completa con guardado automático y tabla por rondas.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: PochaSpacing.lg),
        PochaPrimaryButton(
          label: 'NUEVA PARTIDA',
          icon: Icons.add,
          onPressed: _openNewGame,
        ),
        const SizedBox(height: PochaSpacing.sm),
        PochaSecondaryButton(
          label: 'CONTINUAR PARTIDA',
          icon: Icons.play_arrow,
          onPressed: _activeGame == null ? null : () => _openGame(_activeGame!),
        ),
        const SizedBox(height: PochaSpacing.sm),
        PochaSecondaryButton(
          label: 'HISTORIAL',
          icon: Icons.history,
          onPressed: () async {
            await _load();
            if (mounted) setState(() => _screen = _CalculatorScreen.history);
          },
        ),
      ],
    ),
  );

  Widget _buildSetup(BuildContext context) => Scaffold(
    appBar: AppBar(
      leading: BackButton(
        onPressed: () => setState(() => _screen = _CalculatorScreen.home),
      ),
      title: const Text('Nueva partida'),
    ),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(
        PochaSpacing.lg,
        PochaSpacing.sm,
        PochaSpacing.lg,
        PochaSpacing.xxl,
      ),
      children: [
        const PochaEyebrow('Preparar la partida'),
        const SizedBox(height: PochaSpacing.xs),
        Text('Jugadores', style: Theme.of(context).textTheme.displayMedium),
        const SizedBox(height: PochaSpacing.sm),
        Text(
          'La secuencia clásica se adapta automáticamente a 3–6 jugadores.',
          style: Theme.of(context).textTheme.bodyLarge,
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
                (count) => DropdownMenuItem(
                  value: count,
                  child: Text('$count jugadores'),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() => _playerCount = value ?? 4),
        ),
        const SizedBox(height: PochaSpacing.md),
        ...List.generate(
          _playerCount,
          (index) => Padding(
            padding: const EdgeInsets.only(bottom: PochaSpacing.sm),
            child: TextField(
              controller: _nameControllers[index],
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(
                labelText: 'Jugador ${index + 1}',
                prefixIcon: const Icon(Icons.person_outline),
              ),
            ),
          ),
        ),
        if (_error != null) _ErrorText(message: _error!),
        PochaPrimaryButton(
          label: 'EMPEZAR PARTIDA',
          icon: Icons.check,
          onPressed: _startGame,
        ),
      ],
    ),
  );

  Widget _buildGame(BuildContext context) {
    final game = _activeGame!;
    final cards = game.nextRoundCards!;
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(
          onPressed: () => setState(() => _screen = _CalculatorScreen.home),
        ),
        title: Text(
          'Ronda ${game.rounds.length + 1} de ${game.roundSequence.length}',
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          PochaSurface(
            color: Theme.of(context).colorScheme.primaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(PochaSpacing.md),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '$cards cartas',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    'Total de bazas: $cards',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: PochaSpacing.md),
          _buildScoreTable(context, game),
          const SizedBox(height: PochaSpacing.lg),
          Text(
            'Resultado de la ronda',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          ...List.generate(
            game.players.length,
            (index) => _buildEntryRow(context, game, index, cards),
          ),
          if (_error != null) _ErrorText(message: _error!),
          const SizedBox(height: 8),
          PochaPrimaryButton(
            label: 'GUARDAR RONDA',
            icon: Icons.save,
            onPressed:
                _predictions.any((value) => value == null) ||
                    _tricks.any((value) => value == null)
                ? null
                : _saveRound,
          ),
          PochaTextButton(
            label: 'DESHACER ÚLTIMA RONDA',
            icon: Icons.undo,
            onPressed: game.rounds.isEmpty ? null : _undo,
          ),
        ],
      ),
    );
  }

  Widget _buildEntryRow(
    BuildContext context,
    CalculatorGame game,
    int index,
    int cards,
  ) {
    final legalBids = game.legalPredictions(
      playerIndex: index,
      cards: cards,
      predictions: _predictions,
    );
    return PochaSurface(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
        child: Row(
          children: [
            Expanded(
              child: Text(
                game.players[index],
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            DropdownButton<int>(
              hint: const Text('Pred.'),
              value: legalBids.contains(_predictions[index])
                  ? _predictions[index]
                  : null,
              items: legalBids
                  .map(
                    (value) =>
                        DropdownMenuItem(value: value, child: Text('$value')),
                  )
                  .toList(),
              onChanged: (value) => setState(() => _predictions[index] = value),
            ),
            const SizedBox(width: 12),
            DropdownButton<int>(
              hint: const Text('Real'),
              value: _tricks[index],
              items: List.generate(
                cards + 1,
                (value) =>
                    DropdownMenuItem(value: value, child: Text('$value')),
              ),
              onChanged: (value) => setState(() => _tricks[index] = value),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScoreTable(BuildContext context, CalculatorGame game) {
    return PochaSurface(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: [
            const DataColumn(label: Text('Jugador')),
            ...List.generate(
              game.rounds.length,
              (index) => DataColumn(label: Text('R${index + 1}')),
            ),
            const DataColumn(label: Text('Total')),
          ],
          rows: game.players
              .map(
                (player) => DataRow(
                  cells: [
                    DataCell(Text(player)),
                    ...game.rounds.map(
                      (round) => DataCell(
                        Text(
                          '${round.lines.firstWhere((line) => line.playerName == player).score}',
                        ),
                      ),
                    ),
                    DataCell(
                      Text(
                        '${game.totalFor(player)}',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
              )
              .toList(),
        ),
      ),
    );
  }

  Widget _buildHistory(BuildContext context) => Scaffold(
    appBar: AppBar(
      leading: BackButton(
        onPressed: () => setState(() => _screen = _CalculatorScreen.home),
      ),
      title: const Text('Historial'),
    ),
    body: _history.isEmpty
        ? const PochaEmptyView(
            title: 'Todavía no hay partidas',
            message: 'Cuando termines una partida aparecerá aquí.',
            icon: Icons.history,
          )
        : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _history.length,
            itemBuilder: (_, index) {
              final game = _history[index];
              final ordered = [...game.players]
                ..sort((a, b) => game.totalFor(b).compareTo(game.totalFor(a)));
              return PochaHistoryTile(
                icon: Icons.emoji_events_outlined,
                title: ordered.first,
                subtitle:
                    '${game.players.length} jugadores · ${game.rounds.length} rondas · ${game.createdAt.day}/${game.createdAt.month}/${game.createdAt.year}',
                trailing: Text('${game.totalFor(ordered.first)} pts'),
              );
            },
          ),
  );

  Widget _buildResults(BuildContext context) {
    final game = _activeGame!;
    final ordered = [...game.players]
      ..sort((a, b) => game.totalFor(b).compareTo(game.totalFor(a)));
    return Scaffold(
      appBar: AppBar(title: const Text('Partida terminada')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          PochaSpacing.lg,
          PochaSpacing.sm,
          PochaSpacing.lg,
          PochaSpacing.xxl,
        ),
        children: [
          Text(
            'Podio',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 16),
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
                title: Text(ordered[index]),
                trailing: Text(
                  '${game.totalFor(ordered[index])} pts',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          PochaPrimaryButton(
            label: 'VOLVER AL INICIO',
            onPressed: () => setState(() => _screen = _CalculatorScreen.home),
          ),
        ],
      ),
    );
  }
}

class _ErrorText extends StatelessWidget {
  const _ErrorText({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Text(
      message,
      style: TextStyle(
        color: Theme.of(context).colorScheme.error,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}
