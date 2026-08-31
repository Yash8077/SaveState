import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../because.dart';
import '../../models/types.dart';
import '../../services/api_client.dart';
import '../../state/auth_controller.dart';
import '../../state/home_layout_controller.dart';
import '../auth_ready_load.dart';
import '../widgets/game_rail.dart';
import '../widgets/home_greeting.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with AuthReadyLoad {
  bool _isLoading = true;
  String? _errorMessage;
  List<FeaturedRail> _featuredRails = [];
  List<GameEntry> _library = [];
  FeaturedRail? _because;

  @override
  void onAuthReady(bool signedIn) {
    _loadData();
  }

  CatalogGame _asCard(GameEntry entry) {
    return CatalogGame(
      id: entry.catalogId,
      title: entry.title,
      coverUrl: entry.coverUrl,
      headerUrl: entry.headerUrl,
    );
  }

  Future<void> _loadData() async {
    final api = context.read<ApiClient>();
    final layout = context.read<HomeLayoutController>();
    final signedIn = context.read<AuthController>().isSignedIn;
    final wantPs = layout.enabled(LayoutSurface.home, 'playstation');
    final wantRecs =
        signedIn && layout.enabled(LayoutSurface.home, 'recommended');

    if (_library.isEmpty && api.cachedLibrary != null) {
      _library = api.cachedLibrary!;
    }
    if (_featuredRails.isEmpty && api.cachedFeatured != null && wantPs) {
      _featuredRails = api.cachedFeatured!;
    }
    if (_because == null && wantRecs) {
      final seeds = pickBecauseSeeds(_library);
      _because = api.cachedBecause([for (final seed in seeds) seed.catalogId]);
    }
    final hasCache =
        _library.isNotEmpty || _featuredRails.isNotEmpty || _because != null;
    if (mounted) {
      setState(() {
        _errorMessage = null;
        _isLoading = !hasCache;
      });
    }

    try {
      final libraryFuture = () async {
        if (!signedIn) return const <GameEntry>[];
        try {
          return await api.getLibrary();
        } on ApiException catch (e) {
          if (e.status != 401) rethrow;
          return const <GameEntry>[];
        }
      }();
      final railsFuture = () async {
        if (!wantPs) return const <FeaturedRail>[];
        try {
          return await api.getFeaturedRails();
        } catch (_) {
          return _featuredRails;
        }
      }();
      final results = await Future.wait<Object>([libraryFuture, railsFuture]);
      var library = results[0] as List<GameEntry>;
      var rails = results[1] as List<FeaturedRail>;

      FeaturedRail? because = _because;
      if (wantRecs) {
        final seeds = pickBecauseSeeds(library);
        if (seeds.length >= 2) {
          try {
            because = await api.getBecauseRail(
              [for (final seed in seeds) seed.catalogId],
            );
          } catch (_) {
            because ??= null;
          }
        } else {
          because = null;
        }
      } else {
        because = null;
      }

      if (!mounted) return;
      setState(() {
        _featuredRails = rails;
        _library = library;
        _because = because;
        _isLoading = false;
      });
      for (final game in [
        ...library.take(4).map(_asCard),
        ...rails.expand((rail) => rail.games.take(3)),
      ].take(10)) {
        api.prefetchGameDetails(game.id);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          if (!hasCache) _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          child: _buildBody(colorScheme),
        ),
      ),
    );
  }

  Widget _buildBody(ColorScheme colorScheme) {
    if (_isLoading) return const _HomeScreenSkeleton();
    if (_errorMessage != null) return _buildErrorView(colorScheme);
    return RefreshIndicator(
      onRefresh: _loadData,
      color: colorScheme.primary,
      backgroundColor: colorScheme.surfaceContainerHigh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.only(bottom: 32),
        children: _layoutChildren(),
      ),
    );
  }

  List<Widget> _layoutChildren() {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final layout = context.watch<HomeLayoutController>();
    final signedIn = context.watch<AuthController>().isSignedIn;
    final sections = layout.mergeHome();
    final railsById = {for (final rail in _featuredRails) rail.id: rail};
    final playing = _library
        .where((e) => e.status == GameStatus.playing)
        .map(_asCard)
        .toList();
    final backlog = _library
        .where((e) => e.status == GameStatus.backlog)
        .map(_asCard)
        .toList();
    final beaten = _library.where((e) => e.status == GameStatus.beaten).length;
    final favorites = _library.where((e) => e.favorite).length;
    final wishlist = sortWishlist(
      _library.where((e) => e.status == GameStatus.wishlist),
    ).map(_asCard).toList();
    final owned = {for (final e in _library) e.catalogId};
    final recommended = (_because?.games ?? [])
        .where((g) => !owned.contains(g.id))
        .toList();
    final out = <Widget>[const HomeGreeting()];
    if (!signedIn) {
      out.add(
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Sign in to keep playing, backlog, and wishlist in sync.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: cs.onSurfaceVariant,
                  ),
                ),
              ),
              FilledButton(
                onPressed: () => context.push('/login'),
                child: const Text('Sign in'),
              ),
            ],
          ),
        ),
      );
    }

    for (final section in sections) {
      if (!section.enabled) continue;
      switch (section.id) {
        case 'stats':
          if (!signedIn) break;
          out.add(
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _chip(cs, 'Playing', playing.length),
                  _chip(cs, 'Beaten', beaten),
                  _chip(cs, 'Backlog', backlog.length),
                  _chip(cs, 'Favorites', favorites),
                ],
              ),
            ),
          );
          break;
        case 'playing':
          if (playing.isNotEmpty) {
            out.add(GameRailWidget(title: 'Continue playing', games: playing));
          }
          break;
        case 'backlog':
          if (backlog.isNotEmpty) {
            out.add(
              GameRailWidget(
                title: 'Planning to play',
                games: backlog.take(16).toList(),
              ),
            );
          }
          break;
        case 'wishlist':
          if (wishlist.isNotEmpty) {
            out.add(
              GameRailWidget(
                title: 'Wishlist',
                games: wishlist.take(16).toList(),
              ),
            );
          }
          break;
        case 'recommended':
          if (recommended.isNotEmpty) {
            out.add(
              GameRailWidget(
                title: _because?.title ?? 'Recommended',
                games: recommended,
              ),
            );
          }
          break;
        case 'playstation':
          final rail = railsById['playstation'];
          if (rail != null && rail.games.isNotEmpty) {
            out.add(GameRailWidget(title: rail.title, games: rail.games));
          }
          break;
      }
    }

    if (signedIn && _library.isEmpty) {
      out.add(
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Column(
            children: [
              Text(
                'Library is empty',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Search Discover and add something you are playing.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: cs.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => context.go('/discover'),
                child: const Text('Discover games'),
              ),
            ],
          ),
        ),
      );
    }
    return out;
  }

  Widget _chip(ColorScheme cs, String label, int value) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text.rich(
        TextSpan(
          text: label,
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
          children: [
            TextSpan(
              text: ' $value',
              style: TextStyle(
                color: cs.onSurface,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorView(ColorScheme colorScheme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded, size: 40, color: colorScheme.error),
            const SizedBox(height: 12),
            const Text(
              'Failed to load Home',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(color: colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeScreenSkeleton extends StatefulWidget {
  const _HomeScreenSkeleton();

  @override
  State<_HomeScreenSkeleton> createState() => _HomeScreenSkeletonState();
}

class _HomeScreenSkeletonState extends State<_HomeScreenSkeleton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
    _opacityAnimation = Tween<double>(begin: 0.3, end: 0.7).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return AnimatedBuilder(
      animation: _opacityAnimation,
      builder: (context, child) {
        return Opacity(
          opacity: _opacityAnimation.value,
          child: ListView(
            physics: const NeverScrollableScrollPhysics(),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Container(
                  height: 48,
                  decoration: BoxDecoration(
                    color: colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              _rail(colorScheme),
              _rail(colorScheme),
            ],
          ),
        );
      },
    );
  }

  Widget _rail(ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: 140,
              height: 20,
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(6),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 160,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 4,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, __) => Container(
                width: 110,
                decoration: BoxDecoration(
                  color: colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
