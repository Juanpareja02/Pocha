import 'package:flutter/services.dart';

/// Punto único para las respuestas hápticas de la mesa.
///
/// Todas las acciones reciben el estado de preferencias para que los widgets
/// no llamen directamente a la plataforma ni dupliquen reglas de producto.
class HapticsService {
  const HapticsService();

  Future<void> cardSelected({required bool enabled}) async {
    if (enabled) await HapticFeedback.selectionClick();
  }

  Future<void> cardPlayed({required bool enabled}) async {
    if (enabled) await HapticFeedback.mediumImpact();
  }

  Future<void> trickWon({required bool enabled}) async {
    if (enabled) await HapticFeedback.lightImpact();
  }

  Future<void> invalidAction({required bool enabled}) async {
    if (enabled) await HapticFeedback.vibrate();
  }

  Future<void> rankPromotion({required bool enabled}) async {
    if (enabled) await HapticFeedback.heavyImpact();
  }
}

const hapticsService = HapticsService();
