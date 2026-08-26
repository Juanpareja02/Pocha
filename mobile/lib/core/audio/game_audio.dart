/// Audio boundary for the table. It is intentionally asset-free for Fase 3.
abstract interface class GameAudio {
  Future<void> playCard();
  Future<void> collectTrick();
  Future<void> updateScore();
  Future<void> podium();
}

/// Release-safe implementation used until approved local assets are added.
class NoopGameAudio implements GameAudio {
  const NoopGameAudio();

  @override
  Future<void> playCard() async {}

  @override
  Future<void> collectTrick() async {}

  @override
  Future<void> updateScore() async {}

  @override
  Future<void> podium() async {}
}
