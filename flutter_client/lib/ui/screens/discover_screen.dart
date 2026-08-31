import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/types.dart';
import '../../services/api_client.dart';
import '../../state/home_layout_controller.dart';
import '../open_game.dart';
import '../widgets/game_card.dart';
import '../widgets/game_rail.dart';
import '../widgets/hero_carousel.dart';

class DiscoverScreen extends StatefulWidget {
  final String? q;
  final bool focus;
  const DiscoverScreen({super.key, this.q, this.focus = false});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  late final TextEditingController _searchController;
  late final FocusNode _searchFocus;
  Timer? _debounceTimer;
  List<CatalogGame> _results = [];
  List<FeaturedRail> _rails = [];
  bool _isLoading = false;
  bool _railsLoading = false;
  String? _errorMessage;
  bool _hasSearched = false;
  int _searchGen = 0;

  bool get _ready => _searchController.text.trim().length >= 2;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(text: widget.q ?? '');
    _searchFocus = FocusNode();
    final initial = _searchController.text.trim();
    if (initial.length >= 2) {
      _performSearch(initial);
    } else {
      _loadRails();
      if (widget.focus) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _searchFocus.requestFocus();
        });
      }
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  Future<void> _loadRails({bool force = false}) async {
    final api = context.read<ApiClient>();
    if (!force && _rails.isEmpty && (api.cachedFeatured?.isNotEmpty ?? false)) {
      setState(() {
        _rails = api.cachedFeatured!;
        _railsLoading = false;
      });
    } else if (_rails.isEmpty) {
      setState(() => _railsLoading = true);
    }
    try {
      final rails = await api.getFeaturedRails(force: force);
      if (!mounted) return;
      setState(() {
        _rails = rails;
        _railsLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (_rails.isEmpty) {
          _errorMessage = _hasSearched ? _errorMessage : e.toString();
        }
        _railsLoading = false;
      });
    }
  }

  void _onSearchChanged(String query) {
    setState(() {});
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      _performSearch(query.trim());
    });
  }

  void _clearSearch() {
    _searchController.clear();
    _debounceTimer?.cancel();
    setState(() {
      _results = [];
      _isLoading = false;
      _errorMessage = null;
      _hasSearched = false;
    });
    _loadRails();
  }

  Future<void> _performSearch(String query) async {
    final gen = ++_searchGen;
    if (query.length < 2) {
      setState(() {
        _results = [];
        _isLoading = false;
        _errorMessage = null;
        _hasSearched = false;
      });
      _loadRails();
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _hasSearched = true;
    });

    try {
      final results = await context.read<ApiClient>().searchGames(query);
      if (!mounted || gen != _searchGen) return;
      setState(() {
        _results = results;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted || gen != _searchGen) return;
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  List<CatalogGame> _heroSlides() {
    final out = <CatalogGame>[];
    final seen = <String>{};
    void take(CatalogGame game) {
      if (game.id.isEmpty || seen.contains(game.id) || out.length >= 8) return;
      if ((game.headerUrl == null || game.headerUrl!.isEmpty) &&
          (game.coverUrl == null || game.coverUrl!.isEmpty)) {
        return;
      }
      seen.add(game.id);
      out.add(game);
    }

    for (final rail in _rails) {
      for (final game in rail.games) {
        take(game);
      }
      if (out.length >= 8) break;
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: SearchBar(
                controller: _searchController,
                focusNode: _searchFocus,
                hintText: 'Search games',
                hintStyle: WidgetStatePropertyAll(
                  TextStyle(
                    color: colorScheme.onSurfaceVariant.withOpacity(0.7),
                    fontSize: 15,
                  ),
                ),
                leading: Icon(
                  Icons.search_rounded,
                  color: colorScheme.onSurfaceVariant,
                ),
                trailing: [
                  if (_searchController.text.isNotEmpty)
                    IconButton(
                      icon: const Icon(Icons.clear_rounded),
                      onPressed: _clearSearch,
                    ),
                ],
                elevation: const WidgetStatePropertyAll(0),
                backgroundColor: WidgetStatePropertyAll(
                  colorScheme.surfaceContainerHigh,
                ),
                shape: WidgetStatePropertyAll(
                  RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                  ),
                ),
                onChanged: _onSearchChanged,
                onSubmitted: (value) {
                  _debounceTimer?.cancel();
                  _performSearch(value.trim());
                },
              ),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: _buildContent(colorScheme),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(ColorScheme colorScheme) {
    if (_hasSearched && _ready) {
      if (_isLoading && _results.isEmpty) {
        return const Center(child: CircularProgressIndicator());
      }
      if (_errorMessage != null) {
        return _message(
          colorScheme,
          icon: Icons.error_outline_rounded,
          title: 'Search failed',
          body: _errorMessage!,
          action: () => _performSearch(_searchController.text.trim()),
        );
      }
      if (_results.isEmpty) {
        return _message(
          colorScheme,
          icon: Icons.search_off_rounded,
          title: 'No games found',
          body: 'No results matched "${_searchController.text.trim()}".',
        );
      }
      return _resultsGrid(colorScheme);
    }

    if (_railsLoading && _rails.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    return RefreshIndicator(
      onRefresh: () => _loadRails(force: true),
      child: _storefront(),
    );
  }

  Widget _storefront() {
    final layout = context.watch<HomeLayoutController>();
    final sections = layout.mergeDiscover(_rails.map((r) => r.id));
    final railsById = {for (final rail in _rails) rail.id: rail};
    final slides = _heroSlides();
    final children = <Widget>[];
    for (final section in sections) {
      if (!section.enabled) continue;
      if (section.id == 'hero') {
        if (slides.isNotEmpty) {
          children.add(
            HeroCarousel(games: slides, autoplay: layout.heroAutoplay),
          );
        }
        continue;
      }
      final rail = railsById[section.id];
      if (rail == null || rail.games.isEmpty) continue;
      children.add(GameRailWidget(title: rail.title, games: rail.games));
    }
    if (children.isEmpty) {
      children.add(
        const Padding(
          padding: EdgeInsets.all(40),
          child: Center(child: Text('Catalog is unavailable. Try searching.')),
        ),
      );
    }
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.only(bottom: 32),
      children: children,
    );
  }

  Widget _resultsGrid(ColorScheme colorScheme) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = math.max(3, (constraints.maxWidth / 148).floor());
        return GridView.builder(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            childAspectRatio: 0.58,
            crossAxisSpacing: 10,
            mainAxisSpacing: 12,
          ),
          itemCount: _results.length,
          itemBuilder: (context, index) {
            final game = _results[index];
            final coverUrl = game.artUrl;
            return Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => openGame(context, game),
                borderRadius: BorderRadius.circular(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            coverUrl != null
                                ? CachedNetworkImage(
                                    imageUrl: coverUrl,
                                    fit: BoxFit.cover,
                                  )
                                : ColoredBox(
                                    color: colorScheme.surfaceContainerHighest,
                                    child: const Icon(Icons.videogame_asset_rounded),
                                  ),
                            if (game.metacritic != null)
                              RatingBadge(score: game.metacritic!),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
                      child: Text(
                        game.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _message(
    ColorScheme colorScheme, {
    required IconData icon,
    required String title,
    required String body,
    VoidCallback? action,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 8),
            Text(body, textAlign: TextAlign.center),
            if (action != null) ...[
              const SizedBox(height: 16),
              FilledButton(onPressed: action, child: const Text('Try again')),
            ],
          ],
        ),
      ),
    );
  }
}
