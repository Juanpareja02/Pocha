import 'dart:async';

import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../theme/theme.dart';

class TurnTimer extends StatefulWidget {
  const TurnTimer({
    this.deadline,
    this.total = const Duration(seconds: 20),
    this.label = 'Tu turno',
    this.compact = false,
    super.key,
  });

  final DateTime? deadline;
  final Duration total;
  final String label;
  final bool compact;

  @override
  State<TurnTimer> createState() => _TurnTimerState();
}

class _TurnTimerState extends State<TurnTimer> {
  Timer? _ticker;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _startTicker();
  }

  @override
  void didUpdateWidget(covariant TurnTimer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.deadline != widget.deadline) _startTicker();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _startTicker() {
    _ticker?.cancel();
    if (widget.deadline == null) return;
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final remaining = widget.deadline?.difference(_now);
    final seconds = remaining?.inSeconds.clamp(0, 999);
    final progress = remaining == null || widget.total.inMilliseconds == 0
        ? 1.0
        : (remaining.inMilliseconds / widget.total.inMilliseconds).clamp(
            0.0,
            1.0,
          );
    final state = seconds != null && seconds <= 5
        ? 'critical'
        : seconds != null && seconds <= 10
        ? 'warning'
        : 'normal';
    final color = state == 'critical'
        ? PochaColors.error
        : state == 'warning'
        ? PochaColors.warning
        : Theme.of(context).colorScheme.secondary;
    return Semantics(
      label: seconds == null
          ? widget.label
          : strings.timerSeconds(widget.label, seconds),
      liveRegion: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(
            dimension: widget.compact ? 30 : 38,
            child: Stack(
              fit: StackFit.expand,
              children: [
                CircularProgressIndicator(
                  value: progress,
                  strokeWidth: widget.compact ? 3 : 4,
                  backgroundColor: color.withValues(alpha: 0.16),
                  valueColor: AlwaysStoppedAnimation(color),
                ),
                Center(
                  child: Text(
                    seconds == null ? '—' : '$seconds',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (!widget.compact) ...[
            const SizedBox(width: PochaSpacing.xs),
            Text(widget.label, style: Theme.of(context).textTheme.labelMedium),
          ],
        ],
      ),
    );
  }
}
