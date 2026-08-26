import 'package:flutter/material.dart';

import '../theme/theme.dart';
import 'pocha_surface.dart';

/// Shared presentation for calculator, online and ranked history entries.
class PochaHistoryTile extends StatelessWidget {
  const PochaHistoryTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    this.trailing,
    this.onTap,
    super.key,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => PochaSurface(
    margin: const EdgeInsets.only(bottom: PochaSpacing.sm),
    child: ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: Theme.of(context).colorScheme.secondary),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: trailing,
      onTap: onTap,
    ),
  );
}
