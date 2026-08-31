import 'dart:convert';
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
  String? _banner;
  int _bannerY = 50;
  bool _hasPassword = false;
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

  String? _bannerUrl() {
    if (_banner != null && _banner!.isNotEmpty) {
      if (_banner!.startsWith('data:')) return _banner;
      return upgradeHeroUrl(_banner);
    }
    GameEntry? pick;
    for (final e in _entries) {
      if (e.favorite && (e.headerUrl != null || e.coverUrl != null || e.catalogId.startsWith('steam_'))) {
        pick = e;
        break;
      }
    }
    pick ??= _entries.where((e) => e.headerUrl != null || e.coverUrl != null || e.catalogId.startsWith('steam_')).firstOrNull;
    return upgradeHeroUrl(pick?.headerUrl ?? pick?.coverUrl, pick?.catalogId);
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
        _banner = profile['banner']?.toString();
        final y = profile['bannerY'];
        _bannerY = y is num ? y.round().clamp(0, 100) : 50;
        _hasPassword = profile['hasPassword'] == true;
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

  void _refreshIdentity() {
    final auth = context.read<AuthController>();
    setState(() {
      _name = auth.user?.name ?? _name;
      _image = auth.user?.image ?? _image;
    });
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
          : LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 800;
                final identity = [
                  _banner(cs, height: wide ? 200 : 168),
                  _identity(cs, auth),
                  const SizedBox(height: 12),
                  _stats(cs),
                  ..._nowPlaying(cs),
                ];
                if (wide) {
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 360,
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(16, 8, 8, 32),
                          children: identity,
                        ),
                      ),
                      Expanded(
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(8, 8, 16, 32),
                          children: [
                            if (_error != null)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Text(_error!, style: TextStyle(color: cs.error)),
                              ),
                            ..._favorites(cs),
                            ..._beaten(cs),
                          ],
                        ),
                      ),
                    ],
                  );
                }
                return ListView(
                  padding: const EdgeInsets.only(bottom: 32),
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: identity[0],
                    ),
                    identity[1],
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                        child: Text(_error!, style: TextStyle(color: cs.error)),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                      child: _stats(cs),
                    ),
                    ..._nowPlaying(cs),
                    ..._favorites(cs),
                    ..._beaten(cs),
                  ],
                );
              },
            ),
    );
  }

  Alignment get _bannerAlign =>
      Alignment(0, ((_bannerY.clamp(0, 100) - 50) / 50));

  Future<void> _openBanner() {
    return showBannerPicker(
      context,
      games: _entries,
      banner: _banner,
      previewSrc: _bannerUrl(),
      focusY: _bannerY,
      onSaved: _load,
    );
  }

  Widget _bannerArt(String? src, ColorScheme cs) {
    if (src == null) return ColoredBox(color: cs.surfaceContainerHighest);
    if (src.startsWith('data:')) {
      return Image.memory(
        base64Decode(src.split(',').last),
        fit: BoxFit.cover,
        alignment: _bannerAlign,
      );
    }
    return CachedNetworkImage(
      imageUrl: src,
      fit: BoxFit.cover,
      alignment: _bannerAlign,
      memCacheWidth: 1600,
      errorWidget: (_, __, ___) => ColoredBox(color: cs.surfaceContainerHighest),
    );
  }

  Widget _banner(ColorScheme cs, {required double height}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _openBanner,
        borderRadius: BorderRadius.circular(24),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: SizedBox(
            height: height,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _bannerArt(_bannerUrl(), cs),
                Positioned(
                  top: 10,
                  right: 10,
                  child: FilledButton.tonal(
                    style: FilledButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    onPressed: _openBanner,
                    child: const Text('Banner'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _identity(ColorScheme cs, AuthController auth) {
    final display = _name.isEmpty ? 'Player' : _name;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 8, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Transform.translate(
            offset: const Offset(0, -36),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => showAvatarPicker(
                  context,
                  name: display,
                  image: _image,
                  onSaved: _refreshIdentity,
                ),
                child: Stack(
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: cs.surface, width: 4),
                      ),
                      child: UserAvatar(
                        image: _image,
                        name: display,
                        size: 84,
                      ),
                    ),
                    Positioned(
                      right: 2,
                      bottom: 2,
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
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          display,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Change name',
                        visualDensity: VisualDensity.compact,
                        onPressed: () => showNameEditor(
                          context,
                          name: display,
                          image: _image,
                          onSaved: _refreshIdentity,
                        ),
                        icon: const Icon(Icons.edit_outlined, size: 18),
                      ),
                    ],
                  ),
                  Text(
                    auth.user?.email ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: cs.onSurfaceVariant),
                  ),
                  if (_hasPassword)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: TextButton.icon(
                        onPressed: () => showPasswordEditor(context),
                        icon: const Icon(Icons.key_rounded, size: 16),
                        label: const Text('Change password'),
                        style: TextButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stats(ColorScheme cs) {
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
    final chips = [
      _chip(cs, 'Logged', '${_entries.length}'),
      _chip(cs, 'Hours', '${hours}h'),
      _chip(cs, 'Avg score', avg == null ? '—' : avg.toStringAsFixed(1)),
      _chip(cs, 'Beaten this year', '$beatenYear'),
    ];
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => context.push('/stats'),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 560;
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

  List<Widget> _nowPlaying(ColorScheme cs) {
    final playing =
        _entries.where((e) => e.status == GameStatus.playing).toList();
    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Row(
          children: [
            const Expanded(
              child: Text(
                'Now playing',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
            ),
            if (playing.length > 2)
              TextButton(
                onPressed: () => context.go('/library?status=playing'),
                child: Text('See all ${playing.length}'),
              ),
          ],
        ),
      ),
      if (playing.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: cs.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(18),
            ),
            child: ListTile(
              title: const Text('Nothing in progress'),
              subtitle: const Text('Open library'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => context.go('/library?status=playing'),
            ),
          ),
        )
      else
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final preview = playing.take(2).map(_asCard).toList();
              final columns = 2;
              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: preview.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: columns,
                  childAspectRatio: 0.58,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 12,
                ),
                itemBuilder: (context, i) => GameCardWidget(game: preview[i]),
              );
            },
          ),
        ),
    ];
  }

  List<Widget> _favorites(ColorScheme cs) {
    final all = _entries.where((e) => e.favorite).toList();
    if (all.isEmpty) return const [];
    final games = all.take(8).map(_asCard).toList();
    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Row(
          children: [
            const Expanded(
              child: Text(
                'Favorites',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
            ),
            if (all.length > 8)
              TextButton(
                onPressed: () => context.go('/library?status=favorites'),
                child: Text('See all ${all.length}'),
              ),
          ],
        ),
      ),
      LayoutBuilder(
        builder: (context, constraints) {
          final columns =
              (constraints.maxWidth / 148).floor().clamp(3, 6);
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: games.length,
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                childAspectRatio: 0.58,
                crossAxisSpacing: 10,
                mainAxisSpacing: 12,
              ),
              itemBuilder: (context, i) => GameCardWidget(game: games[i]),
            ),
          );
        },
      ),
    ];
  }

  List<Widget> _beaten(ColorScheme cs) {
    final beaten = [..._entries.where((e) => e.status == GameStatus.beaten)]
      ..sort((a, b) => (b.finishedAt ?? '').compareTo(a.finishedAt ?? ''));
    if (beaten.isEmpty) return const [];
    final preview = beaten.take(6).toList();
    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
        child: Row(
          children: [
            const Expanded(
              child: Text(
                'Beaten',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
            ),
            if (beaten.length > 6)
              TextButton(
                onPressed: () => context.go('/library?status=beaten'),
                child: Text('See all ${beaten.length}'),
              ),
          ],
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: cs.surfaceContainerHigh,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            children: [
              for (var i = 0; i < preview.length; i++) ...[
                if (i > 0) Divider(height: 1, color: cs.outlineVariant.withValues(alpha: 0.4)),
                _beatenRow(cs, preview[i]),
              ],
            ],
          ),
        ),
      ),
    ];
  }

  Widget _beatenRow(ColorScheme cs, GameEntry entry) {
    final cover = normalizeArtUrl(entry.coverUrl) ??
        normalizeArtUrl(entry.headerUrl);
    final bits = [
      if (entry.score != null) '${entry.score}/10',
      if (entry.hours != null) '${entry.hours}h',
      formatDmy(entry.finishedAt),
    ].where((s) => s.isNotEmpty).join(' · ');
    return ListTile(
      onTap: () => openGameId(
        context,
        entry.catalogId,
        title: entry.title,
        coverUrl: entry.coverUrl,
        headerUrl: entry.headerUrl,
      ),
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: 40,
          height: 56,
          child: cover == null
              ? ColoredBox(color: cs.surfaceContainerHighest)
              : CachedNetworkImage(
                  imageUrl: cover,
                  fit: BoxFit.cover,
                  memCacheWidth: 120,
                ),
        ),
      ),
      title: Text(entry.title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: bits.isEmpty ? null : Text(bits),
      trailing: const Icon(Icons.chevron_right_rounded),
    );
  }
}
