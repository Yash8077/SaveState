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
  State<TrophyGameDetailsScreen> createState() => _TrophyGameDetailsScreenState();
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
    setState(() {
      _loading = true;
      _error = null;
    });

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

  Map<String, dynamic> _map(dynamic value) {
    return value is Map
        ? Map<String, dynamic>.from(value)
        : const <String, dynamic>{};
  }

  List<Map<String, dynamic>> get _trophies {
    final raw = _response['trophies'];
    if (raw is! List) return const [];

    final rows = raw
        .whereType<Map>()
        .map(Map<String, dynamic>.from)
        .toList();

    const tiers = <String, int>{
      'platinum': 0,
      'gold': 1,
      'silver': 2,
      'bronze': 3,
    };

    rows.sort((a, b) {
      final earnedA = a['earned'] == true;
      final earnedB = b['earned'] == true;

      if (earnedA != earnedB) return earnedA ? -1 : 1;

      final tierA = tiers[a['trophy_type']?.toString() ?? ''] ?? 99;
      final tierB = tiers[b['trophy_type']?.toString() ?? ''] ?? 99;
      if (tierA != tierB) return tierA.compareTo(tierB);

      if (earnedA) {
        final aDate = DateTime.tryParse(a['earned_at']?.toString() ?? '');
        final bDate = DateTime.tryParse(b['earned_at']?.toString() ?? '');
        final aMillis = aDate?.millisecondsSinceEpoch ?? 0;
        final bMillis = bDate?.millisecondsSinceEpoch ?? 0;
        if (aMillis != bMillis) return bMillis.compareTo(aMillis);
      }

      return _int(a['trophy_id']).compareTo(_int(b['trophy_id']));
    });

    return rows;
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

  Widget _tierCount(String label, Map<String, dynamic> count) {
    final cs = Theme.of(context).colorScheme;
    const typeByLabel = <String, String>{
      'P': 'platinum',
      'G': 'gold',
      'S': 'silver',
      'B': 'bronze',
    };

    return Expanded(
      child: Column(
        children: [
          Icon(
            _tierIcon(typeByLabel[label]),
            size: 18,
            color: cs.primary,
          ),
          const SizedBox(height: 3),
          Text(
            '${_int(count['earned'])}/${_int(count['total'])}',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: cs.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
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
        ? '???'
        : trophy['trophy_detail']?.toString() ?? '';
    final iconUrl = trophy['trophy_icon_url']?.toString();

    Widget fallbackIcon() {
      return ColoredBox(
        color: cs.surfaceContainerHighest,
        child: Icon(
          _tierIcon(trophy['trophy_type']?.toString()),
          color: cs.primary,
        ),
      );
    }

    Widget icon() {
      if (iconUrl == null || iconUrl.isEmpty) return fallbackIcon();
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
      child: Opacity(
        opacity: earned ? 1 : 0.62,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: SizedBox(
                  width: 58,
                  height: 58,
                  child: icon(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    if (detail.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        detail,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.35,
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    ],
                    if (earned && trophy['earned_at'] != null) ...[
                      const SizedBox(height: 7),
                      Text(
                        _formatDate(trophy['earned_at'].toString()),
                        style: TextStyle(
                          fontSize: 11,
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

  String _formatDate(String value) {
    final parsed = DateTime.tryParse(value)?.toLocal();
    if (parsed == null) return value;

    return '${parsed.day.toString().padLeft(2, '0')}/'
        '${parsed.month.toString().padLeft(2, '0')}/'
        '${parsed.year}';
  }

  Scaffold _messageScaffold({required Widget body}) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trophies')),
      body: body,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final orientation = MediaQuery.orientationOf(context);
    final wide = MediaQuery.sizeOf(context).width >= 720;

    if (_loading) {
      return _messageScaffold(
        body: const Center(child: M3Loading()),
      );
    }

    if (_error != null) {
      return _messageScaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _load,
                  child: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_response['found'] != true) {
      return _messageScaffold(
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
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
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
    final percentage = _double(_response['percentage']);
    final trophies = _trophies;
    final grid = orientation == Orientation.landscape || wide;
    final headerUrl = _response['headerUrl']?.toString() ?? '';
    final coverUrl = _response['coverUrl']?.toString() ?? '';
    final heroUrl = headerUrl.isNotEmpty ? headerUrl : coverUrl;

    return Scaffold(
      appBar: AppBar(
        title: Text(_response['titleName']?.toString() ?? 'Trophies'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Card(
            elevation: 0,
            color: cs.surfaceContainerHigh,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                SizedBox(
                  width: double.infinity,
                  height: 170,
                  child: heroUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: heroUrl,
                          fit: BoxFit.cover,
                        )
                      : ColoredBox(
                          color: cs.surfaceContainerHighest,
                          child: const Icon(
                            Icons.videogame_asset_rounded,
                            size: 42,
                          ),
                        ),
                ),
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _response['titleName']?.toString() ?? 'Game',
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${_response['platform']?.toString().toUpperCase()} · '
                        '$earned/$total · ${percentage.toStringAsFixed(1)}%',
                        style: TextStyle(color: cs.onSurfaceVariant),
                      ),
                      const SizedBox(height: 14),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: LinearProgressIndicator(
                          value: total == 0 ? 0 : percentage / 100,
                          minHeight: 9,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          _tierCount('P', _map(_response['platinum'])),
                          _tierCount('G', _map(_response['gold'])),
                          _tierCount('S', _map(_response['silver'])),
                          _tierCount('B', _map(_response['bronze'])),
                        ],
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.tonalIcon(
                          onPressed: () =>
                              context.go('/game/${widget.catalogId}'),
                          icon: const Icon(Icons.open_in_new_rounded),
                          label: const Text('Open game'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (grid)
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount:
                    MediaQuery.sizeOf(context).width >= 1000 ? 3 : 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 2.7,
              ),
              itemCount: trophies.length,
              itemBuilder: (_, i) => _trophyCard(trophies[i]),
            )
          else
            ...trophies.map(_trophyCard),
        ],
      ),
    );
  }
}
