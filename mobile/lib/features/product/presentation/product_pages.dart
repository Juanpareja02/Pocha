import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/runtime_config.dart';
import '../../../design_system/pocha_design_system.dart';
import '../../../l10n/app_strings.dart';
import '../../calculator/domain/calculator_game.dart';
import '../../calculator/data/calculator_repository.dart';
import '../../../core/observability/analytics.dart';
import '../../online/domain/auth_port.dart';
import '../../online/data/auth_session_store.dart';
import '../../ranked/data/ranked_api.dart' as ranked_data;
import '../../ranked/presentation/ranked_pages.dart';
import '../../game/domain/pocha_engine.dart';
import '../../single_player/data/single_player_repository.dart';
import '../../single_player/domain/local_game.dart';
import '../data/product_preferences.dart';

const productServerUrl = pochaApiUrl;

class PochaAppShell extends StatelessWidget {
  const PochaAppShell({required this.child, required this.location, super.key});

  final Widget child;
  final String location;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final currentIndex = switch (location) {
      '/leaderboard' => 1,
      '/history' => 2,
      '/profile' => 3,
      _ => 0,
    };
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) => context.go(switch (index) {
          1 => '/leaderboard',
          2 => '/history',
          3 => '/profile',
          _ => '/',
        }),
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: strings.home,
          ),
          NavigationDestination(
            icon: Icon(Icons.leaderboard_outlined),
            selectedIcon: Icon(Icons.leaderboard),
            label: strings.leaderboard,
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history),
            label: strings.history,
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: strings.profile,
          ),
        ],
      ),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(strings.appName),
        actions: [
          IconButton(
            onPressed: () => context.push('/settings'),
            icon: const Icon(Icons.tune_rounded),
            tooltip: strings.settings,
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            PochaSpacing.lg,
            PochaSpacing.sm,
            PochaSpacing.lg,
            PochaSpacing.xxl,
          ),
          children: [
            const PochaEyebrow('Una mesa para volver'),
            const SizedBox(height: PochaSpacing.xs),
            Text(
              'Tu partida empieza aquí.',
              style: Theme.of(context).textTheme.displayMedium,
            ),
            const SizedBox(height: PochaSpacing.xs),
            Text(
              'Calcula, entrena o juega con tu gente. La baraja siempre está lista.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: PochaSpacing.lg),
            _HeroModeCard(
              title: 'MULTIJUGADOR',
              subtitle: 'Casual, competitivo o sala privada',
              icon: Icons.people_alt_outlined,
              color: PochaColors.table,
              onTap: () => context.push('/multiplayer'),
            ),
            const SizedBox(height: PochaSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: _CompactModeCard(
                    title: '1 JUGADOR',
                    subtitle: 'Entrena offline',
                    icon: Icons.smart_toy_outlined,
                    onTap: () => context.push('/single-player'),
                  ),
                ),
                const SizedBox(width: PochaSpacing.sm),
                Expanded(
                  child: _CompactModeCard(
                    title: 'CALCULADORA',
                    subtitle: 'Lleva la cuenta',
                    icon: Icons.calculate_outlined,
                    onTap: () => context.push('/calculator'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: PochaSpacing.xl),
            const PochaSectionTitle(
              title: 'Tu mesa también tiene memoria',
              subtitle: 'Accesos rápidos a lo que sigues jugando.',
            ),
            PochaActionTile(
              title: 'Clasificación',
              subtitle: 'Mira tu posición y el ELO de la temporada',
              icon: Icons.emoji_events_outlined,
              onTap: () => context.go('/leaderboard'),
            ),
            const SizedBox(height: PochaSpacing.sm),
            PochaActionTile(
              title: 'Historial',
              subtitle: 'Revisa tus partidas y resultados',
              icon: Icons.auto_stories_outlined,
              onTap: () => context.go('/history'),
            ),
            const SizedBox(height: PochaSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: PochaSecondaryButton(
                    label: 'Cómo jugar',
                    icon: Icons.menu_book_outlined,
                    onPressed: () => context.push('/how-to-play'),
                  ),
                ),
                const SizedBox(width: PochaSpacing.sm),
                Expanded(
                  child: PochaSecondaryButton(
                    label: 'Perfil',
                    icon: Icons.person_outline,
                    onPressed: () => context.go('/profile'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroModeCard extends StatelessWidget {
  const _HeroModeCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '$title. $subtitle',
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(PochaRadius.large),
      child: Ink(
        padding: const EdgeInsets.all(PochaSpacing.lg),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(PochaRadius.large),
          border: Border.all(
            color: PochaColors.mutedGold.withValues(alpha: 0.68),
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x24123F35),
              blurRadius: 18,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(PochaRadius.medium),
              ),
              child: Icon(icon, color: PochaColors.ivoryBright, size: 30),
            ),
            const SizedBox(width: PochaSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_rounded,
              color: PochaColors.ivoryBright,
            ),
          ],
        ),
      ),
    ),
  );
}

class _CompactModeCard extends StatelessWidget {
  const _CompactModeCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '$title. $subtitle',
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(PochaRadius.medium),
      child: PochaSurface(
        padding: const EdgeInsets.all(PochaSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.secondary),
            const SizedBox(height: PochaSpacing.md),
            Text(title, style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 3),
            Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    ),
  );
}

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    unawaited(_route());
  }

  Future<void> _route() async {
    final complete = await ProductPreferences.onboardingComplete();
    if (!mounted) return;
    context.go(complete ? '/' : '/onboarding');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 78,
            height: 78,
            decoration: BoxDecoration(
              color: PochaColors.table,
              borderRadius: BorderRadius.circular(PochaRadius.large),
            ),
            child: const Icon(
              Icons.style_rounded,
              color: PochaColors.ivoryBright,
              size: 42,
            ),
          ),
          const SizedBox(height: PochaSpacing.md),
          Text('La Pocha', style: Theme.of(context).textTheme.displayMedium),
          const SizedBox(height: PochaSpacing.xs),
          Text(
            'Tu mesa, tus reglas.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    ),
  );
}

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  var _page = 0;
  final _pages = const [
    _OnboardingStep(
      icon: Icons.calculate_outlined,
      eyebrow: '01 · La cuenta',
      title: 'Que nadie pierda la cuenta',
      body: 'Registra cada ronda de tu partida física con rapidez y claridad.',
    ),
    _OnboardingStep(
      icon: Icons.smart_toy_outlined,
      eyebrow: '02 · Entrena',
      title: 'Juega aunque estés solo',
      body:
          'Practica pujas, triunfo y bazas contra bots que respetan las reglas.',
    ),
    _OnboardingStep(
      icon: Icons.people_alt_outlined,
      eyebrow: '03 · La mesa',
      title: 'Cuando quieras, competimos',
      body:
          'Crea una sala, busca partida casual o sube tu rango en competitivo.',
    ),
    _OnboardingStep(
      icon: Icons.style_outlined,
      eyebrow: '04 · La Pocha',
      title: 'Piensa. Canta. Juega.',
      body:
          'La baza se gana con estrategia, pero la mesa se disfruta con gente.',
    ),
  ];

  Future<void> _finish() async {
    await ProductPreferences.setOnboardingComplete();
    analyticsClient.track(AnalyticsEvent.onboardingCompleted);
    if (mounted) context.go('/');
  }

  @override
  Widget build(BuildContext context) {
    final step = _pages[_page];
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(PochaSpacing.lg),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: PochaTextButton(label: 'SALTAR', onPressed: _finish),
              ),
              const Spacer(),
              Container(
                width: 112,
                height: 112,
                decoration: BoxDecoration(
                  color: PochaColors.table,
                  borderRadius: BorderRadius.circular(PochaRadius.large),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x22123F35),
                      blurRadius: 22,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: Icon(
                  step.icon,
                  color: PochaColors.ivoryBright,
                  size: 54,
                ),
              ),
              const SizedBox(height: PochaSpacing.xxl),
              PochaEyebrow(step.eyebrow),
              const SizedBox(height: PochaSpacing.sm),
              Text(
                step.title,
                style: Theme.of(context).textTheme.displayMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: PochaSpacing.md),
              Text(
                step.body,
                style: Theme.of(context).textTheme.bodyLarge,
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var index = 0; index < _pages.length; index++)
                    AnimatedContainer(
                      duration: PochaMotion.duration(context, PochaMotion.fast),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: index == _page ? 28 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: index == _page
                            ? PochaColors.terracotta
                            : Theme.of(context).colorScheme.outline,
                        borderRadius: BorderRadius.circular(PochaRadius.pill),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: PochaSpacing.lg),
              PochaPrimaryButton(
                label: _page == _pages.length - 1 ? 'EMPEZAR' : 'CONTINUAR',
                icon: _page == _pages.length - 1
                    ? Icons.check_rounded
                    : Icons.arrow_forward_rounded,
                onPressed: () {
                  if (_page == _pages.length - 1) {
                    _finish();
                  } else {
                    setState(() => _page++);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OnboardingStep {
  const _OnboardingStep({
    required this.icon,
    required this.eyebrow,
    required this.title,
    required this.body,
  });
  final IconData icon;
  final String eyebrow;
  final String title;
  final String body;
}

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  bool _loading = false;
  String? _error;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool get _showAppleProvider => Platform.isIOS;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _guest() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = await developmentAuthPort(
        baseUrl: productServerUrl,
      ).signInAsGuest(displayName: 'Jugador');
      await AuthSessionStore().save(auth);
      if (mounted) context.push('/username', extra: auth);
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = _authErrorMessage(
            error,
            fallback:
                'No se ha podido abrir una sesión invitada. Comprueba la conexión.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Tu cuenta')),
    body: ListView(
      padding: const EdgeInsets.all(PochaSpacing.lg),
      children: [
        const PochaEyebrow('Tu identidad en la mesa'),
        const SizedBox(height: PochaSpacing.xs),
        Text(
          'Juega como quieras.',
          style: Theme.of(context).textTheme.displayMedium,
        ),
        const SizedBox(height: PochaSpacing.sm),
        Text(
          'Puedes empezar como invitado y vincular una cuenta permanente cuando quieras jugar ranked.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: PochaSpacing.xl),
        PochaPrimaryButton(
          label: 'CONTINUAR COMO INVITADO',
          icon: Icons.person_outline,
          loading: _loading,
          onPressed: _guest,
        ),
        const SizedBox(height: PochaSpacing.sm),
        PochaSecondaryButton(
          label: 'INICIAR SESIÓN',
          icon: Icons.login_rounded,
          onPressed: () => _showProviderInfo(context, register: false),
        ),
        const SizedBox(height: PochaSpacing.sm),
        PochaSecondaryButton(
          label: 'CREAR CUENTA',
          icon: Icons.person_add_alt_1_rounded,
          onPressed: () => _showProviderInfo(context, register: true),
        ),
        const SizedBox(height: PochaSpacing.lg),
        PochaSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Proveedores preparados',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: PochaSpacing.xs),
              Text(
                _showAppleProvider
                    ? 'Email, Google y Apple usan AuthPort y Firebase en builds externas.'
                    : 'Email y Google usan AuthPort y Firebase en la build Android.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: PochaSpacing.md),
          PochaErrorView(message: _error!, onRetry: _guest),
        ],
      ],
    ),
  );

  Future<void> _completeAuth(Future<AuthSession> Function() action) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = await action();
      await AuthSessionStore().save(auth);
      if (mounted) {
        context.push('/username', extra: auth);
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = _authErrorMessage(
            error,
            fallback: 'No se ha podido iniciar sesión. Comprueba los datos.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _emailAuth({required bool register}) {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.length < 6) {
      setState(
        () => _error =
            'Escribe un email y una contraseña de al menos 6 caracteres.',
      );
      return Future<void>.value();
    }
    return _completeAuth(
      () => register
          ? developmentAuthPort(
              baseUrl: productServerUrl,
            ).registerWithEmail(email: email, password: password)
          : developmentAuthPort(
              baseUrl: productServerUrl,
            ).signInWithEmail(email: email, password: password),
    );
  }

  Future<void> _providerAuth({required bool apple}) => _completeAuth(
    () => apple
        ? developmentAuthPort(baseUrl: productServerUrl).signInWithApple()
        : developmentAuthPort(baseUrl: productServerUrl).signInWithGoogle(),
  );

  String _authErrorMessage(Object error, {required String fallback}) {
    if (error is AuthConfigurationException) return error.message;
    return fallback;
  }

  void _showProviderInfo(BuildContext context, {required bool register}) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (context) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              PochaSpacing.lg,
              PochaSpacing.lg,
              PochaSpacing.lg,
              MediaQuery.viewInsetsOf(context).bottom + PochaSpacing.lg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  register ? 'Crear cuenta' : 'Iniciar sesión',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: PochaSpacing.sm),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                ),
                const SizedBox(height: PochaSpacing.sm),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Contraseña',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                ),
                const SizedBox(height: PochaSpacing.md),
                PochaPrimaryButton(
                  label: register ? 'CREAR CON EMAIL' : 'ENTRAR CON EMAIL',
                  icon: register ? Icons.person_add_alt_1_rounded : Icons.login,
                  loading: _loading,
                  onPressed: () {
                    Navigator.pop(context);
                    unawaited(_emailAuth(register: register));
                  },
                ),
                const SizedBox(height: PochaSpacing.sm),
                PochaSecondaryButton(
                  label: 'CONTINUAR CON GOOGLE',
                  icon: Icons.g_mobiledata_rounded,
                  onPressed: () {
                    Navigator.pop(context);
                    unawaited(_providerAuth(apple: false));
                  },
                ),
                const SizedBox(height: PochaSpacing.sm),
                if (_showAppleProvider)
                  PochaSecondaryButton(
                    label: 'CONTINUAR CON APPLE',
                    icon: Icons.apple,
                    onPressed: () {
                      Navigator.pop(context);
                      unawaited(_providerAuth(apple: true));
                    },
                  ),
                const SizedBox(height: PochaSpacing.sm),
                PochaSecondaryButton(
                  label: 'CERRAR',
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
        ),
      );
}

class UsernamePage extends StatefulWidget {
  const UsernamePage({this.auth, super.key});
  final AuthSession? auth;

  @override
  State<UsernamePage> createState() => _UsernamePageState();
}

class _UsernamePageState extends State<UsernamePage> {
  late final TextEditingController _controller = TextEditingController(
    text: 'Juan',
  );
  Timer? _debounce;
  String? _message;
  bool _checking = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _validate(String value) {
    _debounce?.cancel();
    setState(() {
      _checking = true;
      _message = null;
    });
    _debounce = Timer(const Duration(milliseconds: 280), () {
      final normalized = value.trim();
      final valid = RegExp(r'^[a-zA-Z0-9_ ]{3,20}$').hasMatch(normalized);
      if (mounted) {
        setState(() {
          _checking = false;
          _message = valid
              ? 'Nombre disponible'
              : 'Usa entre 3 y 20 letras, números o espacios.';
        });
      }
    });
  }

  Future<void> _save() async {
    final value = _controller.text.trim();
    if (_message != 'Nombre disponible') {
      _validate(value);
      return;
    }
    await ProductPreferences.saveUsername(value);
    if (mounted) context.go('/');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Tu nombre')),
    body: ListView(
      padding: const EdgeInsets.all(PochaSpacing.lg),
      children: [
        const PochaEyebrow('Visible para tu mesa'),
        const SizedBox(height: PochaSpacing.xs),
        Text(
          'Elige tu nombre',
          style: Theme.of(context).textTheme.displayMedium,
        ),
        const SizedBox(height: PochaSpacing.sm),
        Text(
          'Será el nombre que verán tus compañeros y rivales.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: PochaSpacing.xl),
        TextField(
          controller: _controller,
          autofocus: true,
          maxLength: 20,
          onChanged: _validate,
          decoration: InputDecoration(
            labelText: 'Username',
            prefixIcon: const Icon(Icons.alternate_email_rounded),
            suffixIcon: _checking
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : null,
          ),
        ),
        if (_message != null)
          Padding(
            padding: const EdgeInsets.only(top: PochaSpacing.xs),
            child: Text(
              _message!,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: _message == 'Nombre disponible'
                    ? PochaColors.success
                    : PochaColors.error,
              ),
            ),
          ),
        const SizedBox(height: PochaSpacing.lg),
        PochaPrimaryButton(
          label: 'GUARDAR NOMBRE',
          icon: Icons.check_rounded,
          onPressed: _save,
        ),
      ],
    ),
  );
}

class ProductLeaderboardPage extends StatefulWidget {
  const ProductLeaderboardPage({super.key});
  @override
  State<ProductLeaderboardPage> createState() => _ProductLeaderboardPageState();
}

class _ProductLeaderboardPageState extends State<ProductLeaderboardPage> {
  late final Future<AuthSession> _auth = developmentAuthPort(
    baseUrl: productServerUrl,
  ).signInAsDevelopmentAccount(userId: 'ranked_demo', displayName: 'Jugador');
  @override
  Widget build(BuildContext context) => FutureBuilder<AuthSession>(
    future: _auth,
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return Scaffold(
          appBar: AppBar(title: const Text('Clasificación')),
          body: snapshot.hasError
              ? Padding(
                  padding: const EdgeInsets.all(PochaSpacing.lg),
                  child: PochaErrorView(
                    message: 'No se ha podido cargar la clasificación.',
                  ),
                )
              : const PochaLoadingState(label: 'Cargando clasificación'),
        );
      }
      return RankedLeaderboardPage(
        baseUrl: productServerUrl,
        token: snapshot.data!.token,
      );
    },
  );
}

class ProductProfilePage extends StatefulWidget {
  const ProductProfilePage({super.key});
  @override
  State<ProductProfilePage> createState() => _ProductProfilePageState();
}

class _ProductProfilePageState extends State<ProductProfilePage> {
  late final Future<AuthSession> _auth = developmentAuthPort(
    baseUrl: productServerUrl,
  ).signInAsDevelopmentAccount(userId: 'ranked_demo', displayName: 'Jugador');
  @override
  Widget build(BuildContext context) => FutureBuilder<AuthSession>(
    future: _auth,
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return Scaffold(
          appBar: AppBar(title: const Text('Perfil')),
          body: snapshot.hasError
              ? Padding(
                  padding: const EdgeInsets.all(PochaSpacing.lg),
                  child: PochaErrorView(
                    message: 'No se ha podido cargar tu perfil.',
                  ),
                )
              : const PochaLoadingState(label: 'Cargando perfil'),
        );
      }
      return RankedProfilePage(
        baseUrl: productServerUrl,
        token: snapshot.data!.token,
      );
    },
  );
}

class ProductHistoryPage extends StatefulWidget {
  const ProductHistoryPage({super.key});
  @override
  State<ProductHistoryPage> createState() => _ProductHistoryPageState();
}

class _ProductHistoryPageState extends State<ProductHistoryPage> {
  late final Future<List<dynamic>> _history = Future.wait<dynamic>([
    CalculatorRepository().loadHistory(),
    _loadOnline(),
    _loadRanked(),
  ]);

  Future<List<OnlineHistoryItem>> _loadOnline() async {
    try {
      final port = developmentAuthPort(baseUrl: productServerUrl);
      final auth = await port.signInAsGuest(displayName: 'Jugador');
      return port.fetchHistory(auth.token);
    } catch (_) {
      return const [];
    }
  }

  Future<_RankedHistoryBundle> _loadRanked() async {
    try {
      final port = developmentAuthPort(baseUrl: productServerUrl);
      final auth = await port.signInAsDevelopmentAccount(
        userId: 'ranked_demo',
        displayName: 'Jugador',
      );
      final items = await ranked_data.RankedApi(
        baseUrl: productServerUrl,
        token: auth.token,
      ).history();
      return _RankedHistoryBundle(token: auth.token, items: items);
    } catch (_) {
      return const _RankedHistoryBundle(token: '', items: []);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Historial')),
    body: FutureBuilder<List<dynamic>>(
      future: _history,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return snapshot.hasError
              ? Padding(
                  padding: const EdgeInsets.all(PochaSpacing.lg),
                  child: PochaErrorView(
                    message: 'No se ha podido cargar el historial.',
                  ),
                )
              : const PochaLoadingState(label: 'Cargando historial');
        }

        final calculator = (snapshot.data![0] as List).cast<CalculatorGame>();
        final online = (snapshot.data![1] as List).cast<OnlineHistoryItem>();
        final ranked = snapshot.data![2] as _RankedHistoryBundle;
        if (calculator.isEmpty && online.isEmpty && ranked.items.isEmpty) {
          return const PochaEmptyView(
            title: 'Todavía no hay partidas',
            message: 'Cuando termines una partida aparecerá aquí.',
            icon: Icons.auto_stories_outlined,
          );
        }

        return ListView(
          padding: const EdgeInsets.all(PochaSpacing.lg),
          children: [
            if (calculator.isNotEmpty) ...[
              const PochaSectionTitle(
                title: 'Calculadora',
                subtitle: 'Tus partidas físicas guardadas',
              ),
              for (final game in calculator)
                PochaHistoryTile(
                  icon: Icons.calculate_outlined,
                  title: '${game.players.length} jugadores',
                  subtitle: '${game.rounds.length} rondas',
                  trailing: Text('${_bestScore(game)} pts'),
                  onTap: () => _openCalculatorDetail(context, game),
                ),
            ],
            if (online.isNotEmpty) ...[
              const SizedBox(height: PochaSpacing.md),
              const PochaSectionTitle(
                title: 'Online',
                subtitle: 'Partidas del servidor',
              ),
              for (final item in online)
                PochaHistoryTile(
                  icon: Icons.people_alt_outlined,
                  title: item.rulesetId,
                  subtitle:
                      item.finishedAt?.toLocal().toString() ?? 'Sin fecha',
                  trailing: Text(_shortId(item.gameId)),
                  onTap: () => _openOnlineDetail(context, item),
                ),
            ],
            if (ranked.items.isNotEmpty) ...[
              const SizedBox(height: PochaSpacing.md),
              const PochaSectionTitle(
                title: 'Ranked',
                subtitle: 'Tu historial de ELO y posiciones',
              ),
              for (final item in ranked.items)
                PochaHistoryTile(
                  icon: Icons.emoji_events_outlined,
                  title:
                      '${item.position}º · ${item.delta >= 0 ? '+' : ''}${item.delta} ELO',
                  subtitle: '${item.score} puntos · ${item.gameId}',
                  trailing: Text('${item.newRating} ELO'),
                  onTap: ranked.token.isEmpty
                      ? null
                      : () => Navigator.of(context).push<void>(
                          MaterialPageRoute(
                            builder: (_) => RankedResultPage(
                              baseUrl: productServerUrl,
                              token: ranked.token,
                              gameId: item.gameId,
                            ),
                          ),
                        ),
                ),
            ],
          ],
        );
      },
    ),
  );

  int _bestScore(CalculatorGame game) => game.players
      .map(game.totalFor)
      .fold<int>(0, (best, score) => score > best ? score : best);

  String _shortId(String id) => id.substring(0, id.length.clamp(0, 8));

  void _openCalculatorDetail(BuildContext context, CalculatorGame game) {
    Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => CalculatorHistoryDetail(game: game)),
    );
  }

  void _openOnlineDetail(BuildContext context, OnlineHistoryItem item) {
    Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => OnlineHistoryDetail(item: item)),
    );
  }
}

class _RankedHistoryBundle {
  const _RankedHistoryBundle({required this.token, required this.items});

  final String token;
  final List<ranked_data.RankedHistoryRow> items;
}

class CalculatorHistoryDetail extends StatelessWidget {
  const CalculatorHistoryDetail({required this.game, super.key});

  final CalculatorGame game;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Detalle de partida')),
    body: ListView(
      padding: const EdgeInsets.all(PochaSpacing.lg),
      children: [
        const PochaEyebrow('Historial · Calculadora'),
        const SizedBox(height: PochaSpacing.xs),
        Text(
          '${game.players.length} jugadores · ${game.rounds.length} rondas',
          style: Theme.of(context).textTheme.displayMedium,
        ),
        const SizedBox(height: PochaSpacing.sm),
        Text('Fecha: ${game.createdAt.toLocal()}'),
        const SizedBox(height: PochaSpacing.md),
        PochaSurface(
          child: Column(
            children: [
              for (final player in _orderedPlayers(game))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(player),
                  trailing: Text('${game.totalFor(player)} pts'),
                ),
            ],
          ),
        ),
      ],
    ),
  );

  List<String> _orderedPlayers(CalculatorGame game) =>
      [...game.players]
        ..sort((a, b) => game.totalFor(b).compareTo(game.totalFor(a)));
}

class OnlineHistoryDetail extends StatelessWidget {
  const OnlineHistoryDetail({required this.item, super.key});

  final OnlineHistoryItem item;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Detalle de partida')),
    body: ListView(
      padding: const EdgeInsets.all(PochaSpacing.lg),
      children: [
        const PochaEyebrow('Historial · Online'),
        const SizedBox(height: PochaSpacing.xs),
        Text(item.rulesetId, style: Theme.of(context).textTheme.displayMedium),
        const SizedBox(height: PochaSpacing.md),
        PochaSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Partida: ${item.gameId}'),
              const SizedBox(height: PochaSpacing.sm),
              Text(
                'Fecha: ${item.finishedAt?.toLocal() ?? 'Sin fecha registrada'}',
              ),
              const SizedBox(height: PochaSpacing.sm),
              const Text(
                'Los detalles de puntuación dependen del snapshot guardado por el servidor.',
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  ThemeMode _theme = ThemeMode.system;
  bool _reduceMotion = false;
  bool _haptics = true;
  bool _sound = true;
  bool _music = false;
  bool _notifications = true;
  AuthSession? _session;
  bool _deleting = false;
  String? _accountError;
  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final values = await Future.wait<dynamic>([
      ProductPreferences.themeMode(),
      ProductPreferences.getBool(ProductPreferences.reduceMotionKey),
      ProductPreferences.getBool(ProductPreferences.hapticsKey, fallback: true),
      ProductPreferences.getBool(ProductPreferences.soundKey, fallback: true),
      ProductPreferences.getBool(ProductPreferences.musicKey),
      ProductPreferences.getBool(
        ProductPreferences.notificationsKey,
        fallback: true,
      ),
      AuthSessionStore().read(),
    ]);
    if (mounted) {
      setState(() {
        _theme = values[0] as ThemeMode;
        _reduceMotion = values[1] as bool;
        _haptics = values[2] as bool;
        _sound = values[3] as bool;
        _music = values[4] as bool;
        _notifications = values[5] as bool;
        _session = values[6] as AuthSession?;
      });
    }
  }

  Future<void> _toggle(String key, bool value, void Function() update) async {
    update();
    if (key == ProductPreferences.reduceMotionKey) {
      appReduceMotion.value = value;
    }
    await ProductPreferences.setBool(key, value);
  }

  Future<void> _deleteAccount() async {
    final session = _session;
    if (session == null) {
      setState(
        () => _accountError = 'No hay una sesión guardada en este dispositivo.',
      );
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Eliminar cuenta'),
        content: const Text(
          'Se eliminarán tus identificadores personales. Las partidas históricas se conservarán anonimizadas.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('CANCELAR'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('ELIMINAR'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _deleting = true;
      _accountError = null;
    });
    try {
      await AccountApi(baseUrl: productServerUrl).deleteAccount(session.token);
      await Future.wait([
        CalculatorRepository().clearAccountData(),
        SinglePlayerRepository().clearAccountData(),
        ProductPreferences.clearAccountData(),
        AuthSessionStore().clear(),
      ]);
      if (mounted) context.go('/auth');
    } catch (_) {
      if (mounted) {
        setState(
          () => _accountError =
              'No se pudo eliminar la cuenta. Comprueba la conexión e inténtalo de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  Future<void> _signOut() async {
    try {
      if (!isDevelopmentAuthMode) {
        await FirebaseAuthPort(baseUrl: productServerUrl).signOut();
      }
    } catch (_) {
      // Local credentials must still be removed if the provider is offline.
    } finally {
      await AuthSessionStore().clear();
    }
    if (mounted) context.go('/auth');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Ajustes')),
    body: ListView(
      padding: const EdgeInsets.all(PochaSpacing.lg),
      children: [
        const PochaEyebrow('Tu forma de jugar'),
        const SizedBox(height: PochaSpacing.xs),
        Text('Ajustes', style: Theme.of(context).textTheme.displayMedium),
        const SizedBox(height: PochaSpacing.lg),
        PochaSurface(
          child: Column(
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Apariencia'),
                subtitle: const Text('Elige cómo quieres ver la mesa'),
                trailing: DropdownButton<ThemeMode>(
                  value: _theme,
                  underline: const SizedBox.shrink(),
                  items: const [
                    DropdownMenuItem(
                      value: ThemeMode.system,
                      child: Text('Sistema'),
                    ),
                    DropdownMenuItem(
                      value: ThemeMode.light,
                      child: Text('Clara'),
                    ),
                    DropdownMenuItem(
                      value: ThemeMode.dark,
                      child: Text('Oscura'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _theme = value);
                      appThemeMode.value = value;
                      ProductPreferences.saveThemeMode(value);
                    }
                  },
                ),
              ),
              const Divider(),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Reducir movimiento'),
                subtitle: const Text('Usar fades y transiciones cortas'),
                value: _reduceMotion,
                onChanged: (value) => _toggle(
                  ProductPreferences.reduceMotionKey,
                  value,
                  () => setState(() => _reduceMotion = value),
                ),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Vibración'),
                value: _haptics,
                onChanged: (value) => _toggle(
                  ProductPreferences.hapticsKey,
                  value,
                  () => setState(() => _haptics = value),
                ),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Sonido'),
                value: _sound,
                onChanged: (value) => _toggle(
                  ProductPreferences.soundKey,
                  value,
                  () => setState(() => _sound = value),
                ),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Música'),
                value: _music,
                onChanged: (value) => _toggle(
                  ProductPreferences.musicKey,
                  value,
                  () => setState(() => _music = value),
                ),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Notificaciones'),
                value: _notifications,
                onChanged: (value) => _toggle(
                  ProductPreferences.notificationsKey,
                  value,
                  () => setState(() => _notifications = value),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: PochaSpacing.md),
        PochaSurface(
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Privacidad'),
            subtitle: const Text(
              'No se publican email, proveedor ni identificadores internos.',
            ),
          ),
        ),
        const SizedBox(height: PochaSpacing.md),
        PochaSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.delete_forever_outlined),
                title: Text('Eliminar cuenta'),
                subtitle: Text(
                  'Anonimiza tus datos personales y conserva la integridad del historial.',
                ),
              ),
              const SizedBox(height: PochaSpacing.xs),
              OutlinedButton.icon(
                onPressed: _deleting ? null : _deleteAccount,
                icon: _deleting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.delete_outline),
                label: Text(_deleting ? 'ELIMINANDO…' : 'ELIMINAR CUENTA'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                ),
              ),
              if (_accountError != null) ...[
                const SizedBox(height: PochaSpacing.xs),
                Text(
                  _accountError!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: PochaSpacing.md),
        PochaSecondaryButton(
          label: 'CERRAR SESIÓN',
          icon: Icons.logout_rounded,
          onPressed: _signOut,
        ),
      ],
    ),
  );
}

class HowToPlayPage extends StatelessWidget {
  const HowToPlayPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Cómo jugar')),
    body: ListView(
      padding: const EdgeInsets.all(PochaSpacing.lg),
      children: [
        Text(
          'La Pocha, en la mesa',
          style: Theme.of(context).textTheme.displayMedium,
        ),
        const SizedBox(height: PochaSpacing.sm),
        Text(
          'Una guía corta para empezar sin perder la conversación.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: PochaSpacing.lg),
        const _RuleSection(
          title: 'La baraja',
          icon: Icons.style_outlined,
          body:
              'Se juega con una baraja española de 40 cartas: Oros, Copas, Espadas y Bastos.',
        ),
        const _RuleSection(
          title: 'Bazas',
          icon: Icons.layers_outlined,
          body:
              'Cada jugador juega una carta. Debes asistir al palo de salida cuando puedas.',
        ),
        const _RuleSection(
          title: 'Triunfo',
          icon: Icons.workspace_premium_outlined,
          body:
              'El palo de triunfo supera a los demás. En algunas variantes se elige después de cantar.',
        ),
        const _RuleSection(
          title: 'Cantar',
          icon: Icons.record_voice_over_outlined,
          body:
              'Antes de jugar, anuncia cuántas bazas crees que harás. El último canto puede tener una restricción.',
        ),
        const _RuleSection(
          title: 'Puntuación',
          icon: Icons.calculate_outlined,
          body:
              'Acertar suma una base más tus bazas. Fallar resta según la diferencia.',
        ),
        const _RuleSection(
          title: 'Subastas y variantes',
          icon: Icons.gavel_outlined,
          body:
              'Elige Subasta o reglas personalizadas cuando quieras cambiar cómo se decide el triunfo.',
        ),
        const SizedBox(height: PochaSpacing.md),
        PochaPrimaryButton(
          label: 'PROBAR UN TUTORIAL',
          icon: Icons.play_circle_outline,
          onPressed: () => context.push('/tutorial'),
        ),
      ],
    ),
  );
}

class _RuleSection extends StatelessWidget {
  const _RuleSection({
    required this.title,
    required this.icon,
    required this.body,
  });
  final String title;
  final IconData icon;
  final String body;
  @override
  Widget build(BuildContext context) => PochaSurface(
    margin: const EdgeInsets.only(bottom: PochaSpacing.sm),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.secondary),
        const SizedBox(width: PochaSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(body, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
      ],
    ),
  );
}

class TutorialPage extends StatefulWidget {
  const TutorialPage({super.key});
  @override
  State<TutorialPage> createState() => _TutorialPageState();
}

class _TutorialPageState extends State<TutorialPage> {
  late final LocalGameState _game;
  var _step = 0;
  @override
  void initState() {
    super.initState();
    _game = LocalGameEngine.create(
      gameId: 'tutorial',
      players: [
        LocalPlayer(id: 'human', name: 'Tú', human: true),
        LocalPlayer(id: 'bot-1', name: 'Ana', human: false),
        LocalPlayer(id: 'bot-2', name: 'Pablo', human: false),
      ],
      rules: GameRules.classic(playerCount: 3),
      seed: 17,
    );
    LocalGameEngine.startRound(_game);
  }

  void _next() {
    if (_step == 0) {
      LocalGameEngine.submitBid(
        _game,
        'human',
        LocalGameEngine.legalBids(_game).first,
      );
    } else if (_step == 1) {
      while (_game.currentPlayer.id != 'human') {
        LocalGameEngine.submitBid(_game, _game.currentPlayer.id, 0);
      }
      LocalGameEngine.submitBid(
        _game,
        'human',
        LocalGameEngine.legalBids(_game).first,
      );
    }
    setState(() => _step = (_step + 1).clamp(0, 2));
  }

  @override
  Widget build(BuildContext context) {
    final cards = _game.players.first.hand;
    final title = switch (_step) {
      0 => '1. Canta tu predicción',
      1 => '2. Sigue el palo',
      _ => '3. Lee la mesa',
    };
    final body = switch (_step) {
      0 => 'El motor ya ha preparado las opciones legales para esta ronda.',
      1 =>
        'Las cartas legales se muestran activas. Las demás quedan atenuadas.',
      _ => 'Mira el triunfo, la baza y el marcador antes de decidir.',
    };
    return Scaffold(
      appBar: AppBar(title: const Text('Tutorial guiado')),
      body: ListView(
        padding: const EdgeInsets.all(PochaSpacing.lg),
        children: [
          PochaEyebrow('Paso ${_step + 1} de 3'),
          const SizedBox(height: PochaSpacing.xs),
          Text(title, style: Theme.of(context).textTheme.displayMedium),
          const SizedBox(height: PochaSpacing.sm),
          Text(body, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: PochaSpacing.lg),
          PochaSurface(
            child: Column(
              children: [
                Text(
                  'Mesa de práctica',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: PochaSpacing.md),
                Wrap(
                  spacing: 6,
                  children: [
                    for (final card in cards.take(5))
                      PlayingCardWidget(card: card, width: 54, height: 81),
                  ],
                ),
                const SizedBox(height: PochaSpacing.md),
                Text(
                  'Triunfo: ${_game.trump == null ? 'pendiente' : suitLabel(_game.trump!)}',
                ),
              ],
            ),
          ),
          const SizedBox(height: PochaSpacing.lg),
          PochaPrimaryButton(
            label: _step == 2 ? 'TERMINAR' : 'SIGUIENTE',
            icon: _step == 2 ? Icons.check : Icons.arrow_forward,
            onPressed: _step == 2 ? () => context.pop() : _next,
          ),
        ],
      ),
    );
  }
}
