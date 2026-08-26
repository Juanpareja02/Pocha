import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/config/runtime_config.dart';
import '../../../core/observability/analytics.dart';
import '../../../design_system/pocha_design_system.dart';
import '../../online/data/remote_game_session.dart';
import '../../online/domain/auth_port.dart';
import '../data/ranked_api.dart';
import '../data/ranked_api.dart' as ranked_data;
import '../../online/presentation/online_pages.dart';

const _rankedServerUrl = pochaApiUrl;

class RankedHomePage extends StatefulWidget {
  const RankedHomePage({this.initialProfile, this.initialAuth, super.key});

  final RankedProfile? initialProfile;
  final AuthSession? initialAuth;

  @override
  State<RankedHomePage> createState() => _RankedHomePageState();
}

class _RankedHomePageState extends State<RankedHomePage>
    with WidgetsBindingObserver {
  AuthSession? _auth;
  RemoteGameSession? _session;
  RankedProfile? _profile;
  bool _loading = true;
  bool _searching = false;
  String? _error;
  bool _queueAnalyticsFinished = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _profile = widget.initialProfile;
    _auth = widget.initialAuth;
    _loading = _profile == null;
    if (_profile == null) unawaited(_load());
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
      if (session != null) unawaited(session.cancelRanked());
      if (mounted) {
        setState(() {
          _searching = false;
          _error = 'La búsqueda se ha pausado al salir de la aplicación.';
        });
      }
    }
  }

  Future<void> _load() async {
    try {
      final auth = await developmentAuthPort(baseUrl: _rankedServerUrl)
          .signInAsDevelopmentAccount(
            userId: 'ranked_demo',
            displayName: 'Ranked Demo',
          );
      final profile = await RankedApi(
        baseUrl: _rankedServerUrl,
        token: auth.token,
      ).profile();
      if (mounted) {
        setState(() {
          _auth = auth;
          _profile = profile;
          _loading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = '$error';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    return Scaffold(
      appBar: AppBar(title: const Text('Competitivo')),
      body: _loading
          ? const PochaLoadingState(label: 'Cargando competitivo')
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (_error != null) _ErrorBox(message: _error!),
                if (profile != null) _ProfileCard(profile: profile),
                const SizedBox(height: PochaSpacing.md),
                if (_searching) ...[
                  PochaSurface(
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const SizedBox(
                        width: 44,
                        height: 60,
                        child: PlayingCardWidget.faceDown(
                          semanticLabel: 'Buscando partida',
                        ),
                      ),
                      title: const Text('Buscando partida…'),
                      subtitle: _queueStatus(),
                    ),
                  ),
                  PochaSecondaryButton(
                    expand: true,
                    icon: Icons.close,
                    label: 'CANCELAR BÚSQUEDA',
                    onPressed: _cancel,
                  ),
                ] else
                  PochaPrimaryButton(
                    icon: Icons.sports_esports_outlined,
                    label: 'JUGAR COMPETITIVO',
                    onPressed: _search,
                  ),
                const SizedBox(height: PochaSpacing.xs),
                PochaSecondaryButton(
                  icon: Icons.leaderboard_outlined,
                  label: 'CLASIFICACIÓN',
                  onPressed: _openLeaderboard,
                ),
                PochaSecondaryButton(
                  icon: Icons.person_outline,
                  label: 'PERFIL COMPETITIVO',
                  onPressed: _openProfile,
                ),
                PochaSecondaryButton(
                  icon: Icons.calendar_month_outlined,
                  label: 'TEMPORADA',
                  onPressed: _openSeason,
                ),
              ],
            ),
    );
  }

  Widget _queueStatus() {
    final queue = _session?.rankedQueue;
    if (queue == null) return const Text('Preparando el emparejamiento');
    return _RankedQueueStatus(queuedAt: queue.queuedAt, range: queue.range);
  }

  Future<void> _search() async {
    final auth = _auth;
    if (auth == null) return;
    setState(() {
      _searching = true;
      _error = null;
    });
    _queueAnalyticsFinished = false;
    analyticsClient.track(AnalyticsEvent.rankedQueueStarted);
    final session = _session = RemoteGameSession(
      baseUrl: _rankedServerUrl,
      socketUrl: pochaSocketUrl,
      token: auth.token,
      userId: auth.userId,
    );
    session.addListener(_sessionChanged);
    try {
      await session.searchRanked();
    } catch (error) {
      if (mounted) {
        setState(() {
          _searching = false;
          _error = '$error';
        });
      }
    }
  }

  Future<void> _cancel() async {
    await _session?.cancelRanked();
    _finishQueueAnalytics(matched: false, cancelled: true);
    if (mounted) setState(() => _searching = false);
  }

  void _sessionChanged() {
    final session = _session;
    if (!mounted || session == null) return;
    if (session.state != null) {
      _finishQueueAnalytics(matched: true);
      session.removeListener(_sessionChanged);
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => OnlineGamePage(session: session, ranked: true),
        ),
      );
      return;
    }
    if (session.error != null) setState(() => _error = session.error!.message);
    setState(() {});
  }

  void _finishQueueAnalytics({required bool matched, bool cancelled = false}) {
    if (_queueAnalyticsFinished) return;
    _queueAnalyticsFinished = true;
    analyticsClient.track(
      AnalyticsEvent.rankedQueueFinished,
      properties: {'matched': matched, 'cancelled': cancelled},
    );
  }

  void _openLeaderboard() {
    final auth = _auth;
    if (auth != null) {
      Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder: (_) => RankedLeaderboardPage(
            baseUrl: _rankedServerUrl,
            token: auth.token,
          ),
        ),
      );
    }
  }

  void _openProfile() {
    final auth = _auth;
    if (auth != null) {
      Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder: (_) =>
              RankedProfilePage(baseUrl: _rankedServerUrl, token: auth.token),
        ),
      );
    }
  }

  void _openSeason() {
    final auth = _auth;
    if (auth != null) {
      Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder: (_) =>
              RankedSeasonPage(baseUrl: _rankedServerUrl, token: auth.token),
        ),
      );
    }
  }
}

class _RankedQueueStatus extends StatefulWidget {
  const _RankedQueueStatus({required this.queuedAt, required this.range});

  final DateTime queuedAt;
  final int range;

  @override
  State<_RankedQueueStatus> createState() => _RankedQueueStatusState();
}

class _RankedQueueStatusState extends State<_RankedQueueStatus> {
  Timer? _timer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => mounted ? setState(() => _now = DateTime.now()) : null,
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final elapsed = _now.difference(widget.queuedAt).inSeconds.clamp(0, 9999);
    return Text('$elapsed s · rango de búsqueda ±${widget.range} ELO');
  }
}

class RankedProfilePage extends StatelessWidget {
  const RankedProfilePage({
    required this.baseUrl,
    required this.token,
    this.profileFuture,
    this.historyFuture,
    super.key,
  });

  final String baseUrl;
  final String token;
  final Future<RankedProfile>? profileFuture;
  final Future<List<RankedHistoryRow>>? historyFuture;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Perfil competitivo')),
    body: FutureBuilder<RankedProfile>(
      future:
          profileFuture ?? RankedApi(baseUrl: baseUrl, token: token).profile(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const PochaLoadingState(label: 'Cargando perfil');
        }
        if (snapshot.hasError) return _ErrorBox(message: '${snapshot.error}');
        final profile = snapshot.data!;
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _ProfileCard(profile: profile),
            const SizedBox(height: 16),
            _StatRow(label: 'Partidas ranked', value: '${profile.gamesPlayed}'),
            _StatRow(label: 'Victorias', value: '${profile.wins}'),
            _StatRow(label: 'Podios', value: '${profile.podiums}'),
            _StatRow(
              label: 'Posición media',
              value: profile.averagePosition?.toStringAsFixed(1) ?? '—',
            ),
            _StatRow(
              label: 'Acierto de predicciones',
              value: '${(profile.predictionAccuracy * 100).round()}%',
            ),
            const SizedBox(height: 20),
            const Text(
              'Historial ranked',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            FutureBuilder<List<RankedHistoryRow>>(
              future:
                  historyFuture ??
                  RankedApi(baseUrl: baseUrl, token: token).history(),
              builder: (context, history) {
                if (history.connectionState != ConnectionState.done) {
                  return const PochaLoadingState(
                    label: 'Cargando historial ranked',
                  );
                }
                if (history.hasError) {
                  return _ErrorBox(message: '${history.error}');
                }
                if (history.data!.isEmpty) {
                  return const Text('Todavía no hay partidas ranked.');
                }
                return Column(
                  children: history.data!
                      .map(
                        (item) => ListTile(
                          title: Text(
                            '${item.position}º · ${item.delta >= 0 ? '+' : ''}${item.delta} ELO',
                          ),
                          subtitle: Text(
                            '${item.score} puntos · ${item.gameId}',
                          ),
                          trailing: Text('${item.newRating}'),
                        ),
                      )
                      .toList(),
                );
              },
            ),
          ],
        );
      },
    ),
  );
}

class RankedLeaderboardPage extends StatefulWidget {
  const RankedLeaderboardPage({
    required this.baseUrl,
    required this.token,
    this.pageLoader,
    super.key,
  });

  final String baseUrl;
  final String token;
  final Future<ranked_data.RankedLeaderboardPage> Function(String? cursor)?
  pageLoader;

  @override
  State<RankedLeaderboardPage> createState() => _RankedLeaderboardPageState();
}

class _RankedLeaderboardPageState extends State<RankedLeaderboardPage> {
  final _rows = <RankedLeaderboardRow>[];
  String? _cursor;
  int? _myPosition;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final page = widget.pageLoader != null
          ? await widget.pageLoader!(_cursor)
          : await RankedApi(
              baseUrl: widget.baseUrl,
              token: widget.token,
            ).leaderboard(cursor: _cursor);
      if (mounted) {
        setState(() {
          _rows.addAll(page.items);
          _cursor = page.nextCursor;
          _myPosition = page.myPosition;
          _loading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = '$error';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Clasificación')),
    body: _loading && _rows.isEmpty
        ? const PochaLoadingState(label: 'Cargando clasificación')
        : ListView(
            padding: const EdgeInsets.all(12),
            children: [
              if (_error != null) _ErrorBox(message: _error!, onRetry: _load),
              if (_myPosition != null)
                PochaSurface(
                  margin: const EdgeInsets.only(bottom: PochaSpacing.sm),
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Tu posición'),
                    trailing: Text('#$_myPosition'),
                  ),
                ),
              if (_rows.isEmpty)
                const PochaEmptyView(
                  title: 'La clasificación está vacía',
                  message: 'Todavía no hay datos de temporada.',
                  icon: Icons.leaderboard_outlined,
                ),
              ..._rows.map(
                (row) => PochaSurface(
                  margin: const EdgeInsets.only(bottom: PochaSpacing.sm),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: 56,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '#${row.position}',
                              style: PochaTypography.scoreboard(context),
                            ),
                            PochaAvatar(
                              name: row.username,
                              seed: row.rating,
                              size: 32,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: PochaSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              row.username,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: PochaSpacing.xxs),
                            RankBadge(
                              name: row.rankName,
                              provisional: row.provisional,
                              compact: true,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: PochaSpacing.xs),
                      Flexible(
                        child: Text(
                          '${row.rating} ELO',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.end,
                          style: PochaTypography.scoreboard(context),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (_cursor != null)
                PochaSecondaryButton(
                  label: 'CARGAR MÁS',
                  icon: Icons.expand_more,
                  onPressed: _loading ? null : _load,
                ),
            ],
          ),
  );
}

class RankedSeasonPage extends StatelessWidget {
  const RankedSeasonPage({
    required this.baseUrl,
    required this.token,
    this.seasonFuture,
    this.profileFuture,
    super.key,
  });

  final String baseUrl;
  final String token;
  final Future<RankedSeasonSummary>? seasonFuture;
  final Future<RankedProfile>? profileFuture;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Temporada')),
    body: FutureBuilder<List<Object>>(
      future: Future.wait<Object>([
        seasonFuture ?? RankedApi(baseUrl: baseUrl, token: token).season(),
        profileFuture ?? RankedApi(baseUrl: baseUrl, token: token).profile(),
      ]),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const PochaLoadingState(label: 'Cargando temporada');
        }
        if (snapshot.hasError) return _ErrorBox(message: '${snapshot.error}');
        final season = snapshot.data![0] as RankedSeasonSummary;
        final profile = snapshot.data![1] as RankedProfile;
        return ListView(
          padding: const EdgeInsets.all(PochaSpacing.lg),
          children: [
            PochaSurface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    season.name,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: PochaSpacing.xs),
                  Text('Temporada ${season.number} · ${season.status}'),
                  const SizedBox(height: PochaSpacing.sm),
                  Text(
                    season.endsAt == null
                        ? 'Sin fecha de finalización configurada.'
                        : 'Finaliza: ${season.endsAt}',
                  ),
                ],
              ),
            ),
            const SizedBox(height: PochaSpacing.md),
            PochaSurface(
              child: Column(
                children: [
                  _StatRow(label: 'Rango', value: profile.rankName),
                  _StatRow(label: 'ELO', value: '${profile.rating}'),
                  _StatRow(
                    label: 'Posición',
                    value: profile.position == null
                        ? '—'
                        : '#${profile.position}',
                  ),
                  _StatRow(label: 'Partidas', value: '${profile.gamesPlayed}'),
                  _StatRow(
                    label: 'Placements',
                    value:
                        '${profile.placementGames}/${profile.placementTotal}',
                  ),
                ],
              ),
            ),
            const SizedBox(height: PochaSpacing.md),
            const Text(
              'La política de reset será soft reset y quedará versionada por temporada.',
            ),
          ],
        );
      },
    ),
  );
}

class RankedResultPage extends StatelessWidget {
  const RankedResultPage({
    required this.baseUrl,
    required this.token,
    this.gameId,
    this.profileFuture,
    this.historyFuture,
    super.key,
  });

  final String baseUrl;
  final String token;
  final String? gameId;
  final Future<RankedProfile>? profileFuture;
  final Future<List<RankedHistoryRow>>? historyFuture;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Resultado ranked')),
    body: FutureBuilder<List<Object>>(
      future: Future.wait<Object>([
        profileFuture ?? RankedApi(baseUrl: baseUrl, token: token).profile(),
        historyFuture ?? RankedApi(baseUrl: baseUrl, token: token).history(),
      ]),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const PochaLoadingState(label: 'Cargando resultado');
        }
        if (snapshot.hasError) return _ErrorBox(message: '${snapshot.error}');
        final profile = snapshot.data![0] as RankedProfile;
        final history = snapshot.data![1] as List<RankedHistoryRow>;
        RankedHistoryRow? latest;
        for (final item in history) {
          if (item.gameId == gameId) {
            latest = item;
            break;
          }
        }
        latest ??= history.isEmpty ? null : history.first;
        return ListView(
          padding: const EdgeInsets.all(PochaSpacing.lg),
          children: [
            Text(
              'Partida finalizada',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: PochaSpacing.md),
            if (latest == null)
              _ProfileCard(profile: profile)
            else ...[
              _ResultMetric(label: 'Posición', value: '${latest.position}º'),
              _ResultMetric(
                label: 'Puntuación',
                value: '${latest.score} puntos',
              ),
              _ResultMetric(
                label: 'ELO',
                value:
                    '${latest.oldRating} → ${latest.newRating} (${latest.delta >= 0 ? '+' : ''}${latest.delta})',
              ),
              _ResultMetric(
                label: 'Rango actual',
                value: profile.rankName,
                leading: RankBadge(
                  name: profile.rankName,
                  provisional: profile.provisional,
                  compact: true,
                ),
              ),
              if (latest.promoted)
                _PromotionCard(
                  previousRank: _rankNameForId(latest.previousRankId),
                  currentRank: profile.rankName,
                ),
              if (latest.demoted)
                const _ResultWarning(text: 'Descenso de rango.'),
              if (latest.abandoned)
                const _ResultWarning(
                  text:
                      'Abandono explícito: se aplicó la penalización correspondiente.',
                ),
            ],
            const SizedBox(height: PochaSpacing.md),
            Text(
              'El resultado y el ELO los calcula exclusivamente el servidor.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        );
      },
    ),
  );
}

class _ResultMetric extends StatelessWidget {
  const _ResultMetric({required this.label, required this.value, this.leading});

  final String label;
  final String value;
  final Widget? leading;

  @override
  Widget build(BuildContext context) => PochaSurface(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(label)),
            const SizedBox(width: PochaSpacing.sm),
            Flexible(
              child: Text(
                value,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.end,
                style: PochaTypography.scoreboard(context),
              ),
            ),
          ],
        ),
        if (leading != null) ...[
          const SizedBox(height: PochaSpacing.xs),
          leading!,
        ],
      ],
    ),
  );
}

class _PromotionCard extends StatelessWidget {
  const _PromotionCard({required this.previousRank, required this.currentRank});

  final String previousRank;
  final String currentRank;

  @override
  Widget build(BuildContext context) => PochaSurface(
    color: Theme.of(context).colorScheme.tertiaryContainer,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('¡ASCENSO!', style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: PochaSpacing.sm),
        Row(
          children: [
            RankBadge(name: previousRank, compact: true),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: PochaSpacing.sm),
              child: Icon(Icons.arrow_forward_rounded),
            ),
            RankBadge(name: currentRank, compact: true),
          ],
        ),
      ],
    ),
  );
}

class _ResultWarning extends StatelessWidget {
  const _ResultWarning({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => PochaSurface(
    color: Theme.of(context).colorScheme.errorContainer,
    child: Padding(
      padding: const EdgeInsets.all(PochaSpacing.md),
      child: Text(text),
    ),
  );
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.profile});
  final RankedProfile profile;

  @override
  Widget build(BuildContext context) => PochaSurface(
    child: Padding(
      padding: const EdgeInsets.all(PochaSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PochaAvatar(
                name: profile.displayName,
                seed: profile.rating,
                status: PochaAvatarStatus.online,
              ),
              const SizedBox(width: PochaSpacing.md),
              Expanded(
                child: Text(
                  profile.displayName,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
            ],
          ),
          const SizedBox(height: PochaSpacing.sm),
          Text(profile.seasonName),
          const SizedBox(height: PochaSpacing.xs),
          Row(
            children: [
              RankBadge(
                name: profile.rankName,
                provisional: profile.provisional,
              ),
              const SizedBox(width: PochaSpacing.sm),
              Expanded(
                child: Text(
                  profile.provisional
                      ? '${profile.placementGames}/${profile.placementTotal} partidas de posicionamiento'
                      : '${profile.rating} ELO · máximo ${profile.peakRating}',
                ),
              ),
            ],
          ),
          if (profile.position != null) Text('Posición #${profile.position}'),
        ],
      ),
    ),
  );
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(label),
    trailing: Text(value),
  );
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) =>
      PochaErrorView(message: message, onRetry: onRetry);
}

String _rankNameForId(String? id) => switch (id?.toLowerCase()) {
  'bronze' => 'Bronce',
  'silver' => 'Plata',
  'gold' => 'Oro',
  'platinum' => 'Platino',
  'diamond' => 'Diamante',
  'master' => 'Maestro',
  'grand-master' => 'Gran Maestro',
  _ => 'Anterior',
};
