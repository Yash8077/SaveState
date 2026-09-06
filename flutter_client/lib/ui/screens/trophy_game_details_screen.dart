import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/artwork_resolver.dart';
import '../../services/api_client.dart';
import '../widgets/m3_progress.dart';
import '../widgets/trophy_tier.dart';

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
  _TrophySort _sort = _TrophySort.gameDefault;

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

    final source = raw
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList(growable: false);

    if (_sort == _TrophySort.gameDefault) return source;

    final indexed = [
      for (var i = 0; i < source.length; i++) (i, source[i]),
    ];
    indexed.sort((a, b) {
      final cmp = _compareTrophies(a.$2, b.$2);
      return cmp != 0 ? cmp : a.$1.compareTo(b.$1);
    });
    return [for (final row in indexed) row.$2];
  }

  int _compareTrophies(Map<String, dynamic> a, Map<String, dynamic> b) {
    switch (_sort) {
      case _TrophySort.gameDefault:
        return 0;
      case _TrophySort.notEarned:
        final ae = a['earned'] == true;
        final be = b['earned'] == true;
        if (ae == be) return 0;
        return ae ? 1 : -1;
      case _TrophySort.earnedDate:
        final at = DateTime.tryParse(a['earned_at']?.toString() ?? '');
        final bt = DateTime.tryParse(b['earned_at']?.toString() ?? '');
        if (at == null && bt == null) return 0;
        if (at == null) return 1;
        if (bt == null) return -1;
        return bt.compareTo(at);
      case _TrophySort.grade:
        return _gradeRank(a['trophy_type']?.toString())
            .compareTo(_gradeRank(b['trophy_type']?.toString()));
    }
  }

  int _gradeRank(String? type) {
    switch (type) {
      case 'platinum':
        return 0;
      case 'gold':
        return 1;
      case 'silver':
        return 2;
      case 'bronze':
        return 3;
      default:
        return 4;
    }
  }

  Widget _tierRow({required bool wide, required List<Widget> children}) {
    if (!wide) {
      return Row(
        children: [for (final child in children) Expanded(child: child)],
      );
    }
    return Row(
      children: [
        for (final child in children)
          Padding(
            padding: const EdgeInsets.only(right: 32),
            child: child,
          ),
      ],
    );
  }

  Widget _tierSummary(String type, int earned) {
    return TrophyTierCount(
      type: type,
      value: '$earned',
      iconSize: 34,
      stacked: true,
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
        child: Center(
          child: TrophyTierIcon(
            type: trophy['trophy_type']?.toString(),
            size: 28,
            faded: !earned,
          ),
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
            crossAxisAlignment: CrossAxisAlignment.center,
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
              const SizedBox(width: 10),
              TrophyTierIcon(
                type: trophy['trophy_type']?.toString(),
                size: 36,
                faded: !earned,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _loadingScaffold() {
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

    if (_loading) return _loadingScaffold();

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
                  onPressed: () => context.push('/game/${widget.catalogId}'),
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
    final artwork = resolveGameArtwork(
      coverUrl: _response['coverUrl']?.toString(),
      headerUrl: _response['headerUrl']?.toString(),
      capsuleUrl: _response['capsuleUrl']?.toString(),
      catalogId: widget.catalogId,
    );
    final heroUrl = artwork.heroUrl ?? '';
    final heroFallback = artwork.heroCandidates.length > 1
        ? artwork.heroCandidates[1]
        : null;
    final trophies = _trophies;

    return Scaffold(
      appBar: AppBar(
        title: Text(_response['titleName']?.toString() ?? 'Trophies'),
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
                            errorWidget: (_, url, __) {
                              if (heroFallback != null && heroFallback != url) {
                                return CachedNetworkImage(
                                  imageUrl: heroFallback,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) =>
                                      ColoredBox(color: cs.surfaceContainerHighest),
                                );
                              }
                              return ColoredBox(color: cs.surfaceContainerHighest);
                            },
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
                        _tierRow(
                          wide: wide,
                          children: [
                            for (final type in trophyTiers)
                              _tierSummary(
                                type,
                                _int(_mapValue(type, 'earned')),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: SizedBox(
                            width: wide ? 260 : double.infinity,
                            child: FilledButton.icon(
                              onPressed: () =>
                                  context.push('/game/${widget.catalogId}'),
                              icon: const Icon(
                                Icons.sports_esports_rounded,
                                size: 18,
                              ),
                              label: const Text('Open game'),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
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
                    ],
                  ),
                ),
                Material(
                  color: cs.surfaceContainerHigh,
                  shape: const CircleBorder(),
                  clipBehavior: Clip.antiAlias,
                  child: PopupMenuButton<_TrophySort>(
                    tooltip: 'Sort',
                    initialValue: _sort,
                    position: PopupMenuPosition.under,
                    offset: const Offset(0, 8),
                    icon: const Icon(Icons.sort_rounded),
                    color: cs.surfaceContainerHigh,
                    surfaceTintColor: Colors.transparent,
                    elevation: 6,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                    onSelected: (value) => setState(() => _sort = value),
                    itemBuilder: (context) => [
                      for (final option in _TrophySort.values)
                        PopupMenuItem(
                          value: option,
                          child: Row(
                            children: [
                              SizedBox(
                                width: 22,
                                child: _sort == option
                                    ? Icon(
                                        Icons.check_rounded,
                                        size: 18,
                                        color: cs.primary,
                                      )
                                    : null,
                              ),
                              const SizedBox(width: 6),
                              Text(option.label),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (wide)
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 440,
                  mainAxisExtent: 108,
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

enum _TrophySort { gameDefault, notEarned, earnedDate, grade }

extension on _TrophySort {
  String get label {
    switch (this) {
      case _TrophySort.gameDefault:
        return 'Game Default';
      case _TrophySort.notEarned:
        return 'Not Earned';
      case _TrophySort.earnedDate:
        return 'Earned Date (New - Old)';
      case _TrophySort.grade:
        return 'Grade (Platinum - Bronze)';
    }
  }
}
