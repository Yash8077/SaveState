import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../services/api_client.dart';
import '../../state/auth_controller.dart';
import '../widgets/user_avatar.dart';

const _avatars = <({String id, String name})>[
  (id: 'robot', name: 'Pulse'),
  (id: 'fox', name: 'Ember'),
  (id: 'owl', name: 'Nox'),
  (id: 'cat', name: 'Mochi'),
  (id: 'wolf', name: 'Ash'),
  (id: 'dragon', name: 'Jade'),
  (id: 'octopus', name: 'Ink'),
  (id: 'bird', name: 'Sky'),
  (id: 'bear', name: 'Honey'),
  (id: 'alien', name: 'Nova'),
  (id: 'knight', name: 'Aegis'),
  (id: 'slime', name: 'Bloom'),
  (id: 'pad', name: 'Pad'),
  (id: 'cart', name: 'Cart'),
  (id: 'dice', name: 'Dice'),
  (id: 'sword', name: 'Blade'),
  (id: 'potion', name: 'Flask'),
  (id: 'arcade', name: 'Arcade'),
  (id: 'chest', name: 'Loot'),
  (id: 'ghost', name: 'Haunt'),
];

String avatarPath(String id) => '/avatars/$id.svg';

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
    if (!auth.isSignedIn) {
      setState(() => _loading = false);
      return;
    }
    try {
      final profile = await context.read<ApiClient>().getProfile();
      if (!mounted) return;
      _name.text = profile['name']?.toString() ?? auth.user?.name ?? '';
      setState(() {
        _image = profile['image']?.toString();
        _hasPassword = profile['hasPassword'] == true;
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
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error!, style: TextStyle(color: cs.error)),
                  ),
                Center(
                  child: UserAvatar(
                    image: _image,
                    name: _name.text,
                    size: 88,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  auth.user?.email ?? '',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: cs.onSurfaceVariant),
                ),
                const SizedBox(height: 20),
                Text(
                  'Avatar',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: cs.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 10),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _avatars.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 6,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                  ),
                  itemBuilder: (context, i) {
                    final avatar = _avatars[i];
                    final src = avatarPath(avatar.id);
                    final selected = _image == src;
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
                          child: UserAvatar(
                            image: src,
                            name: avatar.name,
                            size: 48,
                          ),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 8),
                Text(
                  'Custom photos can be uploaded on the website.',
                  style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                ),
                const SizedBox(height: 18),
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
                const SizedBox(height: 28),
                Text(
                  'Password',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: cs.onSurface,
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
                const SizedBox(height: 28),
                OutlinedButton(
                  onPressed: () async {
                    await auth.signOut();
                    if (context.mounted) context.go('/');
                  },
                  child: const Text('Sign out'),
                ),
              ],
            ),
    );
  }
}
