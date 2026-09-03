import 'package:expressive_refresh/expressive_refresh.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/types.dart';
import '../../services/api_client.dart';
import '../auth_ready_load.dart';
import '../widgets/m3_progress.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key});

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> with AuthReadyLoad {
  List<GameEntry> _entries = [];
  Map<String, dynamic> _activity = const {};
  bool _isLoading = true;
  bool _isAuthError = false;
  String _errorMessage = '';
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  String? _selectedDate;

  @override
  void onAuthReady(bool signedIn) {
    _fetchStats();
  }

  String get _monthKey =>
      '${_month.year}-${_month.month.toString().padLeft(2, '0')}';

  Future<void> _fetchStats() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _isAuthError = false;
    });

    try {
      final client = context.read<ApiClient>();
      final results = await Future.wait([
        client.getLibrary(),
        client.getActivity(month: _monthKey),
      ]);
      if (!mounted) return;
      setState(() {
        _entries = results[0] as List<GameEntry>;
        _activity = results[1] as Map<String, dynamic>;
        _isLoading = false;
        _selectedDate ??= _initialSelectedDate();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isAuthError = e.status == 401;
        _errorMessage = e.status == 401
            ? 'Sign in to view your stats'
            : e.message;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  String? _initialSelectedDate() {
    final today = DateTime.now();
    if (today.year == _month.year && today.month == _month.month) {
      return DateFormat('yyyy-MM-dd').format(today);
    }
    return DateFormat('yyyy-MM-dd').format(
      DateTime(_month.year, _month.month, 1),
    );
  }

  void _shiftMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
      _selectedDate = null;
    });
    _fetchStats();
  }

  Map<String, dynamic> get _totals {
    final raw = _activity['totals'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return const {};
  }

  List<Map<String, dynamic>> get _daily {
    final raw = _activity['daily'];
    if (raw is! List) return const [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  List<Map<String, dynamic>> get _games {
    final raw = _activity['games'];
    if (raw is! List) return const [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  String _duration(num seconds) {
    final value = seconds.toInt();
    if (value < 60) return '${value}s';
    final minutes = value ~/ 60;
    if (minutes < 60) return '${minutes}m';
    final hours = minutes ~/ 60;
    final remainder = minutes % 60;
    return remainder == 0 ? '${hours}h' : '${hours}h ${remainder}m';
  }

  Map<String, List<Map<String, dynamic>>> get _byDay {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final row in _daily) {
      final date = row['date'] as String? ?? '';
      (map[date] ??= []).add(row);
    }
    return map;
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
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            M3Loading(),
            SizedBox(height: 16),
            Text('Computing your play history…'),
          ],
        ),
      );
    }

    if (_isAuthError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _circleIcon(Icons.lock_outline_rounded, colorScheme),
              const SizedBox(height: 20),
              Text(
                'Sign in to view your stats',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your PS5 timeline, library insights, and activity calendar live here.',
                textAlign: TextAlign.center,
                style: TextStyle(color: colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => context.push('/login'),
                icon: const Icon(Icons.login_rounded),
                label: const Text('Sign In'),
              ),
            ],
          ),
        ),
      );
    }

    if (_errorMessage.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _circleIcon(Icons.cloud_off_rounded, colorScheme),
              const SizedBox(height: 20),
              Text(
                'Couldn’t load stats',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _errorMessage,
                textAlign: TextAlign.center,
                style: TextStyle(color: colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 20),
              FilledButton.tonalIcon(
                onPressed: _fetchStats,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try Again'),
              ),
            ],
          ),
        ),
      );
    }

    return ExpressiveRefreshIndicator(
      onRefresh: _fetchStats,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _buildHero(theme, colorScheme),
          const SizedBox(height: 16),
          _buildCalendar(theme, colorScheme),
          const SizedBox(height: 16),
          _buildDayDetail(theme, colorScheme),
          const SizedBox(height: 16),
          _buildMostPlayed(theme, colorScheme),
          const SizedBox(height: 16),
          _buildLibrarySummary(theme, colorScheme),
        ],
      ),
    );
  }

  Widget _buildHero(ThemeData theme, ColorScheme colorScheme) {
    final seconds = (_totals['seconds'] as num?)?.toInt() ?? 0;
    final games = (_totals['games'] as num?)?.toInt() ?? 0;
    final sessions = (_totals['sessions'] as num?)?.toInt() ?? 0;
    final days = (_totals['days'] as num?)?.toInt() ?? 0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.sports_esports_rounded, color: colorScheme.primary),
              const SizedBox(width: 8),
              Text(
                'PLAY HISTORY',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _duration(seconds),
            style: theme.textTheme.displaySmall?.copyWith(
              fontWeight: FontWeight.bold,
              letterSpacing: -1.4,
              color: colorScheme.primary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Playtime from your actual PlayStation sessions',
            style: TextStyle(color: colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroMetric('Games', '$games', colorScheme),
              _heroMetric('Sessions', '$sessions', colorScheme),
              _heroMetric('Days', '$days', colorScheme),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroMetric(String label, String value, ColorScheme colorScheme) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainer,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 17,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCalendar(ThemeData theme, ColorScheme colorScheme) {
    final byDay = _byDay;
    final maxSeconds = byDay.values
        .map((rows) => rows.fold<int>(
              0,
              (sum, row) => sum + ((row['seconds'] as num?)?.toInt() ?? 0),
            ))
        .fold<int>(0, (a, b) => a > b ? a : b);

    final first = DateTime(_month.year, _month.month, 1);
    final leading = (first.weekday - 1);
    final totalDays = DateTime(_month.year, _month.month + 1, 0).day;

    return _surfaceCard(
      colorScheme,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  DateFormat('MMMM yyyy').format(_month),
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              IconButton.filledTonal(
                onPressed: () => _shiftMonth(-1),
                icon: const Icon(Icons.chevron_left_rounded),
                tooltip: 'Previous month',
              ),
              const SizedBox(width: 6),
              IconButton.filledTonal(
                onPressed: () => _shiftMonth(1),
                icon: const Icon(Icons.chevron_right_rounded),
                tooltip: 'Next month',
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
                .map(
                  (day) => Expanded(
                    child: Center(
                      child: Text(
                        day,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 8),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: leading + totalDays,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
              childAspectRatio: 0.9,
            ),
            itemBuilder: (context, index) {
              if (index < leading) return const SizedBox.shrink();

              final day = index - leading + 1;
              final date = DateTime(_month.year, _month.month, day);
              final key = DateFormat('yyyy-MM-dd').format(date);
              final rows = byDay[key] ?? const [];
              final seconds = rows.fold<int>(
                0,
                (sum, row) => sum + ((row['seconds'] as num?)?.toInt() ?? 0),
              );
              final ratio = maxSeconds == 0
                  ? 0.0
                  : (seconds / maxSeconds).clamp(0.0, 1.0);
              final selected = _selectedDate == key;

              return InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => setState(() => _selectedDate = key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: selected
                        ? colorScheme.primaryContainer
                        : colorScheme.surfaceContainer,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected
                          ? colorScheme.primary
                          : colorScheme.outlineVariant.withOpacity(0.2),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$day',
                        style: TextStyle(
                          fontWeight:
                              selected ? FontWeight.w800 : FontWeight.w600,
                          color: selected
                              ? colorScheme.onPrimaryContainer
                              : colorScheme.onSurface,
                        ),
                      ),
                      const Spacer(),
                      if (seconds > 0) ...[
                        Text(
                          _duration(seconds),
                          maxLines: 1,
                          overflow: TextOverflow.clip,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: selected
                                ? colorScheme.onPrimaryContainer
                                : colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 5),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            minHeight: 4,
                            value: ratio == 0 ? null : ratio,
                            backgroundColor:
                                colorScheme.surfaceContainerHighest,
                            color: colorScheme.primary,
                          ),
                        ),
                      ] else
                        Container(
                          height: 4,
                          decoration: BoxDecoration(
                            color: colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildDayDetail(ThemeData theme, ColorScheme colorScheme) {
    final date = _selectedDate;
    final rows = date == null ? const [] : (_byDay[date] ?? const []);
    final total = rows.fold<int>(
      0,
      (sum, row) => sum + ((row['seconds'] as num?)?.toInt() ?? 0),
    );

    return _surfaceCard(
      colorScheme,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            date == null
                ? 'Select a day'
                : DateFormat(
                    'EEEE, MMM d',
                  ).format(DateTime.parse('${date}T12:00:00')),
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            rows.isEmpty
                ? 'No tracked play on this day'
                : '${_duration(total)} across ${rows.length} game${rows.length == 1 ? '' : 's'}',
            style: TextStyle(color: colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          if (rows.isEmpty)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainer,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.nightlight_outlined,
                    color: colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Pick another date to see the exact games and time recorded.',
                      style: TextStyle(color: colorScheme.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
            )
          else
            ...rows.map((row) {
              final seconds = (row['seconds'] as num?)?.toInt() ?? 0;
              final sessions = (row['sessions'] as num?)?.toInt() ?? 0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colorScheme.surfaceContainer,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: colorScheme.primaryContainer,
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: Icon(
                          Icons.sports_esports_rounded,
                          color: colorScheme.onPrimaryContainer,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              row['titleName'] as String? ??
                                  row['titleId'] as String? ??
                                  'Unknown game',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '$sessions session${sessions == 1 ? '' : 's'}',
                              style: TextStyle(
                                fontSize: 12,
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        _duration(seconds),
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildMostPlayed(ThemeData theme, ColorScheme colorScheme) {
    final games = _games.take(6).toList();
    final totalSeconds = (_totals['seconds'] as num?)?.toInt() ?? 0;

    return _surfaceCard(
      colorScheme,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Most played',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 14),
          if (games.isEmpty)
            Text(
              'Your most played games will appear here after the next activity import.',
              style: TextStyle(color: colorScheme.onSurfaceVariant),
            )
          else
            ...games.map((game) {
              final seconds = (game['seconds'] as num?)?.toInt() ?? 0;
              final ratio = totalSeconds == 0
                  ? 0.0
                  : (seconds / totalSeconds).clamp(0.0, 1.0);
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            game['titleName'] as String? ?? 'Unknown game',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          _duration(seconds),
                          style: TextStyle(
                            color: colorScheme.onSurfaceVariant,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 7),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        minHeight: 6,
                        value: ratio,
                        backgroundColor: colorScheme.surfaceContainerHighest,
                        color: colorScheme.primary,
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

  Widget _buildLibrarySummary(ThemeData theme, ColorScheme colorScheme) {
    final totalGames = _entries.length;
    final beaten = _entries.where((e) => e.status == GameStatus.beaten).length;
    final scored = _entries.where((e) => e.score != null).toList();
    final avgScore = scored.isEmpty
        ? '—'
        : (scored.fold<int>(0, (sum, e) => sum + (e.score ?? 0)) /
                scored.length)
            .toStringAsFixed(1);

    return _surfaceCard(
      colorScheme,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Library overview',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _summaryItem('Games', '$totalGames', colorScheme),
              _summaryItem('Beaten', '$beaten', colorScheme),
              _summaryItem('Avg. score', avgScore, colorScheme),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Manual game-hour estimates are no longer used on this screen. PS5 activity is the source for actual playtime.',
            style: TextStyle(
              fontSize: 12,
              height: 1.35,
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryItem(
    String label,
    String value,
    ColorScheme colorScheme,
  ) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainer,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 17,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _surfaceCard(
    ColorScheme colorScheme, {
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.18),
        ),
      ),
      child: child,
    );
  }

  Widget _circleIcon(IconData icon, ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh,
        shape: BoxShape.circle,
      ),
      child: Icon(
        icon,
        size: 42,
        color: colorScheme.primary,
      ),
    );
  }
}
