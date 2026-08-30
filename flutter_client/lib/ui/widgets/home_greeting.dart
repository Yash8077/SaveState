import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../state/auth_controller.dart';
import 'save_state_mark.dart';

class HomeGreeting extends StatelessWidget {
  const HomeGreeting({super.key});

  static String hello([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    if (hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final theme = Theme.of(context);
    final user = context.watch<AuthController>().user;
    final name = user?.name.trim().split(RegExp(r'\s+')).first;
    final label =
        (name != null && name.isNotEmpty) ? '${hello()}, $name' : hello();
    final initial = (name != null && name.isNotEmpty) ? name[0].toUpperCase() : null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 12, 4),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: cs.primaryContainer,
            child: initial == null
                ? const SaveStateMark(size: 22)
                : Text(
                    initial,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: cs.onPrimaryContainer,
                    ),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
              ),
            ),
          ),
          IconButton.filledTonal(
            tooltip: 'Search',
            onPressed: () => context.go('/search'),
            icon: const Icon(Icons.search_rounded),
          ),
        ],
      ),
    );
  }
}
