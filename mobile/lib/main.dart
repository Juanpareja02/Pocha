import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/config/runtime_config.dart';
import 'design_system/pocha_design_system.dart';
import 'core/observability/crash_reporter.dart';
import 'l10n/app_strings.dart';
import 'features/calculator/presentation/calculator_page.dart';
import 'features/game/domain/pocha_engine.dart';
import 'features/online/domain/auth_port.dart';
import 'features/online/domain/room_deep_link.dart';
import 'features/online/presentation/online_pages.dart';
import 'features/product/data/product_preferences.dart';
import 'features/product/presentation/product_pages.dart';
import 'features/ranked/presentation/ranked_pages.dart';
import 'features/single_player/presentation/single_player_page.dart';

final rulesProvider = Provider<GameRules>((_) => GameRules.classic());

final appRouter = GoRouter(
  initialLocation: '/splash',
  errorBuilder: (context, state) => RouteErrorPage(error: state.error),
  routes: [
    GoRoute(path: '/splash', builder: (_, _) => const SplashPage()),
    GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingPage()),
    GoRoute(path: '/auth', builder: (_, _) => const AuthPage()),
    GoRoute(
      path: '/username',
      builder: (_, state) => UsernamePage(
        auth: state.extra is AuthSession ? state.extra as AuthSession : null,
      ),
    ),
    ShellRoute(
      builder: (context, state, child) =>
          PochaAppShell(location: state.uri.path, child: child),
      routes: [
        GoRoute(path: '/', builder: (_, _) => const HomePage()),
        GoRoute(
          path: '/leaderboard',
          builder: (_, _) => const ProductLeaderboardPage(),
        ),
        GoRoute(
          path: '/history',
          builder: (_, _) => const ProductHistoryPage(),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, _) => const ProductProfilePage(),
        ),
      ],
    ),
    GoRoute(path: '/calculator', builder: (_, _) => const CalculatorPage()),
    GoRoute(
      path: '/single-player',
      builder: (_, _) => const SinglePlayerPage(),
    ),
    GoRoute(path: '/multiplayer', builder: (_, _) => const OnlineHomePage()),
    GoRoute(path: '/online', builder: (_, _) => const OnlineHomePage()),
    GoRoute(path: '/ranked', builder: (_, _) => const RankedHomePage()),
    GoRoute(path: '/settings', builder: (_, _) => const SettingsPage()),
    GoRoute(path: '/how-to-play', builder: (_, _) => const HowToPlayPage()),
    GoRoute(path: '/tutorial', builder: (_, _) => const TutorialPage()),
    GoRoute(
      path: '/join/:code',
      builder: (_, state) => JoinRoomPage(
        initialCode: RoomDeepLink.parse(
          '/join/${state.pathParameters['code'] ?? ''}',
        )?.code,
      ),
    ),
  ],
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  validateMobileRuntimeConfig(release: kReleaseMode);
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    unawaited(
      crashReporter.report(
        details.exception,
        details.stack ?? StackTrace.current,
        reason: details.context?.toString(),
      ),
    );
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    unawaited(crashReporter.report(error, stack));
    return true;
  };
  appThemeMode.value = await ProductPreferences.themeMode();
  appReduceMotion.value = await ProductPreferences.getBool(
    ProductPreferences.reduceMotionKey,
  );
  runApp(const ProviderScope(child: PochaApp()));
}

class PochaApp extends StatelessWidget {
  const PochaApp({super.key});

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<ThemeMode>(
    valueListenable: appThemeMode,
    builder: (context, themeMode, _) => ValueListenableBuilder<bool>(
      valueListenable: appReduceMotion,
      builder: (context, reduceMotion, _) => MaterialApp.router(
        title: 'La Pocha',
        debugShowCheckedModeBanner: false,
        routerConfig: appRouter,
        theme: pochaTheme(Brightness.light),
        darkTheme: pochaTheme(Brightness.dark),
        themeMode: themeMode,
        localizationsDelegates: const [
          AppStrings.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('es')],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(disableAnimations: reduceMotion),
          child: child!,
        ),
      ),
    ),
  );
}

class RouteErrorPage extends StatelessWidget {
  const RouteErrorPage({required this.error, super.key});

  final GoException? error;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.appName)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(PochaSpacing.lg),
          child: PochaErrorView(
            message: 'No se ha podido abrir esta pantalla.',
            onRetry: () => context.go('/'),
          ),
        ),
      ),
    );
  }
}
