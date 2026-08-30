import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../state/auth_controller.dart';
import '../../state/home_layout_controller.dart';
import '../../state/theme_controller.dart';
import '../widgets/save_state_mark.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeController>();
    final auth = context.watch<AuthController>();
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _sectionLabel('Appearance & Interface'),
          const SizedBox(height: 14),
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
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              backgroundColor: cs.surfaceContainerHighest,
              child: const SaveStateMark(size: 26),
            ),
            title: const Text('Themed icon'),
            subtitle: const Text(
              'The cartridge glow follows your wallpaper when Dynamic is on. On Android 13+ enable Themed icons in wallpaper settings to tint the home-screen icon too.',
            ),
          ),
          const SizedBox(height: 18),
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
          Text(
            'Appearance',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: cs.onSurfaceVariant,
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            secondary: Icon(Icons.blur_on, color: cs.primary),
            title: const Text('Bloom'),
            subtitle: const Text('Soft glowing gradient on details banners'),
            value: theme.bloom,
            onChanged: theme.setBloom,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            secondary: Icon(Icons.grain, color: cs.primary),
            title: const Text('Grain texture'),
            subtitle: const Text('Subtle film grain over the interface'),
            value: theme.grain,
            onChanged: theme.setGrain,
          ),
          if (theme.grain) ...[
            const SizedBox(height: 4),
            Text(
              'Grain intensity',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: cs.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 0, label: Text('Low')),
                ButtonSegment(value: 1, label: Text('Medium')),
                ButtonSegment(value: 2, label: Text('High')),
              ],
              selected: {theme.grainIntensity},
              onSelectionChanged: (next) =>
                  theme.setGrainIntensity(next.first),
            ),
          ],
          const SizedBox(height: 28),
          _sectionLabel('Home layout'),
          const SizedBox(height: 8),
          Text(
            'Show, hide, and drag to reorder homepage sections. Empty lists stay hidden.',
            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
          ),
          const SizedBox(height: 8),
          const _HomeLayoutEditor(),
          const SizedBox(height: 28),
          _sectionLabel('Account'),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.person_outline, color: cs.primary),
            title: Text(auth.isSignedIn
                ? (auth.user?.email ?? 'Signed in')
                : 'Not signed in'),
            subtitle: Text(auth.isSignedIn
                ? 'Library syncs to this account'
                : 'Sign in to sync your library'),
            trailing: auth.isSignedIn
                ? TextButton(
                    onPressed: () => auth.signOut(),
                    child: const Text('Sign out'),
                  )
                : TextButton(
                    onPressed: () => context.push('/login'),
                    child: const Text('Sign in'),
                  ),
          ),
          const SizedBox(height: 28),
          _sectionLabel('About'),
          const SizedBox(height: 8),
          const ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.info_outline),
            title: Text('SaveState'),
            subtitle: Text(
              'Theme options follow AnymeX appearance settings. Player, reader, extensions, and liquid wallpaper are not part of this app.',
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.1,
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

class _HomeLayoutEditor extends StatelessWidget {
  const _HomeLayoutEditor();

  @override
  Widget build(BuildContext context) {
    final layout = context.watch<HomeLayoutController>();
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: layout.reset,
            child: const Text('Reset'),
          ),
        ),
        ReorderableListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: layout.sections.length,
          onReorder: layout.reorder,
          itemBuilder: (context, index) {
            final row = layout.sections[index];
            return ListTile(
              key: ValueKey(row.id),
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.drag_handle, color: cs.onSurfaceVariant),
              title: Text(homeSectionTitles[row.id] ?? row.id),
              subtitle: Text(homeSectionHints[row.id] ?? 'Catalog rail'),
              trailing: Switch(
                value: row.enabled,
                onChanged: (value) => layout.toggle(row.id, value),
              ),
            );
          },
        ),
      ],
    );
  }
}
