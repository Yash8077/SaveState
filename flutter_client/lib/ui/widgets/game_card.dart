import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../models/types.dart';
import '../open_game.dart';

class GameCardWidget extends StatelessWidget {
  final CatalogGame game;

  const GameCardWidget({
    super.key,
    required this.game,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final coverUrl = game.artUrl;
    BoxFit fitFor(String url) =>
        isLandscapeArt(url) ? BoxFit.contain : BoxFit.cover;

    Widget missingArt() => Container(
          color: colorScheme.surfaceContainerHighest,
          child: Center(
            child: Icon(
              Icons.videogame_asset_outlined,
              color: colorScheme.onSurfaceVariant,
              size: 32,
            ),
          ),
        );

    return SizedBox(
      width: 130,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => openGame(context, game),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Card(
                elevation: 2,
                shadowColor: Colors.black.withOpacity(0.4),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                clipBehavior: Clip.antiAlias,
                margin: EdgeInsets.zero,
                child: SizedBox(
                  width: 130,
                  child: AspectRatio(
                    aspectRatio: 3 / 4,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (coverUrl != null && coverUrl.isNotEmpty)
                          CachedNetworkImage(
                            imageUrl: coverUrl,
                            fit: fitFor(coverUrl),
                            memCacheWidth: 360,
                            fadeInDuration: const Duration(milliseconds: 120),
                            placeholder: (context, url) => Container(
                              color: colorScheme.surfaceContainerHighest,
                            ),
                            errorWidget: (context, url, error) {
                              final tried = <String>{url};
                              final fallbacks = [
                                normalizeArtUrl(game.headerUrl),
                                upgradeSteamCapsule(game.capsuleUrl),
                              ].whereType<String>().where((u) => !tried.contains(u));
                              final next = fallbacks.isEmpty ? null : fallbacks.first;
                              if (next != null) {
                                return CachedNetworkImage(
                                  imageUrl: next,
                                  fit: fitFor(next),
                                  errorWidget: (context, failed, __) {
                                    final last = upgradeSteamCapsule(game.capsuleUrl);
                                    if (last != null && last != failed && last != next) {
                                      return CachedNetworkImage(
                                        imageUrl: last,
                                        fit: fitFor(last),
                                        errorWidget: (context, _, ___) => missingArt(),
                                      );
                                    }
                                    return missingArt();
                                  },
                                );
                              }
                              return missingArt();
                            },
                          )
                        else
                          Container(
                            color: colorScheme.surfaceContainerHighest,
                            child: Center(
                              child: Icon(
                                Icons.videogame_asset_outlined,
                                color: colorScheme.onSurfaceVariant,
                                size: 36,
                              ),
                            ),
                          ),
                        if (game.metacritic != null)
                          RatingBadge(score: game.metacritic!),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                game.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  height: 1.25,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RatingBadge extends StatelessWidget {
  final int score;
  const RatingBadge({super.key, required this.score});

  static String labelFor(int score) {
    final ten = score > 10 ? score / 10.0 : score.toDouble();
    return ten.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Positioned(
      right: 0,
      bottom: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(7, 4, 8, 4),
        decoration: BoxDecoration(
          color: cs.primary,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(8),
            bottomRight: Radius.circular(12),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.star_rounded, size: 13, color: cs.onPrimary),
            const SizedBox(width: 3),
            Text(
              labelFor(score),
              style: TextStyle(
                color: cs.onPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w800,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
