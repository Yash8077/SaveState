import 'types.dart';

class ArtworkSelection {
  final String? coverUrl;
  final String? heroUrl;
  final List<String> coverCandidates;
  final List<String> heroCandidates;

  const ArtworkSelection({
    this.coverUrl,
    this.heroUrl,
    this.coverCandidates = const [],
    this.heroCandidates = const [],
  });
}

/// Canonical, synchronous artwork resolution used across Flutter surfaces.
///
/// This layer never performs network requests. It only normalizes URLs and
/// orders deterministic fallbacks. CachedNetworkImage remains responsible for
/// network access and image caching, so identical URLs share the same cache.
ArtworkSelection resolveGameArtwork({
  String? coverUrl,
  String? headerUrl,
  String? capsuleUrl,
  String? catalogId,
}) {
  final cover = normalizeArtUrl(coverUrl);
  final header = normalizeArtUrl(headerUrl);
  final capsule = upgradeSteamCapsule(capsuleUrl);

  final preferredCover = pickPortraitCover([
    cover,
    capsule,
    header,
  ]);
  final coverCandidates = _uniqueArtwork([
    preferredCover,
    cover,
    capsule,
    header,
  ]);

  final preferredHero = _firstArtwork([
    upgradeHeroUrl(headerUrl, catalogId),
    header,
    cover,
    capsule,
  ]);
  final heroCandidates = _uniqueArtwork([
    preferredHero,
    upgradeHeroUrl(coverUrl, catalogId),
    header,
    cover,
    capsule,
  ]);

  return ArtworkSelection(
    coverUrl: preferredCover,
    heroUrl: preferredHero,
    coverCandidates: coverCandidates,
    heroCandidates: heroCandidates,
  );
}

List<String> _uniqueArtwork(Iterable<String?> urls) {
  final result = <String>[];
  final seen = <String>{};
  for (final url in urls) {
    if (url == null || url.isEmpty || !seen.add(url)) continue;
    result.add(url);
  }
  return result;
}

String? _firstArtwork(Iterable<String?> urls) {
  for (final url in urls) {
    if (url != null && url.isNotEmpty) return url;
  }
  return null;
}
