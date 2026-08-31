import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/types.dart';
import '../../services/api_client.dart';
import '../../state/auth_controller.dart';
import '../widgets/game_rail.dart';
import '../widgets/user_avatar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _name = TextEditingController();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  String? _image;
  bool _hasPassword = false;
  bool _loading = true;
  bool _saving = false;
  bool _passwordBusy = false;
  String? _error;
  List<GameEntry> _entries = const [];
  List<String> _avatarSrcs = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<List<String>> _discoverAvatars(ApiClient api) async {
    final found = <String>{};
    try {
      final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
      for (final path in manifest.listAssets()) {
        final match =
            RegExp(r'^assets/avatars/(avatar_\d+)\.png$').firstMatch(path);
        if (match != null) found.add('/avatars/${match.group(1)}.png');
      }
    } catch (_) {}
    found.addAll(await api.listAvatars());
    final list = found.toList();
    int n(String s) =>
        int.tryParse(RegExp(r'avatar_(\d+)').firstMatch(s)?.group(1) ?? '') ?? 0;
    list.sort((a, b) => n(a).compareTo(n(b)));
    return list;
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
    try {
      final api = context.read<ApiClient>();
      final profile = await api.getProfile();
      final avatars = await _discoverAvatars(api);
      List<GameEntry> library = const [];
      try {
        library = await api.getLibrary();
      } on ApiException catch (e) {
        if (e.status != 401) rethrow;
      }
      if (!mounted) return;
      _name.text = profile['name']?.toString() ?? auth.user?.name ?? '';
      setState(() {
        _image = canonicalizeAvatar(profile['image']?.toString());
        _hasPassword = profile['hasPassword'] == true;
        _entries = library;
        _avatarSrcs = avatars;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
        _name.text = auth.user?.name ?? '';
        _image = auth.user?.image;
      });
    }
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty || name.length > 40) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name must be 1–40 characters')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final profile = await context.read<ApiClient>().updateProfile(
            name: name,
            image: _image,
          );
      if (!mounted) return;
      await context.read<AuthController>().applyProfile(
            name: profile['name']?.toString() ?? name,
            image: profile['image']?.toString() ?? _image,
          );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile saved')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _savePassword() async {
    if (_next.text.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New password needs at least 8 characters')),
      );
      return;
    }
    if (_next.text != _confirm.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New passwords do not match')),
      );
      return;
    }
    setState(() => _passwordBusy = true);
    try {
      await context.read<ApiClient>().changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      if (!mounted) return;
      _current.clear();
      _next.clear();
      _confirm.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _passwordBusy = false);
    }
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
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 800;
                final identity = _identity(cs, auth);
                final account = _account(cs, auth);
                final shelves = _shelves(cs);
                if (wide) {
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 360,
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(16, 8, 8, 32),
                          children: [identity, const SizedBox(height: 16), account],
                        ),
                      ),
                      Expanded(
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(8, 8, 8, 32),
                          children: shelves,
                        ),
                      ),
                    ],
                  );
                }
                return ListView(
                  padding: const EdgeInsets.fromLTRB(0, 8, 0, 32),
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: identity,
                    ),
                    ...shelves,
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: account,
                    ),
                  ],
                );
              },
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
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(height: 88, color: cs.primary.withValues(alpha: 0.55)),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Transform.translate(
                  offset: const Offset(0, -28),
                  child: UserAvatar(
                    image: _image,
                    name: _name.text,
                    size: 84,
                  ),
                ),
                Transform.translate(
                  offset: const Offset(0, -16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _name.text.isEmpty ? 'Player' : _name.text,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        auth.user?.email ?? '',
                        style: TextStyle(color: cs.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(_error!, style: TextStyle(color: cs.error)),
                  ),
                Row(
                  children: [
                    Expanded(child: _chip(cs, 'Logged', '${_entries.length}')),
                    const SizedBox(width: 8),
                    Expanded(child: _chip(cs, 'Hours', '${hours}h')),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _chip(
                        cs,
                        'Avg score',
                        avg == null ? '—' : avg.toStringAsFixed(1),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _chip(cs, 'Beaten this year', '$beatenYear'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => context.push('/stats'),
                  child: const Text('Full stats'),
                ),
              ],
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

  List<Widget> _shelves(ColorScheme cs) {
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
        GameRailWidget(title: 'Currently playing', games: playing)
      else
        _empty(cs, 'Currently playing', 'Nothing in progress.'),
      if (favorites.isNotEmpty)
        GameRailWidget(title: 'Favorites', games: favorites)
      else
        _empty(cs, 'Favorites', 'Star a game to pin it here.'),
      if (beatenCards.isNotEmpty)
        GameRailWidget(title: 'Recently beaten', games: beatenCards)
      else
        _empty(cs, 'Recently beaten', 'Finish something and it lands here.'),
    ];
  }

  Widget _empty(ColorScheme cs, String title, String hint) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(hint, style: TextStyle(color: cs.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }

  Future<void> _openPicker(ColorScheme cs) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return Dialog(
              insetPadding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440, maxHeight: 560),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Choose avatar',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: () => Navigator.pop(ctx),
                            icon: const Icon(Icons.close_rounded),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Flexible(
                        child: GridView.builder(
                          shrinkWrap: true,
                          itemCount: _avatarSrcs.length,
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 4,
                            mainAxisSpacing: 10,
                            crossAxisSpacing: 10,
                          ),
                          itemBuilder: (context, i) {
                            final src = _avatarSrcs[i];
                            final selected = canonicalizeAvatar(_image) == src;
                            return InkWell(
                              customBorder: const CircleBorder(),
                              onTap: () {
                                setState(() => _image = src);
                                setLocal(() {});
                              },
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: selected
                                        ? cs.primary
                                        : Colors.transparent,
                                    width: 3,
                                  ),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(2),
                                  child: UserAvatar(
                                    image: src,
                                    name: 'Avatar',
                                    size: 72,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Done'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _account(ColorScheme cs, AuthController auth) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Account',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              'Name, avatar, and password.',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                UserAvatar(image: _image, name: _name.text, size: 64),
                const SizedBox(width: 12),
                FilledButton.tonal(
                  onPressed: () => _openPicker(cs),
                  child: const Text('Change avatar'),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _name,
              maxLength: 40,
              decoration: const InputDecoration(
                labelText: 'Display name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Saving…' : 'Save profile'),
            ),
            const SizedBox(height: 8),
            if (!_hasPassword)
              Text(
                'You signed in with Google, so there is no password to change here.',
                style: TextStyle(color: cs.onSurfaceVariant),
              )
            else
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('Change password'),
                children: [
                  TextField(
                    controller: _current,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Current password',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _next,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'New password',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _confirm,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Confirm new password',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  FilledButton.tonal(
                    onPressed: _passwordBusy ? null : _savePassword,
                    child: Text(_passwordBusy ? 'Updating…' : 'Update password'),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () async {
                await auth.signOut();
                if (context.mounted) context.go('/');
              },
              child: const Text('Sign out'),
            ),
          ],
        ),
      ),
    );
  }
}
