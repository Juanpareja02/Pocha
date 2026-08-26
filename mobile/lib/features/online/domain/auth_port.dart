import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../../core/config/runtime_config.dart';
import '../../../core/network/api_exception.dart';

bool get isDevelopmentAuthMode => pochaAuthMode == 'development';

class AuthConfigurationException implements Exception {
  const AuthConfigurationException([
    this.message =
        'La autenticación externa todavía no está configurada para esta build.',
  ]);

  final String message;

  @override
  String toString() => message;
}

DevelopmentAuthPort developmentAuthPort({required String baseUrl}) {
  if (!isDevelopmentAuthMode && !_hasPochaFirebaseConfiguration) {
    throw const AuthConfigurationException();
  }
  return DevelopmentAuthPort(baseUrl: baseUrl);
}

const pochaFirebaseApiKey = String.fromEnvironment('POCHA_FIREBASE_API_KEY');
const pochaFirebaseAppId = String.fromEnvironment('POCHA_FIREBASE_APP_ID');
const pochaFirebaseMessagingSenderId = String.fromEnvironment(
  'POCHA_FIREBASE_MESSAGING_SENDER_ID',
);
const pochaFirebaseProjectId = String.fromEnvironment(
  'POCHA_FIREBASE_PROJECT_ID',
);
const pochaGoogleServerClientId = String.fromEnvironment(
  'POCHA_GOOGLE_SERVER_CLIENT_ID',
);
const pochaGoogleIosClientId = String.fromEnvironment(
  'POCHA_GOOGLE_IOS_CLIENT_ID',
);
const pochaAppleServiceId = String.fromEnvironment('POCHA_APPLE_SERVICE_ID');
const pochaAppleRedirectUri = String.fromEnvironment(
  'POCHA_APPLE_REDIRECT_URI',
);

bool get _hasPochaFirebaseConfiguration =>
    pochaFirebaseApiKey.isNotEmpty &&
    pochaFirebaseAppId.isNotEmpty &&
    pochaFirebaseMessagingSenderId.isNotEmpty &&
    pochaFirebaseProjectId.isNotEmpty;

Future<FirebaseApp>? _firebaseInitialization;

Future<FirebaseApp> ensurePochaFirebaseInitialized() {
  return _firebaseInitialization ??= _initializePochaFirebase();
}

Future<FirebaseApp> _initializePochaFirebase() async {
  if (Firebase.apps.isNotEmpty) return Firebase.app();
  final missing = <String>[
    if (pochaFirebaseApiKey.isEmpty) 'POCHA_FIREBASE_API_KEY',
    if (pochaFirebaseAppId.isEmpty) 'POCHA_FIREBASE_APP_ID',
    if (pochaFirebaseMessagingSenderId.isEmpty)
      'POCHA_FIREBASE_MESSAGING_SENDER_ID',
    if (pochaFirebaseProjectId.isEmpty) 'POCHA_FIREBASE_PROJECT_ID',
  ];
  if (missing.isNotEmpty) {
    throw AuthConfigurationException(
      'Faltan variables Firebase para esta build: ${missing.join(', ')}.',
    );
  }
  return Firebase.initializeApp(
    options: const FirebaseOptions(
      apiKey: pochaFirebaseApiKey,
      appId: pochaFirebaseAppId,
      messagingSenderId: pochaFirebaseMessagingSenderId,
      projectId: pochaFirebaseProjectId,
    ),
  );
}

class AuthSession {
  const AuthSession({
    required this.token,
    required this.userId,
    required this.displayName,
    this.isGuest = false,
  });

  final String token;
  final String userId;
  final String displayName;
  final bool isGuest;
}

class OnlineHistoryItem {
  const OnlineHistoryItem({
    required this.gameId,
    required this.rulesetId,
    required this.finishedAt,
  });

  final String gameId;
  final String rulesetId;
  final DateTime? finishedAt;
}

abstract interface class AuthPort {
  Future<AuthSession> signInAsGuest({String? displayName});
}

class AccountApi {
  AccountApi({required this.baseUrl, this.client});

  final String baseUrl;
  final http.Client? client;

  Future<void> deleteAccount(String token) async {
    final response = await (client ?? http.Client())
        .delete(
          Uri.parse('$baseUrl/users/me'),
          headers: {'authorization': 'Bearer $token'},
        )
        .timeout(const Duration(seconds: 10));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException.fromResponse(
        response,
        fallback: 'No se pudo eliminar la cuenta.',
      );
    }
  }
}

/// Development/test boundary. Production should provide Firebase/Apple/Google
/// token acquisition through the same AuthPort without changing the session UI.
class DevelopmentAuthPort implements AuthPort {
  DevelopmentAuthPort({required this.baseUrl, this.client});

  final String baseUrl;
  final http.Client? client;
  late final FirebaseAuthPort _firebase = FirebaseAuthPort(
    baseUrl: baseUrl,
    client: client,
  );

  @override
  Future<AuthSession> signInAsGuest({String? displayName}) async {
    if (!isDevelopmentAuthMode) {
      return _firebase.signInAsGuest(displayName: displayName);
    }
    final response = await (client ?? http.Client())
        .post(
          Uri.parse('$baseUrl/auth/guest'),
          headers: const {'content-type': 'application/json'},
          body: jsonEncode(
            displayName == null
                ? <String, String>{}
                : {'displayName': displayName},
          ),
        )
        .timeout(const Duration(seconds: 10));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException.fromResponse(
        response,
        fallback: 'No se pudo crear la sesión invitada.',
      );
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final user = json['user'] as Map<String, dynamic>;
    return AuthSession(
      token: '${json['token']}',
      userId: '${user['id']}',
      displayName: '${user['displayName']}',
      isGuest: '${user['isGuest']}' == 'true',
    );
  }

  Future<AuthSession> signInAsDevelopmentAccount({
    required String userId,
    String? displayName,
  }) async {
    if (!isDevelopmentAuthMode) {
      final session = await _firebase.currentSession();
      if (session == null || session.isGuest) {
        throw const AuthConfigurationException(
          'Inicia sesión con una cuenta permanente antes de abrir ranked.',
        );
      }
      return session;
    }
    final response = await (client ?? http.Client())
        .post(
          Uri.parse('$baseUrl/auth/development'),
          headers: const {'content-type': 'application/json'},
          body: jsonEncode({'userId': userId, 'displayName': ?displayName}),
        )
        .timeout(const Duration(seconds: 10));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException.fromResponse(
        response,
        fallback: 'La cuenta competitiva de desarrollo no está disponible.',
      );
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final user = json['user'] as Map<String, dynamic>;
    return AuthSession(
      token: '${json['token']}',
      userId: '${user['id']}',
      displayName: '${user['displayName']}',
      isGuest: '${user['isGuest']}' == 'true',
    );
  }

  Future<AuthSession> signInWithEmail({
    required String email,
    required String password,
  }) {
    if (isDevelopmentAuthMode) {
      throw const AuthConfigurationException(
        'El email solo está disponible en una build externa.',
      );
    }
    return _firebase.signInWithEmail(email: email, password: password);
  }

  Future<AuthSession> registerWithEmail({
    required String email,
    required String password,
  }) {
    if (isDevelopmentAuthMode) {
      throw const AuthConfigurationException(
        'El registro solo está disponible en una build externa.',
      );
    }
    return _firebase.registerWithEmail(email: email, password: password);
  }

  Future<AuthSession> signInWithGoogle() {
    if (isDevelopmentAuthMode) {
      throw const AuthConfigurationException(
        'Google solo está disponible en una build externa.',
      );
    }
    return _firebase.signInWithGoogle();
  }

  Future<AuthSession> signInWithApple() {
    if (isDevelopmentAuthMode) {
      throw const AuthConfigurationException(
        'Apple solo está disponible en una build externa.',
      );
    }
    return _firebase.signInWithApple();
  }

  Future<List<OnlineHistoryItem>> fetchHistory(String token) async {
    final response = await (client ?? http.Client())
        .get(
          Uri.parse('$baseUrl/users/me/history'),
          headers: {'authorization': 'Bearer $token'},
        )
        .timeout(const Duration(seconds: 10));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException.fromResponse(
        response,
        fallback: 'No se pudo cargar el historial.',
      );
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final games = json['games'] as List<dynamic>? ?? const <dynamic>[];
    return games.map((value) {
      final game = Map<String, dynamic>.from(value as Map);
      final rawFinished = game['finishedAt'] as String?;
      return OnlineHistoryItem(
        gameId: '${game['gameId']}',
        rulesetId: '${game['rulesetId']}',
        finishedAt: rawFinished == null ? null : DateTime.tryParse(rawFinished),
      );
    }).toList();
  }
}

class FirebaseAuthPort implements AuthPort {
  FirebaseAuthPort({required this.baseUrl, this.client});

  final String baseUrl;
  final http.Client? client;
  Future<void>? _googleInitialization;

  FirebaseAuth get _auth => FirebaseAuth.instance;

  @override
  Future<AuthSession> signInAsGuest({String? displayName}) async {
    await ensurePochaFirebaseInitialized();
    final credential = await _auth.signInAnonymously();
    final user = credential.user;
    if (displayName != null && displayName.trim().isNotEmpty) {
      await user?.updateDisplayName(displayName.trim());
    }
    return _sessionFromFirebaseUser(user);
  }

  Future<AuthSession> signInWithEmail({
    required String email,
    required String password,
  }) async {
    await ensurePochaFirebaseInitialized();
    final guestToken = await _anonymousToken();
    final credential = await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    return _finishCredential(credential, guestToken: guestToken);
  }

  Future<AuthSession> registerWithEmail({
    required String email,
    required String password,
  }) async {
    await ensurePochaFirebaseInitialized();
    final guestToken = await _anonymousToken();
    final credential = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    return _finishCredential(credential, guestToken: guestToken);
  }

  Future<AuthSession> signInWithGoogle() async {
    await ensurePochaFirebaseInitialized();
    if (pochaGoogleServerClientId.isEmpty) {
      throw const AuthConfigurationException(
        'Falta POCHA_GOOGLE_SERVER_CLIENT_ID para iniciar sesión con Google.',
      );
    }
    if (Platform.isIOS && pochaGoogleIosClientId.isEmpty) {
      throw const AuthConfigurationException(
        'Falta POCHA_GOOGLE_IOS_CLIENT_ID para iniciar sesión con Google en iOS.',
      );
    }
    final guestToken = await _anonymousToken();
    final google = GoogleSignIn.instance;
    _googleInitialization ??= google.initialize(
      clientId: pochaGoogleIosClientId.isEmpty ? null : pochaGoogleIosClientId,
      serverClientId: pochaGoogleServerClientId,
    );
    await _googleInitialization;
    final account = await google.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw const AuthConfigurationException(
        'Google no devolvió un token de identidad válido.',
      );
    }
    final credential = await _auth.signInWithCredential(
      GoogleAuthProvider.credential(idToken: idToken),
    );
    return _finishCredential(credential, guestToken: guestToken);
  }

  Future<AuthSession> signInWithApple() async {
    await ensurePochaFirebaseInitialized();
    final guestToken = await _anonymousToken();
    final rawNonce = _randomNonce();
    final hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();
    final appleCredential = await SignInWithApple.getAppleIDCredential(
      scopes: const [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
      webAuthenticationOptions: _appleWebAuthenticationOptions(),
      nonce: hashedNonce,
    );
    final identityToken = appleCredential.identityToken;
    if (identityToken == null || identityToken.isEmpty) {
      throw const AuthConfigurationException(
        'Apple no devolvió un token de identidad válido.',
      );
    }
    final credential = await _auth.signInWithCredential(
      OAuthProvider(
        'apple.com',
      ).credential(idToken: identityToken, rawNonce: rawNonce),
    );
    return _finishCredential(credential, guestToken: guestToken);
  }

  Future<AuthSession?> currentSession() async {
    await ensurePochaFirebaseInitialized();
    final user = _auth.currentUser;
    if (user == null) return null;
    return _sessionFromFirebaseUser(user);
  }

  Future<void> signOut() async {
    await ensurePochaFirebaseInitialized();
    await _auth.signOut();
    if (_googleInitialization != null) {
      await GoogleSignIn.instance.signOut();
    }
  }

  Future<String?> _anonymousToken() async {
    final user = _auth.currentUser;
    if (user == null || !user.isAnonymous) return null;
    return user.getIdToken(true);
  }

  Future<AuthSession> _finishCredential(
    UserCredential credential, {
    String? guestToken,
  }) async {
    final user = credential.user;
    if (user == null) {
      throw const AuthConfigurationException(
        'El proveedor no devolvió un usuario válido.',
      );
    }
    final token = await user.getIdToken(true);
    if (token == null || token.isEmpty) {
      throw const AuthConfigurationException(
        'Firebase no devolvió un token de sesión válido.',
      );
    }
    if (guestToken != null && !user.isAnonymous) {
      return _upgradeGuest(guestToken: guestToken, permanentToken: token);
    }
    return _sessionFromBackend(token);
  }

  Future<AuthSession> _sessionFromFirebaseUser(User? user) async {
    if (user == null) {
      throw const AuthConfigurationException(
        'Firebase no devolvió un usuario válido.',
      );
    }
    final token = await user.getIdToken(true);
    if (token == null || token.isEmpty) {
      throw const AuthConfigurationException(
        'Firebase no devolvió un token de sesión válido.',
      );
    }
    return _sessionFromBackend(token);
  }

  Future<AuthSession> _sessionFromBackend(String token) async {
    final json = await _requestJson(
      (httpClient) => httpClient.get(
        Uri.parse('$baseUrl/auth/me'),
        headers: {'authorization': 'Bearer $token'},
      ),
    );
    return _sessionFromUserJson(token, json['user']);
  }

  Future<AuthSession> _upgradeGuest({
    required String guestToken,
    required String permanentToken,
  }) async {
    final json = await _requestJson(
      (httpClient) => httpClient.post(
        Uri.parse('$baseUrl/auth/upgrade'),
        headers: {
          'authorization': 'Bearer $guestToken',
          'content-type': 'application/json',
        },
        body: jsonEncode({'externalToken': permanentToken}),
      ),
    );
    return _sessionFromUserJson(permanentToken, json['user']);
  }

  AuthSession _sessionFromUserJson(String token, dynamic rawUser) {
    if (rawUser is! Map) {
      throw const AuthConfigurationException(
        'El servidor no devolvió un perfil válido.',
      );
    }
    final user = Map<String, dynamic>.from(rawUser);
    return AuthSession(
      token: token,
      userId: '${user['id']}',
      displayName: '${user['displayName']}',
      isGuest: user['isGuest'] == true,
    );
  }

  Future<Map<String, dynamic>> _requestJson(
    Future<http.Response> Function(http.Client) request,
  ) async {
    final requestClient = client ?? http.Client();
    try {
      final response = await request(
        requestClient,
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException.fromResponse(
          response,
          fallback: 'No se pudo completar la autenticación.',
        );
      }
      final json = jsonDecode(response.body);
      if (json is! Map) {
        throw const AuthConfigurationException(
          'El servidor no devolvió una respuesta válida.',
        );
      }
      return Map<String, dynamic>.from(json);
    } finally {
      if (client == null) requestClient.close();
    }
  }

  WebAuthenticationOptions? _appleWebAuthenticationOptions() {
    if (!Platform.isAndroid) return null;
    if (pochaAppleServiceId.isEmpty || pochaAppleRedirectUri.isEmpty) {
      throw const AuthConfigurationException(
        'Faltan POCHA_APPLE_SERVICE_ID y POCHA_APPLE_REDIRECT_URI para Apple en Android.',
      );
    }
    return WebAuthenticationOptions(
      clientId: pochaAppleServiceId,
      redirectUri: Uri.parse(pochaAppleRedirectUri),
    );
  }

  String _randomNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(
      length,
      (_) => charset[random.nextInt(charset.length)],
    ).join();
  }
}
