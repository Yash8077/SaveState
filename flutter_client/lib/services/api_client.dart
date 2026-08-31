import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
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
  final String? image;
  AuthUser({
    required this.id,
    required this.email,
    required this.name,
    this.image,
  });

  AuthUser copyWith({String? name, String? image}) {
    return AuthUser(
      id: id,
      email: email,
      name: name ?? this.name,
      image: image ?? this.image,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'image': image,
      };

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      image: json['image'] as String?,
    );
  }
}

class ApiClient {
  static const String origin = 'https://save-state-jade.vercel.app';

  final http.Client _client;
  String? sessionToken;
  final Map<String, CatalogDetails> _detailsCache = {};
  final Map<String, Future<CatalogDetails?>> _detailsInflight = {};
  List<GameEntry>? _libraryCache;
  DateTime? _libraryAt;
  List<FeaturedRail>? _featuredCache;
  DateTime? _featuredAt;
  Future<List<FeaturedRail>>? _featuredInflight;
  final Map<String, ({DateTime at, FeaturedRail rail})> _becauseCache = {};
  final Map<String, Future<FeaturedRail>> _becauseInflight = {};
  final Map<String, ({DateTime at, List<CatalogGame> games})> _searchCache = {};
  static const _featuredTtl = Duration(minutes: 30);
  static const _becauseTtl = Duration(hours: 6);
  static const _searchTtl = Duration(minutes: 10);
  static const _libraryTtl = Duration(minutes: 2);
  static const _httpTimeout = Duration(seconds: 10);
  static const _featuredDiskKey = 'cache_featured_v1';
  static const _libraryDiskKey = 'cache_library_v1';
  static const _becauseDiskKey = 'cache_because_v1';

  SharedPreferences? _prefs;
  bool _hydrated = false;

  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  List<GameEntry>? get cachedLibrary => _libraryCache;
  List<FeaturedRail>? get cachedFeatured => _featuredCache;
  FeaturedRail? cachedBecause(List<String> seeds) {
    final key = seeds.where((id) => id.isNotEmpty).take(8).join(',');
    if (key.isEmpty) return null;
    return _becauseCache[key]?.rail;
  }

  Future<void> hydrate() async {
    if (_hydrated) return;
    _hydrated = true;
    try {
      _prefs = await SharedPreferences.getInstance();
    } catch (_) {
      return;
    }
    final featuredRaw = _prefs?.getString(_featuredDiskKey);
    if (featuredRaw != null) {
      try {
        final decoded = jsonDecode(featuredRaw);
        if (decoded is List) {
          _featuredCache = [
            for (final row in decoded)
              if (row is Map)
                FeaturedRail.fromJson(Map<String, dynamic>.from(row)),
          ];
          _featuredAt = DateTime.now().subtract(const Duration(days: 1));
        }
      } catch (_) {}
    }
    final libraryRaw = _prefs?.getString(_libraryDiskKey);
    if (libraryRaw != null) {
      try {
        final decoded = jsonDecode(libraryRaw);
        if (decoded is List) {
          _libraryCache = [
            for (final row in decoded)
              if (row is Map)
                GameEntry.fromJson(Map<String, dynamic>.from(row)),
          ];
          _libraryAt = DateTime.now().subtract(const Duration(days: 1));
        }
      } catch (_) {}
    }
    final becauseRaw = _prefs?.getString(_becauseDiskKey);
    if (becauseRaw != null) {
      try {
        final decoded = jsonDecode(becauseRaw);
        if (decoded is Map) {
          final key = decoded['key']?.toString() ?? '';
          final rail = decoded['rail'];
          if (key.isNotEmpty && rail is Map) {
            _becauseCache[key] = (
              at: DateTime.now().subtract(const Duration(days: 1)),
              rail: FeaturedRail.fromJson(Map<String, dynamic>.from(rail)),
            );
          }
        }
      } catch (_) {}
    }
  }

  Future<void> _persistFeatured(List<FeaturedRail> rails) async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(
      _featuredDiskKey,
      jsonEncode([for (final rail in rails) rail.toJson()]),
    );
  }

  Future<void> _persistLibrary(List<GameEntry> items) async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(
      _libraryDiskKey,
      jsonEncode([for (final item in items) item.toJson()]),
    );
  }

  Future<void> _persistBecause(String key, FeaturedRail rail) async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(
      _becauseDiskKey,
      jsonEncode({'key': key, 'rail': rail.toJson()}),
    );
  }

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
    late final http.Response res;
    try {
    switch (method) {
      case 'GET':
        res = await _client.get(uri, headers: headers).timeout(_httpTimeout);
        break;
      case 'POST':
        res = await _client
            .post(uri, headers: headers, body: jsonBody ? jsonEncode(body) : body)
            .timeout(_httpTimeout);
        break;
      case 'PATCH':
        res = await _client
            .patch(uri, headers: headers, body: jsonEncode(body))
            .timeout(_httpTimeout);
        break;
      case 'DELETE':
        res = await _client.delete(uri, headers: headers).timeout(_httpTimeout);
        break;
      default:
        throw ApiException(0, 'Unsupported $method');
    }
    } on TimeoutException {
      throw ApiException(0, 'Request timed out');
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
    final q = query.trim();
    if (q.length < 2) return const [];
    final key = q.toLowerCase();
    final cached = _searchCache[key];
    if (cached != null && DateTime.now().difference(cached.at) < _searchTtl) {
      return cached.games;
    }
    final decoded = await _send(
      'GET',
      _u('/api/catalog/search', {
        'q': q,
      }),
    );
    if (decoded is! List) return const [];
    final games = decoded
        .map((e) => CatalogGame.fromJson(e as Map<String, dynamic>))
        .toList();
    _searchCache[key] = (at: DateTime.now(), games: games);
    if (_searchCache.length > 40) {
      _searchCache.remove(_searchCache.keys.first);
    }
    return games;
  }

  Future<List<FeaturedRail>> getFeaturedRails({bool force = false}) async {
    if (!force &&
        _featuredCache != null &&
        _featuredAt != null &&
        DateTime.now().difference(_featuredAt!) < _featuredTtl) {
      return _featuredCache!;
    }
    final pending = _featuredInflight;
    if (pending != null) return pending;
    final future = () async {
      try {
        final decoded = await _send(
          'GET',
          _u('/api/catalog/featured', {'rel': '19'}),
        );
        if (decoded is! List) return const <FeaturedRail>[];
        final rails = decoded
            .map((e) => FeaturedRail.fromJson(e as Map<String, dynamic>))
            .toList();
        _featuredCache = rails;
        _featuredAt = DateTime.now();
        unawaited(_persistFeatured(rails));
        return rails;
      } finally {
        _featuredInflight = null;
      }
    }();
    _featuredInflight = future;
    return future;
  }

  Future<FeaturedRail> getBecauseRail(List<String> seeds) async {
    final ids = seeds.where((id) => id.isNotEmpty).take(8).toList();
    if (ids.length < 2) {
      return const FeaturedRail(id: 'recommended', title: 'Recommended');
    }
    final key = ids.join(',');
    final cached = _becauseCache[key];
    if (cached != null && DateTime.now().difference(cached.at) < _becauseTtl) {
      return cached.rail;
    }
    final pending = _becauseInflight[key];
    if (pending != null) return pending;
    final future = () async {
      try {
        final decoded = await _send(
          'GET',
          _u('/api/catalog/because', {'seeds': key}),
        );
        if (decoded is Map<String, dynamic>) {
          final rail = FeaturedRail.fromJson(decoded);
          _becauseCache[key] = (at: DateTime.now(), rail: rail);
          unawaited(_persistBecause(key, rail));
          if (_becauseCache.length > 20) {
            _becauseCache.remove(_becauseCache.keys.first);
          }
          return rail;
        }
        return const FeaturedRail(id: 'recommended', title: 'Recommended');
      } finally {
        _becauseInflight.remove(key);
      }
    }();
    _becauseInflight[key] = future;
    return future;
  }

  Future<CatalogDetails?> getGameDetails(String catalogId) async {
    final cached = _detailsCache[catalogId];
    if (cached != null) return cached;
    final pending = _detailsInflight[catalogId];
    if (pending != null) return pending;
    final future = () async {
      try {
        final decoded = await _send(
          'GET',
          _u('/api/catalog/game', {'id': catalogId, 'rel': '14'}),
        );
        if (decoded is Map<String, dynamic>) {
          final details = CatalogDetails.fromJson(decoded);
          _detailsCache[catalogId] = details;
          if (_detailsCache.length > 80) {
            _detailsCache.remove(_detailsCache.keys.first);
          }
          return details;
        }
        return null;
      } finally {
        _detailsInflight.remove(catalogId);
      }
    }();
    _detailsInflight[catalogId] = future;
    return future;
  }

  void prefetchGameDetails(String catalogId) {
    if (catalogId.isEmpty) return;
    if (_detailsCache.containsKey(catalogId) ||
        _detailsInflight.containsKey(catalogId)) {
      return;
    }
    unawaited(getGameDetails(catalogId));
  }

  Future<List<GameEntry>> getLibrary({bool force = false}) async {
    if (!force &&
        _libraryCache != null &&
        _libraryAt != null &&
        DateTime.now().difference(_libraryAt!) < _libraryTtl) {
      return _libraryCache!;
    }
    final decoded = await _send('GET', _u('/api/library'));
    List<GameEntry> items = const [];
    if (decoded is List) {
      items = decoded
          .map((e) => GameEntry.fromJson(e as Map<String, dynamic>))
          .toList();
    } else if (decoded is Map && decoded['items'] is List) {
      items = (decoded['items'] as List)
          .map((e) => GameEntry.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    _libraryCache = items;
    _libraryAt = DateTime.now();
    unawaited(_persistLibrary(items));
    return items;
  }

  void _invalidateLibrary() {
    _libraryCache = null;
    _libraryAt = null;
    unawaited(_prefs?.remove(_libraryDiskKey));
  }

  Future<void> clearUserCaches() async {
    _libraryCache = null;
    _libraryAt = null;
    _becauseCache.clear();
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.remove(_libraryDiskKey);
    await _prefs!.remove(_becauseDiskKey);
  }

  Future<GameEntry> addToLibrary(
    CatalogGame game, {
    String status = 'playing',
    int? score,
    num? hours,
    bool favorite = false,
    String? startedAt,
    String? finishedAt,
    CatalogDetails? details,
  }) async {
    final decoded = await _send(
      'POST',
      _u('/api/library'),
      jsonBody: true,
      body: {
        'catalogId': game.id,
        'status': status,
        'score': score,
        'hours': hours,
        'favorite': favorite,
        'startedAt': startedAt,
        'finishedAt': finishedAt,
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
    if (score != null ||
        hours != null ||
        favorite ||
        startedAt != null ||
        finishedAt != null) {
      entry = await updateEntry(entry.id, {
        if (score != null) 'score': score,
        if (hours != null) 'hours': hours,
        'favorite': favorite,
        if (startedAt != null) 'startedAt': startedAt,
        if (finishedAt != null) 'finishedAt': finishedAt,
      });
    }
    _invalidateLibrary();
    return entry;
  }

  Future<GameEntry> updateEntry(int id, Map<String, dynamic> updates) async {
    final decoded = await _send(
      'PATCH',
      _u('/api/library/$id'),
      jsonBody: true,
      body: updates,
    );
    _invalidateLibrary();
    return GameEntry.fromJson(decoded as Map<String, dynamic>);
  }

  Future<void> deleteEntry(int id) async {
    await _send('DELETE', _u('/api/library/$id'));
    _invalidateLibrary();
  }

  Future<Map<String, dynamic>> exportBackup() async {
    final decoded = await _send('GET', _u('/api/backup'));
    if (decoded is Map<String, dynamic>) return decoded;
    throw ApiException(500, 'Invalid backup');
  }

  Future<({int added, int updated})> importBackup(Object body) async {
    final decoded = await _send(
      'POST',
      _u('/api/backup'),
      jsonBody: true,
      body: body,
    );
    _invalidateLibrary();
    if (decoded is! Map) throw ApiException(500, 'Invalid import');
    return (
      added: (decoded['added'] as num?)?.toInt() ?? 0,
      updated: (decoded['updated'] as num?)?.toInt() ?? 0,
    );
  }

  Future<bool> googleAuthEnabled() async {
    try {
      final decoded = await _send('GET', _u('/api/config'));
      return decoded is Map && decoded['google'] == true;
    } catch (_) {
      return false;
    }
  }

  Future<List<String>> listAvatars() async {
    try {
      final decoded = await _send('GET', _u('/api/config'));
      if (decoded is! Map) return const [];
      final raw = decoded['avatars'];
      if (raw is! List) return const [];
      return raw.map((e) => e.toString()).where((s) => s.startsWith('/avatars/avatar_')).toList();
    } catch (_) {
      return const [];
    }
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
        image: userMap['image']?.toString(),
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
          image: u['image']?.toString(),
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

  Future<Map<String, dynamic>> getProfile() async {
    final decoded = await _send('GET', _u('/api/profile'));
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    throw ApiException(500, 'Invalid profile');
  }

  Future<Map<String, dynamic>> updateProfile({
    String? name,
    String? image,
    String? banner,
    bool clearBanner = false,
  }) async {
    final decoded = await _send(
      'PATCH',
      _u('/api/profile'),
      jsonBody: true,
      body: {
        if (name != null) 'name': name,
        if (image != null) 'image': image,
        if (clearBanner) 'banner': null,
        if (!clearBanner && banner != null) 'banner': banner,
      },
    );
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    throw ApiException(500, 'Invalid profile');
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _send(
      'POST',
      _u('/api/profile/password'),
      jsonBody: true,
      body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }
}
