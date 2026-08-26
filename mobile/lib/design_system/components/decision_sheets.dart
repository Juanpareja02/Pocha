import 'package:flutter/material.dart';

import '../../features/game/domain/pocha_engine.dart';
import '../../l10n/app_strings.dart';
import '../theme/theme.dart';
import 'pocha_surface.dart';
import 'suit_symbol.dart';

/// Embedded bottom-sheet treatment used when the player must make a bid.
/// The caller supplies legal values from the domain/controller.
class BidSheet extends StatelessWidget {
  const BidSheet({
    required this.cardsPerRound,
    required this.legalBids,
    required this.onBid,
    this.restrictionMessage,
    this.illegalExplanation,
    super.key,
  });

  final int cardsPerRound;
  final List<int> legalBids;
  final ValueChanged<int> onBid;
  final String? restrictionMessage;
  final String? illegalExplanation;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return PochaSurface(
      margin: const EdgeInsets.fromLTRB(
        PochaSpacing.xs,
        PochaSpacing.xxs,
        PochaSpacing.xs,
        PochaSpacing.sm,
      ),
      child: Padding(
        padding: const EdgeInsets.all(PochaSpacing.sm),
        child: Column(
          children: [
            Text(
              strings.bidQuestion,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: PochaSpacing.xs),
            Semantics(
              container: true,
              label: 'Opciones de puja, de 0 a $cardsPerRound',
              child: Wrap(
                spacing: PochaSpacing.xs,
                runSpacing: PochaSpacing.xs,
                alignment: WrapAlignment.center,
                children: [
                  for (var value = 0; value <= cardsPerRound; value++)
                    ChoiceChip(
                      label: Text('$value'),
                      selected: false,
                      onSelected: legalBids.contains(value)
                          ? (_) => onBid(value)
                          : null,
                    ),
                ],
              ),
            ),
            if (restrictionMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: PochaSpacing.xs),
                child: Text(
                  restrictionMessage!,
                  style: Theme.of(context).textTheme.bodySmall,
                  textAlign: TextAlign.center,
                ),
              ),
            if (illegalExplanation != null)
              Padding(
                padding: const EdgeInsets.only(top: PochaSpacing.xxs),
                child: Text(
                  illegalExplanation!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Embedded bottom-sheet treatment used when the player must choose trump.
class TrumpSheet extends StatelessWidget {
  const TrumpSheet({
    required this.onTrump,
    this.allowNoTrump = false,
    super.key,
  });

  final ValueChanged<Suit?> onTrump;
  final bool allowNoTrump;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return PochaSurface(
      margin: const EdgeInsets.fromLTRB(
        PochaSpacing.xs,
        PochaSpacing.xxs,
        PochaSpacing.xs,
        PochaSpacing.sm,
      ),
      child: Padding(
        padding: const EdgeInsets.all(PochaSpacing.sm),
        child: Column(
          children: [
            Text(
              strings.chooseTrump,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: PochaSpacing.xs),
            Semantics(
              container: true,
              label: 'Palos de triunfo',
              child: Wrap(
                spacing: PochaSpacing.xs,
                runSpacing: PochaSpacing.xs,
                alignment: WrapAlignment.center,
                children: [
                  for (final suit in Suit.values)
                    ChoiceChip(
                      label: Text(suitLabel(suit)),
                      selected: false,
                      onSelected: (_) => onTrump(suit),
                    ),
                  if (allowNoTrump)
                    ChoiceChip(
                      label: Text(strings.noTrump),
                      selected: false,
                      onSelected: (_) => onTrump(null),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
