import 'package:flutter/material.dart';

import '../../features/game/domain/pocha_engine.dart';
import '../theme/theme.dart';

class PochaSuitSymbol extends StatelessWidget {
  const PochaSuitSymbol({
    required this.suit,
    this.size = 24,
    this.color,
    super.key,
  });

  final Suit suit;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => Semantics(
    label: suitLabel(suit),
    image: true,
    child: CustomPaint(
      size: Size.square(size),
      painter: SpanishSuitPainter(
        suit: suit,
        color: color ?? suitColor(context, suit),
      ),
    ),
  );
}

class SpanishSuitPainter extends CustomPainter {
  const SpanishSuitPainter({required this.suit, required this.color});

  final Suit suit;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.shortestSide * 0.11
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final center = size.center(Offset.zero);
    final unit = size.shortestSide;
    switch (suit) {
      case Suit.oros:
        final path = Path()
          ..moveTo(center.dx, unit * 0.08)
          ..lineTo(unit * 0.86, center.dy)
          ..lineTo(center.dx, unit * 0.92)
          ..lineTo(unit * 0.14, center.dy)
          ..close();
        canvas.drawPath(path, paint);
        canvas.drawPath(path, stroke);
      case Suit.copas:
        final path = Path()
          ..moveTo(unit * 0.16, unit * 0.2)
          ..cubicTo(
            unit * 0.18,
            unit * 0.74,
            unit * 0.38,
            unit * 0.75,
            center.dx,
            unit * 0.75,
          )
          ..cubicTo(
            unit * 0.62,
            unit * 0.75,
            unit * 0.82,
            unit * 0.74,
            unit * 0.84,
            unit * 0.2,
          )
          ..cubicTo(
            unit * 0.68,
            unit * 0.32,
            unit * 0.57,
            unit * 0.3,
            center.dx,
            unit * 0.2,
          )
          ..cubicTo(
            unit * 0.43,
            unit * 0.3,
            unit * 0.32,
            unit * 0.32,
            unit * 0.16,
            unit * 0.2,
          )
          ..close();
        canvas.drawPath(path, paint);
        canvas.drawLine(
          Offset(center.dx, unit * 0.75),
          Offset(center.dx, unit * 0.92),
          stroke,
        );
        canvas.drawLine(
          Offset(unit * 0.34, unit * 0.94),
          Offset(unit * 0.66, unit * 0.94),
          stroke,
        );
      case Suit.espadas:
        final blade = Path()
          ..moveTo(center.dx, unit * 0.05)
          ..lineTo(unit * 0.82, unit * 0.72)
          ..lineTo(center.dx, unit * 0.62)
          ..lineTo(unit * 0.18, unit * 0.72)
          ..close();
        canvas.drawPath(blade, paint);
        canvas.drawLine(
          Offset(unit * 0.28, unit * 0.76),
          Offset(unit * 0.72, unit * 0.76),
          stroke,
        );
        canvas.drawLine(
          Offset(center.dx, unit * 0.65),
          Offset(center.dx, unit * 0.95),
          stroke,
        );
      case Suit.bastos:
        final branch = Path()
          ..moveTo(unit * 0.27, unit * 0.92)
          ..quadraticBezierTo(
            unit * 0.5,
            unit * 0.58,
            unit * 0.67,
            unit * 0.08,
          );
        canvas.drawPath(branch, stroke);
        canvas.drawOval(
          Rect.fromLTWH(unit * 0.12, unit * 0.22, unit * 0.28, unit * 0.17),
          paint,
        );
        canvas.drawOval(
          Rect.fromLTWH(unit * 0.49, unit * 0.35, unit * 0.32, unit * 0.17),
          paint,
        );
        canvas.drawOval(
          Rect.fromLTWH(unit * 0.13, unit * 0.52, unit * 0.28, unit * 0.17),
          paint,
        );
    }
  }

  @override
  bool shouldRepaint(covariant SpanishSuitPainter oldDelegate) =>
      oldDelegate.suit != suit || oldDelegate.color != color;
}

String suitLabel(Suit suit) => switch (suit) {
  Suit.oros => 'Oros',
  Suit.copas => 'Copas',
  Suit.espadas => 'Espadas',
  Suit.bastos => 'Bastos',
};

Color suitColor(BuildContext context, Suit suit) {
  final cards =
      Theme.of(context).extension<PlayingCardTheme>() ??
      cardThemeFor(Theme.of(context).brightness);
  return suit == Suit.oros || suit == Suit.copas
      ? cards.redSuit
      : cards.darkSuit;
}

String rankLabel(Rank rank) => switch (rank) {
  Rank.as_ => 'As',
  Rank.dos => '2',
  Rank.tres => '3',
  Rank.cuatro => '4',
  Rank.cinco => '5',
  Rank.seis => '6',
  Rank.siete => '7',
  Rank.sota => 'S',
  Rank.caballo => 'C',
  Rank.rey => 'R',
};

String rankName(Rank rank) => switch (rank) {
  Rank.as_ => 'As',
  Rank.dos => 'Dos',
  Rank.tres => 'Tres',
  Rank.cuatro => 'Cuatro',
  Rank.cinco => 'Cinco',
  Rank.seis => 'Seis',
  Rank.siete => 'Siete',
  Rank.sota => 'Sota',
  Rank.caballo => 'Caballo',
  Rank.rey => 'Rey',
};
