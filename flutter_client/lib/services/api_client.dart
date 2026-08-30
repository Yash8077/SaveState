import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/types.dart';

class ApiClient {
  // Pointing to your live Vercel deployment!
  static const String baseUrl = 'https://save-state-jade.vercel.app';

  Future<List<CatalogGame>> searchGames(String query) async {
    final uri = Uri.parse('$baseUrl/api/catalog/search?q=${Uri.encodeComponent(query)}');
    final response = await http.get(uri, headers: {'Accept': 'application/json'});
    
    if (response.statusCode == 200) {
      final List<dynamic> jsonList = jsonDecode(response.body);
      return jsonList.map((json) => CatalogGame.fromJson(json)).toList();
    } else {
      throw Exception('Failed to search games');
    }
  }

  Future<List<FeaturedRail>> getFeaturedRails() async {
    final uri = Uri.parse('$baseUrl/api/catalog/featured');
    final response = await http.get(uri, headers: {'Accept': 'application/json'});
    
    if (response.statusCode == 200) {
      final List<dynamic> jsonList = jsonDecode(response.body);
      return jsonList.map((json) => FeaturedRail.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load featured rails');
    }
  }

  // Placeholder for getting library entries
  Future<List<GameEntry>> getLibrary() async {
    // Implement fetching from the backend API, or local SQLite database
    return [];
  }
}
