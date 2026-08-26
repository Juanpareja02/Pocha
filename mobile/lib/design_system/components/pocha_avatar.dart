import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/theme.dart';

enum PochaAvatarStatus { normal, online, offline, bot, turn, winner }

class PochaAvatar extends StatelessWidget {
  const PochaAvatar({
    required this.name,
    this.seed = 0,
    this.status = PochaAvatarStatus.normal,
    this.size = 44,
    super.key,
  });

  final String name;
  final int seed;
  final PochaAvatarStatus status;
  final double size;

  @override
  Widget build(BuildContext context) {
    final label = '${name.trim().isEmpty ? 'Jugador' : name} avatar';
    return Semantics(
      image: true,
      label: label,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          CustomPaint(
            size: Size.square(size),
            painter: _AvatarPainter(
              seed: seed,
              background: _palette[seed.abs() % _palette.length],
              foreground: Theme.of(context).colorScheme.onPrimary,
            ),
            child: SizedBox.square(
              dimension: size,
              child: Center(
                child: Text(
                  _initials(name),
                  style: TextStyle(
                    fontSize: size * 0.32,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
          if (status != PochaAvatarStatus.normal)
            Positioned(
              right: -2,
              bottom: -2,
              child: Container(
                width: math.max(14, size * 0.32),
                height: math.max(14, size * 0.32),
                decoration: BoxDecoration(
                  color: _statusColor(context),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Theme.of(context).scaffoldBackgroundColor,
                    width: 2,
                  ),
                ),
                child: Icon(
                  _statusIcon(),
                  size: size * 0.18,
                  color: Colors.white,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Color _statusColor(BuildContext context) => switch (status) {
    PochaAvatarStatus.online => PochaColors.connected,
    PochaAvatarStatus.offline => PochaColors.disconnected,
    PochaAvatarStatus.bot => Theme.of(context).colorScheme.secondary,
    PochaAvatarStatus.turn => PochaColors.mutedGold,
    PochaAvatarStatus.winner => PochaColors.rankGain,
    PochaAvatarStatus.normal => Colors.transparent,
  };

  IconData _statusIcon() => switch (status) {
    PochaAvatarStatus.online => Icons.check,
    PochaAvatarStatus.offline => Icons.remove,
    PochaAvatarStatus.bot => Icons.smart_toy_outlined,
    PochaAvatarStatus.turn => Icons.bolt,
    PochaAvatarStatus.winner => Icons.star,
    PochaAvatarStatus.normal => Icons.circle,
  };
}

String _initials(String value) {
  final words = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty)
      .toList();
  if (words.isEmpty) return '?';
  if (words.length == 1) return words.first.characters.first.toUpperCase();
  return '${words.first.characters.first}${words.last.characters.first}'
      .toUpperCase();
}

const _palette = [
  PochaColors.table,
  PochaColors.terracottaDeep,
  PochaColors.mutedGold,
  Color(0xFF426B72),
  Color(0xFF6A4F73),
  Color(0xFF8A654B),
];

class _AvatarPainter extends CustomPainter {
  const _AvatarPainter({
    required this.seed,
    required this.background,
    required this.foreground,
  });

  final int seed;
  final Color background;
  final Color foreground;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawCircle(
      size.center(Offset.zero),
      size.shortestSide / 2,
      Paint()..color = background,
    );
    final accent = Paint()..color = foreground.withValues(alpha: 0.15);
    final count = 3 + seed.abs() % 4;
    for (var index = 0; index < count; index++) {
      final x = (seed.abs() + index * 37) % 100 / 100 * size.width;
      final y = (seed.abs() + index * 19) % 100 / 100 * size.height;
      canvas.drawCircle(
        Offset(x, y),
        size.width * (0.12 + index * 0.015),
        accent,
      );
    }
    canvas.drawArc(
      rect.deflate(size.width * 0.1),
      0,
      math.pi,
      false,
      Paint()
        ..color = foreground.withValues(alpha: 0.18)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(covariant _AvatarPainter oldDelegate) =>
      oldDelegate.seed != seed || oldDelegate.background != background;
}
