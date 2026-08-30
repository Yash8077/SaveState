import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../models/types.dart';
import '../../services/api_client.dart';
import '../../state/auth_controller.dart';
import '../widgets/game_rail.dart';
import '../widgets/list_editor_sheet.dart';

class GameDetailsScreen extends StatefulWidget {
  final String id;

  const GameDetailsScreen({super.key, required this.id});

  @override
  State<GameDetailsScreen> createState() => _GameDetailsScreenState();
}

class _GameDetailsScreenState extends State<GameDetailsScreen> {
  CatalogDetails? _game;
  GameEntry? _entry;
  bool _isLoading = true;
  String? _error;
  bool _synopsisOpen = false;
  bool _saving = false;
  late final TextEditingController _hours;
  late final TextEditingController _notes;

  @override
  void initState() {
    super.initState();
    _hours = TextEditingController();
    _notes = TextEditingController();
    _load();
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
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final details = await api.getGameDetails(widget.id);
      GameEntry? entry;
      try {
        final library = await api.getLibrary();
        for (final e in library) {
          if (e.catalogId == widget.id) {
            entry = e;
            break;
          }
        }
      } on ApiException catch (e) {
        if (e.status != 401) rethrow;
      }
      if (!mounted) return;
      if (details == null) {
        setState(() {
          _error = 'Game details could not be found.';
          _isLoading = false;
        });
        return;
      }
      _syncLogFields(entry);
      setState(() {
        _game = details;
        _entry = entry;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
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
          'favorite': result.favorite,
        });
        if (mounted) setState(() => _entry = updated);
      } else {
        final created = await api.addToLibrary(
          game,
          status: result.status.value,
          score: result.score,
          favorite: result.favorite,
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
      final updated = await context.read<ApiClient>().updateEntry(_entry!.id, {
        'favorite': !_entry!.favorite,
      });
      if (mounted) setState(() => _entry = updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
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
      });
      if (mounted) setState(() => _entry = updated);
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

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null || _game == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error ?? 'Not found', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(onPressed: _load, child: const Text('Try again')),
              ],
            ),
          ),
        ),
      );
    }

    final game = _game!;
    final banner = game.headerUrl ?? game.coverUrl ?? game.capsuleUrl;
    final auth = context.watch<AuthController>();
    final inLibrary = _entry != null;
    final addLabel = !auth.isSignedIn
        ? 'SIGN IN TO ADD'
        : inLibrary
            ? _entry!.status.label.toUpperCase()
            : 'ADD TO LIBRARY';

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 280,
            leading: IconButton.filledTonal(
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/');
                }
              },
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
                    CachedNetworkImage(imageUrl: banner, fit: BoxFit.cover)
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
                            child: game.coverUrl != null
                                ? CachedNetworkImage(
                                    imageUrl: game.coverUrl!,
                                    fit: BoxFit.cover,
                                  )
                                : ColoredBox(
                                    color: cs.surfaceContainerHigh,
                                    child: const Icon(Icons.videogame_asset),
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
                                      'Meta ${game.metacritic}',
                                      Colors.white70,
                                    ),
                                  if (_entry?.score != null)
                                    _chip(
                                      'You ${_entry!.score}',
                                      Colors.white70,
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
                            (g) => Chip(
                              label: Text(g),
                              visualDensity: VisualDensity.compact,
                            ),
                          )
                          .toList(),
                    ),
                  ],
                  if (game.summary.isNotEmpty) ...[
                    const SizedBox(height: 16),
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
                        onPressed: () =>
                            setState(() => _synopsisOpen = !_synopsisOpen),
                        child: Text(_synopsisOpen ? 'Show less' : 'Read more'),
                      ),
                  ],
                  if (game.platforms.isNotEmpty ||
                      game.developers.isNotEmpty ||
                      game.publishers.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    if (game.platforms.isNotEmpty)
                      _meta('Platforms', game.platforms.join(', '), cs),
                    if (game.developers.isNotEmpty)
                      _meta('Developers', game.developers.join(', '), cs),
                    if (game.publishers.isNotEmpty)
                      _meta('Publishers', game.publishers.join(', '), cs),
                  ],
                  if (_entry != null) ...[
                    const SizedBox(height: 12),
                    _logCard(cs),
                  ],
                  if (game.screenshots.isNotEmpty) ...[
                    const SizedBox(height: 20),
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
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (context, i) => ClipRRect(
                          borderRadius: BorderRadius.circular(12),
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
                  ],
                ],
              ),
            ),
          ),
          ...game.related.map(
            (rail) => SliverToBoxAdapter(
              child: GameRailWidget(title: rail.title, games: rail.games),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
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
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Hours',
              isDense: true,
              border: OutlineInputBorder(),
            ),
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
            Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}
