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
  Map<String, dynamic> _allTimeActivity = const {};
  Map<String, dynamic> _monthActivity = const {};

  bool _isLoading = true;
  bool _isMonthLoading = false;
  bool _isAuthError = false;
  String _errorMessage = '';

  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  String? _selectedDate;

  String get _monthKey =>
      '${_month.year}-${_month.month.toString().padLeft(2, '0')}';

  @override
  void onAuthReady(bool signedIn) {
    if (signedIn) {
      _fetchInitial();
      return;
    }

    // AuthReadyLoad waits until AuthController has restored the session.
    // If the restored state is signed out, do not leave the screen in the
    // initial loading state indefinitely.
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _isAuthError = true;
      _errorMessage = '';
    });
  }

  Future<void> _fetchInitial() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _isAuthError = false;
    });

    try {
      final client = context.read<ApiClient>();
      final results = await Future.wait([
        client.getLibrary(force: true),
        client.getActivity(force: true),
        client.getActivity(force: true, month: _monthKey),
      ]);

      if (!mounted) return;

      setState(() {
        _entries = results[0] as List<GameEntry>;
        _allTimeActivity = results[1] as Map<String, dynamic>;
        _monthActivity = results[2] as Map<String, dynamic>;
        _selectedDate = _initialSelectedDate();
        _isLoading = false;
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

  Future<void> _fetchMonth() async {
    setState(() {
      _isMonthLoading = true;
    });

    try {
      final client = context.read<ApiClient>();
      final activity = await client.getActivity(
        force: true,
        month: _monthKey,
      );

      if (!mounted) return;

      setState(() {
        _monthActivity = activity;
        _selectedDate = _initialSelectedDate();
        _isMonthLoading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _isMonthLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _isMonthLoading = false;
      });
    }
  }

  String _initialSelectedDate() {
    final today = DateTime.now();
    if (today.year == _month.year && today.month == _month.month) {
      return DateFormat('yyyy-MM-dd').format(today);
    }

    final monthRows = _dailyRows;
    if (monthRows.isNotEmpty) {
      return monthRows.first['date']?.toString() ??
          DateFormat('yyyy-MM-dd').format(
            DateTime(_month.year, _month.month, 1),
          );
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
    _fetchMonth();
  }

  Map<String, dynamic> get _totals {
    final raw = _allTimeActivity['totals'];
    return raw is Map ? Map<String, dynamic>.from(raw) : const {};
  }

  List<Map<String, dynamic>> _rows(
    Map<String, dynamic> source,
    String key,
  ) {
    final raw = source[key];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  List<Map<String, dynamic>> get _games => _rows(_allTimeActivity, 'games');

  List<Map<String, dynamic>> get _dailyRows =>
      _rows(_monthActivity, 'daily');

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
      row['coverUrl']?.toString() ?? row['cover_url']?.toString();

  String? _catalogId(Map<String, dynamic> row) =>
      row['catalogId']?.toString() ?? row['catalog_id']?.toString();

  void _openGame(Map<String, dynamic> row) {
    final id = _catalogId(row);
    if (id != null && id.isNotEmpty) {
      context.push('/game/$id');
      return;
    }

    final title = row['titleName']?.toString() ?? '';
    context.push('/discover?q=${Uri.encodeComponent(title)}');
  }

  Map<String, List<Map<String, dynamic>>> get _byDay {
    final map = <String, List<Map<String, dynamic>>>{};

    for (final row in _dailyRows) {
      final date = row['date']?.toString() ?? '';
      if (date.isEmpty) continue;
      (map[date] ??= []).add(row);
    }

    return map;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: scheme.surface,
      appBar: AppBar(
        title: const Text(
          'Stats',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _buildBody(theme, scheme),
    );
  }

  Widget _buildBody(ThemeData theme, ColorScheme scheme) {
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
      return _messageState(
        theme,
        scheme,
        Icons.lock_outline_rounded,
        'Sign in to view your stats',
        'Your library, PlayStation timeline and activity calendar live here.',
        'Sign In',
        () => context.push('/login'),
      );
    }

    if (_errorMessage.isNotEmpty && _allTimeActivity.isEmpty) {
      return _messageState(
        theme,
        scheme,
        Icons.cloud_off_rounded,
        'Couldn’t load stats',
        _errorMessage,
        'Try Again',
        _fetchInitial,
      );
    }

    return ExpressiveRefreshIndicator(
      onRefresh: _fetchInitial,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 700;

          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              _buildHero(theme, scheme, wide),
              const SizedBox(height: 16),
              _buildMostPlayed(theme, scheme),
              const SizedBox(height: 16),
              _buildActivitySection(theme, scheme, wide),
              const SizedBox(height: 16),
              _buildLibraryOverview(theme, scheme),
            ],
          );
        },
      ),
    );
  }

  Widget _messageState(
    ThemeData theme,
    ColorScheme scheme,
    IconData icon,
    String title,
    String message,
    String action,
    VoidCallback onPressed,
  ) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _circleIcon(icon, scheme),
            const SizedBox(height: 18),
            Text(
              title,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 22),
            FilledButton.tonalIcon(
              onPressed: onPressed,
              icon: Icon(
                action == 'Sign In'
                    ? Icons.login_rounded
                    : Icons.refresh_rounded,
              ),
              label: Text(action),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHero(
    ThemeData theme,
    ColorScheme scheme,
    bool wide,
  ) {
    final seconds = (_totals['seconds'] as num?)?.toInt() ?? 0;
    final games = (_totals['games'] as num?)?.toInt() ?? 0;
    final sessions = (_totals['sessions'] as num?)?.toInt() ?? 0;
    final days = (_totals['days'] as num?)?.toInt() ?? 0;
    final top = _games.isNotEmpty ? _games.first : null;
    final headerUrl = top?['headerUrl']?.toString();

    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: Container(
        constraints: BoxConstraints(minHeight: wide ? 190 : 210),
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHigh,
        ),
        child: Stack(
          children: [
            if (headerUrl != null && headerUrl.isNotEmpty)
              Positioned.fill(
                child: CachedNetworkImage(
                  imageUrl: headerUrl,
                  fit: BoxFit.cover,
                  color: Colors.black.withOpacity(0.42),
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
                      scheme.surfaceContainerHigh.withOpacity(0.55),
                      scheme.surfaceContainerHigh.withOpacity(0.95),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: wide
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: _heroCopy(
                            theme,
                            scheme,
                            seconds,
                            games,
                            sessions,
                            days,
                          ),
                        ),
                        if (top != null)
                          _heroGame(scheme, top),
                      ],
                    )
                  : _heroCopy(
                      theme,
                      scheme,
                      seconds,
                      games,
                      sessions,
                      days,
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _heroCopy(
    ThemeData theme,
    ColorScheme scheme,
    int seconds,
    int games,
    int sessions,
    int days,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.history_rounded, color: scheme.primary),
            const SizedBox(width: 8),
            Text(
              'PLAY HISTORY',
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: 1.4,
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          _duration(seconds),
          style: theme.textTheme.displaySmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: scheme.primary,
          ),
        ),
        Text(
          'Actual PlayStation session time',
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _metric('Games', '$games', scheme),
            _metric('Sessions', '$sessions', scheme),
            _metric('Days', '$days', scheme),
          ],
        ),
      ],
    );
  }

  Widget _heroGame(ColorScheme scheme, Map<String, dynamic> game) {
    final cover = _cover(game);

    return Container(
      width: 205,
      margin: const EdgeInsets.only(left: 20),
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(
        color: scheme.surface.withOpacity(0.22),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          if (cover != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(13),
              child: SizedBox(
                width: 50,
                height: 70,
                child: CachedNetworkImage(
                  imageUrl: cover,
                  fit: BoxFit.cover,
                ),
              ),
            ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'MOST PLAYED',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  game['titleName']?.toString() ?? 'Unknown game',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  _duration((game['seconds'] as num?)?.toInt() ?? 0),
                  style: TextStyle(
                    fontSize: 11,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(
    String label,
    String value,
    ColorScheme scheme,
  ) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(
          horizontal: 11,
          vertical: 9,
        ),
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHighest.withOpacity(0.72),
          borderRadius: BorderRadius.circular(15),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 3),
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

  Widget _buildMostPlayed(
    ThemeData theme,
    ColorScheme scheme,
  ) {
    final games = _games.take(8).toList();

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
            color: scheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 12),
        if (games.isEmpty)
          _surface(
            scheme,
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text('Your imported games will appear here.'),
            ),
          )
        else
          SizedBox(
            height: 190,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: games.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final game = games[index];
                final cover = _cover(game);
                final seconds = (game['seconds'] as num?)?.toInt() ?? 0;
                return SizedBox(
                  width: 138,
                  child: InkWell(
                    onTap: () => _openGame(game),
                    borderRadius: BorderRadius.circular(18),
                    child: Ink(
                      decoration: BoxDecoration(
                        color: scheme.surfaceContainerHigh,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(18),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            if (cover != null)
                              CachedNetworkImage(
                                imageUrl: cover,
                                fit: BoxFit.cover,
                              )
                            else
                              ColoredBox(
                                color: scheme.surfaceContainerHighest,
                              ),
                            DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.transparent,
                                    Colors.black.withOpacity(0.94),
                                  ],
                                ),
                              ),
                            ),
                            Positioned(
                              left: 9,
                              top: 9,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 4,
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
                              left: 10,
                              right: 10,
                              bottom: 10,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    game['titleName']?.toString() ??
                                        'Unknown game',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _duration(seconds),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
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

  Widget _buildActivitySection(
    ThemeData theme,
    ColorScheme scheme,
    bool wide,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: scheme.outlineVariant.withOpacity(0.14),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: wide
          ? _activityWide(theme, scheme)
          : _activityCompact(theme, scheme),
    );
  }

  Widget _activityWide(ThemeData theme, ColorScheme scheme) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 6,
            child: _calendar(theme, scheme),
          ),
          Container(
            width: 1,
            margin: const EdgeInsets.symmetric(vertical: 18),
            color: scheme.outlineVariant.withOpacity(0.2),
          ),
          Expanded(
            flex: 5,
            child: _selectedDay(theme, scheme),
          ),
        ],
      ),
    );
  }

  Widget _activityCompact(ThemeData theme, ColorScheme scheme) {
    return Column(
      children: [
        _calendar(theme, scheme),
        Container(
          height: 1,
          margin: const EdgeInsets.symmetric(horizontal: 18),
          color: scheme.outlineVariant.withOpacity(0.2),
        ),
        _selectedDay(theme, scheme),
      ],
    );
  }

  Widget _calendar(
    ThemeData theme,
    ColorScheme scheme,
  ) {
    final byDay = _byDay;
    final totals = <String, int>{};

    for (final entry in byDay.entries) {
      totals[entry.key] = entry.value.fold<int>(
        0,
        (sum, row) => sum + ((row['seconds'] as num?)?.toInt() ?? 0),
      );
    }

    final maxSeconds = totals.values.isEmpty
        ? 1
        : totals.values.reduce((a, b) => a > b ? a : b);

    final first = DateTime(_month.year, _month.month, 1);
    final leading = first.weekday - 1;
    final days = DateTime(
      _month.year,
      _month.month + 1,
      0,
    ).day;

    final monthBusy = _isMonthLoading;
    final mobile = MediaQuery.sizeOf(context).width < 600;
    final horizontalPadding = mobile ? 12.0 : 20.0;
    final calendarSpacing = mobile ? 5.0 : 5.0;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        horizontalPadding,
        mobile ? 16 : 18,
        horizontalPadding,
        mobile ? 18 : 18,
      ),
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
                      'Activity',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      DateFormat('MMMM yyyy').format(_month),
                      style: TextStyle(
                        fontSize: 11,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              if (monthBusy)
                const Padding(
                  padding: EdgeInsets.only(right: 6),
                  child: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              IconButton.filledTonal(
                visualDensity: VisualDensity.compact,
                onPressed: monthBusy ? null : () => _shiftMonth(-1),
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              const SizedBox(width: 3),
              IconButton.filledTonal(
                visualDensity: VisualDensity.compact,
                onPressed: monthBusy ? null : () => _shiftMonth(1),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
          SizedBox(height: mobile ? 12 : 12),
          Row(
            children: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
                .map(
                  (day) => Expanded(
                    child: Center(
                      child: Text(
                        day,
                        style: TextStyle(
                          fontSize: mobile ? 10 : 9,
                          fontWeight: FontWeight.w800,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          SizedBox(height: mobile ? 6 : 6),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: leading + days,
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: calendarSpacing,
              mainAxisSpacing: calendarSpacing,
              childAspectRatio: mobile ? 0.88 : 1.16,
            ),
            itemBuilder: (context, index) {
              if (index < leading) {
                return const SizedBox.shrink();
              }

              final day = index - leading + 1;
              final date = DateTime(
                _month.year,
                _month.month,
                day,
              );
              final key = DateFormat('yyyy-MM-dd').format(date);
              final seconds = totals[key] ?? 0;
              final ratio =
                  seconds == 0 ? 0.0 : (seconds / maxSeconds).clamp(0.0, 1.0);
              final selected = _selectedDate == key;
              final rows = byDay[key] ?? const [];
              final cover = rows.isNotEmpty ? _cover(rows.first) : null;

              return InkWell(
                onTap: () => setState(() => _selectedDate = key),
                borderRadius: BorderRadius.circular(11),
                child: Ink(
                  decoration: BoxDecoration(
                    color: selected
                        ? scheme.primaryContainer.withOpacity(0.78)
                        : scheme.surfaceContainer,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(
                      color: scheme.outlineVariant.withOpacity(0.15),
                      width: 1,
                    ),
                  ),
                  child: Stack(
                    children: [
                      if (cover != null)
                        Positioned.fill(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Opacity(
                              opacity: 0.08 + ratio * 0.45,
                              child: CachedNetworkImage(
                                imageUrl: cover,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                        ),
                      Padding(
                        padding: EdgeInsets.all(mobile ? 8 : 6),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '$day',
                              style: TextStyle(
                                fontSize: mobile ? 12 : 10,
                                fontWeight: FontWeight.w800,
                                color: selected
                                    ? scheme.onPrimaryContainer
                                    : scheme.onSurface,
                              ),
                            ),
                            if (seconds > 0)
                              Text(
                                _calendarDuration(seconds),
                                maxLines: 1,
                                overflow: TextOverflow.clip,
                                style: TextStyle(
                                  fontSize: mobile ? 10 : 8,
                                  fontWeight: FontWeight.w800,
                                  color: selected
                                      ? scheme.onPrimaryContainer
                                      : scheme.onSurfaceVariant,
                                ),
                              ),
                          ],
                        ),
                      ),
                      // Draw the selection outside the cell's content so the
                      // selected date never becomes smaller when the outline
                      // appears. The color follows the app's Material scheme.
                      if (selected)
                        Positioned.fill(
                          child: IgnorePointer(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: scheme.primary,
                                  width: 2.5,
                                ),
                                borderRadius: BorderRadius.circular(11),
                              ),
                            ),
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

  String _compactDuration(int seconds) {
    if (seconds < 60) return '${seconds}s';
    final minutes = seconds ~/ 60;
    if (minutes < 60) return '${minutes}m';
    final hours = minutes ~/ 60;
    final remainder = minutes % 60;
    return remainder == 0 ? '${hours}h' : '${hours}h ${remainder}m';
  }

  // Calendar cells use a compact representation. The selected-day section
  // keeps the exact duration, so hour-plus values do not get cramped.
  String _calendarDuration(int seconds) {
    if (seconds < 60) return '${seconds}s';
    final minutes = seconds ~/ 60;
    if (minutes < 60) return '${minutes}m';
    return '${minutes ~/ 60}h+';
  }

  Widget _selectedDay(
    ThemeData theme,
    ColorScheme scheme,
  ) {
    final date = _selectedDate;
    final rows = date == null
        ? const <Map<String, dynamic>>[]
        : (_byDay[date] ?? const <Map<String, dynamic>>[]);

    final total = rows.fold<int>(
      0,
      (sum, row) => sum + ((row['seconds'] as num?)?.toInt() ?? 0),
    );

    final mobile = MediaQuery.sizeOf(context).width < 600;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        mobile ? 12 : 20,
        mobile ? 20 : 18,
        mobile ? 12 : 20,
        mobile ? 20 : 18,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Played that day',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
              fontSize: mobile ? 19 : null,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            date == null
                ? 'Select a day'
                : DateFormat(
                    'EEEE, MMM d',
                  ).format(DateTime.parse('${date}T12:00:00')),
            style: TextStyle(
              fontSize: 11,
              color: scheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 10),
          if (rows.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: scheme.surfaceContainer,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                'No tracked play on this date.',
                style: TextStyle(
                  fontSize: 12,
                  color: scheme.onSurfaceVariant,
                ),
              ),
            )
          else ...[
            Text(
              '${_duration(total)} · ${rows.length} game${rows.length == 1 ? '' : 's'}',
              style: TextStyle(
                fontSize: 11,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 9),
            ...rows.map(
              (row) => Padding(
                padding: EdgeInsets.only(bottom: mobile ? 9 : 7),
                child: InkWell(
                  onTap: () => _openGame(row),
                  borderRadius: BorderRadius.circular(15),
                  child: Ink(
                    padding: EdgeInsets.all(mobile ? 9 : 7),
                    decoration: BoxDecoration(
                      color: scheme.surfaceContainer,
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Row(
                      children: [
                        _thumb(row, scheme),
                        const SizedBox(width: 11),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                row['titleName']?.toString() ??
                                    'Unknown game',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: mobile ? 13 : 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${row['sessions'] ?? 0} session${row['sessions'] == 1 ? '' : 's'}',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: scheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _duration(
                            (row['seconds'] as num?)?.toInt() ?? 0,
                          ),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 18,
                          color: scheme.onSurfaceVariant,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _thumb(Map<String, dynamic> row, ColorScheme scheme) {
    final cover = _cover(row);
    final mobile = MediaQuery.sizeOf(context).width < 600;
    final size = mobile ? 52.0 : 44.0;

    return ClipRRect(
      borderRadius: BorderRadius.circular(mobile ? 13 : 11),
      child: SizedBox(
        width: size,
        height: size,
        child: cover != null
            ? CachedNetworkImage(
                imageUrl: cover,
                fit: BoxFit.cover,
              )
            : ColoredBox(
                color: scheme.primaryContainer,
                child: Icon(
                  Icons.sports_esports_rounded,
                  color: scheme.onPrimaryContainer,
                  size: 20,
                ),
              ),
      ),
    );
  }

  Widget _buildLibraryOverview(
    ThemeData theme,
    ColorScheme scheme,
  ) {
    final beaten =
        _entries.where((e) => e.status == GameStatus.beaten).length;
    final scored =
        _entries.where((e) => e.score != null).toList();

    final average = scored.isEmpty
        ? '—'
        : (scored.fold<int>(
                  0,
                  (sum, e) => sum + (e.score ?? 0),
                ) /
                scored.length)
            .toStringAsFixed(1);

    return _surface(
      scheme,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Library overview',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _summary('Games', '${_entries.length}', scheme),
              _summary('Beaten', '$beaten', scheme),
              _summary('Avg. score', average, scheme),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Actual PlayStation playtime is used for tracked games. '
            'First and last imported sessions populate the game dates.',
            style: TextStyle(
              fontSize: 11,
              height: 1.35,
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _summary(
    String label,
    String value,
    ColorScheme scheme,
  ) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: scheme.surfaceContainer,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 9,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              value,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _surface(ColorScheme scheme, Widget child) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: scheme.outlineVariant.withOpacity(0.14),
        ),
      ),
      child: child,
    );
  }

  Widget _circleIcon(
    IconData icon,
    ColorScheme scheme,
  ) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        shape: BoxShape.circle,
      ),
      child: Icon(
        icon,
        size: 42,
        color: scheme.primary,
      ),
    );
  }
}
