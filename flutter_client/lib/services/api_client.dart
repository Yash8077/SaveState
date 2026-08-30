import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/types.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message.isEmpty ? 'HTTP $status' : message;
}

class AuthUser {
  final String id;
  final String email;
  final String name;
  AuthUser({required this.id, required this.email, required this.name});
}

class ApiClient {
  static const String origin = 'https://save-state-jade.vercel.app';

  final http.Client _client;
  String? sessionToken;

  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  Map<String, String> _headers({bool json = false}) {
    final h = <String, String>{
      'Accept': 'application/json',
      'Origin': origin,
    };
    if (json) h['Content-Type'] = 'application/json';
    final token = sessionToken;
    if (token != null && token.isNotEmpty) {
      h['Authorization'] = 'Bearer $token';
    }
    return h;
  }

  Uri _u(String path, [Map<String, String>? q]) =>
      Uri.parse('$origin$path').replace(queryParameters: q);

  Future<dynamic> _send(
    String method,
    Uri uri, {
    Object? body,
    bool jsonBody = false,
  }) async {
    final headers = _headers(json: jsonBody);
    final http.Response res;
    switch (method) {
      case 'GET':
        res = await _client.get(uri, headers: headers);
        break;
      case 'POST':
        res = await _client.post(uri,
            headers: headers, body: jsonBody ? jsonEncode(body) : body);
        break;
      case 'PATCH':
        res = await _client.patch(uri,
            headers: headers, body: jsonEncode(body));
        break;
      case 'DELETE':
        res = await _client.delete(uri, headers: headers);
        break;
      default:
        throw ApiException(0, 'Unsupported $method');
    }

    if (res.statusCode >= 400) {
      String message = 'HTTP ${res.statusCode}';
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map && decoded['message'] is String) {
          message = decoded['message'] as String;
        } else if (decoded is Map && decoded['error'] is String) {
          message = decoded['error'] as String;
        }
      } catch (_) {
        if (res.body.trim().isNotEmpty) message = res.body;
      }
      throw ApiException(res.statusCode, message);
    }
    if (res.body.isEmpty) return null;
    return jsonDecode(res.body);
  }

  String? _tokenFrom(dynamic data, http.Response? raw) {
    if (data is Map) {
      final top = data['token'];
      if (top is String && top.isNotEmpty) return top;
      final session = data['session'];
      if (session is Map && session['token'] is String) {
        return session['token'] as String;
      }
    }
    return null;
  }

  Future<List<CatalogGame>> searchGames(String query) async {
    if (query.trim().isEmpty) return const [];
    final decoded = await _send(
      'GET',
      _u('/api/catalog/search', {'q': query.trim()}),
    );
    if (decoded is! List) return const [];
    return decoded
        .map((e) => CatalogGame.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<FeaturedRail>> getFeaturedRails() async {
    final decoded = await _send('GET', _u('/api/catalog/featured'));
    if (decoded is! List) return const [];
    return decoded
        .map((e) => FeaturedRail.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<CatalogDetails?> getGameDetails(String catalogId) async {
    final decoded = await _send(
      'GET',
      _u('/api/catalog/game', {'id': catalogId}),
    );
    if (decoded is Map<String, dynamic>) {
      return CatalogDetails.fromJson(decoded);
    }
    return null;
  }

  Future<List<GameEntry>> getLibrary() async {
    final decoded = await _send('GET', _u('/api/library'));
    if (decoded is List) {
      return decoded
          .map((e) => GameEntry.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    if (decoded is Map && decoded['items'] is List) {
      return (decoded['items'] as List)
          .map((e) => GameEntry.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return const [];
  }

  Future<GameEntry> addToLibrary(
    CatalogGame game, {
    String status = 'backlog',
    int? score,
    bool favorite = false,
    CatalogDetails? details,
  }) async {
    final decoded = await _send(
      'POST',
      _u('/api/library'),
      jsonBody: true,
      body: {
        'catalogId': game.id,
        'status': status,
        'snapshot': {
          'title': details?.title ?? game.title,
          'coverUrl': details?.coverUrl ?? game.coverUrl,
          'headerUrl': details?.headerUrl ?? game.headerUrl,
          'summary': details?.summary,
          'releaseDate': details?.releaseDate,
          'platforms': details?.platforms ?? game.platforms,
          'genres': details?.genres ?? <String>[],
          'metacritic': details?.metacritic ?? game.metacritic,
          'developers': details?.developers ?? <String>[],
          'publishers': details?.publishers ?? <String>[],
          'screenshots': details?.screenshots ?? <String>[],
        },
      },
    );
    var entry = GameEntry.fromJson(decoded as Map<String, dynamic>);
    if (score != null || favorite) {
      entry = await updateEntry(entry.id, {
        if (score != null) 'score': score,
        'favorite': favorite,
      });
    }
    return entry;
  }

  Future<GameEntry> updateEntry(int id, Map<String, dynamic> updates) async {
    final decoded = await _send(
      'PATCH',
      _u('/api/library/$id'),
      jsonBody: true,
      body: updates,
    );
    return GameEntry.fromJson(decoded as Map<String, dynamic>);
  }

  Future<void> deleteEntry(int id) async {
    await _send('DELETE', _u('/api/library/$id'));
  }

  Future<({AuthUser user, String token})> signInEmail(
    String email,
    String password,
  ) async {
    return _authPost('/api/auth/sign-in/email', {
      'email': email.trim(),
      'password': password,
    });
  }

  Future<({AuthUser user, String token})> signUpEmail({
    required String email,
    required String password,
    required String name,
  }) async {
    return _authPost('/api/auth/sign-up/email', {
      'email': email.trim(),
      'password': password,
      'name': name.trim().isEmpty ? email.split('@').first : name.trim(),
    });
  }

  Future<({AuthUser user, String token})> _authPost(
    String path,
    Map<String, String> body,
  ) async {
    final uri = _u(path);
    final res = await _client.post(
      uri,
      headers: _headers(json: true),
      body: jsonEncode(body),
    );
    dynamic decoded;
    try {
      decoded = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {}
    if (res.statusCode >= 400) {
      final msg = decoded is Map
          ? (decoded['message'] ?? decoded['error'] ?? 'Auth failed')
          : 'Auth failed (${res.statusCode})';
      throw ApiException(res.statusCode, msg.toString());
    }
    final token = _tokenFrom(decoded, res);
    if (token == null) {
      throw ApiException(res.statusCode, 'Signed in but no session token');
    }
    final userMap = decoded is Map ? decoded['user'] : null;
    if (userMap is! Map) {
      throw ApiException(res.statusCode, 'Signed in but no user');
    }
    return (
      user: AuthUser(
        id: userMap['id']?.toString() ?? '',
        email: userMap['email']?.toString() ?? '',
        name: userMap['name']?.toString() ?? '',
      ),
      token: token,
    );
  }

  Future<AuthUser?> getSession() async {
    if (sessionToken == null) return null;
    try {
      final decoded = await _send('GET', _u('/api/auth/get-session'));
      if (decoded is Map && decoded['user'] is Map) {
        final u = decoded['user'] as Map;
        return AuthUser(
          id: u['id']?.toString() ?? '',
          email: u['email']?.toString() ?? '',
          name: u['name']?.toString() ?? '',
        );
      }
    } on ApiException catch (e) {
      if (e.status == 401) return null;
      rethrow;
    }
    return null;
  }

  Future<void> signOut() async {
    try {
      await _send('POST', _u('/api/auth/sign-out'), jsonBody: true, body: {});
    } catch (_) {}
  }
}
