import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../theme/theme.dart';
import 'playing_card_widget.dart';
import 'pocha_buttons.dart';
import 'pocha_surface.dart';

class PochaErrorView extends StatelessWidget {
  const PochaErrorView({
    required this.message,
    this.title = 'Algo no ha salido bien',
    this.onRetry,
    this.onBack,
    super.key,
  });

  final String title;
  final String message;
  final VoidCallback? onRetry;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return PochaSurface(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.error_outline_rounded,
                color: Theme.of(context).colorScheme.onErrorContainer,
              ),
              const SizedBox(width: PochaSpacing.xs),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onErrorContainer,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: PochaSpacing.xs),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onErrorContainer,
            ),
          ),
          if (onRetry != null || onBack != null) ...[
            const SizedBox(height: PochaSpacing.sm),
            Wrap(
              spacing: PochaSpacing.xs,
              children: [
                if (onRetry != null)
                  PochaSecondaryButton(
                    label: strings.retry,
                    icon: Icons.refresh_rounded,
                    onPressed: onRetry,
                    expand: false,
                  ),
                if (onBack != null)
                  PochaTextButton(
                    label: strings.back,
                    icon: Icons.arrow_back_rounded,
                    onPressed: onBack,
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class PochaEmptyView extends StatelessWidget {
  const PochaEmptyView({
    required this.title,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.action,
    super.key,
  });

  final String title;
  final String message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(PochaSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48, color: Theme.of(context).colorScheme.secondary),
          const SizedBox(height: PochaSpacing.md),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: PochaSpacing.xs),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[
            const SizedBox(height: PochaSpacing.md),
            action!,
          ],
        ],
      ),
    ),
  );
}

class PochaOfflineBanner extends StatelessWidget {
  const PochaOfflineBanner({
    this.message = 'Sin conexión. Puedes seguir jugando offline.',
    super.key,
  });

  final String message;

  @override
  Widget build(BuildContext context) => MaterialBanner(
    padding: const EdgeInsets.all(PochaSpacing.sm),
    leading: const Icon(Icons.cloud_off_rounded),
    content: Text(message),
    actions: const [SizedBox.shrink()],
  );
}

class PochaReconnectBanner extends StatelessWidget {
  const PochaReconnectBanner({
    required this.connected,
    this.onRetry,
    super.key,
  });

  final bool connected;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return AnimatedSwitcher(
      duration: PochaMotion.duration(context, PochaMotion.normal),
      child: connected
          ? const SizedBox.shrink(key: ValueKey('connected'))
          : MaterialBanner(
              key: const ValueKey('reconnecting'),
              padding: const EdgeInsets.all(PochaSpacing.sm),
              leading: const Icon(Icons.sync_problem_rounded),
              content: Text(strings.reconnecting),
              actions: [
                if (onRetry != null)
                  TextButton(onPressed: onRetry, child: Text(strings.retry)),
              ],
            ),
    );
  }
}

class PochaLoadingState extends StatelessWidget {
  const PochaLoadingState({
    this.label = 'Cargando',
    this.cardMotif = true,
    super.key,
  });

  final String label;
  final bool cardMotif;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (cardMotif)
            SizedBox(
              width: 48,
              height: 68,
              child: PlayingCardWidget.faceDown(
                semanticLabel: strings.cardLoading,
              ),
            )
          else
            const CircularProgressIndicator(),
          const SizedBox(height: PochaSpacing.md),
          Text(label, style: Theme.of(context).textTheme.labelLarge),
        ],
      ),
    );
  }
}
