import 'package:flutter/material.dart';

import '../theme/theme.dart';

abstract final class TableLayoutDelegate {
  static List<Alignment> opponentAlignments(int playerCount) {
    final count = (playerCount - 1).clamp(2, 5);
    return switch (count) {
      2 => const [Alignment.topCenter, Alignment.centerRight],
      3 => const [
        Alignment.topCenter,
        Alignment.centerLeft,
        Alignment.centerRight,
      ],
      4 => const [
        Alignment.topCenter,
        Alignment(-0.92, -0.18),
        Alignment(0.92, -0.18),
        Alignment(0.72, 0.62),
      ],
      _ => const [
        Alignment.topCenter,
        Alignment(-0.9, -0.25),
        Alignment(-0.9, 0.45),
        Alignment(0.9, 0.45),
        Alignment(0.9, -0.25),
      ],
    };
  }
}

class PochaGameTable extends StatelessWidget {
  const PochaGameTable({
    required this.opponents,
    required this.trick,
    required this.localSeat,
    this.topHeader,
    this.bottomHand,
    this.playerCount = 4,
    super.key,
  });

  final List<Widget> opponents;
  final Widget trick;
  final Widget localSeat;
  final Widget? topHeader;
  final Widget? bottomHand;
  final int playerCount;

  @override
  Widget build(BuildContext context) {
    final table =
        Theme.of(context).extension<GameTableTheme>() ??
        tableTheme(Theme.of(context).brightness);
    final positions = TableLayoutDelegate.opponentAlignments(playerCount);
    return LayoutBuilder(
      builder: (context, constraints) => Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [table.felt, table.feltDeep],
          ),
          borderRadius: BorderRadius.circular(PochaRadius.large),
          border: Border.all(color: table.feltBorder, width: 3),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.18),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: CustomPaint(
                painter: _TablePatternPainter(
                  color: table.onFelt.withValues(alpha: 0.06),
                ),
              ),
            ),
            if (topHeader != null)
              Positioned(
                top: PochaSpacing.sm,
                left: PochaSpacing.sm,
                right: PochaSpacing.sm,
                child: topHeader!,
              ),
            for (
              var index = 0;
              index < opponents.length && index < positions.length;
              index++
            )
              Align(
                alignment: positions[index],
                child: Padding(
                  padding: const EdgeInsets.all(PochaSpacing.sm),
                  child: opponents[index],
                ),
              ),
            Align(
              alignment: Alignment.center,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 70,
                  vertical: 100,
                ),
                child: trick,
              ),
            ),
            Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.only(bottom: PochaSpacing.sm),
                child: localSeat,
              ),
            ),
            if (bottomHand != null)
              Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: bottomHand!,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TablePatternPainter extends CustomPainter {
  const _TablePatternPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (var x = -size.height; x < size.width + size.height; x += 28) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(x + size.height, size.height),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _TablePatternPainter oldDelegate) =>
      oldDelegate.color != color;
}
