/// Compile-time endpoints for the mobile environment.
///
/// Staging and release builds should provide the explicit `STAGING_API_URL`
/// and `STAGING_SOCKET_URL` defines. The legacy `POCHA_SERVER_URL` fallback is
/// kept only so existing development commands continue to compile while they
/// migrate to the explicit names.
const pochaApiUrl = String.fromEnvironment(
  'STAGING_API_URL',
  defaultValue: String.fromEnvironment(
    'POCHA_SERVER_URL',
    defaultValue: 'https://api.example.invalid',
  ),
);

const pochaAuthMode = String.fromEnvironment(
  'POCHA_AUTH_MODE',
  defaultValue: 'external',
);

const pochaSocketUrl = String.fromEnvironment(
  'STAGING_SOCKET_URL',
  defaultValue: String.fromEnvironment(
    'POCHA_SOCKET_URL',
    defaultValue: pochaApiUrl,
  ),
);

/// Prevents a release build from silently connecting to development services.
/// Flutter release builds should be produced by the release script, but this
/// runtime guard also protects direct `flutter build --release` invocations.
void validateMobileRuntimeConfig({
  required bool release,
  String? apiUrl,
  String? socketUrl,
  String? authMode,
}) {
  final resolvedAuthMode = authMode ?? pochaAuthMode;
  final resolvedApiUrl = apiUrl ?? pochaApiUrl;
  final resolvedSocketUrl = socketUrl ?? pochaSocketUrl;
  if (resolvedAuthMode != 'development' && resolvedAuthMode != 'external') {
    throw StateError('POCHA_AUTH_MODE must be development or external');
  }
  if (release && resolvedAuthMode == 'development') {
    throw StateError('Release builds cannot use development authentication');
  }
  if (release || resolvedAuthMode != 'development') {
    _assertPublicHttps('STAGING_API_URL', resolvedApiUrl);
    _assertPublicHttps('STAGING_SOCKET_URL', resolvedSocketUrl);
  }
}

void _assertPublicHttps(String name, String value) {
  final parsed = Uri.tryParse(value);
  final host = parsed?.host.toLowerCase() ?? '';
  final reservedHost =
      host == 'localhost' ||
      host == '127.0.0.1' ||
      host == '0.0.0.0' ||
      host == '10.0.2.2' ||
      host == 'example.com' ||
      host == 'example.org' ||
      host == 'example.net' ||
      host == 'invalid' ||
      host.endsWith('.example.com') ||
      host.endsWith('.example.org') ||
      host.endsWith('.example.net') ||
      host.endsWith('.invalid') ||
      _isPrivateIpLiteral(host);
  if (parsed == null ||
      parsed.scheme != 'https' ||
      host.isEmpty ||
      reservedHost) {
    throw StateError('$name must be a real public HTTPS URL');
  }
}

bool _isPrivateIpLiteral(String host) {
  final octets = host.split('.');
  if (octets.length == 4 &&
      octets.every((octet) => int.tryParse(octet) != null)) {
    final values = octets.map(int.parse).toList(growable: false);
    if (values.every((value) => value >= 0 && value <= 255)) {
      final first = values[0];
      final second = values[1];
      return first == 0 ||
          first == 10 ||
          first == 127 ||
          (first == 169 && second == 254) ||
          (first == 172 && second >= 16 && second <= 31) ||
          (first == 192 && second == 168);
    }
  }
  return host == '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe8') ||
      host.startsWith('fe9') ||
      host.startsWith('fea') ||
      host.startsWith('feb');
}
