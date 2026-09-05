import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../services/api_client.dart';
import '../widgets/m3_progress.dart';

class TrophyGameDetailsScreen extends StatefulWidget {
  final String catalogId;

  const TrophyGameDetailsScreen({super.key, required this.catalogId});

  @override
  State<TrophyGameDetailsScreen> createState() =>
      _TrophyGameDetailsScreenState();
}

class _TrophyGameDetailsScreenState extends State<TrophyGameDetailsScreen> {
  Map<String, dynamic> _response = const {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final data = await context
          .read<ApiClient>()
          .getGameTrophyProgress(widget.catalogId);
      if (!mounted) return;
      setState(() {
        _response = data;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '$e';
      });
    }
  }

  int _int(dynamic value) => (value as num?)?.toInt() ?? 0;
  double _double(dynamic value) => (value as num?)?.toDouble() ?? 0;

  List<Map<String, dynamic>> get _trophies {
    final raw = _response['trophies'];
    if (raw is! List) return const [];

    // Server order is canonical for Web and Flutter.
    return raw
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList(growable: false);
  }

  IconData _tierIcon(String? type) {
    switch (type) {
      case 'platinum':
        return Icons.workspace_premium_rounded;
      case 'gold':
        return Icons.stars_rounded;
      case 'silver':
        return Icons.military_tech_rounded;
      default:
        return Icons.emoji_events_rounded;
    }
  }

  Widget _tierSummary(String label, int earned) {
    final cs = Theme.of(context).colorScheme;
    final typeByLabel = const <String, String>{
      'P': 'platinum',
      'G': 'gold',
      'S': 'silver',
      'B': 'bronze',
    };

    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _tierIcon(typeByLabel[label]),
              size: 17,
              color: cs.primary,
            ),
            const SizedBox(width: 7),
            Text(
              '$earned',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(width: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: cs.onSurfaceVariant,
                letterSpacing: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String value) {
    final parsed = DateTime.tryParse(value)?.toLocal();
    if (parsed == null) return value;
    return '${parsed.day.toString().padLeft(2, '0')}/'
        '${parsed.month.toString().padLeft(2, '0')}/'
        '${parsed.year}';
  }

  Widget _trophyCard(Map<String, dynamic> trophy) {
    final cs = Theme.of(context).colorScheme;
    final earned = trophy['earned'] == true;
    final hidden = trophy['trophy_hidden'] == true && !earned;
    final rawName = trophy['trophy_name']?.toString().trim() ?? '';
    final name = hidden
        ? 'Secret Trophy'
        : rawName.isNotEmpty
            ? rawName
            : 'Unnamed Trophy';
    final detail = hidden
        ? 'Hidden trophy'
        : trophy['trophy_detail']?.toString() ?? '';
    final iconUrl = hidden ? '' : trophy['trophy_icon_url']?.toString() ?? '';

    Widget fallbackIcon() {
      return ColoredBox(
        color: cs.surfaceContainerHighest,
        child: Icon(
          _tierIcon(trophy['trophy_type']?.toString()),
          color: cs.primary,
          size: 22,
        ),
      );
    }

    Widget icon() {
      if (iconUrl.isEmpty) return fallbackIcon();
      return CachedNetworkImage(
        imageUrl: iconUrl,
        fit: BoxFit.cover,
        errorWidget: (_, __, ___) => fallbackIcon(),
      );
    }

    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: cs.surfaceContainerHigh,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
      ),
      child: Opacity(
        opacity: earned ? 1 : 0.76,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(width: 50, height: 50, child: icon()),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        if (earned) ...[
                          const SizedBox(width: 8),
                          Icon(
                            Icons.check_circle_rounded,
                            size: 17,
                            color: cs.primary,
                          ),
                        ],
                      ],
                    ),
                    if (detail.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        detail,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.3,
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    ],
                    if (earned && trophy['earned_at'] != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        _formatDate(trophy['earned_at'].toString()),
                        style: TextStyle(
                          fontSize: 10.5,
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _loading() {
    return Scaffold(
      appBar: AppBar(title: const Text('Trophies')),
      body: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            M3Loading(),
            SizedBox(height: 12),
            Text('Loading trophies…'),
          ],
        ),
      ),
    );
  }

  Widget _message({required Widget body}) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trophies')),
      body: body,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final wide = MediaQuery.sizeOf(context).width >= 720;

    if (_loading) return _loading();

    if (_error != null) {
      return _message(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.cloud_off_rounded, size: 42, color: cs.onSurfaceVariant),
                const SizedBox(height: 12),
                Text(
                  'Couldn’t load trophies',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 6),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: cs.onSurfaceVariant),
                ),
                const SizedBox(height: 16),
                FilledButton(onPressed: _load, child: const Text('Try again')),
              ],
            ),
          ),
        ),
      );
    }

    if (_response['found'] != true) {
      return _message(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.emoji_events_outlined,
                  size: 44,
                  color: cs.onSurfaceVariant,
                ),
                const SizedBox(height: 14),
                const Text(
                  'No synced trophies',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text(
                  'This game does not have recovered trophy data yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: cs.onSurfaceVariant),
                ),
                const SizedBox(height: 18),
                FilledButton.tonal(
                  onPressed: () => context.go('/game/${widget.catalogId}'),
                  child: const Text('Open game'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final earned = _int(_response['earned']);
    final total = _int(_response['total']);
    final percentage = _double(_response['percentage']).clamp(0, 100);
    final heroUrl = (_response['headerUrl']?.toString().isNotEmpty ?? false)
        ? _response['headerUrl'].toString()
        : _response['coverUrl']?.toString() ?? '';
    final trophies = _trophies;

    return Scaffold(
      appBar: AppBar(
        title: Text(_response['titleName']?.toString() ?? 'Trophies'),
        actions: [
          IconButton(
            tooltip: 'Open game',
            onPressed: () => context.go('/game/${widget.catalogId}'),
            icon: const Icon(Icons.open_in_new_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            Card(
              elevation: 0,
              color: cs.surfaceContainerHigh,
              clipBehavior: Clip.antiAlias,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(28),
              ),
              child: Column(
                children: [
                  SizedBox(
                    height: wide ? 190 : 150,
                    width: double.infinity,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (heroUrl.isNotEmpty)
                          CachedNetworkImage(
                            imageUrl: heroUrl,
                            fit: BoxFit.cover,
                          )
                        else
                          ColoredBox(color: cs.surfaceContainerHighest),
                        DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                cs.surfaceContainerHigh.withOpacity(0.98),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: cs.primaryContainer,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            _response['platform']?.toString().toUpperCase() ?? '',
                            style: TextStyle(
                              color: cs.onPrimaryContainer,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.1,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _response['titleName']?.toString() ?? 'Trophies',
                          style: Theme.of(context)
                              .textTheme
                              .headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$earned of $total trophies · ${percentage.toStringAsFixed(1)}%',
                          style: TextStyle(color: cs.onSurfaceVariant),
                        ),
                        const SizedBox(height: 14),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: percentage / 100,
                            minHeight: 8,
                            backgroundColor: cs.surfaceContainerHighest,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            _tierSummary('P', _int(_mapValue('platinum', 'earned'))),
                            const SizedBox(width: 6),
                            _tierSummary('G', _int(_mapValue('gold', 'earned'))),
                            const SizedBox(width: 6),
                            _tierSummary('S', _int(_mapValue('silver', 'earned'))),
                            const SizedBox(width: 6),
                            _tierSummary('B', _int(_mapValue('bronze', 'earned'))),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Trophy list',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: cs.onSurfaceVariant,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              '$earned earned · ${total - earned} remaining',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 10),
            if (wide)
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 440,
                  mainAxisExtent: 96,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemCount: trophies.length,
                itemBuilder: (context, index) =>
                    _trophyCard(trophies[index]),
              )
            else
              ...trophies.map(
                (trophy) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _trophyCard(trophy),
                ),
              ),
          ],
        ),
      ),
    );
  }

  dynamic _mapValue(String key, String child) {
    final raw = _response[key];
    if (raw is Map) return raw[child];
    return null;
  }
}
