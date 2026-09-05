import 'package:cached_network_image/cached_network_image.dart';
import 'package:expressive_refresh/expressive_refresh.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../services/api_client.dart';
import '../auth_ready_load.dart';
import '../widgets/m3_progress.dart';

class TrophiesScreen extends StatefulWidget {
  const TrophiesScreen({super.key});

  @override
  State<TrophiesScreen> createState() => _TrophiesScreenState();
}

class _TrophiesScreenState extends State<TrophiesScreen> with AuthReadyLoad {
  Map<String, dynamic> _response = const {};
  bool _isLoading = true;
  bool _isAuthError = false;
  String _errorMessage = '';

  @override
  void onAuthReady(bool signedIn) {
    if (signedIn) {
      _fetch();
      return;
    }
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _isAuthError = true;
      _errorMessage = '';
    });
  }

  Future<void> _fetch() async {
    setState(() {
      _isLoading = true;
      _isAuthError = false;
      _errorMessage = '';
    });
    try {
      final response = await context.read<ApiClient>().getTrophyProgress();
      if (!mounted) return;
      setState(() {
        _response = response;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _isAuthError = e.status == 401;
        _errorMessage = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  List<Map<String, dynamic>> get _games {
    final raw = _response['games'];
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Map<String, dynamic> get _summary {
    final raw = _response['summary'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return const {};
  }

  int _int(dynamic value) => (value as num?)?.toInt() ?? 0;
  double _double(dynamic value) => (value as num?)?.toDouble() ?? 0;
  Map<String, dynamic> _map(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : const {};

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: scheme.surface,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Row(
                children: [
                  Icon(Icons.emoji_events_rounded, color: scheme.primary),
                  const SizedBox(width: 8),
                  Text('Trophies', style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                ],
              ),
            ),
            Expanded(child: _buildBody(theme, scheme)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(ThemeData theme, ColorScheme scheme) {
    if (_isLoading) {
      return const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [M3Loading(), SizedBox(height: 14), Text('Loading your trophies…')]));
    }

    if (_isAuthError) {
      return _messageState(theme, scheme, Icons.lock_outline_rounded, 'Sign in to view your trophies', 'Recovered PlayStation trophies are shown here.', 'Sign In', () => context.push('/login'));
    }

    if (_errorMessage.isNotEmpty && _response.isEmpty) {
      return _messageState(theme, scheme, Icons.cloud_off_rounded, 'Couldn’t load trophies', _errorMessage, 'Try Again', _fetch);
    }

    final games = _games;
    return ExpressiveRefreshIndicator(
      onRefresh: _fetch,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _buildSummary(theme, scheme),
          const SizedBox(height: 16),
          if (games.isEmpty)
            _emptyState(theme, scheme)
          else
            ...games.map((game) => Padding(padding: const EdgeInsets.only(bottom: 12), child: _gameCard(theme, scheme, game))),
        ],
      ),
    );
  }

  Widget _buildSummary(ThemeData theme, ColorScheme scheme) {
    final earned = _int(_summary['earned']);
    final total = _int(_summary['total']);
    final percentage = _double(_summary['percentage']);
    final games = _int(_summary['games']);
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: scheme.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('OVERALL PROGRESS', style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.4, color: scheme.onSurfaceVariant)),
            const SizedBox(height: 8),
            Text('$earned/$total', style: theme.textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800, color: scheme.primary)),
            Text('${percentage.toStringAsFixed(1)}% across $games ${games == 1 ? 'game' : 'games'}', style: TextStyle(color: scheme.onSurfaceVariant)),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: LinearProgressIndicator(value: total == 0 ? 0 : percentage / 100, minHeight: 9, backgroundColor: scheme.surfaceContainerHighest),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                _typeSummary('Platinum', _int(_summary['platinum']), scheme),
                _typeSummary('Gold', _int(_summary['gold']), scheme),
                _typeSummary('Silver', _int(_summary['silver']), scheme),
                _typeSummary('Bronze', _int(_summary['bronze']), scheme),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _typeSummary(String label, int value, ColorScheme scheme) {
    return Expanded(child: Column(children: [Text('$value', style: const TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 2), Text(label, style: TextStyle(fontSize: 10, color: scheme.onSurfaceVariant))]));
  }

  Widget _gameCard(ThemeData theme, ColorScheme scheme, Map<String, dynamic> game) {
    final title = game['title']?.toString() ?? 'Unknown game';
    final cover = game['coverUrl']?.toString();
    final catalogId = game['catalogId']?.toString();
    final earned = _int(game['earned']);
    final total = _int(game['total']);
    final percentage = _double(game['percentage']);
    final platinum = _map(game['platinum']);
    final gold = _map(game['gold']);
    final silver = _map(game['silver']);
    final bronze = _map(game['bronze']);

    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: scheme.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: catalogId == null || catalogId.isEmpty ? null : () => context.push('/trophies/$catalogId'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  width: 76,
                  height: 104,
                  child: cover == null || cover.isEmpty ? ColoredBox(color: scheme.surfaceContainerHighest) : CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [Expanded(child: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800))), const SizedBox(width: 8), Text('${percentage.toStringAsFixed(1)}%', style: TextStyle(fontWeight: FontWeight.w800, color: scheme.primary))]),
                    const SizedBox(height: 5),
                    Text('$earned/$total trophies', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                    const SizedBox(height: 10),
                    ClipRRect(borderRadius: BorderRadius.circular(20), child: LinearProgressIndicator(value: total == 0 ? 0 : percentage / 100, minHeight: 7, backgroundColor: scheme.surfaceContainerHighest)),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 10,
                      runSpacing: 6,
                      children: [
                        _typeChip('P', platinum, scheme),
                        _typeChip('G', gold, scheme),
                        _typeChip('S', silver, scheme),
                        _typeChip('B', bronze, scheme),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _typeChip(String short, Map<String, dynamic> count, ColorScheme scheme) {
    final earned = _int(count['earned']);
    final total = _int(count['total']);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(color: scheme.surfaceContainer, borderRadius: BorderRadius.circular(999)),
      child: Text('$short $earned/$total', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }

  Widget _emptyState(ThemeData theme, ColorScheme scheme) {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: scheme.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(children: [
          Icon(Icons.emoji_events_outlined, size: 42, color: scheme.onSurfaceVariant),
          const SizedBox(height: 14),
          Text('No trophies synced yet', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('Run the SaveState PS5 payload once to import locally earned trophies.', textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
        ]),
      ),
    );
  }

  Widget _messageState(ThemeData theme, ColorScheme scheme, IconData icon, String title, String message, String action, VoidCallback onPressed) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 44, color: scheme.primary),
          const SizedBox(height: 18),
          Text(title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
          const SizedBox(height: 22),
          FilledButton.tonalIcon(onPressed: onPressed, icon: Icon(action == 'Sign In' ? Icons.login_rounded : Icons.refresh_rounded), label: Text(action)),
        ]),
      ),
    );
  }
}
