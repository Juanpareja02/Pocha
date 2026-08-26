import 'package:flutter/material.dart';

import '../../features/game/domain/pocha_engine.dart';
import '../theme/theme.dart';
import 'playing_card_widget.dart';

class TrickCardView {
  const TrickCardView({required this.playerName, required this.card});

  final String playerName;
  final PochaCard card;
}

class TrickArea extends StatelessWidget {
  const TrickArea({
    required this.cards,
    this.winnerName,
    this.emptyLabel = 'La baza aparecerá aquí',
    super.key,
  });

  final List<TrickCardView> cards;
  final String? winnerName;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    final table =
        Theme.of(context).extension<GameTableTheme>() ??
        tableTheme(Theme.of(context).brightness);
    return Semantics(
      container: true,
      label: cards.isEmpty ? emptyLabel : 'Baza actual, ${cards.length} cartas',
      child: AnimatedSwitcher(
        duration: PochaMotion.duration(context, PochaMotion.normal),
        child: cards.isEmpty
            ? Container(
                key: const ValueKey('empty-trick'),
                padding: const EdgeInsets.all(PochaSpacing.md),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(PochaRadius.large),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.18),
                  ),
                ),
                child: Text(
                  emptyLabel,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: table.onFelt.withValues(alpha: 0.72),
                  ),
                ),
              )
            : Column(
                key: ValueKey(cards.map((item) => item.card.id).join('|')),
                mainAxisSize: MainAxisSize.min,
                children: [
                  Wrap(
                    spacing: PochaSpacing.xs,
                    runSpacing: PochaSpacing.xs,
                    alignment: WrapAlignment.center,
                    children: [
                      for (final item in cards) _TrickCard(item: item),
                    ],
                  ),
                  if (winnerName != null) ...[
                    const SizedBox(height: PochaSpacing.xs),
                    Text(
                      'Gana $winnerName',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: Theme.of(context).colorScheme.tertiary,
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

class _TrickCard extends StatelessWidget {
  const _TrickCard({required this.item});

  final TrickCardView item;

  @override
  Widget build(BuildContext context) {
    final table =
        Theme.of(context).extension<GameTableTheme>() ??
        tableTheme(Theme.of(context).brightness);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          item.playerName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: table.onFelt),
        ),
        const SizedBox(height: 3),
        PlayingCardWidget(card: item.card, width: 48, height: 72, played: true),
      ],
    );
  }
}
