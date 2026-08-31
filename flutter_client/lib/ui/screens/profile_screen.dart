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
          : ListView(
              padding: const EdgeInsets.only(bottom: 32),
              children: [
                _hero(cs, auth),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Text(_error!, style: TextStyle(color: cs.error)),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: _stats(cs),
                ),
                ..._favorites(cs),
                ..._beaten(cs),
              ],
            ),
    );
  }

  Widget _hero(ColorScheme cs, AuthController auth) {
    final display = _name.isEmpty ? 'Player' : _name;
    final banner = _bannerUrl();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: ColoredBox(
          color: cs.surfaceContainerHigh,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 148,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (banner != null && banner.startsWith('data:'))
                      Image.memory(
                        base64Decode(banner.split(',').last),
                        fit: BoxFit.cover,
                      )
                    else if (banner != null)
                      CachedNetworkImage(
                        imageUrl: banner,
                        fit: BoxFit.cover,
                        memCacheWidth: 1600,
                        errorWidget: (_, __, ___) =>
                            ColoredBox(color: cs.surfaceContainerHighest),
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
                            cs.surfaceContainerHigh.withValues(alpha: 0.92),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      top: 10,
                      right: 10,
                      child: FilledButton.tonal(
                        style: FilledButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                        ),
                        onPressed: () => showBannerPicker(
                          context,
                          games: _entries,
                          banner: _banner,
                          onSaved: _load,
                        ),
                        child: const Text('Banner'),
                      ),
                    ),
                  ],
                ),
              ),
              Transform.translate(
                offset: const Offset(0, -36),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Material(
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
                                  border: Border.all(
                                    color: cs.surfaceContainerHigh,
                                    width: 4,
                                  ),
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
                                    border: Border.all(
                                      color: cs.surfaceContainerHigh,
                                      width: 2,
                                    ),
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
                      const SizedBox(width: 12),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 6),
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
                                  padding: const EdgeInsets.only(top: 6),
                                  child: TextButton.icon(
                                    onPressed: () => showPasswordEditor(context),
                                    icon: const Icon(Icons.key_rounded, size: 16),
                                    label: const Text('Change password'),
                                    style: TextButton.styleFrom(
                                      visualDensity: VisualDensity.compact,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
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
