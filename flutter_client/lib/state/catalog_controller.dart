import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum CatalogProvider { igdb, steam }

class CatalogController extends ChangeNotifier {
  static const _key = 'catalog_provider';

  CatalogProvider provider = CatalogProvider.igdb;

  String get queryValue =>
      provider == CatalogProvider.steam ? 'steam' : 'igdb';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_key);
    provider = stored == 'steam' ? CatalogProvider.steam : CatalogProvider.igdb;
    notifyListeners();
  }

  Future<void> setProvider(CatalogProvider value) async {
    if (provider == value) return;
    provider = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, queryValue);
    notifyListeners();
  }
}
