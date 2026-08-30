import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../state/auth_controller.dart';
import 'save_state_mark.dart';

class HomeGreeting extends StatelessWidget {
  const HomeGreeting({super.key});

  /// AnymeX-style time greetings. Pair is stable for the hour.
  static String hello([DateTime? now]) {
    final t = now ?? DateTime.now();
    final hour = t.hour;
    final alt = (t.day + hour).isEven;
    if (hour >= 5 && hour < 12) {
      return alt ? 'Rise and shine' : 'Good morning';
    }
    if (hour >= 12 && hour < 17) {
      return alt ? 'Happy snacking' : 'Good afternoon';
    }
    if (hour >= 17 && hour < 21) {
      return alt ? 'Keep it chill' : 'Good evening';
    }
    return alt ? "You're up late" : 'Goodnight';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final theme = Theme.of(context);
    final auth = context.watch<AuthController>();
    final user = auth.user;
    final name = user?.name.trim().split(RegExp(r'\s+')).first;
    final initial =
        (name != null && name.isNotEmpty) ? name[0].toUpperCase() : null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 12, 2),
      child: Row(
        children: [
          Expanded(
            child: Text.rich(
              TextSpan(
                text: hello(),
                children: [
                  if (name != null && name.isNotEmpty)
                    TextSpan(
                      text: ' $name',
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
          ),
          IconButton.filledTonal(
            tooltip: 'Search',
            onPressed: () => context.go('/search'),
            icon: const Icon(Icons.search_rounded),
          ),
          const SizedBox(width: 4),
          Material(
            color: cs.primaryContainer,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () =>
                  context.push(auth.isSignedIn ? '/settings' : '/login'),
              child: SizedBox(
                width: 42,
                height: 42,
                child: Center(
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
              ),
            ),
          ),
        ],
      ),
    );
  }
}
