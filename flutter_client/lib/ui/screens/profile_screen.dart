import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/types.dart';
import '../../services/api_client.dart';
import '../../state/auth_controller.dart';
import '../widgets/game_rail.dart';
import '../widgets/profile_editor.dart';
import '../widgets/user_avatar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _name = '';
  String? _image;
  bool _loading = true;
  String? _error;
  List<GameEntry> _entries = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  CatalogGame _asCard(GameEntry entry) {
    return CatalogGame(
      id: entry.catalogId,
      title: entry.title,
      coverUrl: entry.coverUrl,
      headerUrl: entry.headerUrl,
      metacritic: entry.metacritic,
    );
  }

  Future<void> _load() async {
    final auth = context.read<AuthController>();
    if (!auth.isSignedIn) {
      setState(() => _loading = false);
      return;
    }
    final api = context.read<ApiClient>();
    if (_entries.isEmpty && api.cachedLibrary != null) {
      _entries = api.cachedLibrary!;
    }
    _name = auth.user?.name ?? '';
    _image = auth.user?.image;
    try {
      final profile = await api.getProfile();
      List<GameEntry> library = _entries;
      try {
        library = await api.getLibrary();
      } on ApiException catch (e) {
        if (e.status != 401) rethrow;
      }
      if (!mounted) return;
      setState(() {
        _name = profile['name']?.toString() ?? auth.user?.name ?? '';
        _image = canonicalizeAvatar(profile['image']?.toString());
        _entries = library;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
        _name = auth.user?.name ?? '';
        _image = auth.user?.image;
      });
    }
  }

  Future<void> _edit() async {
    await showProfileEditor(context, onSaved: () {
      final auth = context.read<AuthController>();
      setState(() {
        _name = auth.user?.name ?? _name;
        _image = auth.user?.image ?? _image;
      });
    });
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final auth = context.watch<AuthController>();

    if (!auth.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Profile')),
        body: Center(
          child: FilledButton(
            onPressed: () => context.push('/login'),
            child: const Text('Sign in'),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: _loading && _entries.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.only(bottom: 32),
              children: [
                _identity(cs, auth),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Text(_error!, style: TextStyle(color: cs.error)),
                  ),
                ..._shelves(),
              ],
            ),
    );
  }

  Widget _identity(ColorScheme cs, AuthController auth) {
    final hours = _entries.fold<int>(0, (sum, e) => sum + (e.hours ?? 0));
    final scored = _entries.where((e) => e.score != null).toList();
    final avg = scored.isEmpty
        ? null
        : scored.fold<int>(0, (sum, e) => sum + e.score!) / scored.length;
    final year = DateTime.now().year.toString();
    final beatenYear = _entries
        .where((e) =>
            e.status == GameStatus.beaten &&
            (e.finishedAt?.startsWith(year) ?? false))
        .length;
    final display = _name.isEmpty ? 'Player' : _name;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Material(
                color: Colors.transparent,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: _edit,
                  child: Stack(
                    children: [
                      UserAvatar(image: _image, name: display, size: 84),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: cs.primary,
                            shape: BoxShape.circle,
                            border: Border.all(color: cs.surface, width: 2),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(6),
                            child: Icon(
                              Icons.edit_rounded,
                              size: 14,
                              color: cs.onPrimary,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      display,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      auth.user?.email ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              TextButton(onPressed: _edit, child: const Text('Edit')),
            ],
          ),
          const SizedBox(height: 16),
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => context.push('/stats'),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 560;
                final chips = [
                  _chip(cs, 'Logged', '${_entries.length}'),
                  _chip(cs, 'Hours', '${hours}h'),
                  _chip(cs, 'Avg score', avg == null ? '—' : avg.toStringAsFixed(1)),
                  _chip(cs, 'Beaten this year', '$beatenYear'),
                ];
                if (wide) {
                  return Row(
                    children: [
                      for (var i = 0; i < chips.length; i++) ...[
                        if (i > 0) const SizedBox(width: 8),
                        Expanded(child: chips[i]),
                      ],
                    ],
                  );
                }
                return Column(
                  children: [
                    Row(
                      children: [
                        Expanded(child: chips[0]),
                        const SizedBox(width: 8),
                        Expanded(child: chips[1]),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(child: chips[2]),
                        const SizedBox(width: 8),
                        Expanded(child: chips[3]),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(ColorScheme cs, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 0.6,
              color: cs.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  List<Widget> _shelves() {
    final playing = _entries
        .where((e) => e.status == GameStatus.playing)
        .map(_asCard)
        .toList();
    final favorites =
        _entries.where((e) => e.favorite).map(_asCard).toList();
    final beaten = [..._entries.where((e) => e.status == GameStatus.beaten)]
      ..sort((a, b) => (b.finishedAt ?? '').compareTo(a.finishedAt ?? ''));
    final beatenCards = beaten.take(12).map(_asCard).toList();
    return [
      if (playing.isNotEmpty)
        GameRailWidget(title: 'Currently playing', games: playing),
      if (favorites.isNotEmpty)
        GameRailWidget(title: 'Favorites', games: favorites),
      if (beatenCards.isNotEmpty)
        GameRailWidget(title: 'Recently beaten', games: beatenCards),
    ];
  }
}
