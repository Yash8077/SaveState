import 'dart:convert';
import 'dart:async';

import 'package:http/http.dart' as http;

import 'api_client.dart';

extension SyncHealthApi on ApiClient {
  Future<Map<String, dynamic>> getSyncStatus() async {
    final token = sessionToken;
    if (token == null || token.isEmpty) {
      throw ApiException(401, 'Sign in to view synchronization health.');
    }

    late final http.Response response;
    try {
      response = await http
          .get(
            Uri.parse('${ApiClient.origin}/api/sync/status'),
            headers: {
              'Accept': 'application/json',
              'Origin': ApiClient.origin,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 10));
    } on TimeoutException {
      throw ApiException(0, 'Request timed out');
    }

    dynamic decoded;
    if (response.body.isNotEmpty) {
      try {
        decoded = jsonDecode(response.body);
      } catch (_) {
        decoded = null;
      }
    }

    if (response.statusCode >= 400) {
      var message = 'HTTP ${response.statusCode}';
      if (decoded is Map && decoded['message'] is String) {
        message = decoded['message'] as String;
      } else if (decoded is Map && decoded['error'] is String) {
        message = decoded['error'] as String;
      }
      throw ApiException(response.statusCode, message);
    }

    if (decoded is! Map) {
      throw ApiException(500, 'Invalid sync status response.');
    }

    return Map<String, dynamic>.from(decoded);
  }
}
