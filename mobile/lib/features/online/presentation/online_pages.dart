import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/config/runtime_config.dart';
import '../../../core/observability/analytics.dart';
import '../../../design_system/pocha_design_system.dart';
import '../../game/domain/pocha_engine.dart';
import '../data/remote_game_session.dart';
import '../domain/auth_port.dart';
import '../domain/online_protocol.dart';
import '../../ranked/presentation/ranked_pages.dart';

class OnlineHomePage extends StatelessWidget {
  const OnlineHomePage({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Multijugador')),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(
        PochaSpacing.lg,
        PochaSpacing.sm,
        PochaSpacing.lg,
        PochaSpacing.xxl,
      ),
      children: [
        const PochaEyebrow('La mesa compartida'),
        const SizedBox(height: PochaSpacing.xs),
        Text(
          'Juega en la misma sala',
          style: Theme.of(context).textTheme.displayMedium,
        ),
        const SizedBox(height: PochaSpacing.sm),
        Text(
          'La partida la valida el servidor. Cada jugador recibe solo su propia mano.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: PochaSpacing.lg),
        PochaPrimaryButton(
          label: 'CREAR SALA',
          icon: Icons.add_link,
          onPressed: () => Navigator.push<void>(
            context,
            MaterialPageRoute(builder: (_) => const CreateRoomPage()),
          ),
        ),
        const SizedBox(height: PochaSpacing.sm),
        PochaSecondaryButton(
          label: 'UNIRSE A SALA',
          icon: Icons.login,
          onPressed: () => Navigator.push<void>(
            context,
            MaterialPageRoute(builder: (_) => const JoinRoomPage()),
          ),
        ),
        const SizedBox(height: PochaSpacing.sm),
        PochaSecondaryButton(
          label: 'HISTORIAL ONLINE',
          icon: Icons.history,
          onPressed: () => Navigator.push<void>(
            context,
            MaterialPageRoute(builder: (_) => const OnlineHistoryPage()),
          ),
        ),
        const SizedBox(height: PochaSpacing.xl),
        PochaActionTile(
          icon: Icons.schedule,
          title: 'PARTIDA CASUAL',
          subtitle: 'Cola simple por jugadores y ruleset',
          onTap: () => Navigator.push<void>(
            context,
            MaterialPageRoute(builder: (_) => const CasualMatchPage()),
          ),
        ),
        const SizedBox(height: PochaSpacing.sm),
        PochaActionTile(
          icon: Icons.emoji_events_outlined,
          title: 'COMPETITIVO',
          subtitle: 'Rango, ELO, placements y temporadas',
          onTap: () => Navigator.push<void>(
            context,
            MaterialPageRoute(builder: (_) => const RankedHomePage()),
          ),
        ),
      ],
    ),
  );
}

class CasualMatchPage extends StatefulWidget {
  const CasualMatchPage({super.key});

  @override
  State<CasualMatchPage> createState() => _CasualMatchPageState();
}

class _CasualMatchPageState extends State<CasualMatchPage>
    with WidgetsBindingObserver {
  RemoteGameSession? _session;
  int _playerCount = 4;
  bool _searching = false;
  String? _error;
  bool _queueAnalyticsFinished = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _session?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if ((state == AppLifecycleState.inactive ||
            state == AppLifecycleState.paused ||
            state == AppLifecycleState.detached) &&
        _searching) {
      final session = _session;
      if (session != null) unawaited(session.cancelSearch());
      _finishQueueAnalytics(matched: false, cancelled: true);
      if (mounted) {
        setState(() {
          _searching = false;
          _error = 'La búsqueda se ha pausado al salir de la aplicación.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    return Scaffold(
      appBar: AppBar(title: const Text('Partida casual')),
      body: Padding(
        padding: const EdgeInsets.all(PochaSpacing.lg),
        child: Column(
          children: [
            const PochaEyebrow('Emparejamiento casual'),
            const SizedBox(height: PochaSpacing.sm),
            DropdownButtonFormField<int>(
              initialValue: _playerCount,
              decoration: const InputDecoration(labelText: 'Jugadores'),
              items: [3, 4, 5, 6]
                  .map(
                    (value) => DropdownMenuItem(
                      value: value,
                      child: Text('$value jugadores'),
                    ),
                  )
                  .toList(),
              onChanged: _searching
                  ? null
                  : (value) => setState(() => _playerCount = value ?? 4),
            ),
            const SizedBox(height: 20),
            if (_searching) ...[
              const PochaLoadingState(label: 'Buscando jugadores'),
              const SizedBox(height: PochaSpacing.sm),
              Text(
                session?.room == null
                    ? 'Buscando jugadores compatibles…'
                    : 'Partida encontrada',
              ),
              PochaSecondaryButton(
                label: 'CANCELAR',
                onPressed: () async {
                  await session?.cancelSearch();
                  _finishQueueAnalytics(matched: false, cancelled: true);
                  if (mounted) setState(() => _searching = false);
                },
              ),
            ] else
              PochaPrimaryButton(
                label: 'BUSCAR PARTIDA',
                onPressed: _startSearch,
              ),
            if (_error != null)
              PochaErrorView(message: _error!, onRetry: _startSearch),
          ],
        ),
      ),
    );
  }

  Future<void> _startSearch() async {
    setState(() {
      _searching = true;
      _error = null;
    });
    _queueAnalyticsFinished = false;
    analyticsClient.track(
      AnalyticsEvent.casualQueueStarted,
      properties: {'player_count': _playerCount},
    );
    try {
      final auth = await developmentAuthPort(
        baseUrl: pochaApiUrl,
      ).signInAsGuest();
      final session = RemoteGameSession(
        baseUrl: pochaApiUrl,
        socketUrl: pochaSocketUrl,
        token: auth.token,
        userId: auth.userId,
      );
      _session = session;
      session.addListener(_onSessionChanged);
      await session.searchCasual(playerCount: _playerCount);
    } catch (error) {
      if (mounted) {
        setState(() {
          _searching = false;
          _error = '$error';
        });
      }
    }
  }

  void _onSessionChanged() {
    final session = _session;
    if (!mounted || session?.state == null) return;
    _finishQueueAnalytics(matched: true);
    session!.removeListener(_onSessionChanged);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => OnlineGamePage(session: session)),
    );
  }

  void _finishQueueAnalytics({required bool matched, bool cancelled = false}) {
    if (_queueAnalyticsFinished) return;
    _queueAnalyticsFinished = true;
    analyticsClient.track(
      AnalyticsEvent.casualQueueFinished,
      properties: {'matched': matched, 'cancelled': cancelled},
    );
  }
}

class CreateRoomPage extends StatefulWidget {
  const CreateRoomPage({super.key});

  @override
  State<CreateRoomPage> createState() => _CreateRoomPageState();
}

class _CreateRoomPageState extends State<CreateRoomPage> {
  int _playerCount = 4;
  String _ruleset = 'classic';
  String _difficulty = 'normal';
  bool _allowBots = true;
  bool _busy = false;
  String? _error;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Crear sala')),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(
        PochaSpacing.lg,
        PochaSpacing.sm,
        PochaSpacing.lg,
        PochaSpacing.xxl,
      ),
      children: [
        const PochaEyebrow('Sala privada'),
        const SizedBox(height: PochaSpacing.sm),
        DropdownButtonFormField<int>(
          initialValue: _playerCount,
          decoration: const InputDecoration(labelText: 'Número de jugadores'),
          items: [3, 4, 5, 6]
              .map(
                (value) => DropdownMenuItem(
                  value: value,
                  child: Text('$value jugadores'),
                ),
              )
              .toList(),
          onChanged: _busy
              ? null
              : (value) => setState(() => _playerCount = value ?? 4),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _ruleset,
          decoration: const InputDecoration(labelText: 'Ruleset oficial'),
          items: const [
            DropdownMenuItem(value: 'classic', child: Text('Pocha clásica')),
            DropdownMenuItem(value: 'auction', child: Text('Subasta')),
          ],
          onChanged: _busy
              ? null
              : (value) => setState(() => _ruleset = value ?? 'classic'),
        ),
        SwitchListTile(
          title: const Text('Permitir bots'),
          value: _allowBots,
          onChanged: _busy
              ? null
              : (value) => setState(() => _allowBots = value),
        ),
        DropdownButtonFormField<String>(
          initialValue: _difficulty,
          decoration: const InputDecoration(labelText: 'Dificultad de bots'),
          items: const [
            DropdownMenuItem(value: 'easy', child: Text('Fácil')),
            DropdownMenuItem(value: 'normal', child: Text('Normal')),
            DropdownMenuItem(value: 'hard', child: Text('Difícil')),
          ],
          onChanged: _busy
              ? null
              : (value) => setState(() => _difficulty = value ?? 'normal'),
        ),
        if (_error != null) PochaErrorView(message: _error!),
        const SizedBox(height: PochaSpacing.lg),
        PochaPrimaryButton(
          label: 'CREAR SALA',
          onPressed: _busy ? null : _create,
          loading: _busy,
        ),
      ],
    ),
  );

  Future<void> _create() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final auth = await developmentAuthPort(
        baseUrl: pochaApiUrl,
      ).signInAsGuest();
      final session = RemoteGameSession(
        baseUrl: pochaApiUrl,
        socketUrl: pochaSocketUrl,
        token: auth.token,
        userId: auth.userId,
      );
      await session.createRoom(
        playerCount: _playerCount,
        rulesetId: _ruleset,
        allowBots: _allowBots,
        botDifficulty: _difficulty,
      );
      await _waitForRoom(session);
      if (!mounted) return;
      await Navigator.push<void>(
        context,
        MaterialPageRoute(builder: (_) => OnlineLobbyPage(session: session)),
      );
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class JoinRoomPage extends StatefulWidget {
  const JoinRoomPage({this.initialCode, super.key});

  final String? initialCode;

  @override
  State<JoinRoomPage> createState() => _JoinRoomPageState();
}

class _JoinRoomPageState extends State<JoinRoomPage> {
  late final TextEditingController _code = TextEditingController(
    text: widget.initialCode?.trim().toUpperCase(),
  );
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Unirse a sala')),
    body: Padding(
      padding: const EdgeInsets.all(PochaSpacing.lg),
      child: Column(
        children: [
          const PochaEyebrow('Código de invitación'),
          const SizedBox(height: PochaSpacing.sm),
          TextField(
            controller: _code,
            textCapitalization: TextCapitalization.characters,
            maxLength: 6,
            decoration: const InputDecoration(
              labelText: 'Código de sala',
              hintText: 'AB7KQ2',
            ),
          ),
          if (_error != null) PochaErrorView(message: _error!),
          const SizedBox(height: PochaSpacing.sm),
          PochaPrimaryButton(
            label: 'UNIRSE',
            onPressed: _busy ? null : _join,
            loading: _busy,
          ),
        ],
      ),
    ),
  );

  Future<void> _join() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final auth = await developmentAuthPort(
        baseUrl: pochaApiUrl,
      ).signInAsGuest();
      final session = RemoteGameSession(
        baseUrl: pochaApiUrl,
        socketUrl: pochaSocketUrl,
        token: auth.token,
        userId: auth.userId,
      );
      await session.joinRoom(_code.text);
      await _waitForRoom(session);
      if (!mounted) return;
      await Navigator.push<void>(
        context,
        MaterialPageRoute(builder: (_) => OnlineLobbyPage(session: session)),
      );
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class OnlineLobbyPage extends StatefulWidget {
  const OnlineLobbyPage({required this.session, this.initialRoom, super.key});

  final RemoteGameSession session;
  final RemoteRoomView? initialRoom;

  @override
  State<OnlineLobbyPage> createState() => _OnlineLobbyPageState();
}

class _OnlineLobbyPageState extends State<OnlineLobbyPage> {
  bool _openedGame = false;

  @override
  void initState() {
    super.initState();
    widget.session.addListener(_changed);
  }

  @override
  void dispose() {
    widget.session.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    if (!mounted || _openedGame || widget.session.state == null) return;
    _openedGame = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => OnlineGamePage(session: widget.session),
          ),
        );
      }
    });
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final room = widget.initialRoom ?? widget.session.room;
    return Scaffold(
      appBar: AppBar(title: const Text('Sala')),
      body: room == null
          ? const PochaLoadingState(label: 'Cargando sala')
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                PochaSpacing.lg,
                PochaSpacing.sm,
                PochaSpacing.lg,
                PochaSpacing.xxl,
              ),
              children: [
                PochaSurface(
                  child: ListTile(
                    title: const Text('Código'),
                    subtitle: SelectableText(
                      room.code,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    trailing: const Icon(Icons.share),
                  ),
                ),
                ListTile(
                  title: Text(
                    '${room.players.length}/${room.playerCount} jugadores',
                  ),
                  subtitle: Text('Ruleset: ${room.rulesetId}'),
                ),
                ...room.players.map(
                  (player) => ListTile(
                    leading: PochaAvatar(
                      name: player.displayName,
                      seed: player.seat,
                      status: player.isBot
                          ? PochaAvatarStatus.bot
                          : _connectionAvatarStatus(player.connectionStatus),
                    ),
                    title: Text(player.displayName),
                    subtitle: Text(
                      player.isHost
                          ? 'Host · ${player.isBot ? 'Bot ${player.botDifficulty}' : player.connectionStatus}'
                          : player.isBot
                          ? 'Bot ${player.botDifficulty}'
                          : player.connectionStatus,
                    ),
                    trailing: Text(player.ready ? 'LISTO' : 'ESPERANDO'),
                  ),
                ),
                const SizedBox(height: PochaSpacing.md),
                if (room.hostUserId == _myUserId()) ...[
                  if (!room.isFull)
                    PochaSecondaryButton(
                      label: 'AÑADIR BOT',
                      icon: Icons.smart_toy_outlined,
                      onPressed: widget.session.addBot,
                    ),
                  PochaPrimaryButton(
                    label: 'INICIAR',
                    onPressed:
                        room.isFull &&
                            room.players.every((player) => player.ready)
                        ? widget.session.startRoom
                        : null,
                  ),
                ] else
                  PochaPrimaryButton(
                    label: 'LISTO',
                    onPressed: _isReady(room) ? null : widget.session.ready,
                  ),
                PochaSecondaryButton(
                  label: 'SALIR DE LA SALA',
                  onPressed: () async {
                    await widget.session.leaveRoom();
                    if (context.mounted) Navigator.of(context).pop();
                  },
                ),
                if (widget.session.error != null)
                  PochaErrorView(message: widget.session.error!.message),
              ],
            ),
    );
  }

  String _myUserId() => widget.session.userId;
  bool _isReady(RemoteRoomView room) => room.players
      .firstWhere((player) => player.userId == widget.session.userId)
      .ready;
}

class OnlineGamePage extends StatefulWidget {
  const OnlineGamePage({required this.session, this.ranked = false, super.key});

  final RemoteGameSession session;
  final bool ranked;

  @override
  State<OnlineGamePage> createState() => _OnlineGamePageState();
}

class _OnlineGamePageState extends State<OnlineGamePage>
    with WidgetsBindingObserver {
  bool _finishedAnalyticsSent = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.session.addListener(_changed);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.session.removeListener(_changed);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(widget.session.resume());
    }
  }

  void _changed() {
    final state = widget.session.state;
    if (state?.status == 'FINISHED' && !_finishedAnalyticsSent) {
      _finishedAnalyticsSent = true;
      if (!widget.ranked) {
        analyticsClient.track(AnalyticsEvent.casualGameFinished);
      }
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.session.state;
    if (state == null) {
      return const Scaffold(
        body: PochaLoadingState(label: 'Conectando con la mesa'),
      );
    }
    final timer = state.timer;
    return Scaffold(
      appBar: AppBar(
        title: const Text('La Pocha online'),
        actions: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Center(
              child: Text(_statusLabel(widget.session.connectionStatus)),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          if (!widget.session.connected)
            PochaReconnectBanner(
              connected: widget.session.connected,
              onRetry: () => widget.session.resume(),
            ),
          if (widget.session.error != null)
            Padding(
              padding: const EdgeInsets.all(PochaSpacing.xs),
              child: PochaErrorView(
                title: 'Conexión con la mesa',
                message: widget.session.error!.message,
                onRetry: () => widget.session.resume(),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Wrap(
              spacing: 8,
              children: [
                Chip(label: Text('Ronda ${state.roundIndex + 1}')),
                Chip(label: Text('${state.cardsPerRound} cartas')),
                Chip(label: Text('Triunfo: ${_suitLabel(state.trumpSuit)}')),
                if (timer != null)
                  TurnTimer(deadline: timer.deadlineAt, compact: true),
              ],
            ),
          ),
          Expanded(child: _OnlineTable(state: state)),
          if (state.status == 'BIDDING' && state.humanTurn)
            BidSheet(
              cardsPerRound: state.cardsPerRound,
              legalBids: state.legalHumanBids,
              restrictionMessage: state.bidRestrictionMessage,
              onBid: widget.session.submitBid,
            ),
          if (state.status == 'CHOOSE_TRUMP' && state.humanTurn)
            TrumpSheet(onTrump: widget.session.chooseTrump),
          if (state.status == 'PLAYING_TRICK' && state.humanTurn)
            _InteractiveRemoteHand(session: widget.session, state: state),
          if (state.status == 'FINISHED')
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text(
                    'Partida terminada',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  if (widget.ranked)
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).push<void>(
                        MaterialPageRoute(
                          builder: (_) => RankedResultPage(
                            baseUrl: pochaApiUrl,
                            token: widget.session.token,
                            gameId: state.gameId,
                          ),
                        ),
                      ),
                      child: const Text('VER RESULTADO RANKED'),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _OnlineTable extends StatelessWidget {
  const _OnlineTable({required this.state});

  final RemoteGameState state;

  @override
  Widget build(BuildContext context) {
    final opponents = state.players
        .where((player) => player.id != state.myPlayerId)
        .toList();
    final localPlayer = state.humanPlayer;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: PochaSpacing.xs),
      child: PochaGameTable(
        playerCount: state.players.length,
        opponents: [
          for (final player in opponents)
            PochaPlayerSeat(
              name: player.name,
              avatarSeed: player.seat,
              bid: player.bid,
              tricksWon: player.tricksWon,
              score: player.score,
              isCurrent: player.id == state.currentPlayerId,
              connection: PochaAvatarStatus.online,
            ),
        ],
        trick: TrickArea(
          cards: [
            for (final played in state.currentTrick)
              TrickCardView(
                playerName: state.players
                    .firstWhere((player) => player.id == played.playerId)
                    .name,
                card: _toLocalCard(played.card),
              ),
          ],
          emptyLabel: 'La baza aparecerá aquí',
        ),
        localSeat: PochaPlayerSeat(
          name: localPlayer.name,
          avatarSeed: localPlayer.seat,
          bid: localPlayer.bid,
          tricksWon: localPlayer.tricksWon,
          score: localPlayer.score,
          isCurrent: localPlayer.id == state.currentPlayerId,
          connection: PochaAvatarStatus.online,
        ),
      ),
    );
  }
}

class _InteractiveRemoteHand extends StatefulWidget {
  const _InteractiveRemoteHand({required this.session, required this.state});

  final RemoteGameSession session;
  final RemoteGameState state;

  @override
  State<_InteractiveRemoteHand> createState() => _InteractiveRemoteHandState();
}

class _InteractiveRemoteHandState extends State<_InteractiveRemoteHand> {
  String? _selectedId;

  @override
  Widget build(BuildContext context) {
    final hand = widget.state.humanPlayer.hand;
    final legal = widget.state.legalHumanCardIds;
    final localCards = [for (final card in hand) _toLocalCard(card)];
    final selected = _selectedId == null
        ? null
        : localCards.firstWhere(
            (card) => card.id == _selectedId,
            orElse: () => localCards.first,
          );
    return PlayerHand(
      cards: localCards,
      legalCardIds: {
        for (final card in hand)
          if (legal.contains(card.id)) _toLocalCard(card).id,
      },
      selectedCard: selected,
      helperText: 'Toca una carta y confirma para jugarla.',
      onCardTap: (card) => setState(() {
        _selectedId = _selectedId == card.id ? null : card.id;
      }),
      onPlaySelected: selected == null
          ? null
          : () {
              final remote = hand.firstWhere(
                (card) => _toLocalCard(card).id == selected.id,
              );
              setState(() => _selectedId = null);
              widget.session.playRemoteCard(remote);
            },
    );
  }
}

class OnlineHistoryPage extends StatefulWidget {
  const OnlineHistoryPage({super.key});

  @override
  State<OnlineHistoryPage> createState() => _OnlineHistoryPageState();
}

class _OnlineHistoryPageState extends State<OnlineHistoryPage> {
  late final Future<List<OnlineHistoryItem>> _history = _load();

  Future<List<OnlineHistoryItem>> _load() async {
    final auth = developmentAuthPort(baseUrl: pochaApiUrl);
    final session = await auth.signInAsGuest();
    return auth.fetchHistory(session.token);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Historial online')),
    body: FutureBuilder<List<OnlineHistoryItem>>(
      future: _history,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const PochaLoadingState(label: 'Cargando historial online');
        }
        if (snapshot.hasError) {
          return Padding(
            padding: const EdgeInsets.all(PochaSpacing.lg),
            child: PochaErrorView(
              message: 'No se ha podido cargar el historial online.',
            ),
          );
        }
        final games = snapshot.data ?? const <OnlineHistoryItem>[];
        if (games.isEmpty) {
          return const PochaEmptyView(
            title: 'Todavía no hay partidas online',
            message: 'Cuando termines una partida aparecerá aquí.',
            icon: Icons.history,
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(PochaSpacing.lg),
          itemCount: games.length,
          itemBuilder: (_, index) {
            final game = games[index];
            return PochaHistoryTile(
              icon: Icons.sports_score,
              title: game.rulesetId,
              subtitle: game.gameId,
              trailing: Text(
                game.finishedAt?.toLocal().toString().split('.').first ?? '—',
              ),
            );
          },
        );
      },
    ),
  );
}

Future<void> _waitForRoom(RemoteGameSession session) async {
  for (var attempt = 0; attempt < 50; attempt += 1) {
    if (session.room != null) return;
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
  throw TimeoutException('El servidor no devolvió la sala');
}

String _statusLabel(RemoteConnectionStatus status) => switch (status) {
  RemoteConnectionStatus.connected => 'Conectado',
  RemoteConnectionStatus.connecting => 'Conectando…',
  RemoteConnectionStatus.reconnecting => 'Reconectando…',
  RemoteConnectionStatus.disconnected => 'Desconectado',
};

PochaAvatarStatus _connectionAvatarStatus(String status) =>
    switch (status.toLowerCase()) {
      'connected' || 'online' => PochaAvatarStatus.online,
      'reconnecting' || 'connecting' => PochaAvatarStatus.turn,
      _ => PochaAvatarStatus.offline,
    };

String _suitLabel(String? suit) => switch (suit) {
  null => 'Sin triunfo',
  'oros' => 'Oros',
  'copas' => 'Copas',
  'espadas' => 'Espadas',
  'bastos' => 'Bastos',
  _ => suit,
};
PochaCard _toLocalCard(RemoteCard card) {
  final suit = card.localSuit ?? Suit.oros;
  final rank = Rank.values.firstWhere(
    (value) => value.name == card.rank,
    orElse: () => Rank.as_,
  );
  return PochaCard(suit: suit, rank: rank);
}
