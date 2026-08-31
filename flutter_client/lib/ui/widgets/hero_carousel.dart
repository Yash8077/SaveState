import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../models/types.dart';
import '../open_game.dart';
import 'game_card.dart';

class HeroCarousel extends StatefulWidget {
  final List<CatalogGame> games;
  final bool autoplay;
  const HeroCarousel({
    super.key,
    required this.games,
    this.autoplay = true,
  });

  @override
  State<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<HeroCarousel> {
  static const _loop = 8000;
  PageController? _pages;
  Timer? _timer;
  int _index = 0;
  int _page = 0;
  bool? _wide;

  int get _n => widget.games.length;

  int _originFor(int real) {
    if (_n < 2) return real;
    return (_loop ~/ 2 ~/ _n) * _n + (real % _n);
  }

  void _attachController(bool wide, [double? fraction]) {
    _wide = wide;
    _pages?.dispose();
    _page = _originFor(_index);
    _pages = PageController(
      viewportFraction: fraction ?? (wide ? 0.2 : 0.46),
      initialPage: _page,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final size = MediaQuery.sizeOf(context);
    final wide = size.width >= 720;
    final contentW = wide ? (size.width - 84).clamp(320, 2000) : size.width;
    final fraction = wide ? (200 / contentW).clamp(0.16, 0.3) : 0.46;
    if (_wide != wide) {
      _attachController(wide, fraction);
    }
  }

  @override
  void initState() {
    super.initState();
    _arm();
  }

  @override
  void didUpdateWidget(covariant HeroCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.games.length != widget.games.length ||
        oldWidget.autoplay != widget.autoplay) {
      _arm();
    }
  }

  void _arm() {
    _timer?.cancel();
    if (!widget.autoplay || widget.games.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted || _pages == null || !_pages!.hasClients) return;
      _pages!.nextPage(
        duration: const Duration(milliseconds: 520),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pages?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.games.isEmpty) return const SizedBox.shrink();
    final wide = _wide ?? MediaQuery.sizeOf(context).width >= 720;
    final controller = _pages;
    if (controller == null) return const SizedBox.shrink();
    final cs = Theme.of(context).colorScheme;

    return Padding(
      padding: EdgeInsets.fromLTRB(wide ? 8 : 12, 8, wide ? 8 : 12, 4),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final cardW = constraints.maxWidth * controller.viewportFraction;
          final posterH = cardW * 3 / 2;
          return Column(
            children: [
              SizedBox(
                height: posterH + 44,
                child: PageView.builder(
                  controller: controller,
                  padEnds: true,
                  itemCount: _n < 2 ? _n : _loop,
                  onPageChanged: (i) {
                    setState(() {
                      _page = i;
                      _index = i % _n;
                    });
                  },
                  itemBuilder: (context, i) {
                    final game = widget.games[i % _n];
                    final selected = i % _n == _index;
                    return AnimatedScale(
                      scale: selected ? 1 : 0.9,
                      duration: const Duration(milliseconds: 280),
                      curve: Curves.easeOutCubic,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 4,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(14),
                                child: _Art(
                                  game: game,
                                  onTap: () => openGame(context, game),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              game.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              if (widget.games.length > 1) ...[
                const SizedBox(height: 8),
                _Dots(
                  count: widget.games.length,
                  index: _index,
                  color: cs.primary,
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _Art extends StatelessWidget {
  final CatalogGame game;
  final VoidCallback onTap;
  const _Art({required this.game, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final art = pickPortraitCover([
      game.coverUrl,
      game.capsuleUrl,
      game.headerUrl,
    ]);
    return Material(
      color: cs.surfaceContainerHighest,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (art != null)
              CachedNetworkImage(
                imageUrl: art,
                fit: isLandscapeArt(art) ? BoxFit.contain : BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
              ),
            if (game.metacritic != null) RatingBadge(score: game.metacritic!),
          ],
        ),
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  final int count;
  final int index;
  final Color color;
  const _Dots({required this.count, required this.index, required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < count; i++)
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            margin: const EdgeInsets.symmetric(horizontal: 3),
            height: 7,
            width: i == index ? 18 : 7,
            decoration: BoxDecoration(
              color: i == index ? color : color.withOpacity(0.28),
              borderRadius: BorderRadius.circular(99),
            ),
          ),
      ],
    );
  }
}
