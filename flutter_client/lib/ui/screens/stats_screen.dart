import 'package:cached_network_image/cached_network_image.dart';
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
      final result = await Future.wait([
        client.getLibrary(),
        client.getActivity(month: _monthKey),
      ]);

      if (!mounted) return;

      setState(() {
        _entries = result[0] as List<GameEntry>;
        _activity = result[1] as Map<String, dynamic>;
        _isLoading = false;
        _selectedDate ??= _initialSelectedDate();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isAuthError = e.status == 401;
        _errorMessage =
            e.status == 401 ? 'Sign in to view your stats' : e.message;
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

  List<Map<String, dynamic>> _rows(String key) {
    final raw = _activity[key];
    if (raw is! List) return const [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  List<Map<String, dynamic>> get _games => _rows('games');
  List<Map<String, dynamic>> get _daily => _rows('daily');

  String _duration(num value) {
    final seconds = value.toInt();
    if (seconds < 60) return '${seconds}s';
    final minutes = seconds ~/ 60;
    if (minutes < 60) return '${minutes}m';
    final hours = minutes ~/ 60;
    final remainder = minutes % 60;
    return remainder == 0 ? '${hours}h' : '${hours}h ${remainder}m';
  }

  String? _cover(Map<String, dynamic> row) =>
      row['coverUrl'] as String? ?? row['cover_url'] as String?;

  String? _catalogId(Map<String, dynamic> row) =>
      row['catalogId'] as String? ?? row['catalog_id'] as String?;

  void _openGame(Map<String, dynamic> row) {
    final id = _catalogId(row);
    if (id != null && id.isNotEmpty) {
      context.push('/game/$id');
      return;
    }
    final title = row['titleName'] as String? ?? '';
    context.push('/discover?q=${Uri.encodeComponent(title)}');
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
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
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
            SizedBox(height: 14),
            Text('Building your play history…'),
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
              const SizedBox(height: 18),
              Text(
                'Sign in to view your stats',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your library, PlayStation timeline and activity calendar live here.',
                textAlign: TextAlign.center,
                style: TextStyle(color: colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 22),
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
              const SizedBox(height: 18),
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
              const SizedBox(height: 18),
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
          _buildMostPlayed(theme, colorScheme),
          const SizedBox(height: 16),
          _buildCalendar(theme, colorScheme),
          const SizedBox(height: 16),
          _buildDayDetail(theme, colorScheme),
          const SizedBox(height: 16),
          _buildLibraryOverview(theme, colorScheme),
        ],
      ),
    );
  }

  Widget _buildHero(ThemeData theme, ColorScheme colorScheme) {
    final seconds = (_totals['seconds'] as num?)?.toInt() ?? 0;
    final games = (_totals['games'] as num?)?.toInt() ?? 0;
    final sessions = (_totals['sessions'] as num?)?.toInt() ?? 0;
    final days = (_totals['days'] as num?)?.toInt() ?? 0;
    final top = _games.isNotEmpty ? _games.first : null;
    final headerUrl = top?['headerUrl'] as String?;

    return ClipRRect(
      borderRadius: BorderRadius.circular(30),
      child: Container(
        constraints: const BoxConstraints(minHeight: 220),
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainerHigh,
        ),
        child: Stack(
          children: [
            if (headerUrl != null)
              Positioned.fill(
                child: CachedNetworkImage(
                  imageUrl: headerUrl,
                  fit: BoxFit.cover,
                  color: Colors.black.withOpacity(0.35),
                  colorBlendMode: BlendMode.darken,
                ),
              ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      colorScheme.surfaceContainerHigh.withOpacity(0.65),
                      colorScheme.surfaceContainerHigh.withOpacity(0.94),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.history_rounded,
                        color: colorScheme.primary,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'PLAY HISTORY',
                        style: theme.textTheme.labelMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.5,
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 9),
                  Text(
                    _duration(seconds),
                    style: theme.textTheme.displaySmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1.5,
                      color: colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Actual PlayStation session time',
                    style: TextStyle(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      _metric('Games', '$games', colorScheme),
                      _metric('Sessions', '$sessions', colorScheme),
                      _metric('Days', '$days', colorScheme),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _metric(
    String label,
    String value,
    ColorScheme colorScheme,
  ) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 7),
        padding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 11,
        ),
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainerHighest.withOpacity(0.75),
          borderRadius: BorderRadius.circular(17),
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
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMostPlayed(
    ThemeData theme,
    ColorScheme colorScheme,
  ) {
    final games = _games.take(8).toList();
    final totalSeconds = (_totals['seconds'] as num?)?.toInt() ?? 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Most played',
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          'Tap a game to open its SaveState entry',
          style: TextStyle(
            fontSize: 12,
            color: colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 12),
        if (games.isEmpty)
          _surface(
            colorScheme,
            child: const Padding(
              padding: EdgeInsets.all(10),
              child: Text(
                'Your imported games will appear here.',
              ),
            ),
          )
        else
          SizedBox(
            height: 205,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: games.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final game = games[index];
                final cover = _cover(game);
                final seconds = (game['seconds'] as num?)?.toInt() ?? 0;
                final share = totalSeconds == 0
                    ? 0.0
                    : (seconds / totalSeconds).clamp(0.08, 1.0);

                return SizedBox(
                  width: 150,
                  child: InkWell(
                    onTap: () => _openGame(game),
                    borderRadius: BorderRadius.circular(20),
                    child: Ink(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        color: colorScheme.surfaceContainerHigh,
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            if (cover != null)
                              CachedNetworkImage(
                                imageUrl: cover,
                                fit: BoxFit.cover,
                              )
                            else
                              Container(
                                color: colorScheme.surfaceContainerHighest,
                              ),
                            DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.transparent,
                                    Colors.black.withOpacity(0.92),
                                  ],
                                ),
                              ),
                            ),
                            Positioned(
                              left: 10,
                              top: 10,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.45),
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                child: Text(
                                  '#${index + 1}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              left: 11,
                              right: 11,
                              bottom: 11,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    game['titleName'] as String? ??
                                        'Unknown game',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _duration(seconds),
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 11,
                                    ),
                                  ),
                                  const SizedBox(height: 7),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(99),
                                    child: LinearProgressIndicator(
                                      minHeight: 4,
                                      value: share,
                                      backgroundColor: Colors.white24,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  Widget _buildCalendar(
    ThemeData theme,
    ColorScheme colorScheme,
  ) {
    final byDay = _byDay;
    final maxSeconds = byDay.values
        .map(
          (rows) => rows.fold<int>(
            0,
            (sum, row) => sum + ((row['seconds'] as num?)?.toInt() ?? 0),
          ),
        )
        .fold<int>(0, (a, b) => a > b ? a : b);

    final first = DateTime(_month.year, _month.month, 1);
    final leading = first.weekday - 1;
    final totalDays = DateTime(
      _month.year,
      _month.month + 1,
      0,
    ).day;

    return _surface(
      colorScheme,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Activity calendar',
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Tap a day to see exactly what you played',
                      style: TextStyle(
                        fontSize: 12,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton.filledTonal(
                onPressed: () => _shiftMonth(-1),
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              const SizedBox(width: 4),
              IconButton.filledTonal(
                onPressed: () => _shiftMonth(1),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              DateFormat('MMMM yyyy').format(_month),
              style: const TextStyle(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
                .map(
                  (day) => Expanded(
                    child: Center(
                      child: Text(
                        day,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
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
            gridDelegate:
                const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
              childAspectRatio: 0.92,
            ),
            itemBuilder: (context, index) {
              if (index < leading) return const SizedBox.shrink();

              final day = index - leading + 1;
              final date = DateTime(
                _month.year,
                _month.month,
                day,
              );
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
              final cover = rows.isNotEmpty ? _cover(rows.first) : null;

              return InkWell(
                onTap: () => setState(() => _selectedDate = key),
                borderRadius: BorderRadius.circular(15),
                child: Ink(
                  decoration: BoxDecoration(
                    color: selected
                        ? colorScheme.primaryContainer
                        : colorScheme.surfaceContainer,
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(
                      color: selected
                          ? colorScheme.primary
                          : colorScheme.outlineVariant.withOpacity(0.18),
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(15),
                    child: Stack(
                      children: [
                        if (cover != null)
                          Positioned.fill(
                            child: CachedNetworkImage(
                              imageUrl: cover,
                              fit: BoxFit.cover,
                              color: colorScheme.surface.withOpacity(
                                0.72 - ratio * 0.3,
                              ),
                              colorBlendMode: BlendMode.srcOver,
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.all(8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$day',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: selected
                                      ? colorScheme.onPrimaryContainer
                                      : colorScheme.onSurface,
                                ),
                              ),
                              const Spacer(),
                              if (seconds > 0)
                                Text(
                                  _duration(seconds),
                                  maxLines: 1,
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: selected
                                        ? colorScheme.onPrimaryContainer
                                        : colorScheme.onSurfaceVariant,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (seconds > 0)
                          Positioned(
                            left: 8,
                            right: 8,
                            bottom: 5,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(99),
                              child: LinearProgressIndicator(
                                minHeight: 3,
                                value: ratio,
                                backgroundColor:
                                    colorScheme.surfaceContainerHighest,
                                color: colorScheme.primary,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildDayDetail(
    ThemeData theme,
    ColorScheme colorScheme,
  ) {
    final date = _selectedDate;
    final rows = date == null
        ? const <Map<String, dynamic>>[]
        : (_byDay[date] ?? const <Map<String, dynamic>>[]);
    final total = rows.fold<int>(
      0,
      (sum, row) => sum + ((row['seconds'] as num?)?.toInt() ?? 0),
    );

    return _surface(
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
          const SizedBox(height: 3),
          Text(
            rows.isEmpty
                ? 'No tracked play'
                : '${_duration(total)} across ${rows.length} game${rows.length == 1 ? '' : 's'}',
            style: TextStyle(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 15),
          ...rows.map(
            (row) {
              final cover = _cover(row);
              final seconds = (row['seconds'] as num?)?.toInt() ?? 0;
              final sessions = (row['sessions'] as num?)?.toInt() ?? 0;

              return Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: InkWell(
                  onTap: () => _openGame(row),
                  borderRadius: BorderRadius.circular(18),
                  child: Ink(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: colorScheme.surfaceContainer,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(13),
                          child: SizedBox(
                            width: 52,
                            height: 52,
                            child: cover != null
                                ? CachedNetworkImage(
                                    imageUrl: cover,
                                    fit: BoxFit.cover,
                                  )
                                : ColoredBox(
                                    color: colorScheme.primaryContainer,
                                    child: Icon(
                                      Icons.sports_esports_rounded,
                                      color: colorScheme.onPrimaryContainer,
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(width: 11),
                        Expanded(
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              Text(
                                row['titleName'] as String? ??
                                    'Unknown game',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '$sessions session${sessions == 1 ? '' : 's'}',
                                style: TextStyle(
                                  fontSize: 11,
                                  color:
                                      colorScheme.onSurfaceVariant,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Open game',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: colorScheme.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          _duration(seconds),
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          if (rows.isEmpty)
            Container(
              margin: const EdgeInsets.only(top: 5),
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
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Select a date with activity to see its games.',
                      style: TextStyle(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildLibraryOverview(
    ThemeData theme,
    ColorScheme colorScheme,
  ) {
    final beaten =
        _entries.where((e) => e.status == GameStatus.beaten).length;
    final scored =
        _entries.where((e) => e.score != null).toList();
    final avgScore = scored.isEmpty
        ? '—'
        : (scored.fold<int>(
                  0,
                  (sum, e) => sum + (e.score ?? 0),
                ) /
                scored.length)
            .toStringAsFixed(1);

    return _surface(
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
              _summary('Games', '${_entries.length}', colorScheme),
              _summary('Beaten', '$beaten', colorScheme),
              _summary('Avg. score', avgScore, colorScheme),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'PS5 activity is the source of truth for actual playtime. '
            'Manual hour estimates are no longer used for these stats.',
            style: TextStyle(
              fontSize: 12,
              height: 1.4,
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _summary(
    String label,
    String value,
    ColorScheme colorScheme,
  ) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 7),
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
                fontSize: 10,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _surface(
    ColorScheme colorScheme, {
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.16),
        ),
      ),
      child: child,
    );
  }

  Widget _circleIcon(
    IconData icon,
    ColorScheme colorScheme,
  ) {
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
