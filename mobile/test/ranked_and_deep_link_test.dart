import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/online/domain/room_deep_link.dart';
import 'package:mobile/features/online/domain/online_protocol.dart';

void main() {
  test('parses a valid room deep link and normalizes its code', () {
    final link = RoomDeepLink.parse('https://pocha.example/join/ab12cd');
    expect(link?.code, 'AB12CD');
  });

  test('rejects invalid room deep links', () {
    expect(RoomDeepLink.parse('https://pocha.example/join/short'), isNull);
    expect(RoomDeepLink.parse('https://pocha.example/rooms/AB12CD'), isNull);
  });

  test('parses ranked queue range and official room mode', () {
    final queue = RemoteRankedQueueState.fromJson({
      'seasonId': 'season_1',
      'queueKey': 'ranked:season_1:user',
      'range': 250,
      'queuedAt': '2026-08-25T12:00:00.000Z',
    });
    final room = RemoteRoomView.fromJson({
      'roomId': 'room',
      'code': 'AB12CD',
      'hostUserId': 'user',
      'status': 'LOBBY',
      'mode': 'ranked',
      'seasonId': 'season_1',
      'config': {'playerCount': 4, 'rulesetId': 'ranked_standard'},
      'players': const [],
    });
    expect(queue.range, 250);
    expect(room.mode, 'ranked');
    expect(room.playerCount, 4);
    expect(room.rulesetId, 'ranked_standard');
  });
}
