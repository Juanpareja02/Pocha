import 'package:flutter/material.dart';

import '../theme/theme.dart';

class PochaSurface extends StatelessWidget {
  const PochaSurface({
    required this.child,
    this.padding,
    this.color,
    this.margin,
    this.borderRadius,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? color;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) => Container(
    margin: margin,
    padding: padding ?? const EdgeInsets.all(PochaSpacing.md),
    decoration: BoxDecoration(
      color: color ?? Theme.of(context).cardTheme.color,
      borderRadius: borderRadius ?? BorderRadius.circular(PochaRadius.medium),
      border: Border.all(
        color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.5),
      ),
    ),
    child: child,
  );
}

class PochaSectionTitle extends StatelessWidget {
  const PochaSectionTitle({
    required this.title,
    this.subtitle,
    this.action,
    super.key,
  });

  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: PochaSpacing.sm),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ],
          ),
        ),
        action ?? const SizedBox.shrink(),
      ],
    ),
  );
}

class PochaEyebrow extends StatelessWidget {
  const PochaEyebrow(this.text, {this.color, super.key});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: Theme.of(context).textTheme.labelSmall?.copyWith(
      color: color ?? Theme.of(context).colorScheme.secondary,
    ),
  );
}
