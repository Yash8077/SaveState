import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import '../services/api_client.dart';

class AuthController extends ChangeNotifier {
  AuthController(this.api);

  final ApiClient api;
  static const _storage = FlutterSecureStorage();
  static const _key = 'savestate.session';

  AuthUser? user;
  bool ready = false;
  String? error;

  bool get isSignedIn => user != null;

  Future<void> load() async {
    final token = await _storage.read(key: _key);
    api.sessionToken = token;
    if (token != null) {
      try {
        user = await api.getSession();
        if (user == null) {
          await _storage.delete(key: _key);
          api.sessionToken = null;
        }
      } catch (_) {
        user = null;
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<void> signInGoogle() async {
    error = null;
    notifyListeners();
    final result = await FlutterWebAuth2.authenticate(
      url: '${ApiClient.origin}/api/google/start',
      callbackUrlScheme: 'savestate',
    );
    final token = Uri.parse(result).queryParameters['token'];
    if (token == null || token.isEmpty) {
      throw ApiException(401, 'Google sign-in did not return a session');
    }
    api.sessionToken = token;
    final user = await api.getSession();
    if (user == null) {
      api.sessionToken = null;
      throw ApiException(401, 'Google sign-in session was invalid');
    }
    await _setSession(token, user);
  }

  Future<void> signIn(String email, String password) async {
    error = null;
    notifyListeners();
    final result = await api.signInEmail(email, password);
    await _setSession(result.token, result.user);
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String name,
  }) async {
    error = null;
    notifyListeners();
    final result =
        await api.signUpEmail(email: email, password: password, name: name);
    await _setSession(result.token, result.user);
  }

  Future<void> signOut() async {
    await api.signOut();
    api.sessionToken = null;
    user = null;
    await _storage.delete(key: _key);
    notifyListeners();
  }

  Future<void> _setSession(String token, AuthUser next) async {
    api.sessionToken = token;
    user = next;
    await _storage.write(key: _key, value: token);
    notifyListeners();
  }

  Future<void> applyProfile({required String name, String? image}) async {
    if (user == null) return;
    user = AuthUser(
      id: user!.id,
      email: user!.email,
      name: name,
      image: image,
    );
    notifyListeners();
  }
}
