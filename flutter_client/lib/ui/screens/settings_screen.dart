import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../services/api_client.dart';
import '../../state/auth_controller.dart';
import '../../state/home_layout_controller.dart';
import '../../state/theme_controller.dart';
import '../widgets/save_state_mark.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          _tile(
            context,
            icon: Icons.palette_outlined,
            title: 'Appearance',
            hint: 'Theme, accent, Material You',
            page: const _AppearancePage(),
          ),
          _tile(
            context,
            icon: Icons.view_agenda_outlined,
            title: 'Order in Home',
            hint: 'Playing, wishlist, recommended, PlayStation',
            page: const _OrderPage(LayoutSurface.home),
          ),
          _tile(
            context,
            icon: Icons.explore_outlined,
            title: 'Order in Discover',
            hint: 'Carousel, Steam rails, PlayStation',
            page: const _OrderPage(LayoutSurface.discover),
          ),
          _tile(
            context,
            icon: Icons.archive_outlined,
            title: 'Backup',
            hint: 'Export and import your library',
            page: const _BackupPage(),
          ),
          _tile(
            context,
            icon: Icons.person_outline,
            title: 'Account',
            hint: 'Profile and sign in',
            page: const _AccountPage(),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Tap a row. Back returns here.',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _tile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String hint,
    required Widget page,
  }) {
    final cs = Theme.of(context).colorScheme;
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: cs.primaryContainer,
        foregroundColor: cs.primary,
        child: Icon(icon, size: 20),
      ),
      title: Text(title),
      subtitle: Text(hint),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => page),
      ),
    );
  }
}

class _AppearancePage extends StatelessWidget {
  const _AppearancePage();

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeController>();
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Appearance')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Text(
            'Theme',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: cs.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _modeCard(
                context,
                label: 'Light',
                subtitle: 'Paper',
                selected: theme.mode == AppThemeMode.light,
                preview: const LinearGradient(
                  colors: [Color(0xFFF3F6F7), Colors.white],
                ),
                onTap: () => theme.setMode(AppThemeMode.light),
              ),
              const SizedBox(width: 8),
              _modeCard(
                context,
                label: 'Dark',
                subtitle: 'Charcoal',
                selected: theme.mode == AppThemeMode.dark,
                preview: LinearGradient(
                  colors: [cs.surfaceContainerHighest, cs.surface],
                ),
                onTap: () => theme.setMode(AppThemeMode.dark),
              ),
              const SizedBox(width: 8),
              _modeCard(
                context,
                label: 'System',
                subtitle: 'Device',
                selected: theme.mode == AppThemeMode.system,
                preview: const LinearGradient(
                  colors: [Color(0xFFF3F6F7), Color(0xFF1A2326)],
                ),
                onTap: () => theme.setMode(AppThemeMode.system),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _modeCard(
                context,
                label: 'OLED',
                subtitle: 'True black',
                selected: theme.oled && theme.mode != AppThemeMode.light,
                preview: const LinearGradient(
                  colors: [Colors.black, Color(0xFF111111)],
                ),
                onTap: theme.mode == AppThemeMode.light
                    ? () {}
                    : () => theme.setOled(!theme.oled),
              ),
              const SizedBox(width: 8),
              _modeCard(
                context,
                label: 'Dynamic',
                subtitle: 'Material You',
                selected: theme.useDynamicColor,
                preview: const LinearGradient(
                  colors: [Color(0xFF4FD8C4), Color(0xFF8EC8FF)],
                ),
                onTap: () => theme.setDynamicColor(!theme.useDynamicColor),
              ),
            ],
          ),
          const SizedBox(height: 22),
          Text(
            'Accent',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: cs.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(ThemeController.accents.length, (i) {
              final selected = theme.accentIndex == i;
              return ChoiceChip(
                avatar: CircleAvatar(
                  backgroundColor: ThemeController.accents[i],
                ),
                label: Text(ThemeController.accentLabels[i]),
                selected: selected,
                onSelected: (_) => theme.setAccentIndex(i),
              );
            }),
          ),
          const SizedBox(height: 18),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              backgroundColor: cs.surfaceContainerHighest,
              child: const SaveStateMark(size: 26),
            ),
            title: const Text('Material You'),
            subtitle: const Text(
              'The cartridge glow follows your wallpaper when Dynamic is on. On Android 13+ enable Themed icons in wallpaper settings to tint the home-screen icon too.',
            ),
          ),
        ],
      ),
    );
  }

  Widget _modeCard(
    BuildContext context, {
    required String label,
    required String subtitle,
    required bool selected,
    required Gradient preview,
    required VoidCallback onTap,
  }) {
    final cs = Theme.of(context).colorScheme;
    return Expanded(
      child: Material(
        color: selected
            ? cs.primary.withOpacity(0.12)
            : cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                width: selected ? 2 : 1,
                color: selected ? cs.primary : cs.outlineVariant,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 42,
                  decoration: BoxDecoration(
                    gradient: preview,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  label,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: selected ? cs.primary : cs.onSurface,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderPage extends StatelessWidget {
  const _OrderPage(this.surface);
  final LayoutSurface surface;

  @override
  Widget build(BuildContext context) {
    final layout = context.watch<HomeLayoutController>();
    final cs = Theme.of(context).colorScheme;
    final sections = layout.sectionsFor(surface);
    final home = surface == LayoutSurface.home;
    return Scaffold(
      appBar: AppBar(
        title: Text(home ? 'Order in Home' : 'Order in Discover'),
        actions: [
          TextButton(
            onPressed: () => layout.reset(surface),
            child: const Text('Reset'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 32),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              home
                  ? 'Show, hide, and drag to reorder Home. Empty lists stay hidden.'
                  : 'Show, hide, and drag to reorder Discover. Empty lists stay hidden.',
            ),
          ),
          if (!home)
            SwitchListTile(
              title: const Text('Auto-play carousel'),
              subtitle: const Text('Rotate featured games on Discover'),
              value: layout.heroAutoplay,
              onChanged: layout.setHeroAutoplay,
            ),
          ReorderableListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: sections.length,
            onReorder: (from, to) => layout.reorder(surface, from, to),
            itemBuilder: (context, index) {
              final row = sections[index];
              return ListTile(
                key: ValueKey(row.id),
                leading: Icon(Icons.drag_handle, color: cs.onSurfaceVariant),
                title: Text(homeSectionTitles[row.id] ?? row.id),
                subtitle: Text(homeSectionHints[row.id] ?? 'Catalog rail'),
                trailing: Switch(
                  value: row.enabled,
                  onChanged: (value) => layout.toggle(surface, row.id, value),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _AccountPage extends StatelessWidget {
  const _AccountPage();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListTile(
        leading: const Icon(Icons.person_outline),
        title: Text(auth.isSignedIn
            ? (auth.user?.name.isNotEmpty == true
                ? auth.user!.name
                : (auth.user?.email ?? 'Signed in'))
            : 'Not signed in'),
        subtitle: Text(auth.isSignedIn
            ? 'Open profile to change name, avatar, or password'
            : 'Sign in to sync your library'),
        trailing: TextButton(
          onPressed: () =>
              context.push(auth.isSignedIn ? '/profile' : '/login'),
          child: Text(auth.isSignedIn ? 'Profile' : 'Sign in'),
        ),
      ),
    );
  }
}

class _BackupPage extends StatefulWidget {
  const _BackupPage();

  @override
  State<_BackupPage> createState() => _BackupPageState();
}

class _BackupPageState extends State<_BackupPage> {
  bool _busy = false;

  String _filename(String ext) {
    final now = DateTime.now();
    final dd = now.day.toString().padLeft(2, '0');
    final mm = now.month.toString().padLeft(2, '0');
    return 'savestate-library-$dd-$mm-${now.year}.$ext';
  }

  Future<void> _export(String ext) async {
    final auth = context.read<AuthController>();
    if (!auth.isSignedIn) {
      context.push('/login');
      return;
    }
    setState(() => _busy = true);
    try {
      final backup = await context.read<ApiClient>().exportBackup();
      final name = _filename(ext);
      final body = ext == 'csv'
          ? _toCsv(backup)
          : const JsonEncoder.withIndent('  ').convert(backup);
      await Share.shareXFiles([
        XFile.fromData(
          utf8.encode(body),
          mimeType: ext == 'csv' ? 'text/csv' : 'application/json',
          name: name,
        ),
      ], fileNameOverrides: [name]);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _toCsv(Map<String, dynamic> backup) {
    final entries = backup['entries'];
    final rows = <String>[
      'catalogId,title,status,score,hours,favorite,notes,startedAt,finishedAt',
    ];
    if (entries is List) {
      for (final raw in entries) {
        if (raw is! Map) continue;
        String cell(Object? v) {
          final text = v?.toString() ?? '';
          if (text.contains(',') || text.contains('"') || text.contains('\n')) {
            return '"${text.replaceAll('"', '""')}"';
          }
          return text;
        }
        rows.add([
          cell(raw['catalogId']),
          cell(raw['title']),
          cell(raw['status']),
          cell(raw['score']),
          cell(raw['hours']),
          cell(raw['favorite']),
          cell(raw['notes']),
          cell(raw['startedAt']),
          cell(raw['finishedAt']),
        ].join(','));
      }
    }
    return '${rows.join('\n')}\n';
  }

  Future<void> _import() async {
    final auth = context.read<AuthController>();
    if (!auth.isSignedIn) {
      context.push('/login');
      return;
    }
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['json', 'csv'],
      withData: true,
    );
    final file = picked?.files.single;
    if (file == null) return;
    final bytes = file.bytes;
    if (bytes == null) return;
    setState(() => _busy = true);
    try {
      final text = utf8.decode(bytes);
      Object body = text;
      try {
        body = jsonDecode(text);
      } catch (_) {}
      final result = await context.read<ApiClient>().importBackup(body);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Imported ${result.added} new, updated ${result.updated}',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    return Scaffold(
      appBar: AppBar(title: const Text('Backup')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Text(
            auth.isSignedIn
                ? 'Download a copy of your library, or restore from a previous SaveState file. Import merges by game — it does not delete anything already on this account.'
                : 'Sign in to export or restore your library.',
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : () => _export('json'),
            child: Text(_busy ? 'Working…' : 'Export JSON'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _busy ? null : () => _export('csv'),
            child: const Text('Export CSV'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _busy ? null : _import,
            child: const Text('Import JSON or CSV'),
          ),
        ],
      ),
    );
  }
}
