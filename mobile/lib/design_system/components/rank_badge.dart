import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../theme/theme.dart';

class RankBadge extends StatelessWidget {
  const RankBadge({
    required this.name,
    this.id,
    this.provisional = false,
    this.compact = false,
    super.key,
  });

  final String name;
  final String? id;
  final bool provisional;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final rankTheme =
        Theme.of(context).extension<RankTheme>() ?? _fallbackRankTheme;
    final accent = rankTheme.colorFor(id ?? name);
    return Semantics(
      label: provisional ? strings.provisional : 'Rango $name',
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 8 : 10,
          vertical: compact ? 5 : 7,
        ),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(PochaRadius.pill),
          border: Border.all(color: accent.withValues(alpha: 0.62)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CustomPaint(
              size: Size.square(compact ? 15 : 19),
              painter: _RankMarkPainter(
                color: accent,
                order: _rankOrder(id ?? name),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              provisional ? strings.provisional : name,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: accent,
                fontSize: compact ? 10 : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const _fallbackRankTheme = RankTheme(
  bronze: Color(0xFF9C6B43),
  silver: Color(0xFF8B9A96),
  gold: Color(0xFFB58A35),
  platinum: Color(0xFF4C8D86),
  diamond: Color(0xFF4B78A5),
  master: Color(0xFF86528D),
  grandMaster: Color(0xFF9A4D38),
);

int _rankOrder(String value) => switch (value.toLowerCase()) {
  'bronze' || 'bronce' => 0,
  'silver' || 'plata' => 1,
  'gold' || 'oro' => 2,
  'platinum' || 'platino' => 3,
  'diamond' || 'diamante' => 4,
  'master' || 'maestro' => 5,
  'grand-master' || 'gran maestro' => 6,
  _ => 1,
};

class _RankMarkPainter extends CustomPainter {
  const _RankMarkPainter({required this.color, required this.order});

  final Color color;
  final int order;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * 0.42;
    final path = Path();
    final points = 4 + order.clamp(0, 3);
    for (var index = 0; index < points; index++) {
      final angle = -3.14159 / 2 + index * 2 * 3.14159 / points;
      final point = Offset(
        center.dx + radius * math.cos(angle),
        center.dy + radius * math.sin(angle),
      );
      if (index == 0) {
        path.moveTo(point.dx, point.dy);
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    path.close();
    canvas.drawPath(path, Paint()..color = color);
    canvas.drawCircle(
      center,
      size.shortestSide * 0.12,
      Paint()..color = Colors.white.withValues(alpha: 0.55),
    );
  }

  @override
  bool shouldRepaint(covariant _RankMarkPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.order != order;
}
