import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/online/domain/online_protocol.dart';

void main() {
  test('decodes a private server snapshot with turn and deadline', () {
    final state = RemoteGameState.fromJson({
      'protocolVersion': 1,
      'gameId': 'game-1',
      'roomId': 'room-1',
      'stateVersion': 7,
      'myPlayerId': 'p1',
      'mySeat': 0,
      'timer': {
        'action': 'PLAY_CARD',
        'deadlineAt': '2026-08-25T12:00:00.000Z',
      },
      'state': {
        'status': 'PLAYING_TRICK',
        'roundIndex': 2,
        'cardsPerRound': 3,
        'currentPlayerIndex': 0,
        'trumpSuit': 'oros',
        'leadSuit': 'copas',
        'currentTrick': [],
        'playedCards': [],
        'tricksCompleted': 1,
        'rules': {'mustFollowSuit': true},
        'players': [
          {
            'id': 'p1',
            'name': 'Juan',
            'seat': 0,
            'hand': [
              {'id': 'copas:as', 'suit': 'copas', 'rank': 'as'},
            ],
            'cardsRemaining': 1,
            'bid': 1,
            'tricksWon': 0,
            'score': 10,
          },
          {
            'id': 'p2',
            'name': 'Esther',
            'seat': 1,
            'hand': [],
            'cardsRemaining': 1,
            'bid': 0,
            'tricksWon': 1,
            'score': 15,
          },
        ],
      },
    });
    expect(state.currentPlayerId, 'p1');
    expect(state.humanTurn, isTrue);
    expect(state.humanPlayer.hand.single.id, 'copas:as');
    expect(state.players[1].hand, isEmpty);
    expect(state.timer?.action, 'PLAY_CARD');
  });

  test('projects legal online actions from the authoritative snapshot', () {
    final state = RemoteGameState.fromJson({
      'gameId': 'game-1',
      'roomId': 'room-1',
      'stateVersion': 2,
      'myPlayerId': 'p1',
      'mySeat': 0,
      'state': {
        'status': 'BIDDING',
        'roundIndex': 0,
        'cardsPerRound': 2,
        'currentPlayerIndex': 0,
        'trumpSuit': null,
        'leadSuit': null,
        'currentTrick': [],
        'playedCards': [],
        'tricksCompleted': 0,
        'rules': {'mustFollowSuit': true},
        'players': [
          {
            'id': 'p1',
            'name': 'Juan',
            'seat': 0,
            'hand': [
              {'id': 'oros:as', 'suit': 'oros', 'rank': 'as'},
            ],
            'cardsRemaining': 2,
            'bid': null,
            'tricksWon': 0,
            'score': 0,
          },
          {
            'id': 'p2',
            'name': 'Ana',
            'seat': 1,
            'hand': [],
            'cardsRemaining': 2,
            'bid': 1,
            'tricksWon': 0,
            'score': 0,
          },
          {
            'id': 'p3',
            'name': 'Pablo',
            'seat': 2,
            'hand': [],
            'cardsRemaining': 2,
            'bid': 1,
            'tricksWon': 0,
            'score': 0,
          },
        ],
      },
    });
    expect(state.legalHumanBids, equals([1, 2]));
    expect(state.bidRestrictionMessage, isNotNull);
  });
}
