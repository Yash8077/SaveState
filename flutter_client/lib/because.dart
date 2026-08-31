import 'models/types.dart';

const becauseSeedLimit = 8;

class BecauseSeed {
  final String catalogId;
  final String title;
  final bool favorite;
  final String status;
  final int? score;
  final String updatedAt;

  const BecauseSeed({
    required this.catalogId,
    required this.title,
    required this.favorite,
    required this.status,
    required this.score,
    required this.updatedAt,
  });

  factory BecauseSeed.fromEntry(GameEntry entry) {
    return BecauseSeed(
      catalogId: entry.catalogId,
      title: entry.title,
      favorite: entry.favorite,
      status: entry.status.name,
      score: entry.score,
      updatedAt: entry.updatedAt,
    );
  }
}

int becauseWeight(BecauseSeed seed) {
  var n = 0;
  if (seed.favorite) n += 2;
  if (seed.status == 'beaten') n += 2;
  if (seed.status == 'playing') n += 1;
  if ((seed.score ?? 0) >= 9) n += 1;
  return n == 0 ? 1 : n;
}

List<BecauseSeed> pickBecauseSeeds(Iterable<GameEntry> entries) {
  final ranked = <BecauseSeed>[];
  for (final entry in entries) {
    if (entry.catalogId.isEmpty || entry.catalogId.startsWith('custom_')) {
      continue;
    }
    final keep = entry.favorite ||
        entry.status == GameStatus.beaten ||
        (entry.status == GameStatus.playing && (entry.score ?? 0) >= 8);
    if (!keep) continue;
    ranked.add(BecauseSeed.fromEntry(entry));
  }
  ranked.sort((a, b) {
    final aw = becauseWeight(a);
    final bw = becauseWeight(b);
    if (bw != aw) return bw - aw;
    return b.updatedAt.compareTo(a.updatedAt);
  });
  if (ranked.length <= becauseSeedLimit) return ranked;
  return ranked.sublist(0, becauseSeedLimit);
}

bool isUpcomingRelease(String? raw) {
  if (raw == null) return false;
  final text = raw.trim();
  if (text.isEmpty) return false;
  if (RegExp(r'tba|coming soon|to be announced', caseSensitive: false)
      .hasMatch(text)) {
    return true;
  }
  final iso = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(text);
  if (iso != null) {
    return text
            .substring(0, 10)
            .compareTo(DateTime.now().toIso8601String().substring(0, 10)) >
        0;
  }
  final parsed = DateTime.tryParse(text);
  if (parsed == null) return false;
  return parsed.isAfter(DateTime.now());
}

List<GameEntry> sortWishlist(Iterable<GameEntry> entries) {
  final list = entries.toList();
  list.sort((a, b) {
    final au = isUpcomingRelease(a.releaseDate);
    final bu = isUpcomingRelease(b.releaseDate);
    if (au != bu) return au ? -1 : 1;
    return a.title.toLowerCase().compareTo(b.title.toLowerCase());
  });
  return list;
}
