import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_client.dart';

class AuthController extends ChangeNotifier {
  AuthController(this.api);

  final ApiClient api;
  static const _storage = FlutterSecureStorage();
  static const _key = 'savestate.session';
  static const _userKey = 'savestate.user_v1';

  AuthUser? user;
  bool ready = false;
  String? error;

  bool get isSignedIn => user != null;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final token = await _storage.read(key: _key);
    api.sessionToken = token;
    if (token != null) {
      final cached = prefs.getString(_userKey);
      if (cached != null) {
        try {
          final decoded = jsonDecode(cached);
          if (decoded is Map) {
            user = AuthUser.fromJson(Map<String, dynamic>.from(decoded));
          }
        } catch (_) {}
      }
    }
    ready = true;
    notifyListeners();
    if (token == null) return;
    try {
      final next = await api.getSession();
      if (next == null) {
        user = null;
        api.sessionToken = null;
        await _storage.delete(key: _key);
        await prefs.remove(_userKey);
      } else {
        user = next;
        await prefs.setString(_userKey, jsonEncode(next.toJson()));
      }
    } catch (_) {
      /* keep the cached user so Home can still load the library */
    }
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
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
    await api.clearUserCaches();
    notifyListeners();
  }

  Future<void> _setSession(String token, AuthUser next) async {
    api.sessionToken = token;
    user = next;
    await _storage.write(key: _key, value: token);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(next.toJson()));
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
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user!.toJson()));
    notifyListeners();
  }
}
