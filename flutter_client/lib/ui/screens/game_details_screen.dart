import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../date_format.dart';
import '../../models/types.dart';
import '../../services/api_client.dart';
import '../../state/auth_controller.dart';
import '../open_game.dart';
import '../widgets/game_card.dart';
import '../widgets/list_editor_sheet.dart';
import '../widgets/m3_progress.dart';
import '../widgets/screenshot_gallery.dart';

class GameDetailsScreen extends StatefulWidget {
  final String id;
  final CatalogGame? preview;

  const GameDetailsScreen({super.key, required this.id, this.preview});

  @override
  State<GameDetailsScreen> createState() => _GameDetailsScreenState();
}

class _GameDetailsScreenState extends State<GameDetailsScreen> {
  CatalogDetails? _game;
  GameEntry? _entry;
  bool _isLoading = true;
  bool _refreshing = false;
  String? _error;
  bool _synopsisOpen = false;
  bool _saving = false;
  late final TextEditingController _hours;
  late final TextEditingController _notes;
  String? _startedAt;
  String? _finishedAt;
  Map<String, dynamic>? _trophyProgress;

  @override
  void initState() {
    super.initState();
    _hours = TextEditingController();
    _notes = TextEditingController();

    final preview = widget.preview;
    if (preview != null) {
      _game = CatalogDetails.fromPreview(preview);
      _isLoading = false;
      _refreshing = true;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _hours.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _syncLogFields(GameEntry? entry) {
    _hours.text = entry?.hours?.toString() ?? '';
    _notes.text = entry?.notes ?? '';
    _startedAt = _ymd(entry?.startedAt);
    _finishedAt = _ymd(entry?.finishedAt);
  }

  String? _ymd(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    return raw.length >= 10 ? raw.substring(0, 10) : raw;
  }

  Future<void> _load() async {
    if (_game == null) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    } else {
      setState(() => _refreshing = true);
    }

    try {
      final api = context.read<ApiClient>();
      final detailsFuture = api.getGameDetails(widget.id);
      final trophyFuture = () async {
        try {
          return await api.getGameTrophyProgress(widget.id);
        } on ApiException {
          return null;
        } catch (_) {
          return null;
        }
      }();
      final libraryFuture = () async {
        try {
          return await api.getLibrary();
        } on ApiException catch (e) {
          if (e.status != 401) rethrow;
          return const <GameEntry>[];
        }
      }();

      final details = await detailsFuture;
      final trophyProgress = await trophyFuture;
      final library = await libraryFuture;

      GameEntry? entry;
      for (final item in library) {
        if (item.catalogId == widget.id) {
          entry = item;
          break;
        }
      }

      if (!mounted) return;

      if (details == null && _game == null) {
        setState(() {
          _error = 'Game details could not be found.';
          _isLoading = false;
          _refreshing = false;
        });
        return;
      }

      _syncLogFields(entry);
      setState(() {
        if (details != null) _game = details;
        _entry = entry;
        _trophyProgress = trophyProgress;
        _isLoading = false;
        _refreshing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (_game == null) _error = e.toString();
        _isLoading = false;
        _refreshing = false;
      });
    }
  }

  Future<void> _openEditor({bool favoriteHint = false}) async {
    final auth = context.read<AuthController>();
    if (!auth.isSignedIn) {
      context.push('/login');
      return;
    }

    final game = _game;
    if (game == null) return;

    final result = await showListEditorSheet(
      context: context,
      title: game.title,
      entry: _entry,
      favoriteHint: favoriteHint,
    );
    if (result == null || !mounted) return;

    setState(() => _saving = true);
    final api = context.read<ApiClient>();

    try {
      if (result.remove && _entry != null) {
        await api.deleteEntry(_entry!.id);
        if (mounted) {
          _syncLogFields(null);
          setState(() => _entry = null);
        }
      } else if (_entry != null) {
        final updated = await api.updateEntry(_entry!.id, {
          'status': result.status.value,
          'score': result.score,
          'hours': result.hours,
          'favorite': result.favorite,
          'startedAt': result.startedAt,
          'finishedAt': result.finishedAt,
        });
        if (mounted) {
          _syncLogFields(updated);
          setState(() => _entry = updated);
        }
      } else {
        final created = await api.addToLibrary(
          game,
          status: result.status.value,
          score: result.score,
          hours: result.hours,
          favorite: result.favorite,
          startedAt: result.startedAt,
          finishedAt: result.finishedAt,
          details: game,
        );
        if (mounted) {
          _syncLogFields(created);
          setState(() => _entry = created);
        }
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.status == 401) {
        context.push('/login');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleFavorite() async {
    final auth = context.read<AuthController>();
    if (!auth.isSignedIn) {
      context.push('/login');
      return;
    }

    if (_entry == null) {
      await _openEditor(favoriteHint: true);
      return;
    }

    setState(() => _saving = true);
    try {
      final updated = await context.read<ApiClient>().updateEntry(
        _entry!.id,
        {'favorite': !_entry!.favorite},
      );
      if (mounted) setState(() => _entry = updated);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveLog() async {
    if (_entry == null) return;

    setState(() => _saving = true);
    try {
      final hoursRaw = _hours.text.trim();
      final notesRaw = _notes.text.trim();
      final updated = await context.read<ApiClient>().updateEntry(_entry!.id, {
        'hours': hoursRaw.isEmpty ? null : num.parse(hoursRaw),
        'notes': notesRaw.isEmpty ? null : notesRaw,
        'startedAt': _startedAt,
        'finishedAt': _finishedAt,
      });

      if (mounted) {
        _syncLogFields(updated);
        setState(() => _entry = updated);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _leave() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  Widget _withBack(Widget child) {
    final canPop = context.canPop();
    return PopScope(
      canPop: canPop,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _leave();
      },
      child: child,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    if (_isLoading) {
      return _withBack(
        Scaffold(
          appBar: AppBar(
            leading: IconButton(
              onPressed: _leave,
              icon: const Icon(Icons.arrow_back),
            ),
          ),
          body: const Center(child: M3Loading()),
        ),
      );
    }

    if (_error != null || _game == null) {
      return _withBack(
        Scaffold(
          appBar: AppBar(
            leading: IconButton(
              onPressed: _leave,
              icon: const Icon(Icons.arrow_back),
            ),
          ),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error ?? 'Not found', textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _load,
                    child: const Text('Try again'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final game = _game!;
    final posterUrl = pickPortraitCover([
      game.coverUrl,
      game.capsuleUrl,
      game.headerUrl,
    ]);
    final banner = game.headerUrl ?? posterUrl;
    final auth = context.watch<AuthController>();
    final inLibrary = _entry != null;
    final addLabel = !auth.isSignedIn
        ? 'SIGN IN TO ADD'
        : inLibrary
            ? _entry!.status.label.toUpperCase()
            : 'ADD TO LIBRARY';

    return _withBack(
      Scaffold(
        body: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              expandedHeight: 280,
              leading: IconButton.filledTonal(
                onPressed: _leave,
                icon: const Icon(Icons.arrow_back),
              ),
              actions: [
                IconButton.filledTonal(
                  onPressed: _saving ? null : _toggleFavorite,
                  icon: Icon(
                    _entry?.favorite == true
                        ? Icons.favorite
                        : Icons.favorite_border,
                  ),
                ),
                const SizedBox(width: 8),
              ],
              flexibleSpace: FlexibleSpaceBar(
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (banner != null)
                      CachedNetworkImage(
                        imageUrl: banner,
                        fit: BoxFit.cover,
                      )
                    else
                      ColoredBox(color: cs.surfaceContainerHighest),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black54,
                            Colors.transparent,
                            Colors.black87,
                          ],
                          stops: [0, 0.4, 1],
                        ),
                      ),
                    ),
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 16,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: SizedBox(
                              width: 92,
                              height: 128,
                              child: posterUrl != null
                                  ? CachedNetworkImage(
                                      imageUrl: posterUrl,
                                      fit: isLandscapeArt(posterUrl)
                                          ? BoxFit.contain
                                          : BoxFit.cover,
                                      errorWidget: (_, url, __) {
                                        final fallback =
                                            game.headerUrl ?? game.capsuleUrl;
                                        if (fallback != null &&
                                            fallback != url) {
                                          return CachedNetworkImage(
                                            imageUrl: fallback,
                                            fit: isLandscapeArt(fallback)
                                                ? BoxFit.contain
                                                : BoxFit.cover,
                                          );
                                        }
                                        return ColoredBox(
                                          color: cs.surfaceContainerHigh,
                                          child: const Icon(
                                            Icons.videogame_asset,
                                          ),
                                        );
                                      },
                                    )
                                  : ColoredBox(
                                      color: cs.surfaceContainerHigh,
                                      child: const Icon(
                                        Icons.videogame_asset,
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  game.title,
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 22,
                                    fontWeight: FontWeight.w700,
                                    height: 1.15,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 4,
                                  children: [
                                    if (_entry != null)
                                      _chip(_entry!.status.label, cs.primary),
                                    if (game.releaseDate != null)
                                      _chip(game.releaseDate!, Colors.white70),
                                    if (game.metacritic != null)
                                      _chip(
                                        '★ ${RatingBadge.labelFor(game.metacritic!)}',
                                        cs.primary,
                                      ),
                                    if (_entry?.score != null)
                                      _chip(
                                        'You ${_entry!.score}',
                                        Colors.white70,
                                      ),
                                    if (_trophyProgress?['found'] == true)
                                      InkWell(
                                        borderRadius:
                                            BorderRadius.circular(999),
                                        onTap: () => context.push(
                                          '/trophies/${widget.id}',
                                        ),
                                        child: _chip(
                                          _trophyChipLabel(_trophyProgress!),
                                          cs.primary,
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_refreshing)
              const SliverToBoxAdapter(
                child: M3LinearProgress(minHeight: 2),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: _quickAction(
                            context,
                            icon: inLibrary
                                ? Icons.check_circle_rounded
                                : Icons.add_rounded,
                            label: addLabel,
                            primary: true,
                            radius: const BorderRadius.horizontal(
                              left: Radius.circular(16),
                              right: Radius.circular(5),
                            ),
                            onTap: _saving ? null : () => _openEditor(),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          flex: 2,
                          child: _quickAction(
                            context,
                            icon: _entry?.favorite == true
                                ? Icons.favorite
                                : Icons.favorite_border,
                            label: _entry?.favorite == true
                                ? 'FAVORITED'
                                : 'FAVORITE',
                            primary: _entry?.favorite == true,
                            radius: const BorderRadius.horizontal(
                              left: Radius.circular(5),
                              right: Radius.circular(16),
                            ),
                            onTap: _saving ? null : _toggleFavorite,
                          ),
                        ),
                      ],
                    ),
                    if (game.genres.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: game.genres
                            .map(
                              (genre) => Chip(
                                label: Text(genre),
                                visualDensity: VisualDensity.compact,
                              ),
                            )
                            .toList(),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (_RelationsRail.hasGames(
              game.related,
              _RelationsRail.sequelDlcIds,
            ))
              SliverToBoxAdapter(
                child: _RelationsRail(
                  rails: game.related,
                  title: 'Prequels, sequels & DLC',
                  ids: _RelationsRail.sequelDlcIds,
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final wide = constraints.maxWidth >= 720;
                    final about = Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (game.summary.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          const Text(
                            'About',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            game.summary,
                            maxLines: _synopsisOpen ? null : 4,
                            overflow: _synopsisOpen
                                ? TextOverflow.visible
                                : TextOverflow.ellipsis,
                            style: TextStyle(
                              height: 1.5,
                              color: cs.onSurfaceVariant,
                            ),
                          ),
                          if (game.summary.length > 180)
                            TextButton(
                              onPressed: () => setState(
                                () => _synopsisOpen = !_synopsisOpen,
                              ),
                              child: Text(
                                _synopsisOpen ? 'Show less' : 'Read more',
                              ),
                            ),
                        ],
                        if (game.platforms.isNotEmpty ||
                            game.developers.isNotEmpty ||
                            game.publishers.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          if (game.platforms.isNotEmpty)
                            _meta(
                              'Platforms',
                              game.platforms.join(', '),
                              cs,
                            ),
                          if (game.developers.isNotEmpty)
                            _meta(
                              'Developers',
                              game.developers.join(', '),
                              cs,
                            ),
                          if (game.publishers.isNotEmpty)
                            _meta(
                              'Publishers',
                              game.publishers.join(', '),
                              cs,
                            ),
                        ],
                      ],
                    );

                    final log = _entry == null ? null : _logCard(cs);
                    if (!wide || log == null) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          about,
                          if (log != null) ...[
                            const SizedBox(height: 12),
                            log,
                          ],
                        ],
                      );
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: about),
                        const SizedBox(width: 16),
                        SizedBox(width: 320, child: log),
                      ],
                    );
                  },
                ),
              ),
            ),
            if (game.screenshots.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Screenshots',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 148,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: game.screenshots.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: 10),
                          itemBuilder: (context, i) => GestureDetector(
                            onTap: () => _openScreenshot(
                              context,
                              game.screenshots,
                              i,
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(14),
                              child: AspectRatio(
                                aspectRatio: 16 / 9,
                                child: CachedNetworkImage(
                                  imageUrl: game.screenshots[i],
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (_RelationsRail.hasGames(
              game.related,
              _RelationsRail.relatedIds,
            ))
              SliverToBoxAdapter(
                child: _RelationsRail(
                  rails: game.related,
                  title: 'Similar games',
                  ids: _RelationsRail.relatedIds,
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }

  String _trophyChipLabel(Map<String, dynamic> progress) {
    Map<String, dynamic> count(String key) {
      final value = progress[key];
      return value is Map
          ? Map<String, dynamic>.from(value)
          : const <String, dynamic>{};
    }

    final p = count('platinum');
    final g = count('gold');
    final s = count('silver');
    final b = count('bronze');

    int earned(Map<String, dynamic> row) {
      return (row['earned'] as num?)?.toInt() ?? 0;
    }

    int total(Map<String, dynamic> row) {
      return (row['total'] as num?)?.toInt() ?? 0;
    }

    return '🏆 ${earned(p)}/${total(p)} · '
        '🥇 ${earned(g)}/${total(g)} · '
        '🥈 ${earned(s)}/${total(s)} · '
        '🥉 ${earned(b)}/${total(b)}';
  }

  Future<void> _openScreenshot(
    BuildContext context,
    List<String> shots,
    int index,
  ) {
    return openScreenshotGallery(
      context,
      shots: shots,
      index: index,
    );
  }

  Widget _quickAction(
    BuildContext context, {
    required IconData icon,
    required String label,
    required BorderRadius radius,
    required VoidCallback? onTap,
    bool primary = false,
  }) {
    final cs = Theme.of(context).colorScheme;
    final bg = primary
        ? cs.primary.withOpacity(0.14)
        : cs.surfaceContainerHighest;
    final fg = primary ? cs.primary : cs.onSurface;

    return Material(
      color: bg,
      borderRadius: radius,
      child: InkWell(
        borderRadius: radius,
        onTap: onTap,
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(
              color: primary
                  ? cs.primary.withOpacity(0.28)
                  : cs.outlineVariant,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: fg),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: fg,
                    fontWeight: FontWeight.w800,
                    fontSize: 12.5,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _logCard(ColorScheme cs) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surfaceContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your log',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _hours,
            keyboardType: const TextInputType.numberWithOptions(
              decimal: true,
            ),
            decoration: const InputDecoration(
              labelText: 'Hours',
              isDense: true,
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          _logDateField(
            cs,
            label: 'Start date',
            value: _startedAt,
            onPick: () => _pickLogDate(start: true),
            onClear: _startedAt == null
                ? null
                : () => setState(() => _startedAt = null),
          ),
          const SizedBox(height: 10),
          _logDateField(
            cs,
            label: 'End date',
            value: _finishedAt,
            onPick: () => _pickLogDate(start: false),
            onClear: _finishedAt == null
                ? null
                : () => setState(() => _finishedAt = null),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _notes,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Notes',
              alignLabelWithHint: true,
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.tonal(
              onPressed: _saving ? null : _saveLog,
              child: Text(_saving ? 'Saving…' : 'Save log'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickLogDate({required bool start}) async {
    final current = DateTime.tryParse(
      start ? (_startedAt ?? '') : (_finishedAt ?? ''),
    );
    final now = DateTime.now();

    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? now,
      firstDate: DateTime(1970),
      lastDate: DateTime(now.year + 3),
    );
    if (picked == null) return;

    final value = isoDate(picked);
    setState(() {
      if (start) {
        _startedAt = value;
      } else {
        _finishedAt = value;
      }
    });
  }

  Widget _logDateField(
    ColorScheme cs, {
    required String label,
    required String? value,
    required VoidCallback onPick,
    VoidCallback? onClear,
  }) {
    return InkWell(
      onTap: onPick,
      borderRadius: BorderRadius.circular(8),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          border: const OutlineInputBorder(),
          suffixIcon: onClear == null
              ? const Icon(Icons.event, size: 18)
              : IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: onClear,
                ),
        ),
        child: Text(
          formatDmy(value).isEmpty ? 'Not set' : formatDmy(value),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: value == null ? cs.onSurfaceVariant : cs.onSurface,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black45,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _meta(String label, String value, ColorScheme cs) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: cs.surfaceContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }
}

class _RelatedItem {
  final CatalogGame game;
  final String badge;

  const _RelatedItem(this.game, this.badge);
}

class _RelationsRail extends StatelessWidget {
  final List<FeaturedRail> rails;
  final String title;
  final Set<String> ids;

  const _RelationsRail({
    required this.rails,
    required this.title,
    required this.ids,
  });

  static const sequelDlcIds = <String>{
    'dlc',
    'prequel',
    'sequel',
  };

  static const relatedIds = <String>{
    'series',
    'original',
    'franchise',
    'remakes',
    'similar',
  };

  static const _badges = <String, String>{
    'prequel': 'Prequel',
    'sequel': 'Sequel',
    'series': 'Series',
    'original': 'Original',
    'franchise': 'Franchise',
    'dlc': 'DLC',
    'remakes': 'Remake',
    'similar': 'Similar',
  };

  static bool hasGames(List<FeaturedRail> rails, Set<String> ids) {
    return rails.any(
      (rail) => ids.contains(rail.id) && rail.games.isNotEmpty,
    );
  }

  List<_RelatedItem> get items {
    final seen = <String>{};
    final out = <_RelatedItem>[];

    for (final rail in rails) {
      if (!ids.contains(rail.id)) continue;
      final badge = _badges[rail.id] ?? rail.title;

      for (final game in rail.games) {
        if (!seen.add(game.id)) continue;
        out.add(_RelatedItem(game, badge));
      }
    }

    return out;
  }

  @override
  Widget build(BuildContext context) {
    final cards = items;
    if (cards.isEmpty) return const SizedBox.shrink();

    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
          ),
          SizedBox(
            height: 196,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: cards.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, i) {
                final item = cards[i];
                return SizedBox(
                  width: 108,
                  child: InkWell(
                    onTap: () => openGame(context, item.game),
                    borderRadius: BorderRadius.circular(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AspectRatio(
                          aspectRatio: 2 / 3,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: item.game.artUrl != null
                                    ? CachedNetworkImage(
                                        imageUrl: item.game.artUrl!,
                                        fit: BoxFit.cover,
                                      )
                                    : ColoredBox(
                                        color: cs.surfaceContainerHighest,
                                      ),
                              ),
                              Positioned(
                                top: 6,
                                left: 6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.black87,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    item.badge.toUpperCase(),
                                    style: TextStyle(
                                      color: cs.primary,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.4,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          item.game.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            height: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
