enum GameStatus {
  playing,
  beaten,
  backlog,
  hold,
  dropped,
  wishlist
}

extension GameStatusExtension on GameStatus {
  String get label {
    switch (this) {
      case GameStatus.playing:
        return "Playing";
      case GameStatus.beaten:
        return "Beaten";
      case GameStatus.backlog:
        return "Backlog";
      case GameStatus.hold:
        return "On hold";
      case GameStatus.dropped:
        return "Dropped";
      case GameStatus.wishlist:
        return "Wishlist";
    }
  }

  String get value {
    return toString().split('.').last;
  }
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

  CatalogGame({
    required this.id,
    this.steamId,
    required this.title,
    this.coverUrl,
    this.headerUrl,
    this.capsuleUrl,
    required this.platforms,
    this.metacritic,
  });

  factory CatalogGame.fromJson(Map<String, dynamic> json) {
    return CatalogGame(
      id: json['id'] as String,
      steamId: json['steamId'] as int?,
      title: json['title'] as String,
      coverUrl: json['coverUrl'] as String?,
      headerUrl: json['headerUrl'] as String?,
      capsuleUrl: json['capsuleUrl'] as String?,
      platforms: (json['platforms'] as List<dynamic>?)?.cast<String>() ?? [],
      metacritic: json['metacritic'] as int?,
    );
  }
}

class FeaturedRail {
  final String id;
  final String title;
  final List<CatalogGame> games;

  FeaturedRail({
    required this.id,
    required this.title,
    required this.games,
  });

  factory FeaturedRail.fromJson(Map<String, dynamic> json) {
    return FeaturedRail(
      id: json['id'] as String,
      title: json['title'] as String,
      games: (json['games'] as List<dynamic>?)
              ?.map((e) => CatalogGame.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class GameEntry {
  final int id;
  final String catalogId;
  final String title;
  final String? coverUrl;
  final String? headerUrl;
  final GameStatus status;
  final int? score;
  final int? hours;
  final bool favorite;

  // Add other fields from types.ts as needed

  GameEntry({
    required this.id,
    required this.catalogId,
    required this.title,
    this.coverUrl,
    this.headerUrl,
    required this.status,
    this.score,
    this.hours,
    this.favorite = false,
  });

  factory GameEntry.fromJson(Map<String, dynamic> json) {
    return GameEntry(
      id: json['id'] as int,
      catalogId: json['catalogId'] as String,
      title: json['title'] as String,
      coverUrl: json['coverUrl'] as String?,
      headerUrl: json['headerUrl'] as String?,
      status: GameStatus.values.firstWhere(
        (e) => e.value == json['status'],
        orElse: () => GameStatus.backlog,
      ),
      score: json['score'] as int?,
      hours: json['hours'] as int?,
      favorite: json['favorite'] as bool? ?? false,
    );
  }
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

  CatalogDetails({
    required super.id,
    super.steamId,
    required super.title,
    super.coverUrl,
    super.headerUrl,
    super.capsuleUrl,
    required super.platforms,
    super.metacritic,
    required this.summary,
    this.releaseDate,
    this.comingSoon = false,
    required this.genres,
    required this.developers,
    required this.publishers,
    required this.screenshots,
    this.website,
  });

  factory CatalogDetails.fromJson(Map<String, dynamic> json) {
    return CatalogDetails(
      id: json['id'] as String,
      steamId: json['steamId'] as int?,
      title: json['title'] as String,
      coverUrl: json['coverUrl'] as String?,
      headerUrl: json['headerUrl'] as String?,
      capsuleUrl: json['capsuleUrl'] as String?,
      platforms: (json['platforms'] as List<dynamic>?)?.cast<String>() ?? [],
      metacritic: json['metacritic'] as int?,
      summary: json['summary'] as String? ?? '',
      releaseDate: json['releaseDate'] as String?,
      comingSoon: json['comingSoon'] as bool? ?? false,
      genres: (json['genres'] as List<dynamic>?)?.cast<String>() ?? [],
      developers: (json['developers'] as List<dynamic>?)?.cast<String>() ?? [],
      publishers: (json['publishers'] as List<dynamic>?)?.cast<String>() ?? [],
      screenshots: (json['screenshots'] as List<dynamic>?)?.cast<String>() ?? [],
      website: json['website'] as String?,
    );
  }
}
