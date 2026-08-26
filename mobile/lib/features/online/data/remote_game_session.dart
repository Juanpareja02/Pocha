import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../game/domain/pocha_engine.dart';
import '../../single_player/domain/game_session_port.dart';
import '../domain/online_protocol.dart';

enum RemoteConnectionStatus {
  disconnected,
  connecting,
  connected,
  reconnecting,
}

class RemoteGameError {
  const RemoteGameError({
    required this.code,
    required this.message,
    this.stateVersion,
  });

  final String code;
  final String message;
  final int? stateVersion;
}

class RemoteGameSession extends ChangeNotifier
    implements GameSessionPort<RemoteGameState> {
  RemoteGameSession({
    required this.baseUrl,
    String? socketUrl,
    required this.token,
    required this.userId,
  }) : socketUrl = socketUrl ?? baseUrl;

  final String baseUrl;
  final String socketUrl;
  final String token;
  final String userId;
  io.Socket? _socket;
  RemoteGameState? _state;
  RemoteRoomView? _room;
  RemoteRankedQueueState? _rankedQueue;
  RemoteConnectionStatus _connectionStatus =
      RemoteConnectionStatus.disconnected;
  RemoteGameError? _error;
  final Random _random = Random();

  @override
  RemoteGameState? get state => _state;
  RemoteRoomView? get room => _room;
  RemoteRankedQueueState? get rankedQueue => _rankedQueue;
  RemoteConnectionStatus get connectionStatus => _connectionStatus;
  RemoteGameError? get error => _error;
  bool get connected => _connectionStatus == RemoteConnectionStatus.connected;

  Future<void> connect() async {
    if (connected) return;
    _connectionStatus = RemoteConnectionStatus.connecting;
    _error = null;
    notifyListeners();
    final completer = Completer<void>();
    final socket = _socket = io.io(
      '$socketUrl/online',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token, 'protocolVersion': 1})
          .setReconnectionAttempts(6)
          .setReconnectionDelay(500)
          .setReconnectionDelayMax(5000)
          .setRandomizationFactor(0.25)
          .disableAutoConnect()
          .build(),
    );
    socket.onConnect((_) {
      _connectionStatus = RemoteConnectionStatus.connected;
      notifyListeners();
      final room = _room;
      if (room != null) socket.emit('room:join', {'code': room.code});
      if (!completer.isCompleted) completer.complete();
    });
    socket.onDisconnect((_) {
      _connectionStatus = RemoteConnectionStatus.reconnecting;
      notifyListeners();
    });
    socket.onConnectError((error) {
      final text = '$error';
      final protocolMismatch = text.toLowerCase().contains('protocol');
      _error = RemoteGameError(
        code: protocolMismatch ? 'PROTOCOL_UNSUPPORTED' : 'NETWORK_ERROR',
        message: protocolMismatch
            ? 'Necesitas actualizar La Pocha para seguir jugando online.'
            : 'No se ha podido conectar con el servidor. Comprueba tu conexión.',
      );
      _connectionStatus = RemoteConnectionStatus.disconnected;
      notifyListeners();
      if (!completer.isCompleted) completer.completeError(error);
    });
    socket.on('room:created', _onRoom);
    socket.on('room:joined', _onRoom);
    socket.on('room:updated', _onRoom);
    socket.on('matchmaking:matched', _onRoom);
    socket.on('ranked:matched', _onRoom);
    socket.on('ranked:queued', _onRankedQueue);
    socket.on('game:snapshot', _onSnapshot);
    socket.on('game:started', _onSnapshot);
    socket.on('game:error', _onError);
    socket.connect();
    try {
      await completer.future.timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw TimeoutException('Connection timeout'),
      );
    } on TimeoutException {
      _error = const RemoteGameError(
        code: 'TIMEOUT',
        message: 'El servidor está tardando demasiado. Inténtalo de nuevo.',
      );
      _connectionStatus = RemoteConnectionStatus.disconnected;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> createRoom({
    required int playerCount,
    required String rulesetId,
    bool allowBots = true,
    String botDifficulty = 'normal',
  }) async {
    await connect();
    _socket!.emit('room:create', {
      'playerCount': playerCount,
      'rulesetId': rulesetId,
      'rulesetVersion': 1,
      'allowBots': allowBots,
      'botDifficulty': botDifficulty,
    });
  }

  Future<void> joinRoom(String code) async {
    await connect();
    _socket!.emit('room:join', {'code': code.trim().toUpperCase()});
  }

  Future<void> ready() async {
    final room = _requireRoom();
    _socket!.emit('room:ready', {'roomId': room.roomId});
  }

  Future<void> leaveRoom() async {
    _socket?.emit('room:leave');
    _room = null;
    _state = null;
    notifyListeners();
  }

  Future<void> addBot({String difficulty = 'normal'}) async {
    _socket!.emit('room:addBot', {'difficulty': difficulty});
  }

  Future<void> removeBot(String userId) async {
    _socket!.emit('room:removeBot', {'userId': userId});
  }

  Future<void> startRoom() async {
    final room = _requireRoom();
    _socket!.emit('room:start', {'roomId': room.roomId});
  }

  Future<void> searchCasual({
    required int playerCount,
    String rulesetId = 'classic',
  }) async {
    await connect();
    _socket!.emit('matchmaking:join', {
      'playerCount': playerCount,
      'rulesetId': rulesetId,
      'rulesetVersion': 1,
    });
  }

  Future<void> cancelSearch() async {
    _socket?.emit('matchmaking:cancel');
  }

  Future<void> searchRanked({String rulesetId = 'ranked_standard'}) async {
    await connect();
    _socket!.emit('ranked:join', {'rulesetId': rulesetId, 'rulesetVersion': 1});
  }

  Future<void> cancelRanked() async {
    _socket?.emit('ranked:cancel');
    _rankedQueue = null;
    notifyListeners();
  }

  @override
  bool get humanTurn => _state?.humanTurn ?? false;

  @override
  Future<void> submitBid(int bid) async {
    final state = _requireState();
    _send('game:bid', {'bid': bid, 'gameId': state.gameId});
  }

  @override
  Future<void> chooseTrump(Suit? trump) async {
    final state = _requireState();
    _send('game:chooseTrump', {
      'suit': _suitName(trump),
      'gameId': state.gameId,
    });
  }

  @override
  Future<void> playCard(PochaCard card) async {
    final state = _requireState();
    _send('game:playCard', {'cardId': card.id, 'gameId': state.gameId});
  }

  Future<void> playRemoteCard(RemoteCard card) async {
    final state = _requireState();
    _send('game:playCard', {'cardId': card.id, 'gameId': state.gameId});
  }

  @override
  Future<void> pause() async {}

  @override
  Future<void> resume() async {
    final state = _state;
    if (state != null) _socket?.emit('game:sync', {'gameId': state.gameId});
  }

  @override
  Future<void> abandon() async {
    final state = _state;
    if (state != null) {
      _send('game:leave', {'gameId': state.gameId});
    }
  }

  @override
  void dispose() {
    _socket?.dispose();
    _socket = null;
    super.dispose();
  }

  void _send(String event, Map<String, Object?> payload) {
    final state = _requireState();
    _socket?.emit(event, {
      ...payload,
      'expectedStateVersion': state.stateVersion,
      'actionId':
          'flutter:${DateTime.now().microsecondsSinceEpoch}:${_random.nextInt(1 << 20)}',
    });
  }

  void _onRoom(Object? raw) {
    _room = RemoteRoomView.fromJson(raw);
    _rankedQueue = null;
    notifyListeners();
  }

  void _onRankedQueue(Object? raw) {
    _rankedQueue = RemoteRankedQueueState.fromJson(raw);
    notifyListeners();
  }

  void _onSnapshot(Object? raw) {
    try {
      final next = RemoteGameState.fromJson(raw);
      final current = _state;
      if (current != null && next.stateVersion < current.stateVersion) return;
      _state = next;
      _error = null;
      notifyListeners();
    } catch (error) {
      _error = RemoteGameError(
        code: 'SERVER_ERROR',
        message: 'Snapshot inválido: $error',
      );
      notifyListeners();
    }
  }

  void _onError(Object? raw) {
    final json = raw is Map
        ? Map<String, dynamic>.from(raw)
        : <String, dynamic>{};
    _error = RemoteGameError(
      code: '${json['code'] ?? 'SERVER_ERROR'}',
      message: json['code'] == 'PROTOCOL_UNSUPPORTED'
          ? 'Necesitas actualizar La Pocha para seguir jugando online.'
          : '${json['message'] ?? 'No se pudo procesar la acción'}',
      stateVersion: (json['stateVersion'] as num?)?.toInt(),
    );
    if (json['snapshot'] != null) _onSnapshot(json['snapshot']);
    notifyListeners();
  }

  RemoteRoomView _requireRoom() =>
      _room ?? (throw StateError('La sesión no está en una sala'));
  RemoteGameState _requireState() =>
      _state ?? (throw StateError('La partida todavía no ha comenzado'));

  String _suitName(Suit? suit) => switch (suit) {
    null => 'none',
    Suit.oros => 'oros',
    Suit.copas => 'copas',
    Suit.espadas => 'espadas',
    Suit.bastos => 'bastos',
  };
}
