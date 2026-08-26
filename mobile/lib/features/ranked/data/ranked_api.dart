import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/network/api_exception.dart';

class RankedApi {
  RankedApi({required this.baseUrl, required this.token, this.client});

  final String baseUrl;
  final String token;
  final http.Client? client;

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await (client ?? http.Client())
        .get(
          Uri.parse('$baseUrl$path'),
          headers: {'authorization': 'Bearer $token'},
        )
        .timeout(const Duration(seconds: 10));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException.fromResponse(
        response,
        fallback: 'No se pudo cargar la información competitiva.',
      );
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<RankedProfile> profile() async =>
      RankedProfile.fromJson(await _get('/ranked/me'));

  Future<RankedLeaderboardPage> leaderboard({
    String? cursor,
    int limit = 50,
    bool global = false,
  }) async {
    final query = <String, String>{'limit': '$limit'};
    if (cursor != null) query['cursor'] = cursor;
    if (global) query['scope'] = 'global';
    final uri = Uri.parse(
      '$baseUrl/ranked/leaderboard',
    ).replace(queryParameters: query);
    final response = await (client ?? http.Client())
        .get(uri, headers: {'authorization': 'Bearer $token'})
        .timeout(const Duration(seconds: 10));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException.fromResponse(
        response,
        fallback: 'No se pudo cargar la clasificación.',
      );
    }
    return RankedLeaderboardPage.fromJson(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<List<RankedHistoryRow>> history() async {
    final json = await _get('/ranked/history');
    return (json['games'] as List<dynamic>? ?? const <dynamic>[])
        .map(
          (value) => RankedHistoryRow.fromJson(
            Map<String, dynamic>.from(value as Map),
          ),
        )
        .toList();
  }

  Future<RankedSeasonSummary> season() async {
    return RankedSeasonSummary.fromJson(await _get('/seasons/current'));
  }
}

class RankedProfile {
  const RankedProfile({
    required this.username,
    required this.displayName,
    required this.rating,
    required this.peakRating,
    required this.rankName,
    required this.position,
    required this.provisional,
    required this.placementGames,
    required this.placementTotal,
    required this.gamesPlayed,
    required this.wins,
    required this.podiums,
    required this.averagePosition,
    required this.predictionAccuracy,
    required this.seasonName,
    required this.seasonEndsAt,
  });

  final String username;
  final String displayName;
  final int rating;
  final int peakRating;
  final String rankName;
  final int? position;
  final bool provisional;
  final int placementGames;
  final int placementTotal;
  final int gamesPlayed;
  final int wins;
  final int podiums;
  final double? averagePosition;
  final double predictionAccuracy;
  final String seasonName;
  final DateTime? seasonEndsAt;

  factory RankedProfile.fromJson(Map<String, dynamic> json) {
    final season = Map<String, dynamic>.from(
      json['season'] as Map? ?? const {},
    );
    final rank = Map<String, dynamic>.from(json['rank'] as Map? ?? const {});
    return RankedProfile(
      username: '${json['username'] ?? 'jugador'}',
      displayName: '${json['displayName'] ?? 'Jugador'}',
      rating: (json['rating'] as num?)?.toInt() ?? 1000,
      peakRating: (json['peakRating'] as num?)?.toInt() ?? 1000,
      rankName: '${rank['name'] ?? 'Provisional'}',
      position: (json['position'] as num?)?.toInt(),
      provisional: json['provisional'] as bool? ?? true,
      placementGames: (json['placementGames'] as num?)?.toInt() ?? 0,
      placementTotal: (json['placementTotal'] as num?)?.toInt() ?? 10,
      gamesPlayed: (json['gamesPlayed'] as num?)?.toInt() ?? 0,
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      podiums: (json['podiums'] as num?)?.toInt() ?? 0,
      averagePosition: (json['averagePosition'] as num?)?.toDouble(),
      predictionAccuracy: (json['predictionAccuracy'] as num?)?.toDouble() ?? 0,
      seasonName: '${season['name'] ?? 'Temporada'}',
      seasonEndsAt: DateTime.tryParse('${season['endsAt']}'),
    );
  }
}

class RankedLeaderboardPage {
  const RankedLeaderboardPage({
    required this.items,
    this.nextCursor,
    this.myPosition,
  });

  final List<RankedLeaderboardRow> items;
  final String? nextCursor;
  final int? myPosition;

  factory RankedLeaderboardPage.fromJson(Map<String, dynamic> json) {
    return RankedLeaderboardPage(
      items: (json['items'] as List<dynamic>? ?? const <dynamic>[])
          .map(
            (value) => RankedLeaderboardRow.fromJson(
              Map<String, dynamic>.from(value as Map),
            ),
          )
          .toList(),
      nextCursor: json['nextCursor'] as String?,
      myPosition: (json['myPosition'] as num?)?.toInt(),
    );
  }
}

class RankedLeaderboardRow {
  const RankedLeaderboardRow({
    required this.position,
    required this.username,
    required this.rating,
    required this.rankName,
    required this.gamesPlayed,
    required this.provisional,
  });

  final int position;
  final String username;
  final int rating;
  final String rankName;
  final int gamesPlayed;
  final bool provisional;

  factory RankedLeaderboardRow.fromJson(Map<String, dynamic> json) {
    final rank = Map<String, dynamic>.from(json['rank'] as Map? ?? const {});
    return RankedLeaderboardRow(
      position: (json['position'] as num?)?.toInt() ?? 0,
      username: '${json['username'] ?? 'jugador'}',
      rating: (json['rating'] as num?)?.toInt() ?? 1000,
      rankName: '${rank['name'] ?? 'Provisional'}',
      gamesPlayed: (json['gamesPlayed'] as num?)?.toInt() ?? 0,
      provisional: json['provisional'] as bool? ?? true,
    );
  }
}

class RankedHistoryRow {
  const RankedHistoryRow({
    required this.gameId,
    required this.position,
    required this.score,
    required this.delta,
    required this.oldRating,
    required this.newRating,
    required this.rankId,
    required this.previousRankId,
    required this.promoted,
    required this.demoted,
    required this.abandoned,
    required this.createdAt,
  });

  final String gameId;
  final int position;
  final int score;
  final int delta;
  final int oldRating;
  final int newRating;
  final String rankId;
  final String? previousRankId;
  final bool promoted;
  final bool demoted;
  final bool abandoned;
  final DateTime? createdAt;

  factory RankedHistoryRow.fromJson(Map<String, dynamic> json) =>
      RankedHistoryRow(
        gameId: '${json['gameId']}',
        position: (json['position'] as num?)?.toInt() ?? 0,
        score: (json['score'] as num?)?.toInt() ?? 0,
        delta: (json['delta'] as num?)?.toInt() ?? 0,
        oldRating: (json['oldRating'] as num?)?.toInt() ?? 1000,
        newRating: (json['newRating'] as num?)?.toInt() ?? 1000,
        rankId: '${json['rankId'] ?? 'unranked'}',
        previousRankId: json['previousRankId'] as String?,
        promoted: json['promoted'] as bool? ?? false,
        demoted: json['demoted'] as bool? ?? false,
        abandoned: json['abandoned'] as bool? ?? false,
        createdAt: DateTime.tryParse('${json['createdAt']}'),
      );
}

class RankedSeasonSummary {
  const RankedSeasonSummary({
    required this.id,
    required this.name,
    required this.number,
    required this.status,
    required this.endsAt,
  });

  final String id;
  final String name;
  final int number;
  final String status;
  final DateTime? endsAt;

  factory RankedSeasonSummary.fromJson(Map<String, dynamic> json) =>
      RankedSeasonSummary(
        id: '${json['id']}',
        name: '${json['name']}',
        number: (json['number'] as num?)?.toInt() ?? 1,
        status: '${json['status']}',
        endsAt: DateTime.tryParse('${json['endsAt']}'),
      );
}
