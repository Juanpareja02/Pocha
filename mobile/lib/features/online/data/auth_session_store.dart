import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../domain/auth_port.dart';

class AuthSessionStore {
  AuthSessionStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const tokenKey = 'pocha.auth.token';
  static const userIdKey = 'pocha.auth.user_id';
  static const displayNameKey = 'pocha.auth.display_name';

  final FlutterSecureStorage _storage;

  Future<void> save(AuthSession session) async {
    await Future.wait([
      _storage.write(key: tokenKey, value: session.token),
      _storage.write(key: userIdKey, value: session.userId),
      _storage.write(key: displayNameKey, value: session.displayName),
    ]);
  }

  Future<AuthSession?> read() async {
    try {
      final values = await Future.wait([
        _storage.read(key: tokenKey),
        _storage.read(key: userIdKey),
        _storage.read(key: displayNameKey),
      ]);
      if (values[0] == null || values[1] == null || values[2] == null) {
        return null;
      }
      return AuthSession(
        token: values[0]!,
        userId: values[1]!,
        displayName: values[2]!,
      );
    } catch (_) {
      // Widget tests and unsupported platforms have no secure-storage plugin.
      return null;
    }
  }

  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: tokenKey),
      _storage.delete(key: userIdKey),
      _storage.delete(key: displayNameKey),
    ]);
  }
}
