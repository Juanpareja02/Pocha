import '../../game/domain/pocha_engine.dart';

Map<String, dynamic> _map(Object? value) =>
    Map<String, dynamic>.from(value as Map);
List<dynamic> _list(Object? value) => value is List ? value : const <dynamic>[];

class RemoteCard {
  const RemoteCard({required this.id, required this.suit, required this.rank});

  final String id;
  final String suit;
  final String rank;

  factory RemoteCard.fromJson(Object? value) {
    final json = _map(value);
    return RemoteCard(
      id: '${json['id']}',
      suit: '${json['suit']}',
      rank: '${json['rank']}',
    );
  }

  Suit? get localSuit => switch (suit) {
    'oros' => Suit.oros,
    'copas' => Suit.copas,
    'espadas' => Suit.espadas,
    'bastos' => Suit.bastos,
    _ => null,
  };
}

class RemotePlayerView {
  const RemotePlayerView({
    required this.id,
    required this.name,
    required this.seat,
    required this.hand,
    required this.cardsRemaining,
    required this.bid,
    required this.tricksWon,
    required this.score,
  });

  final String id;
  final String name;
  final int seat;
  final List<RemoteCard> hand;
  final int cardsRemaining;
  final int? bid;
  final int tricksWon;
  final int score;

  factory RemotePlayerView.fromJson(Object? value) {
    final json = _map(value);
    return RemotePlayerView(
      id: '${json['id']}',
      name: '${json['name']}',
      seat: (json['seat'] as num?)?.toInt() ?? 0,
      hand: _list(json['hand']).map(RemoteCard.fromJson).toList(),
      cardsRemaining: (json['cardsRemaining'] as num?)?.toInt() ?? 0,
      bid: (json['bid'] as num?)?.toInt(),
      tricksWon: (json['tricksWon'] as num?)?.toInt() ?? 0,
      score: (json['score'] as num?)?.toInt() ?? 0,
    );
  }
}

class RemotePlayedCard {
  const RemotePlayedCard({required this.playerId, required this.card});

  final String playerId;
  final RemoteCard card;

  factory RemotePlayedCard.fromJson(Object? value) {
    final json = _map(value);
    return RemotePlayedCard(
      playerId: '${json['playerId']}',
      card: RemoteCard.fromJson(json['card']),
    );
  }
}

class RemoteTurnTimer {
  const RemoteTurnTimer({required this.action, required this.deadlineAt});

  final String action;
  final DateTime deadlineAt;

  factory RemoteTurnTimer.fromJson(Object? value) {
    final json = _map(value);
    return RemoteTurnTimer(
      action: '${json['action']}',
      deadlineAt: DateTime.parse('${json['deadlineAt']}'),
    );
  }
}

class RemoteGameState {
  const RemoteGameState({
    required this.gameId,
    required this.roomId,
    required this.stateVersion,
    required this.status,
    required this.roundIndex,
    required this.cardsPerRound,
    required this.currentPlayerId,
    required this.myPlayerId,
    required this.mySeat,
    required this.players,
    required this.trumpSuit,
    required this.leadSuit,
    required this.currentTrick,
    required this.playedCards,
    required this.tricksCompleted,
    required this.mustFollowSuit,
    required this.timer,
  });

  final String gameId;
  final String roomId;
  final int stateVersion;
  final String status;
  final int roundIndex;
  final int cardsPerRound;
  final String currentPlayerId;
  final String myPlayerId;
  final int mySeat;
  final List<RemotePlayerView> players;
  final String? trumpSuit;
  final String? leadSuit;
  final List<RemotePlayedCard> currentTrick;
  final List<RemotePlayedCard> playedCards;
  final int tricksCompleted;
  final bool mustFollowSuit;
  final RemoteTurnTimer? timer;

  bool get humanTurn => currentPlayerId == myPlayerId;
  RemotePlayerView get humanPlayer =>
      players.firstWhere((player) => player.id == myPlayerId);

  /// Legal actions exposed by the authoritative snapshot.
  ///
  /// The client never decides whether a submitted card is accepted; it only
  /// uses this view-state projection to render enabled cards. The server
  /// remains authoritative when the action is sent.
  Set<String> get legalHumanCardIds {
    final hand = humanPlayer.hand;
    if (!mustFollowSuit || leadSuit == null || currentTrick.isEmpty) {
      return hand.map((card) => card.id).toSet();
    }
    final hasLeadSuit = hand.any((card) => card.suit == leadSuit);
    final legal = hasLeadSuit
        ? hand.where((card) => card.suit == leadSuit)
        : hand;
    return legal.map((card) => card.id).toSet();
  }

  List<int> get legalHumanBids {
    final values = List<int>.generate(cardsPerRound + 1, (value) => value);
    final submitted = players
        .where((player) => player.bid != null)
        .map((player) => player.bid!)
        .toList();
    if (submitted.length == players.length - 1) {
      values.remove(
        cardsPerRound - submitted.fold<int>(0, (sum, value) => sum + value),
      );
    }
    return values;
  }

  String? get bidRestrictionMessage =>
      players.where((player) => player.bid != null).length == players.length - 1
      ? 'El último jugador no puede hacer coincidir la suma con las '
            '$cardsPerRound bazas.'
      : null;

  factory RemoteGameState.fromJson(Object? value) {
    final root = _map(value);
    final state = _map(root['state']);
    final rules = _map(state['rules']);
    final rawPlayers = _list(state['players']);
    final currentIndex = (state['currentPlayerIndex'] as num?)?.toInt() ?? 0;
    final currentPlayerId =
        currentIndex >= 0 && currentIndex < rawPlayers.length
        ? '${_map(rawPlayers[currentIndex])['id']}'
        : '';
    return RemoteGameState(
      gameId: '${root['gameId']}',
      roomId: '${root['roomId']}',
      stateVersion: (root['stateVersion'] as num?)?.toInt() ?? 0,
      status: '${state['status']}',
      roundIndex: (state['roundIndex'] as num?)?.toInt() ?? -1,
      cardsPerRound: (state['cardsPerRound'] as num?)?.toInt() ?? 0,
      currentPlayerId: currentPlayerId,
      myPlayerId: '${root['myPlayerId']}',
      mySeat: (root['mySeat'] as num?)?.toInt() ?? 0,
      players: _list(state['players']).map(RemotePlayerView.fromJson).toList(),
      trumpSuit: state['trumpSuit'] as String?,
      leadSuit: state['leadSuit'] as String?,
      currentTrick: _list(
        state['currentTrick'],
      ).map(RemotePlayedCard.fromJson).toList(),
      playedCards: _list(
        state['playedCards'],
      ).map(RemotePlayedCard.fromJson).toList(),
      tricksCompleted: (state['tricksCompleted'] as num?)?.toInt() ?? 0,
      mustFollowSuit: rules['mustFollowSuit'] as bool? ?? true,
      timer: root['timer'] == null
          ? null
          : RemoteTurnTimer.fromJson(root['timer']),
    );
  }
}

class RemoteRoomPlayer {
  const RemoteRoomPlayer({
    required this.userId,
    required this.displayName,
    required this.seat,
    required this.isHost,
    required this.isBot,
    required this.botDifficulty,
    required this.ready,
    required this.connectionStatus,
  });

  final String userId;
  final String displayName;
  final int seat;
  final bool isHost;
  final bool isBot;
  final String? botDifficulty;
  final bool ready;
  final String connectionStatus;

  factory RemoteRoomPlayer.fromJson(Object? value) {
    final json = _map(value);
    return RemoteRoomPlayer(
      userId: '${json['userId']}',
      displayName: '${json['displayName']}',
      seat: (json['seat'] as num?)?.toInt() ?? 0,
      isHost: json['isHost'] as bool? ?? false,
      isBot: json['isBot'] as bool? ?? false,
      botDifficulty: json['botDifficulty'] as String?,
      ready: json['ready'] as bool? ?? false,
      connectionStatus: '${json['connectionStatus']}',
    );
  }
}

class RemoteRoomView {
  const RemoteRoomView({
    required this.roomId,
    required this.code,
    required this.hostUserId,
    required this.status,
    required this.playerCount,
    required this.rulesetId,
    required this.players,
    this.gameId,
    this.mode,
    this.seasonId,
  });

  final String roomId;
  final String code;
  final String hostUserId;
  final String status;
  final int playerCount;
  final String rulesetId;
  final List<RemoteRoomPlayer> players;
  final String? gameId;
  final String? mode;
  final String? seasonId;

  bool get isFull => players.length >= playerCount;

  factory RemoteRoomView.fromJson(Object? value) {
    final json = _map(value);
    final config = _map(json['config']);
    return RemoteRoomView(
      roomId: '${json['roomId']}',
      code: '${json['code']}',
      hostUserId: '${json['hostUserId']}',
      status: '${json['status']}',
      playerCount: (config['playerCount'] as num?)?.toInt() ?? 3,
      rulesetId: '${config['rulesetId']}',
      players: _list(json['players']).map(RemoteRoomPlayer.fromJson).toList(),
      gameId: json['gameId'] as String?,
      mode: json['mode'] as String?,
      seasonId: json['seasonId'] as String?,
    );
  }
}

class RemoteRankedQueueState {
  const RemoteRankedQueueState({
    required this.seasonId,
    required this.queueKey,
    required this.range,
    required this.queuedAt,
  });

  final String seasonId;
  final String queueKey;
  final int range;
  final DateTime queuedAt;

  factory RemoteRankedQueueState.fromJson(Object? value) {
    final json = _map(value);
    return RemoteRankedQueueState(
      seasonId: '${json['seasonId']}',
      queueKey: '${json['queueKey']}',
      range: (json['range'] as num?)?.toInt() ?? 100,
      queuedAt: DateTime.tryParse('${json['queuedAt']}') ?? DateTime.now(),
    );
  }
}
