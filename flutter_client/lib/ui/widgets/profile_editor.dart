import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../state/auth_controller.dart';
import 'user_avatar.dart';

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

  Future<List<String>> _discoverAvatars(ApiClient api) async {
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

  Future<void> _load() async {
    final auth = context.read<AuthController>();
    try {
      final api = context.read<ApiClient>();
      final profile = await api.getProfile();
      final avatars = await _discoverAvatars(api);
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
        child: Center(child: CircularProgressIndicator()),
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

Future<void> showProfileEditor(BuildContext context, {VoidCallback? onSaved}) {
  final cs = Theme.of(context).colorScheme;
  final wide = MediaQuery.sizeOf(context).width >= 720;
  final body = Padding(
    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
    child: ProfileEditor(onSaved: onSaved),
  );
  if (wide) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: cs.surfaceContainerHigh,
        insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480, maxHeight: 640),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                child: Row(
                  children: [
                    const Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(left: 12),
                        child: Text(
                          'Edit profile',
                          style: TextStyle(
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
        height: MediaQuery.sizeOf(ctx).height * 0.86,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 8, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Edit profile',
                      style: TextStyle(
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
