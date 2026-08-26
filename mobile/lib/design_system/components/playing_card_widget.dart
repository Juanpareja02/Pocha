import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../features/game/domain/pocha_engine.dart';
import '../theme/theme.dart';
import 'suit_symbol.dart';

class PlayingCardWidget extends StatelessWidget {
  const PlayingCardWidget({
    required this.card,
    this.selected = false,
    this.legal = true,
    this.played = false,
    this.faceDown = false,
    this.onTap,
    this.width = 72,
    this.height = 108,
    this.semanticLabel,
    super.key,
  });

  const PlayingCardWidget.faceDown({
    this.width = 72,
    this.height = 108,
    this.onTap,
    this.semanticLabel,
    super.key,
  }) : card = null,
       selected = false,
       legal = true,
       played = false,
       faceDown = true;

  final PochaCard? card;
  final bool selected;
  final bool legal;
  final bool played;
  final bool faceDown;
  final VoidCallback? onTap;
  final double width;
  final double height;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final cardTheme =
        Theme.of(context).extension<PlayingCardTheme>() ??
        cardThemeFor(Theme.of(context).brightness);
    final label =
        semanticLabel ??
        (faceDown
            ? 'Carta boca abajo'
            : card == null
            ? 'Carta'
            : '${rankName(card!.rank)} de ${suitLabel(card!.suit)}${legal ? '' : ', no legal'}');
    return Semantics(
      button: onTap != null,
      label: label,
      enabled: onTap != null && legal,
      selected: selected,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: legal ? onTap : null,
        child: AnimatedOpacity(
          opacity: legal ? 1 : 0.38,
          duration: PochaMotion.duration(context, PochaMotion.fast),
          child: AnimatedContainer(
            duration: PochaMotion.duration(context, PochaMotion.fast),
            curve: PochaMotion.curve,
            transform: Matrix4.translationValues(0, selected ? -10 : 0, 0),
            width: width,
            height: height,
            decoration: BoxDecoration(
              color: faceDown ? cardTheme.back : cardTheme.surface,
              borderRadius: BorderRadius.circular(PochaRadius.small),
              border: Border.all(
                color: selected ? PochaColors.mutedGold : cardTheme.border,
                width: selected ? 2.5 : 1,
              ),
              boxShadow: [
                if (selected || !played)
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: selected ? 10 : 4,
                    offset: const Offset(0, 3),
                  ),
              ],
            ),
            child: faceDown
                ? const CardBack()
                : _CardFace(card: card!, theme: cardTheme, compact: width < 58),
          ),
        ),
      ),
    );
  }
}

class _CardFace extends StatelessWidget {
  const _CardFace({
    required this.card,
    required this.theme,
    required this.compact,
  });

  final PochaCard card;
  final PlayingCardTheme theme;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final figure =
        card.rank == Rank.sota ||
        card.rank == Rank.caballo ||
        card.rank == Rank.rey;
    return Stack(
      children: [
        Positioned(
          left: compact ? 4 : 7,
          top: compact ? 3 : 6,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                rankLabel(card.rank),
                style: TextStyle(
                  fontSize: compact ? 12 : 16,
                  fontWeight: FontWeight.w900,
                  color: _suitColor(),
                ),
              ),
              PochaSuitSymbol(
                suit: card.suit,
                size: compact ? 11 : 15,
                color: _suitColor(),
              ),
            ],
          ),
        ),
        Positioned.fill(
          child: Padding(
            padding: EdgeInsets.all(compact ? 7 : 12),
            child: figure
                ? _FigureMark(card: card, color: theme.figure)
                : _PipField(card: card, color: _suitColor()),
          ),
        ),
      ],
    );
  }

  Color _suitColor() => card.suit == Suit.oros || card.suit == Suit.copas
      ? theme.redSuit
      : theme.darkSuit;
}

class _PipField extends StatelessWidget {
  const _PipField({required this.card, required this.color});

  final PochaCard card;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final count = switch (card.rank) {
      Rank.as_ => 1,
      Rank.dos => 2,
      Rank.tres => 3,
      Rank.cuatro => 4,
      Rank.cinco => 5,
      Rank.seis => 6,
      Rank.siete => 7,
      _ => 0,
    };
    final positions = _pipPositions(count);
    return LayoutBuilder(
      builder: (context, constraints) => Stack(
        children: [
          for (final position in positions)
            Align(
              alignment: position,
              child: PochaSuitSymbol(
                suit: card.suit,
                size: math.min(24, constraints.maxWidth * 0.34),
                color: color,
              ),
            ),
        ],
      ),
    );
  }
}

List<Alignment> _pipPositions(int count) {
  const top = Alignment(0, -0.75);
  const middle = Alignment.center;
  const bottom = Alignment(0, 0.75);
  return switch (count) {
    1 => [middle],
    2 => [top, bottom],
    3 => [top, middle, bottom],
    4 => [
      Alignment(-0.55, -0.52),
      Alignment(0.55, -0.52),
      Alignment(-0.55, 0.52),
      Alignment(0.55, 0.52),
    ],
    5 => [
      Alignment(-0.55, -0.52),
      Alignment(0.55, -0.52),
      middle,
      Alignment(-0.55, 0.52),
      Alignment(0.55, 0.52),
    ],
    6 => [
      Alignment(-0.55, -0.65),
      Alignment(0.55, -0.65),
      Alignment(-0.55, 0),
      Alignment(0.55, 0),
      Alignment(-0.55, 0.65),
      Alignment(0.55, 0.65),
    ],
    _ => [
      Alignment(-0.55, -0.7),
      Alignment(0.55, -0.7),
      Alignment(-0.55, -0.23),
      Alignment(0.55, -0.23),
      Alignment(-0.55, 0.23),
      Alignment(0.55, 0.23),
      middle,
    ],
  };
}

class _FigureMark extends StatelessWidget {
  const _FigureMark({required this.card, required this.color});

  final PochaCard card;
  final Color color;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(PochaRadius.small),
      border: Border.all(color: color.withValues(alpha: 0.35)),
    ),
    child: Center(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              rankLabel(card.rank),
              style: TextStyle(
                fontFamily: 'serif',
                fontSize: 38,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            PochaSuitSymbol(suit: card.suit, size: 32, color: color),
          ],
        ),
      ),
    ),
  );
}

class CardBack extends StatelessWidget {
  const CardBack({super.key});

  @override
  Widget build(BuildContext context) {
    final theme =
        Theme.of(context).extension<PlayingCardTheme>() ??
        cardThemeFor(Theme.of(context).brightness);
    return CustomPaint(
      painter: _CardBackPainter(background: theme.back, ink: theme.backInk),
      child: Center(
        child: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            border: Border.all(
              color: theme.backInk.withValues(alpha: 0.75),
              width: 1.5,
            ),
            borderRadius: BorderRadius.circular(5),
          ),
          child: const Center(
            child: Wrap(
              alignment: WrapAlignment.center,
              spacing: 1,
              runSpacing: 1,
              children: [
                PochaSuitSymbol(
                  suit: Suit.oros,
                  size: 8,
                  color: PochaColors.ivory,
                ),
                PochaSuitSymbol(
                  suit: Suit.copas,
                  size: 8,
                  color: PochaColors.ivory,
                ),
                PochaSuitSymbol(
                  suit: Suit.espadas,
                  size: 8,
                  color: PochaColors.ivory,
                ),
                PochaSuitSymbol(
                  suit: Suit.bastos,
                  size: 8,
                  color: PochaColors.ivory,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CardBackPainter extends CustomPainter {
  const _CardBackPainter({required this.background, required this.ink});

  final Color background;
  final Color ink;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = ink.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final spacing = math.max(8, size.shortestSide * 0.18);
    for (var x = -size.height; x < size.width + size.height; x += spacing) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(x + size.height, size.height),
        paint,
      );
      canvas.drawLine(
        Offset(x, size.height),
        Offset(x + size.height, 0),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _CardBackPainter oldDelegate) =>
      oldDelegate.background != background || oldDelegate.ink != ink;
}
