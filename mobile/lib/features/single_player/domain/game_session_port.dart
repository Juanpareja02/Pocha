import '../../game/domain/pocha_engine.dart';

/// Contract consumed by a future RemoteGameController as well as the local one.
/// The presentation layer sends intentions and never owns rule transitions.
abstract interface class GameSessionPort<S extends Object> {
  S? get state;
  bool get humanTurn;

  Future<void> submitBid(int bid);
  Future<void> chooseTrump(Suit? trump);
  Future<void> playCard(PochaCard card);
  Future<void> pause();
  Future<void> resume();
  Future<void> abandon();
}
