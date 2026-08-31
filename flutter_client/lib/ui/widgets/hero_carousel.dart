import 'dart:async';
import 'dart:ui';
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
      viewportFraction: fraction ?? (wide ? 0.2 : 0.86),
      initialPage: _page,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final size = MediaQuery.sizeOf(context);
    final wide = size.width >= 720;
    final contentW = wide ? (size.width - 84).clamp(320, 2000) : size.width;
    final fraction = wide ? (200 / contentW).clamp(0.16, 0.3) : 0.86;
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

    return Padding(
      padding: EdgeInsets.fromLTRB(wide ? 8 : 16, 8, wide ? 8 : 16, 4),
      child: wide ? _buildWide(controller) : _buildPhone(controller),
    );
  }

  Widget _buildPhone(PageController controller) {
    final cs = Theme.of(context).colorScheme;
    final game = widget.games[_index.clamp(0, widget.games.length - 1)];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: AspectRatio(
            aspectRatio: 2,
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
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: _Art(
                      game: game,
                      preferWide: true,
                      onTap: () => openGame(context, game),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 28,
          child: Align(
            alignment: Alignment.centerLeft,
            child: _TitleRow(game: game),
          ),
        ),
        if (widget.games.length > 1) ...[
          const SizedBox(height: 12),
          _Dots(
            count: widget.games.length,
            index: _index,
            color: cs.primary,
          ),
        ],
      ],
    );
  }

  Widget _buildWide(PageController controller) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cardW = constraints.maxWidth * controller.viewportFraction;
        final posterH = cardW * 3 / 2;
        return SizedBox(
          height: posterH + 48,
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
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: _Art(
                            game: game,
                            preferWide: false,
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
        );
      },
    );
  }
}

class _Art extends StatelessWidget {
  final CatalogGame game;
  final bool preferWide;
  final VoidCallback onTap;
  const _Art({
    required this.game,
    required this.preferWide,
    required this.onTap,
  });

  String? _url() {
    if (preferWide) {
      return normalizeArtUrl(game.headerUrl) ??
          normalizeArtUrl(game.coverUrl) ??
          normalizeArtUrl(game.capsuleUrl);
    }
    return pickPortraitCover([game.coverUrl, game.capsuleUrl, game.headerUrl]);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final art = _url();
    return Material(
      color: cs.surfaceContainerHighest,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (art != null)
              preferWide
                  ? _BannerFill(url: art)
                  : CachedNetworkImage(
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

class _BannerFill extends StatelessWidget {
  final String url;
  const _BannerFill({required this.url});

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ImageFiltered(
          imageFilter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
          child: Transform.scale(
            scale: 1.18,
            child: CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
            ),
          ),
        ),
        const ColoredBox(color: Color(0x66000000)),
        CachedNetworkImage(
          imageUrl: url,
          fit: BoxFit.contain,
          width: double.infinity,
          height: double.infinity,
        ),
      ],
    );
  }
}

class _TitleRow extends StatelessWidget {
  final CatalogGame game;
  const _TitleRow({required this.game});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text(
      game.title,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: theme.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -0.2,
        height: 1.15,
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
