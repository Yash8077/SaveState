import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/types.dart';
import '../../services/api_client.dart';
import '../open_game.dart';

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
  PageController? _pages;
  Timer? _timer;
  int _index = 0;
  bool? _wide;
  final Map<String, String> _summaries = {};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final wide = MediaQuery.sizeOf(context).width >= 720;
    if (_wide != wide) {
      _wide = wide;
      _pages?.dispose();
      _pages = PageController(
        viewportFraction: wide ? 0.58 : 1,
        initialPage: _index,
      );
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _hydrateAround(_index);
    });
    _arm();
  }

  @override
  void didUpdateWidget(covariant HeroCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.games.length != widget.games.length ||
        oldWidget.autoplay != widget.autoplay) {
      _arm();
      if (oldWidget.games.length != widget.games.length) {
        _hydrateAround(_index);
      }
    }
  }

  void _arm() {
    _timer?.cancel();
    if (!widget.autoplay || widget.games.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted || _pages == null || !_pages!.hasClients) return;
      final next = (_index + 1) % widget.games.length;
      _pages!.animateToPage(
        next,
        duration: const Duration(milliseconds: 520),
        curve: Curves.easeOutCubic,
      );
    });
  }

  void _hydrateAround(int i) {
    final api = context.read<ApiClient>();
    for (final j in {i - 1, i, i + 1}) {
      if (j < 0 || j >= widget.games.length) continue;
      final id = widget.games[j].id;
      if (_summaries.containsKey(id)) continue;
      api.getGameDetails(id).then((details) {
        if (!mounted || details == null || details.summary.isEmpty) return;
        setState(() => _summaries[id] = details.summary);
      });
    }
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
    final summary = _summaries[game.id];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: PageView.builder(
              controller: controller,
              itemCount: widget.games.length,
              onPageChanged: (i) {
                setState(() => _index = i);
                _hydrateAround(i);
              },
              itemBuilder: (context, i) {
                return _Art(
                  game: widget.games[i],
                  preferWide: true,
                  onTap: () => openGame(context, widget.games[i]),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 14),
        _TitleRow(game: game),
        if (summary != null && summary.isNotEmpty) ...[
          const SizedBox(height: 10),
          _SynopsisCard(
            text: summary,
            onTap: () => openGame(context, game),
          ),
        ],
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
    return SizedBox(
      height: 460,
      child: PageView.builder(
        controller: controller,
        itemCount: widget.games.length,
        onPageChanged: (i) {
          setState(() => _index = i);
          _hydrateAround(i);
        },
        itemBuilder: (context, i) {
          final game = widget.games[i];
          final selected = i == _index;
          return AnimatedScale(
            scale: selected ? 1 : 0.94,
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOutCubic,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(22),
                      child: _Art(
                        game: game,
                        preferWide: false,
                        onTap: () => openGame(context, game),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _TitleRow(game: game),
                  if ((_summaries[game.id] ?? '').isNotEmpty) ...[
                    const SizedBox(height: 8),
                    _SynopsisCard(
                      text: _summaries[game.id]!,
                      onTap: () => openGame(context, game),
                      compact: true,
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
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

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final art = preferWide
        ? (game.headerUrl ?? game.coverUrl ?? game.capsuleUrl)
        : (game.coverUrl ?? game.headerUrl ?? game.capsuleUrl);
    return Material(
      color: cs.surfaceContainerHighest,
      child: InkWell(
        onTap: onTap,
        child: art == null
            ? const SizedBox.expand()
            : CachedNetworkImage(
                imageUrl: art,
                fit: BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
              ),
      ),
    );
  }
}

class _TitleRow extends StatelessWidget {
  final CatalogGame game;
  const _TitleRow({required this.game});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final score = game.metacritic;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            game.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.2,
              height: 1.15,
            ),
          ),
        ),
        if (score != null) ...[
          const SizedBox(width: 10),
          _ScoreChip(score: score),
        ],
      ],
    );
  }
}

class _ScoreChip extends StatelessWidget {
  final int score;
  const _ScoreChip({required this.score});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tens = (score / 10).toStringAsFixed(1);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: cs.primaryContainer,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.star_rounded, size: 14, color: cs.onPrimaryContainer),
          const SizedBox(width: 2),
          Text(
            tens,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: cs.onPrimaryContainer,
            ),
          ),
        ],
      ),
    );
  }
}

class _SynopsisCard extends StatelessWidget {
  final String text;
  final VoidCallback onTap;
  final bool compact;
  const _SynopsisCard({
    required this.text,
    required this.onTap,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: cs.surfaceContainerHigh,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: EdgeInsets.fromLTRB(12, compact ? 8 : 10, 10, compact ? 8 : 10),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  text,
                  maxLines: compact ? 2 : 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.35,
                    color: cs.onSurfaceVariant,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.north_east_rounded,
                size: 16,
                color: cs.onSurfaceVariant,
              ),
            ],
          ),
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
