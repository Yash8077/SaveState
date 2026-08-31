import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../models/types.dart';
import '../../services/api_client.dart';
import '../../state/auth_controller.dart';
import 'user_avatar.dart';
import 'm3_progress.dart';

Future<List<String>> discoverAvatars(ApiClient api) async {
  final found = <String>{};
  try {
    final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
    for (final path in manifest.listAssets()) {
      final match = RegExp(r'avatars/(avatar_\d+)\.png$').firstMatch(path);
      if (match != null) found.add('/avatars/${match.group(1)}.png');
    }
  } catch (_) {}
  try {
    final raw = await rootBundle.loadString('AssetManifest.json');
    final decoded = jsonDecode(raw);
    if (decoded is Map) {
      for (final key in decoded.keys) {
        final match =
            RegExp(r'avatars/(avatar_\d+)\.png$').firstMatch(key.toString());
        if (match != null) found.add('/avatars/${match.group(1)}.png');
      }
    }
  } catch (_) {}
  found.addAll(await api.listAvatars());
  if (found.isEmpty) {
    for (var i = 1; i <= 32; i++) {
      found.add('/avatars/avatar_$i.png');
    }
  }
  final list = found.toList();
  int n(String s) =>
      int.tryParse(RegExp(r'avatar_(\d+)').firstMatch(s)?.group(1) ?? '') ?? 0;
  list.sort((a, b) => n(a).compareTo(n(b)));
  return list;
}

class ProfileEditor extends StatefulWidget {
  final VoidCallback? onSaved;
  const ProfileEditor({super.key, this.onSaved});

  @override
  State<ProfileEditor> createState() => _ProfileEditorState();
}

class _ProfileEditorState extends State<ProfileEditor> {
  final _name = TextEditingController();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  String? _image;
  bool _hasPassword = false;
  bool _loading = true;
  bool _saving = false;
  bool _passwordBusy = false;
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

  Future<void> _load() async {
    final auth = context.read<AuthController>();
    try {
      final api = context.read<ApiClient>();
      final profile = await api.getProfile();
      final avatars = await discoverAvatars(api);
      if (!mounted) return;
      _name.text = profile['name']?.toString() ?? auth.user?.name ?? '';
      setState(() {
        _image = canonicalizeAvatar(profile['image']?.toString());
        _hasPassword = profile['hasPassword'] == true;
        _avatarSrcs = avatars;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _name.text = auth.user?.name ?? '';
        _image = auth.user?.image;
        _loading = false;
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
      widget.onSaved?.call();
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
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: M3Loading()),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Avatar',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: cs.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _avatarSrcs.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
          ),
          itemBuilder: (context, i) {
            final src = _avatarSrcs[i];
            final selected = canonicalizeAvatar(_image) == src;
            return InkWell(
              customBorder: const CircleBorder(),
              onTap: () => setState(() => _image = src),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected ? cs.primary : Colors.transparent,
                    width: 3,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(2),
                  child: UserAvatar(image: src, name: 'Avatar', size: 64),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 16),
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
        const SizedBox(height: 20),
        Text(
          'Password',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: cs.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        if (!_hasPassword)
          Text(
            'You signed in with Google, so there is no password to change here.',
            style: TextStyle(color: cs.onSurfaceVariant),
          )
        else ...[
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
        ],
      ],
    );
  }
}

Future<void> _presentSheet(
  BuildContext context, {
  required String title,
  required Widget body,
  double maxHeight = 640,
}) {
  final cs = Theme.of(context).colorScheme;
  final wide = MediaQuery.sizeOf(context).width >= 720;
  if (wide) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: cs.surfaceContainerHigh,
        insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: SizedBox(
          width: 480,
          height: maxHeight,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 12),
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Done'),
                    ),
                  ],
                ),
              ),
              Expanded(child: SingleChildScrollView(child: body)),
            ],
          ),
        ),
      ),
    );
  }
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: cs.surfaceContainerHigh,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(ctx).height * 0.72,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 8, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Done'),
                  ),
                ],
              ),
            ),
            Expanded(child: SingleChildScrollView(child: body)),
          ],
        ),
      ),
    ),
  );
}

Future<void> showProfileEditor(BuildContext context, {VoidCallback? onSaved}) {
  return _presentSheet(
    context,
    title: 'Edit profile',
    body: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: ProfileEditor(onSaved: onSaved),
    ),
  );
}

Future<void> showAvatarPicker(
  BuildContext context, {
  required String name,
  String? image,
  VoidCallback? onSaved,
}) async {
  final api = context.read<ApiClient>();
  final auth = context.read<AuthController>();
  final cs = Theme.of(context).colorScheme;
  final srcs = await discoverAvatars(api);
  if (!context.mounted) return;
  var selected = canonicalizeAvatar(image);
  await _presentSheet(
    context,
    title: 'Change avatar',
    body: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: StatefulBuilder(
        builder: (ctx, setLocal) {
          return GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: srcs.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
            ),
            itemBuilder: (context, i) {
              final src = srcs[i];
              final isOn = canonicalizeAvatar(selected) == src;
              return InkWell(
                customBorder: const CircleBorder(),
                onTap: () async {
                  setLocal(() => selected = src);
                  try {
                    final profile = await api.updateProfile(name: name, image: src);
                    await auth.applyProfile(
                      name: profile['name']?.toString() ?? name,
                      image: profile['image']?.toString() ?? src,
                    );
                    onSaved?.call();
                    if (ctx.mounted) Navigator.pop(ctx);
                  } catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        SnackBar(content: Text('$e')),
                      );
                    }
                  }
                },
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isOn ? cs.primary : Colors.transparent,
                      width: 3,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(2),
                    child: UserAvatar(image: src, name: 'Avatar', size: 64),
                  ),
                ),
              );
            },
          );
        },
      ),
    ),
  );
}

Future<void> showNameEditor(
  BuildContext context, {
  required String name,
  String? image,
  VoidCallback? onSaved,
}) async {
  final controller = TextEditingController(text: name);
  final api = context.read<ApiClient>();
  final auth = context.read<AuthController>();
  await _presentSheet(
    context,
    title: 'Change name',
    maxHeight: 280,
    body: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: controller,
            maxLength: 40,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Display name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () async {
              final next = controller.text.trim();
              if (next.isEmpty || next.length > 40) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Name must be 1–40 characters')),
                );
                return;
              }
              try {
                final profile =
                    await api.updateProfile(name: next, image: image);
                await auth.applyProfile(
                  name: profile['name']?.toString() ?? next,
                  image: profile['image']?.toString() ?? image,
                );
                onSaved?.call();
                if (context.mounted) Navigator.pop(context);
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('$e')),
                  );
                }
              }
            },
            child: const Text('Save name'),
          ),
        ],
      ),
    ),
  );
  controller.dispose();
}

Future<void> showPasswordEditor(BuildContext context) {
  return _presentSheet(
    context,
    title: 'Change password',
    maxHeight: 420,
    body: const Padding(
      padding: EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: _PasswordFields(),
    ),
  );
}

class _PasswordFields extends StatefulWidget {
  const _PasswordFields();

  @override
  State<_PasswordFields> createState() => _PasswordFieldsState();
}

class _PasswordFieldsState extends State<_PasswordFields> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
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
    setState(() => _busy = true);
    try {
      await context.read<ApiClient>().changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
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
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _busy ? null : _save,
          child: Text(_busy ? 'Updating…' : 'Update password'),
        ),
      ],
    );
  }
}

Future<void> showBannerPicker(
  BuildContext context, {
  required List<GameEntry> games,
  String? banner,
  String? previewSrc,
  int focusY = 50,
  VoidCallback? onSaved,
}) {
  final ranked = [
    ...games.where((g) => g.favorite),
    ...games,
  ];
  final options = <({String id, String title, String src})>[];
  final seen = <String>{};
  for (final game in ranked) {
    final src = upgradeHeroUrl(game.headerUrl, game.catalogId);
    if (src == null || !seen.add(src)) continue;
    options.add((id: game.catalogId, title: game.title, src: src));
    if (options.length >= 12) break;
  }
  return _presentSheet(
    context,
    title: 'Change banner',
    body: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: _BannerBody(
        options: options,
        current: banner,
        previewSrc: previewSrc,
        focusY: focusY,
        onSaved: onSaved,
      ),
    ),
  );
}

class _BannerBody extends StatefulWidget {
  final List<({String id, String title, String src})> options;
  final String? current;
  final String? previewSrc;
  final int focusY;
  final VoidCallback? onSaved;
  const _BannerBody({
    required this.options,
    required this.current,
    required this.previewSrc,
    required this.focusY,
    this.onSaved,
  });

  @override
  State<_BannerBody> createState() => _BannerBodyState();
}

class _BannerBodyState extends State<_BannerBody> {
  late String? _current = widget.current;
  late String? _preview = widget.previewSrc ?? widget.current;
  late double _y = widget.focusY.toDouble();
  bool _busy = false;

  Alignment get _align => Alignment(0, ((_y.clamp(0, 100) - 50) / 50));

  Future<void> _save({String? next, bool clear = false, int? y}) async {
    setState(() => _busy = true);
    try {
      await context.read<ApiClient>().updateProfile(
            banner: next,
            clearBanner: clear,
            bannerY: (y ?? _y.round()).clamp(0, 100),
          );
      if (!mounted) return;
      setState(() {
        if (clear) {
          _current = null;
        } else if (next != null) {
          _current = next;
          _preview = next;
        }
      });
      widget.onSaved?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            clear
                ? 'Using automatic banner'
                : next != null
                    ? 'Banner updated'
                    : 'Crop saved',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _custom() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.image,
      withData: true,
    );
    final file = picked?.files.firstOrNull;
    final bytes = file?.bytes;
    if (bytes == null) return;
    if (bytes.length > 280000) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pick a smaller photo (under 280 KB)')),
      );
      return;
    }
    final mime = (file?.extension ?? 'jpg').toLowerCase() == 'png'
        ? 'png'
        : 'jpeg';
    await _save(next: 'data:image/$mime;base64,${base64Encode(bytes)}');
  }

  Widget _previewImage(String src) {
    if (src.startsWith('data:')) {
      return Image.memory(
        base64Decode(src.split(',').last),
        fit: BoxFit.cover,
        alignment: _align,
        width: double.infinity,
        height: 120,
      );
    }
    return CachedNetworkImage(
      imageUrl: src,
      fit: BoxFit.cover,
      alignment: _align,
      memCacheWidth: 1200,
      width: double.infinity,
      height: 120,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final shown = _preview;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (shown != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: _previewImage(shown),
          ),
        const SizedBox(height: 8),
        Text('Crop', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13)),
        Slider(
          value: _y.clamp(0, 100),
          min: 0,
          max: 100,
          onChanged: (v) => setState(() => _y = v),
          onChangeEnd: (v) => _save(y: v.round()),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Top', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 11)),
              Text('Bottom', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 11)),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Pick a game hero, upload a photo, or reset to automatic art.',
          style: TextStyle(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 12),
        if (widget.options.isEmpty)
          Text(
            'Add games to your library to use their artwork.',
            style: TextStyle(color: cs.onSurfaceVariant),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: widget.options.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 16 / 5,
            ),
            itemBuilder: (context, i) {
              final row = widget.options[i];
              final selected = _current == row.src;
              return InkWell(
                onTap: _busy ? null : () => _save(next: row.src),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: selected ? cs.primary : Colors.transparent,
                      width: 3,
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: CachedNetworkImage(
                      imageUrl: row.src,
                      fit: BoxFit.cover,
                      memCacheWidth: 800,
                    ),
                  ),
                ),
              );
            },
          ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          children: [
            FilledButton.tonal(
              onPressed: _busy ? null : _custom,
              child: const Text('Custom photo'),
            ),
            TextButton(
              onPressed: _busy ? null : () => _save(clear: true),
              child: const Text('Automatic'),
            ),
          ],
        ),
      ],
    );
  }
}

