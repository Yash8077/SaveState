import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HomeSectionPref {
  final String id;
  bool enabled;
  HomeSectionPref({required this.id, this.enabled = true});

  Map<String, dynamic> toJson() => {'id': id, 'enabled': enabled};

  factory HomeSectionPref.fromJson(Map<String, dynamic> json) {
    return HomeSectionPref(
      id: json['id']?.toString() ?? '',
      enabled: json['enabled'] != false,
    );
  }
}

const defaultHomeSections = <String>[
  'hero',
  'stats',
  'playing',
  'backlog',
  'top_sellers',
  'new_releases',
  'coming_soon',
  'specials',
  'playstation',
];

const homeSectionTitles = <String, String>{
  'hero': 'Featured carousel',
  'stats': 'Welcome stats',
  'playing': 'Continue playing',
  'backlog': 'Planning to play',
  'top_sellers': 'Trending',
  'new_releases': 'New releases',
  'coming_soon': 'Coming soon',
  'specials': 'On sale',
  'playstation': 'PlayStation',
};

const homeSectionHints = <String, String>{
  'hero': 'Featured games at the top of Home',
  'stats': 'Playing / beaten / backlog chips',
  'playing': 'Games you marked as playing',
  'backlog': 'Your backlog',
  'top_sellers': 'Steam top sellers',
  'new_releases': 'Popular new Steam games',
  'coming_soon': 'Most wishlisted upcoming games',
  'specials': 'Steam specials',
  'playstation': 'PS5 exclusives and popular titles',
};

const catalogSectionIds = {
  'top_sellers',
  'new_releases',
  'coming_soon',
  'specials',
  'playstation',
};

class HomeLayoutController extends ChangeNotifier {
  static const _key = 'home_layout_v1';
  static const _autoplayKey = 'hero_autoplay_v1';
  List<HomeSectionPref> sections = [
    for (final id in defaultHomeSections) HomeSectionPref(id: id),
  ];
  bool heroAutoplay = true;

  bool enabled(String id) =>
      sections.any((row) => row.id == id && row.enabled);

  List<HomeSectionPref> mergeWith(Iterable<String> extraIds) {
    final known = {...defaultHomeSections, ...extraIds};
    final out = <HomeSectionPref>[];
    final seen = <String>{};
    void take(String id, bool enabled) {
      if (id.isEmpty || seen.contains(id) || !known.contains(id)) return;
      seen.add(id);
      out.add(HomeSectionPref(id: id, enabled: enabled));
    }

    for (final row in sections) {
      take(row.id, row.enabled);
    }
    for (final id in defaultHomeSections) {
      take(id, true);
    }
    for (final id in extraIds) {
      take(id, true);
    }
    return out;
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          sections = [
            for (final item in decoded)
              if (item is Map)
                HomeSectionPref.fromJson(Map<String, dynamic>.from(item)),
          ].where((row) => row.id.isNotEmpty).toList();
          sections = mergeWith(const []);
        }
      } catch (_) {
        /* keep defaults */
      }
    }
    final auto = prefs.getBool(_autoplayKey);
    if (auto != null) heroAutoplay = auto;
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode([for (final row in sections) row.toJson()]),
    );
  }

  Future<void> setHeroAutoplay(bool value) async {
    if (heroAutoplay == value) return;
    heroAutoplay = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_autoplayKey, value);
  }

  Future<void> toggle(String id, bool enabled) async {
    sections = [
      for (final row in sections)
        if (row.id == id)
          HomeSectionPref(id: id, enabled: enabled)
        else
          row,
    ];
    notifyListeners();
    await _persist();
  }

  Future<void> reorder(int from, int to) async {
    if (from == to) return;
    if (from < 0 || to < 0 || from >= sections.length) return;
    var dest = to;
    if (dest > from) dest -= 1;
    if (dest >= sections.length) dest = sections.length - 1;
    final copy = [...sections];
    final item = copy.removeAt(from);
    copy.insert(dest, item);
    sections = copy;
    notifyListeners();
    await _persist();
  }

  Future<void> reset() async {
    sections = [for (final id in defaultHomeSections) HomeSectionPref(id: id)];
    heroAutoplay = true;
    notifyListeners();
    await _persist();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_autoplayKey, true);
  }
}
