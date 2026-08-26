import '../../game/domain/pocha_engine.dart';

enum LocalGamePhase {
  bidding,
  choosingTrump,
  playingTrick,
  trickResults,
  roundResults,
  gameResults,
  finished,
}

class LocalRandom {
  LocalRandom(this.state);

  int state;

  double next() {
    state = (1664525 * state + 1013904223) & 0xFFFFFFFF;
    return state / 0x100000000;
  }

  int nextInt(int maxExclusive) {
    if (maxExclusive <= 0) throw ArgumentError.value(maxExclusive);
    return (next() * maxExclusive).floor();
  }
}

class LocalPlayedCard {
  LocalPlayedCard({required this.playerId, required this.card});

  final String playerId;
  final PochaCard card;

  Map<String, dynamic> toJson() => {
    'playerId': playerId,
    'card': _cardToJson(card),
  };

  factory LocalPlayedCard.fromJson(Map<String, dynamic> json) =>
      LocalPlayedCard(
        playerId: json['playerId'] as String,
        card: _cardFromJson(Map<String, dynamic>.from(json['card'] as Map)),
      );
}

class LocalPlayer {
  LocalPlayer({
    required this.id,
    required this.name,
    required this.human,
    this.hand = const [],
    this.bid,
    this.tricksWon = 0,
    this.score = 0,
    int? avatarSeed,
    int? cardsRemaining,
  }) : avatarSeed = avatarSeed ?? _stableSeed(id),
       cardsRemaining = cardsRemaining ?? hand.length;

  final String id;
  final String name;
  final bool human;
  final int avatarSeed;
  List<PochaCard> hand;
  int cardsRemaining;
  int? bid;
  int tricksWon;
  int score;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'human': human,
    'avatarSeed': avatarSeed,
    'hand': hand.map(_cardToJson).toList(),
    'cardsRemaining': cardsRemaining,
    'bid': bid,
    'tricksWon': tricksWon,
    'score': score,
  };

  factory LocalPlayer.fromJson(Map<String, dynamic> json) => LocalPlayer(
    id: json['id'] as String,
    name: json['name'] as String,
    human: json['human'] as bool,
    avatarSeed: json['avatarSeed'] as int? ?? _stableSeed(json['id'] as String),
    hand: (json['hand'] as List<dynamic>)
        .map((card) => _cardFromJson(Map<String, dynamic>.from(card as Map)))
        .toList(),
    bid: json['bid'] as int?,
    tricksWon: json['tricksWon'] as int,
    score: json['score'] as int,
    cardsRemaining:
        json['cardsRemaining'] as int? ??
        (json['hand'] as List<dynamic>).length,
  );
}

class LocalGameState {
  LocalGameState({
    required this.gameId,
    required this.rules,
    required this.players,
    required this.randomState,
  });

  final String gameId;
  final GameRules rules;
  final List<LocalPlayer> players;
  int randomState;
  Map<String, int> decisionRandomStates = {};
  LocalGamePhase phase = LocalGamePhase.bidding;
  int roundIndex = -1;
  int cardsPerRound = 0;
  int dealerIndex = 0;
  int currentPlayerIndex = 0;
  Suit? trump;
  Suit? leadSuit;
  final List<LocalPlayedCard> currentTrick = [];
  final List<LocalPlayedCard> playedCards = [];
  int tricksCompleted = 0;
  Map<String, int> lastRoundScores = {};
  String? lastTrickWinnerId;
  int humanPredictions = 0;
  int humanPredictionsHit = 0;
  int humanPredictedTricks = 0;
  int humanWonTricks = 0;
  int? humanBestRoundScore;
  int? humanWorstRoundScore;
  int stateVersion = 0;

  LocalPlayer get currentPlayer => players[currentPlayerIndex];
  bool get isFinished => phase == LocalGamePhase.finished;
  int? get nextRoundCards => roundIndex + 1 < rules.roundSequence.length
      ? rules.roundSequence[roundIndex + 1]
      : null;

  LocalGameState publicView(String playerId) {
    final copy = LocalGameState.fromJson(toJson());
    for (final player in copy.players) {
      if (player.id != playerId) player.hand = [];
    }
    // The game/deal RNG and bot decision RNGs are never part of public knowledge.
    copy.randomState = 0;
    copy.decisionRandomStates = {};
    return copy;
  }

  Map<String, dynamic> toJson() => {
    'gameId': gameId,
    'rulesId': rules.id,
    'rulesVersion': rules.version,
    'roundSequence': rules.roundSequence,
    'trumpEnabled': rules.trumpEnabled,
    'trumpMode': rules.trumpMode.name,
    'auctionEnabled': rules.auctionEnabled,
    'allowNoTrump': rules.allowNoTrump,
    'mustFollowSuit': rules.mustFollowSuit,
    'mustOvertrump': rules.mustOvertrump,
    'lastBidCannotMatchTrickCount': rules.lastBidCannotMatchTrickCount,
    'scoring': {
      'exactBase': rules.scoring.exactBase,
      'exactPerTrick': rules.scoring.exactPerTrick,
      'missPenaltyPerTrick': rules.scoring.missPenaltyPerTrick,
      'roundMultiplier': rules.scoring.roundMultiplier,
      'pochaBonusEnabled': rules.scoring.pochaBonusEnabled,
      'pochaBonus': rules.scoring.pochaBonus,
    },
    'players': players.map((player) => player.toJson()).toList(),
    'randomState': randomState,
    'decisionRandomStates': decisionRandomStates,
    'phase': phase.name,
    'roundIndex': roundIndex,
    'cardsPerRound': cardsPerRound,
    'dealerIndex': dealerIndex,
    'currentPlayerIndex': currentPlayerIndex,
    'trump': trump?.name,
    'leadSuit': leadSuit?.name,
    'currentTrick': currentTrick.map((card) => card.toJson()).toList(),
    'playedCards': playedCards.map((card) => card.toJson()).toList(),
    'tricksCompleted': tricksCompleted,
    'lastRoundScores': lastRoundScores,
    'lastTrickWinnerId': lastTrickWinnerId,
    'humanPredictions': humanPredictions,
    'humanPredictionsHit': humanPredictionsHit,
    'humanPredictedTricks': humanPredictedTricks,
    'humanWonTricks': humanWonTricks,
    'humanBestRoundScore': humanBestRoundScore,
    'humanWorstRoundScore': humanWorstRoundScore,
    'stateVersion': stateVersion,
  };

  factory LocalGameState.fromJson(Map<String, dynamic> json) {
    final players = (json['players'] as List<dynamic>)
        .map(
          (player) =>
              LocalPlayer.fromJson(Map<String, dynamic>.from(player as Map)),
        )
        .toList();
    final baseRules = GameRules.classic(playerCount: players.length);
    final roundSequence = (json['roundSequence'] as List<dynamic>?)
        ?.map((value) => value as int)
        .toList();
    final scoringJson = json['scoring'] as Map<dynamic, dynamic>?;
    final scoring = ScoringRules(
      exactBase:
          scoringJson?['exactBase'] as int? ?? baseRules.scoring.exactBase,
      exactPerTrick:
          scoringJson?['exactPerTrick'] as int? ??
          baseRules.scoring.exactPerTrick,
      missPenaltyPerTrick:
          scoringJson?['missPenaltyPerTrick'] as int? ??
          baseRules.scoring.missPenaltyPerTrick,
      roundMultiplier:
          scoringJson?['roundMultiplier'] as int? ??
          baseRules.scoring.roundMultiplier,
      pochaBonusEnabled:
          scoringJson?['pochaBonusEnabled'] as bool? ??
          baseRules.scoring.pochaBonusEnabled,
      pochaBonus:
          scoringJson?['pochaBonus'] as int? ?? baseRules.scoring.pochaBonus,
    );
    final trumpModeName = json['trumpMode'] as String?;
    final trumpMode = trumpModeName == null
        ? baseRules.trumpMode
        : TrumpMode.values.byName(trumpModeName);
    final game = LocalGameState(
      gameId: json['gameId'] as String,
      rules: GameRules(
        id: json['rulesId'] as String? ?? baseRules.id,
        version: json['rulesVersion'] as int? ?? baseRules.version,
        playerCount: players.length,
        roundSequence: roundSequence ?? baseRules.roundSequence,
        trumpEnabled: json['trumpEnabled'] as bool? ?? baseRules.trumpEnabled,
        trumpMode: trumpMode,
        auctionEnabled:
            json['auctionEnabled'] as bool? ?? baseRules.auctionEnabled,
        allowNoTrump: json['allowNoTrump'] as bool? ?? baseRules.allowNoTrump,
        mustFollowSuit:
            json['mustFollowSuit'] as bool? ?? baseRules.mustFollowSuit,
        mustOvertrump:
            json['mustOvertrump'] as bool? ?? baseRules.mustOvertrump,
        lastBidCannotMatchTrickCount:
            json['lastBidCannotMatchTrickCount'] as bool? ??
            baseRules.lastBidCannotMatchTrickCount,
        scoring: scoring,
      ),
      players: players,
      randomState: json['randomState'] as int,
    );
    game.phase = LocalGamePhase.values.byName(json['phase'] as String);
    game.decisionRandomStates = Map<String, dynamic>.from(
      json['decisionRandomStates'] as Map? ?? const {},
    ).map((key, value) => MapEntry(key, value as int));
    game.roundIndex = json['roundIndex'] as int;
    game.cardsPerRound = json['cardsPerRound'] as int;
    game.dealerIndex = json['dealerIndex'] as int;
    game.currentPlayerIndex = json['currentPlayerIndex'] as int;
    game.trump = _suitFromName(json['trump'] as String?);
    game.leadSuit = _suitFromName(json['leadSuit'] as String?);
    game.currentTrick.addAll(
      (json['currentTrick'] as List<dynamic>).map(
        (card) =>
            LocalPlayedCard.fromJson(Map<String, dynamic>.from(card as Map)),
      ),
    );
    game.playedCards.addAll(
      (json['playedCards'] as List<dynamic>).map(
        (card) =>
            LocalPlayedCard.fromJson(Map<String, dynamic>.from(card as Map)),
      ),
    );
    game.tricksCompleted = json['tricksCompleted'] as int;
    game.lastRoundScores = Map<String, dynamic>.from(
      json['lastRoundScores'] as Map,
    ).map((key, value) => MapEntry(key, value as int));
    game.lastTrickWinnerId = json['lastTrickWinnerId'] as String?;
    game.humanPredictions = json['humanPredictions'] as int? ?? 0;
    game.humanPredictionsHit = json['humanPredictionsHit'] as int? ?? 0;
    game.humanPredictedTricks = json['humanPredictedTricks'] as int? ?? 0;
    game.humanWonTricks = json['humanWonTricks'] as int? ?? 0;
    game.humanBestRoundScore = json['humanBestRoundScore'] as int?;
    game.humanWorstRoundScore = json['humanWorstRoundScore'] as int?;
    game.stateVersion = json['stateVersion'] as int;
    return game;
  }
}

class LocalGameEngine {
  static LocalGameState create({
    required String gameId,
    required List<LocalPlayer> players,
    required GameRules rules,
    required int seed,
  }) {
    if (players.length != rules.playerCount) {
      throw FormatException(
        'El ruleset necesita ${rules.playerCount} jugadores',
      );
    }
    return LocalGameState(
      gameId: gameId,
      rules: rules,
      players: players,
      randomState: seed,
    );
  }

  static void startRound(LocalGameState state) {
    if (state.phase != LocalGamePhase.roundResults && state.roundIndex != -1) {
      throw StateError('La ronda no puede empezar ahora');
    }
    final roundIndex = state.roundIndex + 1;
    if (roundIndex >= state.rules.roundSequence.length) {
      state.phase = LocalGamePhase.gameResults;
      state.stateVersion++;
      return;
    }
    final cards = state.rules.roundSequence[roundIndex];
    final random = LocalRandom(state.randomState);
    final deck = _shuffle(SpanishDeck.standard40(), random);
    final total = cards * state.players.length;
    final dealer = state.roundIndex < 0
        ? 0
        : (state.dealerIndex + 1) % state.players.length;
    state.roundIndex = roundIndex;
    state.cardsPerRound = cards;
    state.dealerIndex = dealer;
    state.currentPlayerIndex = (dealer + 1) % state.players.length;
    state.trump = switch (state.rules.trumpMode) {
      TrumpMode.revealed => deck[total < deck.length ? total : 0].suit,
      TrumpMode.chosenByBidWinner || TrumpMode.none => null,
    };
    state.leadSuit = null;
    state.currentTrick.clear();
    state.playedCards.clear();
    state.tricksCompleted = 0;
    state.lastRoundScores = {};
    state.lastTrickWinnerId = null;
    for (var index = 0; index < state.players.length; index++) {
      final player = state.players[index];
      player.hand = deck.sublist(index * cards, (index + 1) * cards);
      player.cardsRemaining = cards;
      player.bid = null;
      player.tricksWon = 0;
    }
    state.randomState = random.state;
    state.phase = LocalGamePhase.bidding;
    state.stateVersion++;
  }

  static List<int> legalBids(LocalGameState state) {
    if (state.phase != LocalGamePhase.bidding) return const [];
    final submitted = state.players
        .where((player) => player.bid != null)
        .toList();
    final total = submitted.fold<int>(0, (sum, player) => sum + player.bid!);
    return List<int>.generate(state.cardsPerRound + 1, (value) => value).where((
      bid,
    ) {
      final forbidden =
          state.rules.lastBidCannotMatchTrickCount &&
          submitted.length == state.players.length - 1 &&
          total + bid == state.cardsPerRound;
      return !forbidden && state.currentPlayer.bid == null;
    }).toList();
  }

  static String? bidExplanation(LocalGameState state, int bid) {
    if (state.phase != LocalGamePhase.bidding) {
      return 'Ahora no se puede cantar.';
    }
    if (legalBids(state).contains(bid)) return null;
    final submitted = state.players
        .where((player) => player.bid != null)
        .fold<int>(0, (sum, player) => sum + player.bid!);
    if (state.players.where((player) => player.bid != null).length ==
            state.players.length - 1 &&
        state.rules.lastBidCannotMatchTrickCount &&
        submitted + bid == state.cardsPerRound) {
      return 'No puedes cantar $bid porque la suma coincidiría con las '
          '${state.cardsPerRound} bazas disponibles.';
    }
    return 'Esa predicción no es legal.';
  }

  static void submitBid(LocalGameState state, String playerId, int bid) {
    _requireTurn(state, playerId);
    final legal = legalBids(state);
    if (state.phase != LocalGamePhase.bidding || !legal.contains(bid)) {
      throw StateError('Predicción no válida');
    }
    state.currentPlayer.bid = bid;
    if (state.players.every((player) => player.bid != null)) {
      if (state.rules.auctionEnabled ||
          state.rules.trumpMode == TrumpMode.chosenByBidWinner) {
        final winner = state.players.reduce(
          (best, player) => player.bid! > best.bid! ? player : best,
        );
        state.phase = LocalGamePhase.choosingTrump;
        state.currentPlayerIndex = state.players.indexOf(winner);
      } else {
        state.phase = LocalGamePhase.playingTrick;
        state.currentPlayerIndex =
            (state.dealerIndex + 1) % state.players.length;
      }
    } else {
      state.currentPlayerIndex =
          (state.currentPlayerIndex + 1) % state.players.length;
    }
    state.stateVersion++;
  }

  static void chooseTrump(LocalGameState state, String playerId, Suit? trump) {
    _requireTurn(state, playerId);
    if (state.phase != LocalGamePhase.choosingTrump) {
      throw StateError('Ahora no se puede elegir triunfo');
    }
    if (trump == null && !state.rules.allowNoTrump) {
      throw StateError('Debes elegir un palo de triunfo');
    }
    state.trump = trump;
    state.phase = LocalGamePhase.playingTrick;
    state.currentPlayerIndex = (state.dealerIndex + 1) % state.players.length;
    state.stateVersion++;
  }

  static List<PochaCard> legalCards(LocalGameState state, String playerId) {
    if (state.phase != LocalGamePhase.playingTrick) return const [];
    _requireTurn(state, playerId);
    return PochaRuleEngine.legalCards(
      hand: state.currentPlayer.hand,
      trick: state.currentTrick.map((item) => item.card).toList(),
      rules: state.rules,
      trump: state.trump,
    );
  }

  static void playCard(LocalGameState state, String playerId, String cardId) {
    _requireTurn(state, playerId);
    final matching = state.currentPlayer.hand
        .where((candidate) => candidate.id == cardId)
        .toList();
    final card = matching.isEmpty ? null : matching.first;
    if (card == null) throw StateError('La carta no pertenece al jugador');
    if (!legalCards(
      state,
      playerId,
    ).any((candidate) => candidate.id == cardId)) {
      throw StateError('La carta no es legal');
    }
    state.currentPlayer.hand.removeWhere((candidate) => candidate.id == cardId);
    state.currentPlayer.cardsRemaining--;
    final played = LocalPlayedCard(playerId: playerId, card: card);
    state.currentTrick.add(played);
    state.playedCards.add(played);
    state.leadSuit ??= card.suit;
    if (state.currentTrick.length < state.players.length) {
      state.currentPlayerIndex =
          (state.currentPlayerIndex + 1) % state.players.length;
      state.stateVersion++;
      return;
    }
    final winnerIndex = _winnerIndex(state);
    state.players[winnerIndex].tricksWon++;
    state.tricksCompleted++;
    state.lastTrickWinnerId = state.players[winnerIndex].id;
    state.currentPlayerIndex = winnerIndex;
    state.phase = LocalGamePhase.trickResults;
    state.stateVersion++;
  }

  static void continueAfterTrick(LocalGameState state) {
    if (state.phase != LocalGamePhase.trickResults) {
      throw StateError('La baza aún no está lista para resolverse');
    }
    state.currentTrick.clear();
    state.leadSuit = null;
    if (state.players.every((player) => player.hand.isEmpty)) {
      for (final player in state.players) {
        final score = state.rules.scoring.score(
          bid: player.bid ?? 0,
          tricks: player.tricksWon,
          cardsPerRound: state.cardsPerRound,
        );
        player.score += score;
        state.lastRoundScores[player.id] = score;
        if (player.human) {
          final bid = player.bid ?? 0;
          state.humanPredictions++;
          state.humanPredictedTricks += bid;
          state.humanWonTricks += player.tricksWon;
          if (bid == player.tricksWon) state.humanPredictionsHit++;
          state.humanBestRoundScore = state.humanBestRoundScore == null
              ? score
              : score > state.humanBestRoundScore!
              ? score
              : state.humanBestRoundScore;
          state.humanWorstRoundScore = state.humanWorstRoundScore == null
              ? score
              : score < state.humanWorstRoundScore!
              ? score
              : state.humanWorstRoundScore;
        }
      }
      state.phase = LocalGamePhase.roundResults;
    } else {
      state.phase = LocalGamePhase.playingTrick;
    }
    state.stateVersion++;
  }

  static void startNextRound(LocalGameState state) => startRound(state);

  static bool wouldWinCurrentTrick(LocalGameState state, PochaCard card) {
    if (state.currentTrick.isEmpty) return true;
    final lead = state.leadSuit ?? state.currentTrick.first.card.suit;
    var winner = state.currentTrick.first.card;
    for (final played in state.currentTrick.skip(1)) {
      winner = _compare(winner, played.card, lead, state.trump);
    }
    return _compare(winner, card, lead, state.trump) == card;
  }

  static void finish(LocalGameState state) {
    if (state.phase != LocalGamePhase.gameResults) {
      throw StateError('La partida aún no ha terminado');
    }
    state.phase = LocalGamePhase.finished;
    state.stateVersion++;
  }

  static String? legalCardExplanation(
    LocalGameState state,
    String playerId,
    String cardId,
  ) {
    final player = state.players.firstWhere(
      (candidate) => candidate.id == playerId,
    );
    final card = player.hand.firstWhere(
      (candidate) => candidate.id == cardId,
      orElse: () => throw StateError('La carta no pertenece al jugador'),
    );
    final legal = legalCards(state, playerId);
    if (legal.any((candidate) => candidate.id == cardId)) return null;
    if (state.currentTrick.isNotEmpty && state.rules.mustFollowSuit) {
      final lead = state.leadSuit ?? state.currentTrick.first.card.suit;
      if (player.hand.any((candidate) => candidate.suit == lead) &&
          card.suit != lead) {
        return 'Debes asistir a ${_suitName(lead)}.';
      }
    }
    return 'Esa carta no es legal ahora.';
  }

  static int _winnerIndex(LocalGameState state) {
    var winner = state.currentTrick.first;
    final lead = state.currentTrick.first.card.suit;
    for (final played in state.currentTrick.skip(1)) {
      if (_compare(winner.card, played.card, lead, state.trump) ==
          played.card) {
        winner = played;
      }
    }
    return state.players.indexWhere((player) => player.id == winner.playerId);
  }

  static PochaCard _compare(
    PochaCard first,
    PochaCard second,
    Suit lead,
    Suit? trump,
  ) {
    final firstTrump = trump != null && first.suit == trump;
    final secondTrump = trump != null && second.suit == trump;
    if (firstTrump != secondTrump) return firstTrump ? first : second;
    if (first.suit != second.suit) {
      if (first.suit == lead) return first;
      if (second.suit == lead) return second;
      return first;
    }
    return standardRankStrength[first.rank]! >=
            standardRankStrength[second.rank]!
        ? first
        : second;
  }

  static void _requireTurn(LocalGameState state, String playerId) {
    if (state.players[state.currentPlayerIndex].id != playerId) {
      throw StateError('No es el turno de $playerId');
    }
  }
}

List<PochaCard> _shuffle(List<PochaCard> source, LocalRandom random) {
  final cards = [...source];
  for (var index = cards.length - 1; index > 0; index--) {
    final swap = (random.next() * (index + 1)).floor();
    final card = cards[index];
    cards[index] = cards[swap];
    cards[swap] = card;
  }
  return cards;
}

Map<String, String> _cardToJson(PochaCard card) => {
  'suit': card.suit.name,
  'rank': card.rank.name,
};

PochaCard _cardFromJson(Map<String, dynamic> json) => PochaCard(
  suit: Suit.values.byName(json['suit'] as String),
  rank: Rank.values.byName(json['rank'] as String),
);

Suit? _suitFromName(String? value) =>
    value == null ? null : Suit.values.byName(value);

String _suitName(Suit suit) => switch (suit) {
  Suit.oros => 'oros',
  Suit.copas => 'copas',
  Suit.espadas => 'espadas',
  Suit.bastos => 'bastos',
};

int _stableSeed(String value) => value.codeUnits.fold<int>(
  17,
  (seed, codeUnit) => (seed * 31 + codeUnit) & 0x7FFFFFFF,
);
