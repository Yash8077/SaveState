import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../models/types.dart';
import '../../services/api_client.dart';
import '../open_game.dart';
import '../widgets/game_card.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<GameEntry> _entries = [];
  bool _isLoading = true;
  bool _isAuthError = false;
  String _errorMessage = '';
  GameStatus? _selectedStatus; // null means 'All'

  @override
  void initState() {
    super.initState();
    _fetchLibrary();
  }

  Future<void> _fetchLibrary() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _isAuthError = false;
    });

    try {
      final entries = await context.read<ApiClient>().getLibrary();
      if (mounted) {
        setState(() {
          _entries = entries;
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        if (e.status == 401) {
          setState(() {
            _isAuthError = true;
            _errorMessage = 'Sign in to sync your library';
            _isLoading = false;
          });
        } else {
          setState(() {
            _isAuthError = false;
            _errorMessage = e.message;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isAuthError = false;
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Color _getStatusColor(GameStatus status) {
    switch (status) {
      case GameStatus.playing:
        return const Color(0xFF10B981); // Emerald Green
      case GameStatus.beaten:
        return const Color(0xFF3B82F6); // Royal Blue
      case GameStatus.backlog:
        return const Color(0xFFF59E0B); // Amber
      case GameStatus.hold:
        return const Color(0xFFA855F7); // Purple
      case GameStatus.dropped:
        return const Color(0xFFEF4444); // Red
      case GameStatus.wishlist:
        return const Color(0xFFEC4899); // Pink
    }
  }

  String _getStatusLabel(GameStatus status) {
    switch (status) {
      case GameStatus.playing:
        return 'Playing';
      case GameStatus.beaten:
        return 'Beaten';
      case GameStatus.backlog:
        return 'Backlog';
      case GameStatus.hold:
        return 'On Hold';
      case GameStatus.dropped:
        return 'Dropped';
      case GameStatus.wishlist:
        return 'Wishlist';
    }
  }

  List<GameEntry> get _filteredEntries {
    if (_selectedStatus == null) return _entries;
    return _entries.where((entry) => entry.status == _selectedStatus).toList();
  }

  int _countForStatus(GameStatus? status) {
    if (status == null) return _entries.length;
    return _entries.where((e) => e.status == status).length;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        title: Row(
          children: [
            const Text(
              'Library',
              style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: -0.5),
            ),
            if (!_isLoading && _errorMessage.isEmpty && _entries.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_entries.length}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(theme, colorScheme),
    );
  }

  Widget _buildBody(ThemeData theme, ColorScheme colorScheme) {
    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(
              strokeWidth: 3,
              color: colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              'Loading library...',
              style: TextStyle(
                color: colorScheme.onSurfaceVariant,
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }

    if (_isAuthError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: colorScheme.surfaceContainerHigh,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.lock_outline_rounded,
                  size: 48,
                  color: colorScheme.primary,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Sign in to sync your library',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Sign in to sync your game library and track your progress across devices.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => context.push('/login'),
                icon: const Icon(Icons.login_rounded, size: 18),
                label: const Text('Sign In'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_errorMessage.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: colorScheme.errorContainer.withOpacity(0.4),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.cloud_off_rounded,
                  size: 48,
                  color: colorScheme.error,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Couldn\'t load library',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _errorMessage,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              FilledButton.tonalIcon(
                onPressed: _fetchLibrary,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Try Again'),
              ),
            ],
          ),
        ),
      );
    }

    if (_entries.isEmpty) {
      return RefreshIndicator(
        onRefresh: _fetchLibrary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.65,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: colorScheme.surfaceContainerHigh,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.sports_esports_outlined,
                          size: 52,
                          color: colorScheme.onSurfaceVariant.withOpacity(0.8),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'Your library is empty',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Search for games to add them.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final filtered = _filteredEntries;

    return RefreshIndicator(
      onRefresh: _fetchLibrary,
      child: Column(
        children: [
          _buildFilterChips(colorScheme),
          Expanded(
            child: filtered.isEmpty
                ? _buildEmptyFilteredState(theme, colorScheme)
                : _buildGameGrid(filtered, colorScheme),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips(ColorScheme colorScheme) {
    final filters = <Map<String, dynamic>>[
      {'status': null, 'label': 'All'},
      {'status': GameStatus.playing, 'label': 'Playing'},
      {'status': GameStatus.beaten, 'label': 'Beaten'},
      {'status': GameStatus.backlog, 'label': 'Backlog'},
      {'status': GameStatus.hold, 'label': 'On Hold'},
      {'status': GameStatus.dropped, 'label': 'Dropped'},
      {'status': GameStatus.wishlist, 'label': 'Wishlist'},
    ];

    return Container(
      height: 48,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: filters.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final filter = filters[index];
          final GameStatus? status = filter['status'] as GameStatus?;
          final String label = filter['label'] as String;
          final bool isSelected = _selectedStatus == status;
          final int count = _countForStatus(status);
          final Color statusColor = status != null
              ? _getStatusColor(status)
              : colorScheme.primary;

          return FilterChip(
            selected: isSelected,
            showCheckmark: false,
            labelPadding: const EdgeInsets.symmetric(horizontal: 4),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            avatar: status != null
                ? Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                    ),
                  )
                : null,
            label: Text(
              '$label ($count)',
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                color: isSelected
                    ? colorScheme.onSecondaryContainer
                    : colorScheme.onSurfaceVariant,
              ),
            ),
            backgroundColor: colorScheme.surfaceContainerHigh.withOpacity(0.6),
            selectedColor: colorScheme.secondaryContainer,
            side: BorderSide(
              color: isSelected
                  ? colorScheme.primary.withOpacity(0.4)
                  : colorScheme.outlineVariant.withOpacity(0.2),
              width: 1,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            onSelected: (_) {
              setState(() {
                _selectedStatus = status;
              });
            },
          );
        },
      ),
    );
  }

  Widget _buildEmptyFilteredState(ThemeData theme, ColorScheme colorScheme) {
    final statusName = _selectedStatus != null
        ? _getStatusLabel(_selectedStatus!)
        : 'selected';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHigh,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.filter_list_off_rounded,
                size: 40,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No $statusName games',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'You have no games marked as $statusName.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGameGrid(List<GameEntry> entries, ColorScheme colorScheme) {
    return GridView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.60,
        crossAxisSpacing: 12,
        mainAxisSpacing: 14,
      ),
      itemCount: entries.length,
      itemBuilder: (context, index) {
        final entry = entries[index];
        final statusColor = _getStatusColor(entry.status);
        final statusLabel = _getStatusLabel(entry.status);
        final formattedCoverUrl = entry.coverUrl != null
            ? (normalizeArtUrl(entry.coverUrl) ?? '')
            : (normalizeArtUrl(entry.headerUrl) ?? '');

        return Card(
          margin: EdgeInsets.zero,
          elevation: 0,
          color: colorScheme.surfaceContainer,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: colorScheme.outlineVariant.withOpacity(0.2),
              width: 1,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => openGameId(
              context,
              entry.catalogId,
              title: entry.title,
              coverUrl: entry.coverUrl,
              headerUrl: entry.headerUrl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      formattedCoverUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: formattedCoverUrl,
                              fit: BoxFit.cover,
                              placeholder: (context, url) => Container(
                                color: colorScheme.surfaceContainerHighest,
                                child: Center(
                                  child: SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: colorScheme.primary.withOpacity(0.6),
                                    ),
                                  ),
                                ),
                              ),
                              errorWidget: (context, url, error) => Container(
                                color: colorScheme.surfaceContainerHighest,
                                child: Center(
                                  child: Icon(
                                    Icons.videogame_asset_outlined,
                                    size: 36,
                                    color: colorScheme.onSurfaceVariant.withOpacity(0.4),
                                  ),
                                ),
                              ),
                            )
                          : Container(
                              color: colorScheme.surfaceContainerHighest,
                              child: Center(
                                child: Icon(
                                  Icons.videogame_asset_outlined,
                                  size: 36,
                                  color: colorScheme.onSurfaceVariant.withOpacity(0.4),
                                ),
                              ),
                            ),
                      // Top gradient for badge contrast
                      Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 48,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.black.withOpacity(0.5),
                                Colors.transparent,
                              ],
                            ),
                          ),
                        ),
                      ),
                      // Status badge
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xE60F172A), // Dark translucent
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: statusColor.withOpacity(0.6),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: statusColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                statusLabel,
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      // Favorite indicator if favorited
                      if (entry.favorite)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: const Color(0xE60F172A),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.pinkAccent.withOpacity(0.6),
                                width: 1,
                              ),
                            ),
                            child: const Icon(
                              Icons.favorite_rounded,
                              size: 12,
                              color: Colors.pinkAccent,
                            ),
                          ),
                        ),
                      if (entry.metacritic != null)
                        RatingBadge(score: entry.metacritic!),
                      // Score pill if present
                      if (entry.score != null && entry.score! > 0)
                        Positioned(
                          bottom: 8,
                          left: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xE60F172A),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: Colors.amber.withOpacity(0.5),
                                width: 1,
                              ),
                            ),
                            child: Text(
                              '★ ${entry.score}',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.amber,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        entry.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          if (entry.hours != null && entry.hours! > 0) ...[
                            Icon(
                              Icons.schedule_rounded,
                              size: 12,
                              color: colorScheme.onSurfaceVariant,
                            ),
                            const SizedBox(width: 3),
                            Text(
                              '${entry.hours}h',
                              style: TextStyle(
                                fontSize: 11,
                                color: colorScheme.onSurfaceVariant,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ] else ...[
                            Text(
                              statusLabel,
                              style: TextStyle(
                                fontSize: 11,
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
