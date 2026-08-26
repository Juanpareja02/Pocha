import 'package:http/http.dart' as http;

enum ApiErrorKind {
  badRequest,
  unauthorized,
  forbidden,
  rateLimited,
  server,
  unknown,
}

class ApiException implements Exception {
  const ApiException({
    required this.kind,
    required this.message,
    this.statusCode,
  });

  final ApiErrorKind kind;
  final String message;
  final int? statusCode;

  factory ApiException.fromResponse(
    http.Response response, {
    required String fallback,
  }) {
    final kind = switch (response.statusCode) {
      400 || 422 => ApiErrorKind.badRequest,
      401 => ApiErrorKind.unauthorized,
      403 => ApiErrorKind.forbidden,
      429 => ApiErrorKind.rateLimited,
      >= 500 => ApiErrorKind.server,
      _ => ApiErrorKind.unknown,
    };
    return ApiException(
      kind: kind,
      statusCode: response.statusCode,
      message: fallback,
    );
  }

  @override
  String toString() => message;
}
