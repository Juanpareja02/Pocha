import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../theme/theme.dart';
import 'pocha_surface.dart';

class PochaPrimaryButton extends StatelessWidget {
  const PochaPrimaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.expand = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final button = FilledButton.icon(
      onPressed: loading ? null : onPressed,
      icon: loading
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(icon ?? Icons.arrow_forward_rounded),
      label: Text(loading ? '${strings.loading}…' : label),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

class PochaSecondaryButton extends StatelessWidget {
  const PochaSecondaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.expand = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final button = OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon ?? Icons.chevron_right_rounded),
      label: Text(label),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

class PochaTextButton extends StatelessWidget {
  const PochaTextButton({
    required this.label,
    required this.onPressed,
    this.icon,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => TextButton.icon(
    onPressed: onPressed,
    icon: icon == null ? const SizedBox.shrink() : Icon(icon),
    label: Text(label),
  );
}

class PochaActionTile extends StatelessWidget {
  const PochaActionTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.accent,
    super.key,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
  final Color? accent;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '$title. $subtitle',
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(PochaRadius.medium),
      child: PochaSurface(
        color: accent ?? Theme.of(context).cardTheme.color,
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Theme.of(
                  context,
                ).colorScheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(PochaRadius.small),
              ),
              child: Icon(icon, color: Theme.of(context).colorScheme.primary),
            ),
            const SizedBox(width: PochaSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
            const SizedBox(width: PochaSpacing.xs),
            Icon(
              Icons.arrow_forward_rounded,
              color: Theme.of(context).colorScheme.secondary,
            ),
          ],
        ),
      ),
    ),
  );
}
