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
  Map<String, dynamic> _summary = const {};
  List<Map<String, dynamic>> _monthDaily = [];
  bool _isLoading = true;
  bool _isMonthLoading = false;
  bool _isAuthError = false;
  String _errorMessage = '';
  String _monthError = '';
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  String? _selectedDate;

  @override
  void onAuthReady(bool signedIn) => _fetchStats();

  String get _monthKey => '${_month.year}-${_month.month.toString().padLeft(2, '0')}';

  Future<void> _fetchStats() async {
    if (mounted) {
      setState(() {
        _isLoading = true;
        _errorMessage = '';
        _isAuthError = false;
        _monthError = '';
      });
    }
    try {
      final client = context.read<ApiClient>();
      final result = await Future.wait([
        client.getLibrary(),
        client.getActivity(),
        client.getActivity(month: _monthKey),
      ]);
      if (!mounted) return;
      final monthly = result[2] as Map<String, dynamic>;
      setState(() {
        _entries = result[0] as List<GameEntry>;
        _summary = result[1] as Map<String, dynamic>;
        _monthDaily = _rowsFrom(monthly, 'daily');
        _isLoading = false;
        _selectedDate = _validSelectedDate(_selectedDate) ? _selectedDate : _initialSelectedDate();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isAuthError = e.status == 401;
        _errorMessage = e.status == 401 ? 'Sign in to view your stats' : e.message;
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

  Future<void> _fetchMonthActivity() async {
    if (mounted) {
      setState(() {
        _isMonthLoading = true;
        _monthError = '';
      });
    }
    try {
      final client = context.read<ApiClient>();
      final result = await client.getActivity(month: _monthKey);
      if (!mounted) return;
      setState(() {
        _monthDaily = _rowsFrom(result, 'daily');
        _isMonthLoading = false;
        _selectedDate = _initialSelectedDate();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isMonthLoading = false;
        _monthError = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isMonthLoading = false;
        _monthError = e.toString();
      });
    }
  }

  String _initialSelectedDate() {
    final today = DateTime.now();
    if (today.year == _month.year && today.month == _month.month) return DateFormat('yyyy-MM-dd').format(today);
    return DateFormat('yyyy-MM-dd').format(DateTime(_month.year, _month.month, 1));
  }

  bool _validSelectedDate(String? value) => value != null && value.startsWith(_monthKey);

  void _shiftMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
      _selectedDate = DateFormat('yyyy-MM-dd').format(DateTime(_month.year, _month.month, 1));
    });
    _fetchMonthActivity();
  }

  Map<String, dynamic> get _totals {
    final raw = _summary['totals'];
    return raw is Map ? Map<String, dynamic>.from(raw) : const {};
  }

  List<Map<String, dynamic>> _rowsFrom(Map<String, dynamic> source, String key) {
    final raw = source[key];
    if (raw is! List) return const [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  List<Map<String, dynamic>> get _games {
    final raw = _summary['games'];
    if (raw is! List) return const [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  String _duration(num value) {
    final seconds = value.toInt();
    if (seconds < 60) return '${seconds}s';
    final minutes = seconds ~/ 60;
    if (minutes < 60) return '${minutes}m';
    final hours = minutes ~/ 60;
    final remainder = minutes % 60;
    return remainder == 0 ? '${hours}h' : '${hours}h ${remainder}m';
  }

  int _seconds(Map<String, dynamic> row) => (row['seconds'] as num?)?.toInt() ?? 0;
  String? _cover(Map<String, dynamic> row) => row['coverUrl'] as String?;
  String? _catalogId(Map<String, dynamic> row) => row['catalogId'] as String?;

  Map<String, List<Map<String, dynamic>>> get _byDay {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final row in _monthDaily) {
      final date = row['date']?.toString() ?? '';
      (map[date] ??= []).add(row);
    }
    return map;
  }

  void _openGame(Map<String, dynamic> row) {
    final id = _catalogId(row);
    if (id != null && id.isNotEmpty) {
      context.push('/game/$id');
      return;
    }
    final title = row['titleName']?.toString() ?? '';
    context.push('/discover?q=${Uri.encodeComponent(title)}');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Scaffold(
      backgroundColor: scheme.surface,
      appBar: AppBar(title: const Text('Stats', style: TextStyle(fontWeight: FontWeight.bold)), backgroundColor: Colors.transparent, elevation: 0),
      body: _buildBody(theme, scheme),
    );
  }

  Widget _buildBody(ThemeData theme, ColorScheme scheme) {
    if (_isLoading) {
      return const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [M3Loading(), SizedBox(height: 14), Text('Building your play history…')]));
    }
    if (_isAuthError) {
      return _messageState(theme, scheme, Icons.lock_outline_rounded, 'Sign in to view your stats', 'Your library, PlayStation timeline and activity calendar live here.', 'Sign In', () => context.push('/login'));
    }
    if (_errorMessage.isNotEmpty) {
      return _messageState(theme, scheme, Icons.cloud_off_rounded, 'Couldn’t load stats', _errorMessage, 'Try Again', _fetchStats);
    }

    return ExpressiveRefreshIndicator(
      onRefresh: _fetchStats,
      child: LayoutBuilder(builder: (context, constraints) {
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            _buildHero(theme, scheme),
            const SizedBox(height: 16),
            _buildMostPlayed(theme, scheme),
            const SizedBox(height: 16),
            _buildTimeline(theme, scheme, constraints.maxWidth),
            const SizedBox(height: 16),
            _buildLibraryOverview(theme, scheme),
          ],
        );
      }),
    );
  }

  Widget _messageState(ThemeData theme, ColorScheme scheme, IconData icon, String title, String message, String action, VoidCallback onPressed) => Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisSize: MainAxisSize.min, children: [_circleIcon(icon, scheme), const SizedBox(height: 18), Text(title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold), textAlign: TextAlign.center), const SizedBox(height: 8), Text(message, textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)), const SizedBox(height: 22), FilledButton.tonalIcon(onPressed: onPressed, icon: Icon(action == 'Sign In' ? Icons.login_rounded : Icons.refresh_rounded), label: Text(action))]));

  Widget _buildHero(ThemeData theme, ColorScheme scheme) {
    final seconds = (_totals['seconds'] as num?)?.toInt() ?? 0;
    final games = (_totals['games'] as num?)?.toInt() ?? 0;
    final sessions = (_totals['sessions'] as num?)?.toInt() ?? 0;
    final days = (_totals['days'] as num?)?.toInt() ?? 0;
    final top = _games.isNotEmpty ? _games.first : null;
    final headerUrl = top?['headerUrl'] as String?;
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: Container(
        constraints: const BoxConstraints(minHeight: 170),
        decoration: BoxDecoration(color: scheme.surfaceContainerHigh),
        child: Stack(children: [
          if (headerUrl != null) Positioned.fill(child: CachedNetworkImage(imageUrl: headerUrl, fit: BoxFit.cover, color: Colors.black.withOpacity(0.42), colorBlendMode: BlendMode.darken)),
          Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [scheme.surfaceContainerHigh.withOpacity(0.48), scheme.surfaceContainerHigh.withOpacity(0.93)])))),
          Padding(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Icon(Icons.history_rounded, color: scheme.primary), const SizedBox(width: 8), Text('PLAY HISTORY', style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.4, color: scheme.onSurfaceVariant))]), const SizedBox(height: 6), Text(_duration(seconds), style: theme.textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -1.2, color: scheme.primary)), Text('Actual PlayStation session time', style: TextStyle(color: scheme.onSurfaceVariant)), const SizedBox(height: 14), Row(children: [_metric('Games', '$games', scheme), _metric('Sessions', '$sessions', scheme), _metric('Days', '$days', scheme)])]))
        ]),
      ),
    );
  }

  Widget _metric(String label, String value, ColorScheme scheme) => Expanded(child: Container(margin: const EdgeInsets.only(right: 6), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9), decoration: BoxDecoration(color: scheme.surfaceContainerHighest.withOpacity(0.72), borderRadius: BorderRadius.circular(15)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: TextStyle(fontSize: 10, color: scheme.onSurfaceVariant)), const SizedBox(height: 3), Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))])));

  Widget _buildMostPlayed(ThemeData theme, ColorScheme scheme) {
    final games = _games.take(8).toList();
    final total = (_totals['seconds'] as num?)?.toInt() ?? 0;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Most played', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)), const SizedBox(height: 3), Text('Tap a game to open its SaveState entry', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)), const SizedBox(height: 10), if (games.isEmpty) _surface(scheme, child: const Padding(padding: EdgeInsets.all(12), child: Text('Your imported games will appear here.'))) else SizedBox(height: 184, child: ListView.separated(scrollDirection: Axis.horizontal, itemCount: games.length, separatorBuilder: (_, __) => const SizedBox(width: 9), itemBuilder: (context, index) => _gameCard(games[index], index, total, scheme)))]);
  }

  Widget _gameCard(Map<String, dynamic> game, int index, int total, ColorScheme scheme) {
    final cover = _cover(game);
    final seconds = _seconds(game);
    final share = total == 0 ? 0.0 : (seconds / total).clamp(0.08, 1.0);
    return SizedBox(width: 138, child: InkWell(onTap: () => _openGame(game), borderRadius: BorderRadius.circular(18), child: Ink(decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), color: scheme.surfaceContainerHigh), child: ClipRRect(borderRadius: BorderRadius.circular(18), child: Stack(fit: StackFit.expand, children: [if (cover != null) CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover) else ColoredBox(color: scheme.surfaceContainerHighest), DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withOpacity(0.92)]))), Positioned(left: 9, top: 9, child: Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4), decoration: BoxDecoration(color: Colors.black.withOpacity(0.45), borderRadius: BorderRadius.circular(99)), child: Text('#${index + 1}', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)))), Positioned(left: 10, right: 10, bottom: 10, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(game['titleName']?.toString() ?? 'Unknown game', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)), const SizedBox(height: 4), Text(_duration(seconds), style: const TextStyle(color: Colors.white70, fontSize: 10)), const SizedBox(height: 6), ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(minHeight: 3, value: share, backgroundColor: Colors.white24, color: Colors.white))])])))));
  }

  Widget _buildTimeline(ThemeData theme, ColorScheme scheme, double width) {
    final wide = width >= 720;
    return _surface(
      scheme,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Activity calendar', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)), const SizedBox(height: 2), Text('Compact play history with the games from the selected day.', style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant))])), if (_isMonthLoading) Padding(padding: const EdgeInsets.only(right: 6), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: scheme.primary))), IconButton.filledTonal(onPressed: _isMonthLoading ? null : () => _shiftMonth(-1), icon: const Icon(Icons.chevron_left_rounded)), const SizedBox(width: 2), IconButton.filledTonal(onPressed: _isMonthLoading ? null : () => _shiftMonth(1), icon: const Icon(Icons.chevron_right_rounded))]),
        const SizedBox(height: 12),
        if (_monthError.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 10), child: Container(width: double.infinity, padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: scheme.errorContainer, borderRadius: BorderRadius.circular(15)), child: Text('Couldn’t load this month: $_monthError', style: TextStyle(color: scheme.onErrorContainer, fontSize: 11)))),
        if (wide) Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(flex: 11, child: _calendar(theme, scheme)), const SizedBox(width: 12), Expanded(flex: 10, child: _dayDetail(theme, scheme, scrollable: true))]) else Column(children: [_calendar(theme, scheme), const SizedBox(height: 12), _dayDetail(theme, scheme, scrollable: false)]),
      ]),
    );
  }

  Widget _calendar(ThemeData theme, ColorScheme scheme) {
    final byDay = _byDay;
    final first = DateTime(_month.year, _month.month, 1);
    final leading = first.weekday - 1;
    final totalDays = DateTime(_month.year, _month.month + 1, 0).day;
    final maxSeconds = byDay.values.fold<int>(0, (max, rows) {
      final total = rows.fold<int>(0, (sum, row) => sum + _seconds(row));
      return total > max ? total : max;
    });

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: scheme.surfaceContainer.withOpacity(0.55), borderRadius: BorderRadius.circular(22)),
      child: Column(children: [
        Row(children: [Expanded(child: Text(DateFormat('MMMM yyyy').format(_month), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800))), Text('${byDay.length} active days', style: TextStyle(fontSize: 10, color: scheme.onSurfaceVariant))]),
        const SizedBox(height: 9),
        Row(children: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => Expanded(child: Center(child: Text(d, style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: scheme.onSurfaceVariant))))).toList()),
        const SizedBox(height: 5),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: leading + totalDays,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, crossAxisSpacing: 4, mainAxisSpacing: 4, mainAxisExtent: 40),
          itemBuilder: (context, index) {
            if (index < leading) return const SizedBox.shrink();
            final day = index - leading + 1;
            final key = DateFormat('yyyy-MM-dd').format(DateTime(_month.year, _month.month, day));
            final rows = byDay[key] ?? const <Map<String, dynamic>>[];
            final seconds = rows.fold<int>(0, (sum, row) => sum + _seconds(row));
            final ratio = maxSeconds == 0 ? 0.0 : (seconds / maxSeconds).clamp(0.0, 1.0);
            final selected = _selectedDate == key;
            final cover = rows.isNotEmpty ? _cover(rows.first) : null;
            return InkWell(
              onTap: _isMonthLoading ? null : () => setState(() => _selectedDate = key),
              borderRadius: BorderRadius.circular(12),
              child: Ink(decoration: BoxDecoration(color: selected ? scheme.primaryContainer : scheme.surfaceContainerHighest.withOpacity(0.65), borderRadius: BorderRadius.circular(12), border: Border.all(color: selected ? scheme.primary : scheme.outlineVariant.withOpacity(0.12))), child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Stack(children: [if (cover != null) Positioned.fill(child: CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover, color: scheme.surface.withOpacity(0.72 - ratio * 0.32), colorBlendMode: BlendMode.srcOver)), Padding(padding: const EdgeInsets.all(6), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('$day', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: selected ? scheme.onPrimaryContainer : scheme.onSurface)), const Spacer(), if (seconds > 0) Text(_duration(seconds), maxLines: 1, style: TextStyle(fontSize: 7.5, fontWeight: FontWeight.w800, color: selected ? scheme.onPrimaryContainer : scheme.onSurfaceVariant))])), if (seconds > 0) Positioned(left: 6, right: 6, bottom: 4, child: ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(minHeight: 2.5, value: ratio, backgroundColor: scheme.surfaceContainer.withOpacity(0.72), color: scheme.primary))) ]))),
            );
          },
        ),
      ]),
    );
  }

  Widget _dayDetail(ThemeData theme, ColorScheme scheme, {required bool scrollable}) {
    final date = _selectedDate ?? _initialSelectedDate();
    final rows = [...(_byDay[date] ?? const <Map<String, dynamic>>[])];
    rows.sort((a, b) => _seconds(b).compareTo(_seconds(a)));
    final total = rows.fold<int>(0, (sum, row) => sum + _seconds(row));
    final body = _isMonthLoading
        ? Column(children: List.generate(3, (i) => Padding(padding: const EdgeInsets.only(bottom: 7), child: Row(children: [Container(width: 45, height: 45, decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(11))), const SizedBox(width: 9), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(height: 10, width: 120, decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(8))), const SizedBox(height: 7), Container(height: 8, width: 70, decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(8)))]))])))
        : rows.isEmpty
            ? _emptyDay(scheme)
            : scrollable
                ? ConstrainedBox(constraints: const BoxConstraints(maxHeight: 300), child: SingleChildScrollView(child: Column(children: rows.map((row) => _dayRow(row, scheme)).toList())))
                : Column(children: rows.map((row) => _dayRow(row, scheme)).toList());

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(DateFormat('EEEE, MMM d').format(DateTime.parse('${date}T12:00:00')), style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)), const SizedBox(height: 2), Text(rows.isEmpty ? 'No tracked play' : '${_duration(total)} across ${rows.length} game${rows.length == 1 ? '' : 's'}', style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)), const SizedBox(height: 10), body]);
  }

  Widget _dayRow(Map<String, dynamic> row, ColorScheme scheme) {
    final cover = _cover(row);
    final seconds = _seconds(row);
    final sessions = (row['sessions'] as num?)?.toInt() ?? 0;
    return Padding(padding: const EdgeInsets.only(bottom: 7), child: InkWell(onTap: () => _openGame(row), borderRadius: BorderRadius.circular(15), child: Ink(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: scheme.surfaceContainer, borderRadius: BorderRadius.circular(15)), child: Row(children: [ClipRRect(borderRadius: BorderRadius.circular(11), child: SizedBox(width: 45, height: 45, child: cover != null ? CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover) : ColoredBox(color: scheme.primaryContainer, child: Icon(Icons.sports_esports_rounded, color: scheme.onPrimaryContainer)))), const SizedBox(width: 9), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(row['titleName']?.toString() ?? 'Unknown game', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)), const SizedBox(height: 3), Text('$sessions session${sessions == 1 ? '' : 's'} · Open game', style: TextStyle(fontSize: 10, color: scheme.onSurfaceVariant))])), Text(_duration(seconds), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800))]))));
  }

  Widget _emptyDay(ColorScheme scheme) => Container(width: double.infinity, padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: scheme.surfaceContainer, borderRadius: BorderRadius.circular(15)), child: Row(children: [Icon(Icons.nightlight_outlined, color: scheme.onSurfaceVariant), const SizedBox(width: 9), Expanded(child: Text('Pick a day with activity to see its games.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)))]));

  Widget _buildLibraryOverview(ThemeData theme, ColorScheme scheme) {
    final beaten = _entries.where((e) => e.status == GameStatus.beaten).length;
    final scored = _entries.where((e) => e.score != null).toList();
    final avgScore = scored.isEmpty ? '—' : (scored.fold<int>(0, (sum, e) => sum + (e.score ?? 0)) / scored.length).toStringAsFixed(1);
    final tracked = (_totals['seconds'] as num?)?.toInt() ?? 0;
    return _surface(scheme, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Library overview', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)), const SizedBox(height: 12), Row(children: [_summary('Games', '${_entries.length}', scheme), _summary('Beaten', '$beaten', scheme), _summary('Avg. score', avgScore, scheme)]), const SizedBox(height: 10), Text('Matched PlayStation games automatically keep playtime, first-played date and last-played date synchronized with your library.', style: TextStyle(fontSize: 11, height: 1.35, color: scheme.onSurfaceVariant)), const SizedBox(height: 7), Text('Tracked playtime · ${_duration(tracked)}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: scheme.primary))]));
  }

  Widget _summary(String label, String value, ColorScheme scheme) => Expanded(child: Container(margin: const EdgeInsets.only(right: 6), padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: scheme.surfaceContainer, borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: TextStyle(fontSize: 9, color: scheme.onSurfaceVariant)), const SizedBox(height: 3), Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800))])));
  Widget _surface(ColorScheme scheme, {required Widget child}) => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: scheme.surfaceContainerHigh, borderRadius: BorderRadius.circular(23), border: Border.all(color: scheme.outlineVariant.withOpacity(0.14))), child: child);
  Widget _circleIcon(IconData icon, ColorScheme scheme) => Container(padding: const EdgeInsets.all(17), decoration: BoxDecoration(color: scheme.surfaceContainerHigh, shape: BoxShape.circle), child: Icon(icon, size: 40, color: scheme.primary));
}
