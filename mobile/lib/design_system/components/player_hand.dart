import 'package:flutter/material.dart';

import '../../features/game/domain/pocha_engine.dart';
import '../../l10n/app_strings.dart';
import '../theme/theme.dart';
import 'playing_card_widget.dart';

class PlayerHand extends StatelessWidget {
  const PlayerHand({
    required this.cards,
    this.legalCardIds,
    this.selectedCard,
    this.onCardTap,
    this.onPlaySelected,
    this.helperText,
    super.key,
  });

  final List<PochaCard> cards;
  final Set<String>? legalCardIds;
  final PochaCard? selectedCard;
  final ValueChanged<PochaCard>? onCardTap;
  final VoidCallback? onPlaySelected;
  final String? helperText;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final legal = legalCardIds ?? cards.map((card) => card.id).toSet();
    return Semantics(
      container: true,
      label: strings.handSemantics(cards.length),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (helperText != null)
            Padding(
              padding: const EdgeInsets.only(bottom: PochaSpacing.xs),
              child: Text(
                helperText!,
                style: Theme.of(context).textTheme.labelMedium,
                textAlign: TextAlign.center,
              ),
            ),
          LayoutBuilder(
            builder: (context, constraints) {
              if (cards.isEmpty) return const SizedBox.shrink();
              final available = constraints.maxWidth;
              final cardWidth = cards.length <= 5
                  ? (available / cards.length).clamp(48.0, 72.0)
                  : (available / (1 + 0.58 * (cards.length - 1))).clamp(
                      32.0,
                      68.0,
                    );
              final cardHeight = cardWidth * 1.5;
              final gap = cards.length <= 5
                  ? cards.length == 1
                        ? 0.0
                        : ((available - cardWidth * cards.length) /
                                  (cards.length - 1))
                              .clamp(0.0, 5.0)
                  : 0.0;
              final step = cards.length <= 5
                  ? cardWidth + gap
                  : cardWidth * 0.58;
              final width = cardWidth + (cards.length - 1) * step;
              return SizedBox(
                height: cardHeight + 20,
                child: Center(
                  child: SizedBox(
                    width: width,
                    height: cardHeight + 20,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        for (var index = 0; index < cards.length; index++)
                          Positioned(
                            left: index * step,
                            top: selectedCard?.id == cards[index].id ? 0 : 10,
                            child: PlayingCardWidget(
                              card: cards[index],
                              width: cardWidth,
                              height: cardHeight,
                              legal: legal.contains(cards[index].id),
                              selected: selectedCard?.id == cards[index].id,
                              onTap: onCardTap == null
                                  ? null
                                  : () => onCardTap!(cards[index]),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          if (onPlaySelected != null)
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: selectedCard == null ? null : onPlaySelected,
                icon: const Icon(Icons.play_arrow_rounded),
                label: Text(strings.playCard),
              ),
            ),
        ],
      ),
    );
  }
}
