import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/config/runtime_config.dart';

void main() {
  test('fails closed for placeholder release endpoints', () {
    expect(
      () => validateMobileRuntimeConfig(release: true),
      throwsA(isA<StateError>()),
    );
  });

  test('fails closed for the Android emulator endpoint', () {
    expect(
      () => validateMobileRuntimeConfig(
        release: true,
        authMode: 'external',
        apiUrl: 'https://staging-api.staging.dev',
        socketUrl: 'https://10.0.2.2',
      ),
      throwsA(isA<StateError>()),
    );
  });
}
