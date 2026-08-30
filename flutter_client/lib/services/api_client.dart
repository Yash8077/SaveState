import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/types.dart';

class ApiClient {
  static const String defaultBaseUrl = 'https://save-state-jade.vercel.app';
  static const String baseUrl = defaultBaseUrl;

  final String _baseUrl;
  final http.Client _client;

  ApiClient({
    String? baseUrl,
    http.Client? client,
  })  : _baseUrl = baseUrl ?? defaultBaseUrl,
        _client = client ?? http.Client();

  Map<String, String> get _headers => const {
        'Accept': 'application/json',
      };

  Map<String, String> get _headersWithJson => const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

  Future<List<CatalogGame>> searchGames(String query) async {
    if (query.trim().isEmpty) return const [];
    try {
      final uri = Uri.parse('$_baseUrl/api/catalog/search?q=${Uri.encodeQueryComponent(query)}');
      final response = await _client.get(uri, headers: _headers);

      if (response.statusCode == 200) {
        final dynamic decoded = jsonDecode(response.body);
        if (decoded is List) {
          return decoded
              .map((item) => CatalogGame.fromJson(item as Map<String, dynamic>))
              .toList();
        }
      }
      return const [];
    } catch (e) {
      return const [];
    }
  }

  Future<List<FeaturedRail>> getFeaturedRails() async {
    try {
      final uri = Uri.parse('$_baseUrl/api/catalog/featured');
      final response = await _client.get(uri, headers: _headers);

      if (response.statusCode == 200) {
        final dynamic decoded = jsonDecode(response.body);
        if (decoded is List) {
          return decoded
              .map((item) => FeaturedRail.fromJson(item as Map<String, dynamic>))
              .toList();
        }
      }
      return const [];
    } catch (e) {
      return const [];
    }
  }

  Future<CatalogDetails?> getGameDetails(String catalogId) async {
    if (catalogId.trim().isEmpty) return null;
    try {
      final uri = Uri.parse('$_baseUrl/api/catalog/game?id=${Uri.encodeQueryComponent(catalogId)}');
      final response = await _client.get(uri, headers: _headers);

      if (response.statusCode == 200) {
        final dynamic decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          return CatalogDetails.fromJson(decoded);
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<List<GameEntry>> getLibrary() async {
    try {
      final uri = Uri.parse('$_baseUrl/api/library');
      final response = await _client.get(uri, headers: _headers);

      if (response.statusCode == 401) {
        return const [];
      }

      if (response.statusCode == 200) {
        final dynamic decoded = jsonDecode(response.body);
        if (decoded is List) {
          return decoded
              .map((item) => GameEntry.fromJson(item as Map<String, dynamic>))
              .toList();
        } else if (decoded is Map<String, dynamic> && decoded['items'] is List) {
          return (decoded['items'] as List)
              .map((item) => GameEntry.fromJson(item as Map<String, dynamic>))
              .toList();
        }
      }
      return const [];
    } catch (e) {
      return const [];
    }
  }

  Future<GameEntry?> addToLibrary(String catalogId, String status) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/library');
      final body = jsonEncode({
        'catalogId': catalogId,
        'status': status,
      });

      final response = await _client.post(
        uri,
        headers: _headersWithJson,
        body: body,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final dynamic decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          return GameEntry.fromJson(decoded);
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<GameEntry?> updateEntry(int id, Map<String, dynamic> updates) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/library/$id');
      final body = jsonEncode(updates);

      final response = await _client.patch(
        uri,
        headers: _headersWithJson,
        body: body,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final dynamic decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          return GameEntry.fromJson(decoded);
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> deleteEntry(int id) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/library/$id');
      final response = await _client.delete(uri, headers: _headers);

      return response.statusCode == 200 || response.statusCode == 204;
    } catch (e) {
      return false;
    }
  }
}
