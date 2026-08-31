import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/types.dart';
import '../../services/api_client.dart';
import '../auth_ready_load.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key});

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> with AuthReadyLoad {
  List<GameEntry> _entries = [];
  bool _isLoading = true;
  bool _isAuthError = false;
  String _errorMessage = '';

  @override
  void onAuthReady(bool signedIn) {
    _fetchStats();
  }

  Future<void> _fetchStats() async {
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
            _errorMessage = 'Sign in to view your stats';
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        title: const Text(
          'Stats',
          style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: -0.5),
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
              'Computing statistics...',
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
                'Sign in to view your stats',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Sign in to view your gaming analytics, hours logged, and completion metrics.',
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
                'Couldn\'t load stats',
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
                onPressed: _fetchStats,
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
        onRefresh: _fetchStats,
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
                          Icons.bar_chart_rounded,
                          size: 52,
                          color: colorScheme.onSurfaceVariant.withOpacity(0.8),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'No stats available',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Add games to your library to see statistics and insights about your gaming habits.',
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

    final totalGames = _entries.length;
    final totalHours = _entries.fold<int>(0, (sum, e) => sum + (e.hours ?? 0));
    final beatenCount = _entries.where((e) => e.status == GameStatus.beaten).length;
    final completionRate = totalGames > 0
        ? ((beatenCount / totalGames) * 100).toStringAsFixed(1)
        : '0.0';

    final playingCount = _entries.where((e) => e.status == GameStatus.playing).length;
    final backlogCount = _entries.where((e) => e.status == GameStatus.backlog).length;
    final holdCount = _entries.where((e) => e.status == GameStatus.hold).length;
    final droppedCount = _entries.where((e) => e.status == GameStatus.dropped).length;
    final wishlistCount = _entries.where((e) => e.status == GameStatus.wishlist).length;

    final favoriteCount = _entries.where((e) => e.favorite).length;
    final scoredEntries = _entries.where((e) => e.score != null && e.score! > 0).toList();
    final avgScore = scoredEntries.isNotEmpty
        ? (scoredEntries.fold<int>(0, (sum, e) => sum + e.score!) / scoredEntries.length).toStringAsFixed(1)
        : null;

    final gamesWithHours = _entries.where((e) => e.hours != null && e.hours! > 0).length;
    final avgHours = gamesWithHours > 0
        ? (totalHours / gamesWithHours).toStringAsFixed(1)
        : '0';

    return RefreshIndicator(
      onRefresh: _fetchStats,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          // 2x2 Highlights Grid
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  title: 'Total Games',
                  value: totalGames.toString(),
                  icon: Icons.sports_esports_rounded,
                  iconColor: const Color(0xFF60A5FA),
                  colorScheme: colorScheme,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard(
                  title: 'Hours Played',
                  value: '${totalHours}h',
                  icon: Icons.schedule_rounded,
                  iconColor: const Color(0xFFFBBF24),
                  colorScheme: colorScheme,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  title: 'Games Beaten',
                  value: beatenCount.toString(),
                  icon: Icons.emoji_events_outlined,
                  iconColor: const Color(0xFF34D399),
                  colorScheme: colorScheme,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard(
                  title: 'Completion Rate',
                  value: '$completionRate%',
                  icon: Icons.pie_chart_outline_rounded,
                  iconColor: const Color(0xFFA78BFA),
                  colorScheme: colorScheme,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Status Breakdown Card
          _buildStatusBreakdownCard(
            totalGames: totalGames,
            statusCounts: {
              GameStatus.playing: playingCount,
              GameStatus.beaten: beatenCount,
              GameStatus.backlog: backlogCount,
              GameStatus.hold: holdCount,
              GameStatus.dropped: droppedCount,
              GameStatus.wishlist: wishlistCount,
            },
            colorScheme: colorScheme,
            theme: theme,
          ),
          const SizedBox(height: 20),

          // Additional Insights Card
          _buildInsightsCard(
            avgScore: avgScore,
            favoriteCount: favoriteCount,
            avgHours: avgHours,
            activeCount: playingCount + backlogCount,
            colorScheme: colorScheme,
            theme: theme,
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color iconColor,
    required ColorScheme colorScheme,
  }) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  title,
                  style: TextStyle(
                    color: colorScheme.onSurfaceVariant,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.1,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  size: 16,
                  color: iconColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBreakdownCard({
    required int totalGames,
    required Map<GameStatus, int> statusCounts,
    required ColorScheme colorScheme,
    required ThemeData theme,
  }) {
    return Container(
      padding: const EdgeInsets.all(20.0),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Status Breakdown',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 17,
                ),
              ),
              Text(
                '$totalGames ${totalGames == 1 ? 'game' : 'games'} total',
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Multi-segmented continuous horizontal bar
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              height: 12,
              child: totalGames > 0
                  ? Row(
                      children: GameStatus.values.map((status) {
                        final count = statusCounts[status] ?? 0;
                        if (count == 0) return const SizedBox.shrink();
                        return Expanded(
                          flex: count,
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 0.5),
                            color: _getStatusColor(status),
                          ),
                        );
                      }).toList(),
                    )
                  : Container(
                      color: colorScheme.surfaceContainerHighest,
                    ),
            ),
          ),
          const SizedBox(height: 20),

          // Individual status list
          ...GameStatus.values.map((status) {
            final count = statusCounts[status] ?? 0;
            final percentage = totalGames > 0 ? (count / totalGames) : 0.0;
            final percentageString = (percentage * 100).toStringAsFixed(0);
            final statusColor = _getStatusColor(status);
            final statusLabel = _getStatusLabel(status);

            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6.0),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        statusLabel,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '$count',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '($percentageString%)',
                        style: TextStyle(
                          fontSize: 12,
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: percentage,
                      minHeight: 6,
                      backgroundColor: colorScheme.surfaceContainerHighest,
                      valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildInsightsCard({
    required String? avgScore,
    required int favoriteCount,
    required String avgHours,
    required int activeCount,
    required ColorScheme colorScheme,
    required ThemeData theme,
  }) {
    return Container(
      padding: const EdgeInsets.all(20.0),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.insights_rounded,
                size: 20,
                color: colorScheme.primary,
              ),
              const SizedBox(width: 8),
              Text(
                'Activity Highlights',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 17,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildMiniInsightTile(
                  label: 'Active Queue',
                  value: '$activeCount',
                  caption: 'Playing & Backlog',
                  colorScheme: colorScheme,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMiniInsightTile(
                  label: 'Avg Tracked Time',
                  value: '${avgHours}h',
                  caption: 'Per game with logs',
                  colorScheme: colorScheme,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildMiniInsightTile(
                  label: 'Favorites',
                  value: '$favoriteCount',
                  caption: 'Starred titles',
                  colorScheme: colorScheme,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMiniInsightTile(
                  label: 'Avg Score',
                  value: avgScore != null ? '$avgScore/10' : 'N/A',
                  caption: 'User ratings',
                  colorScheme: colorScheme,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniInsightTile({
    required String label,
    required String value,
    required String caption,
    required ColorScheme colorScheme,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh.withOpacity(0.5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            caption,
            style: TextStyle(
              fontSize: 10.5,
              color: colorScheme.onSurfaceVariant.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }
}
