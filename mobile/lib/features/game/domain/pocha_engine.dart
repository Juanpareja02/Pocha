enum Suit { oros, copas, espadas, bastos }

enum Rank { as_, dos, tres, cuatro, cinco, seis, siete, sota, caballo, rey }

enum TrumpMode { revealed, chosenByBidWinner, none }

enum GameRulesPreset { classic, auction, custom }

const standardRankStrength = <Rank, int>{
  Rank.as_: 10,
  Rank.tres: 9,
  Rank.rey: 8,
  Rank.caballo: 7,
  Rank.sota: 6,
  Rank.siete: 5,
  Rank.seis: 4,
  Rank.cinco: 3,
  Rank.cuatro: 2,
  Rank.dos: 1,
};

class PochaCard {
  const PochaCard({required this.suit, required this.rank});

  final Suit suit;
  final Rank rank;

  String get id => '${suit.name}:${rank.name}';
}

class ScoringRules {
  const ScoringRules({
    this.exactBase = 10,
    this.exactPerTrick = 5,
    this.missPenaltyPerTrick = 5,
    this.roundMultiplier = 1,
    this.pochaBonusEnabled = false,
    this.pochaBonus = 0,
  });

  final int exactBase;
  final int exactPerTrick;
  final int missPenaltyPerTrick;
  final int roundMultiplier;
  final bool pochaBonusEnabled;
  final int pochaBonus;

  int score({required int bid, required int tricks, int cardsPerRound = 0}) {
    final exact = bid == tricks;
    final rawScore = exact
        ? exactBase + exactPerTrick * tricks
        : -missPenaltyPerTrick * (bid - tricks).abs();
    final bonus = pochaBonusEnabled && exact && bid == cardsPerRound
        ? pochaBonus
        : 0;
    return (rawScore + bonus) * roundMultiplier;
  }
}

class GameRules {
  const GameRules({
    required this.id,
    required this.version,
    required this.playerCount,
    required this.roundSequence,
    this.trumpEnabled = true,
    this.trumpMode = TrumpMode.revealed,
    this.auctionEnabled = false,
    this.allowNoTrump = false,
    this.mustFollowSuit = true,
    this.mustOvertrump = false,
    this.lastBidCannotMatchTrickCount = true,
    this.scoring = const ScoringRules(),
  });

  factory GameRules.classic({int playerCount = 4}) {
    final maximumCards = (40 ~/ playerCount).clamp(1, 8).toInt();
    final ascending = List<int>.generate(maximumCards, (index) => index + 1);
    return GameRules(
      id: 'classic',
      version: 1,
      playerCount: playerCount,
      roundSequence: [
        ...ascending,
        ...ascending.take(ascending.length - 1).toList().reversed,
      ],
    );
  }

  factory GameRules.auction({int playerCount = 4}) {
    final base = GameRules.classic(playerCount: playerCount);
    return GameRules(
      id: 'auction',
      version: 1,
      playerCount: playerCount,
      roundSequence: base.roundSequence,
      trumpMode: TrumpMode.chosenByBidWinner,
      auctionEnabled: true,
      mustFollowSuit: base.mustFollowSuit,
      mustOvertrump: base.mustOvertrump,
      lastBidCannotMatchTrickCount: base.lastBidCannotMatchTrickCount,
      scoring: base.scoring,
    );
  }

  factory GameRules.custom({
    required int playerCount,
    List<int>? roundSequence,
    bool auctionEnabled = false,
    bool allowNoTrump = false,
    bool mustOvertrump = false,
  }) {
    final base = GameRules.classic(playerCount: playerCount);
    final choosesTrump = auctionEnabled || allowNoTrump;
    return GameRules(
      id: 'custom',
      version: 1,
      playerCount: playerCount,
      roundSequence: roundSequence ?? base.roundSequence,
      trumpMode: choosesTrump
          ? TrumpMode.chosenByBidWinner
          : TrumpMode.revealed,
      auctionEnabled: choosesTrump,
      allowNoTrump: allowNoTrump,
      mustFollowSuit: true,
      mustOvertrump: mustOvertrump,
      lastBidCannotMatchTrickCount: true,
      scoring: base.scoring,
    );
  }

  final String id;
  final int version;
  final int playerCount;
  final List<int> roundSequence;
  final bool trumpEnabled;
  final TrumpMode trumpMode;
  final bool auctionEnabled;
  final bool allowNoTrump;
  final bool mustFollowSuit;
  final bool mustOvertrump;
  final bool lastBidCannotMatchTrickCount;
  final ScoringRules scoring;
}

class SpanishDeck {
  static List<PochaCard> standard40() {
    return [
      for (final suit in Suit.values)
        for (final rank in Rank.values) PochaCard(suit: suit, rank: rank),
    ];
  }
}

class PochaRuleEngine {
  static List<PochaCard> legalCards({
    required List<PochaCard> hand,
    required List<PochaCard> trick,
    required GameRules rules,
    Suit? trump,
  }) {
    if (trick.isEmpty || !rules.mustFollowSuit) return List.unmodifiable(hand);
    final leadSuit = trick.first.suit;
    final leadCards = hand
        .where((card) => card.suit == leadSuit)
        .toList(growable: false);
    if (leadCards.isNotEmpty) return leadCards;
    if (rules.mustOvertrump && trump != null) {
      final highestTrump = trick
          .where((card) => card.suit == trump)
          .map((card) => standardRankStrength[card.rank]!)
          .fold<int?>(
            null,
            (highest, strength) =>
                highest == null || strength > highest ? strength : highest,
          );
      final trumpCards = hand
          .where((card) => card.suit == trump)
          .toList(growable: false);
      if (highestTrump == null || trumpCards.isEmpty) {
        return List.unmodifiable(hand);
      }
      final higher = trumpCards
          .where((card) => standardRankStrength[card.rank]! > highestTrump)
          .toList(growable: false);
      return higher.isNotEmpty ? higher : trumpCards;
    }
    return List.unmodifiable(hand);
  }
}
