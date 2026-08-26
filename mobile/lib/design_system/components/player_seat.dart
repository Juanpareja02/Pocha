import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../theme/theme.dart';
import 'pocha_avatar.dart';
import 'turn_timer.dart';

class PochaPlayerSeat extends StatelessWidget {
  const PochaPlayerSeat({
    required this.name,
    this.avatarSeed = 0,
    this.bid,
    this.tricksWon = 0,
    this.score = 0,
    this.isCurrent = false,
    this.isDealer = false,
    this.isBot = false,
    this.isWinner = false,
    this.connection = PochaAvatarStatus.online,
    this.timerDeadline,
    this.compact = false,
    super.key,
  });

  final String name;
  final int avatarSeed;
  final int? bid;
  final int tricksWon;
  final int score;
  final bool isCurrent;
  final bool isDealer;
  final bool isBot;
  final bool isWinner;
  final PochaAvatarStatus connection;
  final DateTime? timerDeadline;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final border = isCurrent
        ? Theme.of(context).colorScheme.tertiary
        : Colors.transparent;
    final strings = AppStrings.of(context);
    final semanticLabel = [
      name,
      strings.bidAndTricks(bid, tricksWon),
      strings.score(score),
      if (isCurrent) strings.turn,
      if (isBot) 'Bot',
      if (isWinner) 'Ganador',
    ].join('. ');
    return Semantics(
      container: true,
      label: semanticLabel,
      child: AnimatedContainer(
        duration: PochaMotion.duration(context, PochaMotion.normal),
        constraints: BoxConstraints(maxWidth: compact ? 132 : 170),
        padding: EdgeInsets.all(compact ? PochaSpacing.xs : PochaSpacing.sm),
        decoration: BoxDecoration(
          color: isCurrent
              ? Theme.of(context).colorScheme.tertiary.withValues(alpha: 0.18)
              : Theme.of(context).colorScheme.surface.withValues(alpha: 0.94),
          borderRadius: BorderRadius.circular(PochaRadius.medium),
          border: Border.all(color: border, width: isCurrent ? 2 : 1),
          boxShadow: [
            if (isCurrent)
              BoxShadow(
                color: Theme.of(
                  context,
                ).colorScheme.tertiary.withValues(alpha: 0.2),
                blurRadius: 12,
              ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                PochaAvatar(
                  name: name,
                  seed: avatarSeed,
                  status: isWinner
                      ? PochaAvatarStatus.winner
                      : isCurrent
                      ? PochaAvatarStatus.turn
                      : connection,
                  size: compact ? 34 : 44,
                ),
                if (isDealer)
                  Positioned(
                    top: -5,
                    left: -5,
                    child: _SeatMark(
                      icon: Icons.local_play_outlined,
                      label: 'Repartidor',
                    ),
                  ),
                if (isBot)
                  Positioned(
                    bottom: -5,
                    left: -5,
                    child: _SeatMark(
                      icon: Icons.smart_toy_outlined,
                      label: 'Bot',
                    ),
                  ),
              ],
            ),
            const SizedBox(height: PochaSpacing.xxs),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelLarge,
            ),
            if (!compact) ...[
              const SizedBox(height: 3),
              Text(
                strings.bidAndTricks(bid, tricksWon),
                style: Theme.of(context).textTheme.labelSmall,
              ),
              Text(
                strings.score(score),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ],
            if (isCurrent && timerDeadline != null) ...[
              const SizedBox(height: 4),
              TurnTimer(deadline: timerDeadline, compact: true),
            ],
          ],
        ),
      ),
    );
  }
}

class _SeatMark extends StatelessWidget {
  const _SeatMark({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
    label: label,
    child: Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondary,
        shape: BoxShape.circle,
        border: Border.all(
          color: Theme.of(context).scaffoldBackgroundColor,
          width: 1.5,
        ),
      ),
      child: Icon(
        icon,
        size: 11,
        color: Theme.of(context).colorScheme.onSecondary,
      ),
    ),
  );
}
