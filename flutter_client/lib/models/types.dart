enum GameStatus {
  playing,
  beaten,
  backlog,
  hold,
  dropped,
  wishlist;

  static GameStatus fromString(String? value) {
    if (value == null) return GameStatus.backlog;
    return GameStatus.values.firstWhere(
      (e) => e.name == value || e.value == value,
      orElse: () => GameStatus.backlog,
    );
  }
}

extension GameStatusExtension on GameStatus {
  String get label {
    switch (this) {
      case GameStatus.playing:
        return 'Playing';
      case GameStatus.beaten:
        return 'Beaten';
      case GameStatus.backlog:
        return 'Backlog';
      case GameStatus.hold:
        return 'On hold';
      case GameStatus.dropped:
        return 'Dropped';
      case GameStatus.wishlist:
        return 'Wishlist';
    }
  }

  String get value => name;
}

class CatalogGame {
  final String id;
  final int? steamId;
  final String title;
  final String? coverUrl;
  final String? headerUrl;
  final String? capsuleUrl;
  final List<String> platforms;
  final int? metacritic;

  const CatalogGame({
    required this.id,
    this.steamId,
    required this.title,
    this.coverUrl,
    this.headerUrl,
    this.capsuleUrl,
    this.platforms = const [],
    this.metacritic,
  });

  factory CatalogGame.fromJson(Map<String, dynamic> json) {
    return CatalogGame(
      id: json['id']?.toString() ?? '',
      steamId: (json['steamId'] as num?)?.toInt(),
      title: json['title'] as String? ?? '',
      coverUrl: json['coverUrl'] as String?,
      headerUrl: json['headerUrl'] as String?,
      capsuleUrl: json['capsuleUrl'] as String?,
      platforms: (json['platforms'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      metacritic: (json['metacritic'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'steamId': steamId,
      'title': title,
      'coverUrl': coverUrl,
      'headerUrl': headerUrl,
      'capsuleUrl': capsuleUrl,
      'platforms': platforms,
      'metacritic': metacritic,
    };
  }

  CatalogGame copyWith({
    String? id,
    int? steamId,
    String? title,
    String? coverUrl,
    String? headerUrl,
    String? capsuleUrl,
    List<String>? platforms,
    int? metacritic,
  }) {
    return CatalogGame(
      id: id ?? this.id,
      steamId: steamId ?? this.steamId,
      title: title ?? this.title,
      coverUrl: coverUrl ?? this.coverUrl,
      headerUrl: headerUrl ?? this.headerUrl,
      capsuleUrl: capsuleUrl ?? this.capsuleUrl,
      platforms: platforms ?? this.platforms,
      metacritic: metacritic ?? this.metacritic,
    );
  }

  String? get artUrl =>
      pickPortraitCover([coverUrl, capsuleUrl, headerUrl]);

  bool get artIsLandscape => isLandscapeArt(artUrl);
}

String? pickPortraitCover(List<String?> urls) {
  final normalized = urls.map(normalizeArtUrl).whereType<String>().toList();
  for (final url in normalized) {
    if (!isLandscapeArt(url)) return url;
  }
  return normalized.isEmpty ? null : normalized.first;
}

String? normalizeArtUrl(String? url) {
  if (url == null) return null;
  final trimmed = url.trim();
  if (trimmed.isEmpty) return null;
  if (trimmed.startsWith('//')) return 'https:$trimmed';
  if (trimmed.startsWith('http://')) {
    return 'https://${trimmed.substring(7)}';
  }
  return trimmed;
}

bool isLandscapeArt(String? url) {
  if (url == null) return false;
  final lower = url.toLowerCase();
  if (lower.contains('library_capsule') ||
      lower.contains('library_600x900') ||
      lower.contains('cover_big') ||
      lower.contains('cover_art')) {
    return false;
  }
  return lower.contains('header.jpg') ||
      lower.contains('header_2x.jpg') ||
      lower.contains('capsule_231') ||
      lower.contains('capsule_616') ||
      lower.contains('library_hero') ||
      lower.contains('hero_capsule');
}

String? upgradeSteamCapsule(String? url) {
  final normalized = normalizeArtUrl(url);
  if (normalized == null) return null;
  return normalized.replaceFirst(
    RegExp(r'capsule_231x87(?=_2x)?\.jpg', caseSensitive: false),
    'capsule_231x87_2x.jpg',
  );
}

String? upgradeHeroUrl(String? url, [String? catalogId]) {
  var normalized = normalizeArtUrl(url);
  if (normalized == null) {
    final steam = RegExp(r'^steam_(\d+)$').firstMatch(catalogId ?? '');
    if (steam == null) return null;
    return 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steam.group(1)}/library_hero_2x.jpg';
  }
  normalized = normalized.replaceAll(
    RegExp(r'/t_(thumb|cover_small|cover_big|screenshot_med|screenshot_big|720p)\b'),
    '/t_1080p',
  );
  normalized = normalized.replaceFirst(
    RegExp(r'/header(?:_2x)?\.jpg', caseSensitive: false),
    '/library_hero_2x.jpg',
  );
  normalized = normalized.replaceFirst(
    RegExp(r'/library_hero\.jpg', caseSensitive: false),
    '/library_hero_2x.jpg',
  );
  return normalized;
}

class CatalogDetails extends CatalogGame {
  final String summary;
  final String? releaseDate;
  final bool comingSoon;
  final List<String> genres;
  final List<String> developers;
  final List<String> publishers;
  final List<String> screenshots;
  final String? website;
  final List<FeaturedRail> related;

  const CatalogDetails({
    required super.id,
    super.steamId,
    required super.title,
    super.coverUrl,
    super.headerUrl,
    super.capsuleUrl,
    super.platforms = const [],
    super.metacritic,
    this.summary = '',
    this.releaseDate,
    this.comingSoon = false,
    this.genres = const [],
    this.developers = const [],
    this.publishers = const [],
    this.screenshots = const [],
    this.website,
    this.related = const [],
  });

  factory CatalogDetails.fromJson(Map<String, dynamic> json) {
    return CatalogDetails(
      id: json['id']?.toString() ?? '',
      steamId: (json['steamId'] as num?)?.toInt(),
      title: json['title'] as String? ?? '',
      coverUrl: json['coverUrl'] as String?,
      headerUrl: json['headerUrl'] as String?,
      capsuleUrl: json['capsuleUrl'] as String?,
      platforms: (json['platforms'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      metacritic: (json['metacritic'] as num?)?.toInt(),
      summary: json['summary'] as String? ?? '',
      releaseDate: json['releaseDate'] as String?,
      comingSoon: json['comingSoon'] as bool? ?? false,
      genres: (json['genres'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      developers: (json['developers'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      publishers: (json['publishers'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      screenshots: (json['screenshots'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      website: json['website'] as String?,
      related: (json['related'] as List<dynamic>?)
              ?.map((e) => FeaturedRail.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  factory CatalogDetails.fromPreview(CatalogGame game) {
    return CatalogDetails(
      id: game.id,
      steamId: game.steamId,
      title: game.title,
      coverUrl: game.coverUrl,
      headerUrl: game.headerUrl,
      capsuleUrl: game.capsuleUrl,
      platforms: game.platforms,
      metacritic: game.metacritic,
    );
  }

  @override
  Map<String, dynamic> toJson() {
    final map = super.toJson();
    map.addAll({
      'summary': summary,
      'releaseDate': releaseDate,
      'comingSoon': comingSoon,
      'genres': genres,
      'developers': developers,
      'publishers': publishers,
      'screenshots': screenshots,
      'website': website,
      'related': related.map((e) => e.toJson()).toList(),
    });
    return map;
  }
}

class FeaturedRail {
  final String id;
  final String title;
  final List<CatalogGame> games;

  const FeaturedRail({
    required this.id,
    required this.title,
    this.games = const [],
  });

  factory FeaturedRail.fromJson(Map<String, dynamic> json) {
    return FeaturedRail(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      games: (json['games'] as List<dynamic>?)
              ?.map((e) => CatalogGame.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'games': games.map((e) => e.toJson()).toList(),
    };
  }
}

class GameEntry {
  final int id;
  final String catalogId;
  final String title;
  final String? coverUrl;
  final String? headerUrl;
  final String? summary;
  final String? releaseDate;
  final List<String> platforms;
  final List<String> genres;
  final int? metacritic;
  final List<String> developers;
  final List<String> publishers;
  final List<String> screenshots;
  final GameStatus status;
  final int? score;
  final int? hours;
  final bool favorite;
  final String? notes;
  final String? startedAt;
  final String? finishedAt;
  final String createdAt;
  final String updatedAt;

  const GameEntry({
    required this.id,
    required this.catalogId,
    required this.title,
    this.coverUrl,
    this.headerUrl,
    this.summary,
    this.releaseDate,
    this.platforms = const [],
    this.genres = const [],
    this.metacritic,
    this.developers = const [],
    this.publishers = const [],
    this.screenshots = const [],
    this.status = GameStatus.backlog,
    this.score,
    this.hours,
    this.favorite = false,
    this.notes,
    this.startedAt,
    this.finishedAt,
    this.createdAt = '',
    this.updatedAt = '',
  });

  factory GameEntry.fromJson(Map<String, dynamic> json) {
    return GameEntry(
      id: (json['id'] as num?)?.toInt() ?? 0,
      catalogId: json['catalogId']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      coverUrl: json['coverUrl'] as String?,
      headerUrl: json['headerUrl'] as String?,
      summary: json['summary'] as String?,
      releaseDate: json['releaseDate'] as String?,
      platforms: (json['platforms'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      genres: (json['genres'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      metacritic: (json['metacritic'] as num?)?.toInt(),
      developers: (json['developers'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      publishers: (json['publishers'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      screenshots: (json['screenshots'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      status: GameStatus.fromString(json['status']?.toString()),
      score: (json['score'] as num?)?.toInt(),
      hours: (json['hours'] as num?)?.toInt(),
      favorite: json['favorite'] as bool? ?? false,
      notes: json['notes'] as String?,
      startedAt: json['startedAt'] as String?,
      finishedAt: json['finishedAt'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'catalogId': catalogId,
      'title': title,
      'coverUrl': coverUrl,
      'headerUrl': headerUrl,
      'summary': summary,
      'releaseDate': releaseDate,
      'platforms': platforms,
      'genres': genres,
      'metacritic': metacritic,
      'developers': developers,
      'publishers': publishers,
      'screenshots': screenshots,
      'status': status.value,
      'score': score,
      'hours': hours,
      'favorite': favorite,
      'notes': notes,
      'startedAt': startedAt,
      'finishedAt': finishedAt,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  GameEntry copyWith({
    int? id,
    String? catalogId,
    String? title,
    String? coverUrl,
    String? headerUrl,
    String? summary,
    String? releaseDate,
    List<String>? platforms,
    List<String>? genres,
    int? metacritic,
    List<String>? developers,
    List<String>? publishers,
    List<String>? screenshots,
    GameStatus? status,
    int? score,
    int? hours,
    bool? favorite,
    String? notes,
    String? startedAt,
    String? finishedAt,
    String? createdAt,
    String? updatedAt,
  }) {
    return GameEntry(
      id: id ?? this.id,
      catalogId: catalogId ?? this.catalogId,
      title: title ?? this.title,
      coverUrl: coverUrl ?? this.coverUrl,
      headerUrl: headerUrl ?? this.headerUrl,
      summary: summary ?? this.summary,
      releaseDate: releaseDate ?? this.releaseDate,
      platforms: platforms ?? this.platforms,
      genres: genres ?? this.genres,
      metacritic: metacritic ?? this.metacritic,
      developers: developers ?? this.developers,
      publishers: publishers ?? this.publishers,
      screenshots: screenshots ?? this.screenshots,
      status: status ?? this.status,
      score: score ?? this.score,
      hours: hours ?? this.hours,
      favorite: favorite ?? this.favorite,
      notes: notes ?? this.notes,
      startedAt: startedAt ?? this.startedAt,
      finishedAt: finishedAt ?? this.finishedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
