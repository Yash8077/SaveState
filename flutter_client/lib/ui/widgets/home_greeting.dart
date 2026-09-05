import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../state/auth_controller.dart';

class HomeGreeting extends StatelessWidget {
  const HomeGreeting({super.key});

  /// Time-of-day greeting + subtitle. Stable for the whole window.
  static ({String hello, String subtitle}) greeting([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    if (hour >= 5 && hour < 12) {
      return (
        hello: 'Good morning',
        subtitle: 'Another day, another adventure.',
      );
    }
    if (hour >= 12 && hour < 17) {
      return (
        hello: 'Good afternoon',
        subtitle: 'Pick up where you left off.',
      );
    }
    if (hour >= 17 && hour < 21) {
      return (
        hello: 'Good evening',
        subtitle: 'Time to settle in and play.',
      );
    }
    if (hour >= 21 && hour < 24) {
      return (
        hello: 'Good night',
        subtitle: 'End the day with a good game.',
      );
    }
    return (
      hello: 'Night owl',
      subtitle: 'Keep the adventure going.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final theme = Theme.of(context);
    final auth = context.watch<AuthController>();
    final user = auth.user;
    final name = user?.name.trim().split(RegExp(r'\s+')).first;
    final g = greeting();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 12, 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    text: g.hello,
                    children: [
                      if (name != null && name.isNotEmpty)
                        TextSpan(
                          text: ', $name',
                          style: TextStyle(color: cs.primary),
                        ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  g.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: cs.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),

          // AppShell owns the avatar at the far right. Leave its slot here
          // so Search sits on the exact same header line without overlapping.
          Padding(
            padding: const EdgeInsets.only(right: 46),
            child: IconButton.filledTonal(
              tooltip: 'Search',
              onPressed: () => context.go('/discover?focus=1'),
              icon: const Icon(Icons.search_rounded),
            ),
          ),
        ],
      ),
    );
  }
}
