import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/types.dart';
import '../../services/api_client.dart';
import '../../state/home_layout_controller.dart';
import '../widgets/game_rail.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  List<FeaturedRail> _featuredRails = [];
  List<CatalogGame> _playing = [];
  List<CatalogGame> _backlog = [];

  @override
  void initState() {
    super.initState();
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
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiClient = context.read<ApiClient>();
      final featured = apiClient.getFeaturedRails();
      List<GameEntry> library = const [];
      try {
        library = await apiClient.getLibrary();
      } on ApiException catch (e) {
        if (e.status != 401) rethrow;
      }
      final rails = await featured;

      if (mounted) {
        setState(() {
          _featuredRails = rails;
          _playing = library
              .where((e) => e.status == GameStatus.playing)
              .map(_asCard)
              .toList();
          _backlog = library
              .where((e) => e.status == GameStatus.backlog)
              .map(_asCard)
              .toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          child: _buildBody(colorScheme),
        ),
      ),
    );
  }

  Widget _buildBody(ColorScheme colorScheme) {
    final theme = Theme.of(context);
    if (_isLoading) {
      return const _HomeScreenSkeleton();
    }

    if (_errorMessage != null) {
      return _buildErrorView(colorScheme);
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: colorScheme.primary,
      backgroundColor: colorScheme.surfaceContainerHigh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.only(bottom: 32.0),
        children: _layoutChildren(theme, colorScheme),
      ),
    );
  }

  List<Widget> _layoutChildren(ThemeData theme, ColorScheme colorScheme) {
    final layout = context.watch<HomeLayoutController>();
    final sections = layout.mergeWith(_featuredRails.map((r) => r.id));
    final railsById = {for (final rail in _featuredRails) rail.id: rail};
    final out = <Widget>[];
    var browseShown = false;

    for (final section in sections) {
      if (!section.enabled) continue;
      switch (section.id) {
        case 'hero':
        case 'stats':
          if (!out.any((w) => w.key == const ValueKey('home-stats'))) {
            out.add(KeyedSubtree(
              key: const ValueKey('home-stats'),
              child: _buildGreetingHeader(colorScheme),
            ));
          }
          break;
        case 'playing':
          if (_playing.isNotEmpty) {
            out.add(GameRailWidget(title: 'Continue playing', games: _playing));
          }
          break;
        case 'backlog':
          if (_backlog.isNotEmpty) {
            out.add(GameRailWidget(title: 'Planning to play', games: _backlog));
          }
          break;
        default:
          final rail = railsById[section.id];
          if (rail == null || rail.games.isEmpty) break;
          if (!browseShown) {
            browseShown = true;
            out.add(
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Browse',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Popular Steam lists, plus PlayStation',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }
          out.add(GameRailWidget(title: rail.title, games: rail.games));
      }
    }

    if (out.isEmpty) {
      out.add(_buildEmptyState(colorScheme));
    }
    return out;
  }

  Widget _buildGreetingHeader(ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 8.0),
      child: Container(
        padding: const EdgeInsets.all(20.0),
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainer,
          borderRadius: BorderRadius.circular(20.0),
          border: Border.all(
            color: colorScheme.outlineVariant.withOpacity(0.3),
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 12.0,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10.0),
                  decoration: BoxDecoration(
                    color: colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(14.0),
                  ),
                  child: Icon(
                    Icons.sports_esports_rounded,
                    color: colorScheme.onPrimaryContainer,
                    size: 24.0,
                  ),
                ),
                const SizedBox(width: 14.0),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SaveState',
                        style: TextStyle(
                          fontSize: 24.0,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                          color: colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2.0),
                      Text(
                        'Track & organize your gaming universe',
                        style: TextStyle(
                          fontSize: 13.0,
                          fontWeight: FontWeight.w500,
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16.0),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 12.0,
                vertical: 8.0,
              ),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(12.0),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.auto_awesome_rounded,
                    size: 16.0,
                    color: colorScheme.primary,
                  ),
                  const SizedBox(width: 8.0),
                  Text(
                    'Explore curated collections & top releases',
                    style: TextStyle(
                      fontSize: 12.0,
                      fontWeight: FontWeight.w500,
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.all(40.0),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.sports_esports_outlined,
              size: 56.0,
              color: colorScheme.onSurfaceVariant.withOpacity(0.5),
            ),
            const SizedBox(height: 16.0),
            Text(
              'No featured games available',
              style: TextStyle(
                fontSize: 16.0,
                fontWeight: FontWeight.w600,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 8.0),
            Text(
              'Pull down to refresh and check for updates.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13.0,
                color: colorScheme.onSurfaceVariant,
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
        padding: const EdgeInsets.all(24.0),
        child: Container(
          padding: const EdgeInsets.all(24.0),
          decoration: BoxDecoration(
            color: colorScheme.surfaceContainer,
            borderRadius: BorderRadius.circular(20.0),
            border: Border.all(
              color: colorScheme.outlineVariant.withOpacity(0.3),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16.0),
                decoration: BoxDecoration(
                  color: colorScheme.errorContainer.withOpacity(0.4),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.cloud_off_rounded,
                  size: 40.0,
                  color: colorScheme.error,
                ),
              ),
              const SizedBox(height: 16.0),
              Text(
                'Failed to load games',
                style: TextStyle(
                  fontSize: 18.0,
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 8.0),
              Text(
                _errorMessage ?? 'An unexpected error occurred while fetching featured games.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13.0,
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 20.0),
              FilledButton.icon(
                onPressed: _loadData,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try Again'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24.0,
                    vertical: 12.0,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14.0),
                  ),
                ),
              ),
            ],
          ),
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
            padding: const EdgeInsets.only(bottom: 24.0),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 8.0),
                child: Container(
                  height: 110.0,
                  decoration: BoxDecoration(
                    color: colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(20.0),
                  ),
                ),
              ),
              const SizedBox(height: 16.0),
              _buildSkeletonRail(colorScheme),
              _buildSkeletonRail(colorScheme),
              _buildSkeletonRail(colorScheme),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSkeletonRail(ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.only(top: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Container(
              width: 140.0,
              height: 20.0,
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(6.0),
              ),
            ),
          ),
          const SizedBox(height: 12.0),
          SizedBox(
            height: 180.0,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 4,
              separatorBuilder: (context, index) => const SizedBox(width: 12.0),
              itemBuilder: (context, index) {
                return SizedBox(
                  width: 120.0,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Container(
                          decoration: BoxDecoration(
                            color: colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(12.0),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8.0),
                      Container(
                        width: 90.0,
                        height: 12.0,
                        decoration: BoxDecoration(
                          color: colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(4.0),
                        ),
                      ),
                      const SizedBox(height: 4.0),
                      Container(
                        width: 60.0,
                        height: 10.0,
                        decoration: BoxDecoration(
                          color: colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(4.0),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
