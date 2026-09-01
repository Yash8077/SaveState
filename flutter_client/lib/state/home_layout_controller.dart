import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum LayoutSurface { home, discover }

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
  'stats',
  'playing',
  'backlog',
  'wishlist',
  'recommended',
  'playstation',
];

const defaultDiscoverSections = <String>[
  'hero',
  'popular',
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
  'wishlist': 'Wishlist',
  'recommended': 'Recommended',
  'popular': 'Popular',
  'new_releases': 'New releases',
  'coming_soon': 'Coming soon',
  'specials': 'On sale',
  'playstation': 'Popular on PlayStation',
};

const homeSectionHints = <String, String>{
  'hero': 'Trending games at the top of Discover',
  'stats': 'Playing / beaten / backlog chips',
  'playing': 'Games you marked as playing',
  'backlog': 'Your backlog',
  'wishlist': 'Wanted games, unreleased first',
  'recommended': 'Because you played — from IGDB',
  'popular': 'Loved old and new, ranked by reviews',
  'new_releases': 'Popular new Steam games',
  'coming_soon': 'Most wishlisted upcoming games',
  'specials': 'Steam specials',
  'playstation': 'Popular PlayStation 5 titles',
};

List<HomeSectionPref> mergeSectionList(
  List<String> defaults,
  Iterable<HomeSectionPref> saved, [
  Iterable<String> extraIds = const [],
]) {
  final known = {...defaults, ...extraIds.where((id) => id != 'top_sellers')};
  final out = <HomeSectionPref>[];
  final seen = <String>{};
  void take(String id, bool enabled) {
    final next = id == 'top_sellers' ? 'popular' : id;
    if (next.isEmpty || seen.contains(next) || !known.contains(next)) return;
    seen.add(next);
    out.add(HomeSectionPref(id: next, enabled: enabled));
  }

  for (final row in saved) {
    take(row.id, row.enabled);
  }
  for (final id in defaults) {
    take(id, true);
  }
  for (final id in extraIds) {
    take(id, true);
  }
  return out;
}

class HomeLayoutController extends ChangeNotifier {
  static const _homeKey = 'home_layout_v2';
  static const _discoverKey = 'discover_layout_v1';
  static const _legacyKey = 'home_layout_v1';
  static const _autoplayKey = 'hero_autoplay_v1';

  List<HomeSectionPref> homeSections = [
    for (final id in defaultHomeSections) HomeSectionPref(id: id),
  ];
  List<HomeSectionPref> discoverSections = [
    for (final id in defaultDiscoverSections) HomeSectionPref(id: id),
  ];
  bool heroAutoplay = true;

  List<HomeSectionPref> sectionsFor(LayoutSurface surface) =>
      surface == LayoutSurface.home ? homeSections : discoverSections;

  bool enabled(LayoutSurface surface, String id) =>
      sectionsFor(surface).any((row) => row.id == id && row.enabled);

  List<HomeSectionPref> mergeHome([Iterable<String> extraIds = const []]) =>
      mergeSectionList(defaultHomeSections, homeSections, extraIds);

  List<HomeSectionPref> mergeDiscover([Iterable<String> extraIds = const []]) =>
      mergeSectionList(defaultDiscoverSections, discoverSections, extraIds);

  List<HomeSectionPref> _parse(String? raw, List<String> defaults) {
    if (raw == null || raw.isEmpty) {
      return [for (final id in defaults) HomeSectionPref(id: id)];
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        return [for (final id in defaults) HomeSectionPref(id: id)];
      }
      final rows = [
        for (final item in decoded)
          if (item is Map)
            HomeSectionPref.fromJson(Map<String, dynamic>.from(item)),
      ].where((row) => row.id.isNotEmpty);
      return mergeSectionList(defaults, rows);
    } catch (_) {
      return [for (final id in defaults) HomeSectionPref(id: id)];
    }
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final homeRaw = prefs.getString(_homeKey);
    final discoverRaw = prefs.getString(_discoverKey);
    final legacy = prefs.getString(_legacyKey);
    if (homeRaw != null) {
      homeSections = _parse(homeRaw, defaultHomeSections);
    } else if (legacy != null) {
      final old = _parse(legacy, [
        ...defaultHomeSections,
        ...defaultDiscoverSections,
      ]);
      final enabled = {for (final row in old) row.id: row.enabled};
      homeSections = [
        for (final id in defaultHomeSections)
          HomeSectionPref(id: id, enabled: enabled[id] ?? true),
      ];
    }
    if (discoverRaw != null) {
      discoverSections = _parse(discoverRaw, defaultDiscoverSections);
    } else if (legacy != null) {
      final old = _parse(legacy, [
        ...defaultHomeSections,
        ...defaultDiscoverSections,
      ]);
      final enabled = {for (final row in old) row.id: row.enabled};
      discoverSections = [
        for (final id in defaultDiscoverSections)
          HomeSectionPref(id: id, enabled: enabled[id] ?? true),
      ];
    }
    final auto = prefs.getBool(_autoplayKey);
    if (auto != null) heroAutoplay = auto;
    notifyListeners();
  }

  Future<void> _persistHome() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _homeKey,
      jsonEncode([for (final row in homeSections) row.toJson()]),
    );
  }

  Future<void> _persistDiscover() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _discoverKey,
      jsonEncode([for (final row in discoverSections) row.toJson()]),
    );
  }

  Future<void> setHeroAutoplay(bool value) async {
    if (heroAutoplay == value) return;
    heroAutoplay = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_autoplayKey, value);
  }

  Future<void> toggle(LayoutSurface surface, String id, bool enabled) async {
    final next = [
      for (final row in sectionsFor(surface))
        if (row.id == id) HomeSectionPref(id: id, enabled: enabled) else row,
    ];
    if (surface == LayoutSurface.home) {
      homeSections = next;
      notifyListeners();
      await _persistHome();
    } else {
      discoverSections = next;
      notifyListeners();
      await _persistDiscover();
    }
  }

  Future<void> reorder(LayoutSurface surface, int from, int to) async {
    if (from == to) return;
    final copy = [...sectionsFor(surface)];
    if (from < 0 || to < 0 || from >= copy.length) return;
    var dest = to;
    if (dest > from) dest -= 1;
    if (dest >= copy.length) dest = copy.length - 1;
    final item = copy.removeAt(from);
    copy.insert(dest, item);
    if (surface == LayoutSurface.home) {
      homeSections = copy;
      notifyListeners();
      await _persistHome();
    } else {
      discoverSections = copy;
      notifyListeners();
      await _persistDiscover();
    }
  }

  Future<void> reset(LayoutSurface surface) async {
    if (surface == LayoutSurface.home) {
      homeSections = [
        for (final id in defaultHomeSections) HomeSectionPref(id: id),
      ];
      notifyListeners();
      await _persistHome();
      return;
    }
    discoverSections = [
      for (final id in defaultDiscoverSections) HomeSectionPref(id: id),
    ];
    heroAutoplay = true;
    notifyListeners();
    await _persistDiscover();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_autoplayKey, true);
  }
}
