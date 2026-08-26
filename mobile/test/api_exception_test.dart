import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/online/domain/auth_port.dart';

void main() {
  test('maps common HTTP failures to typed, user-safe errors', () {
    final error = ApiException.fromResponse(
      http.Response('', 429),
      fallback: 'No se pudo completar la acción.',
    );

    expect(error.kind, ApiErrorKind.rateLimited);
    expect(error.statusCode, 429);
    expect(error.message, 'No se pudo completar la acción.');
  });

  test('does not enable development authentication by default', () {
    expect(isDevelopmentAuthMode, isFalse);
    expect(
      () => developmentAuthPort(baseUrl: 'https://api.example.invalid'),
      throwsA(isA<AuthConfigurationException>()),
    );
  });
}
