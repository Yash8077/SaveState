import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'account_sheet.dart';
import 'pill_nav.dart';

const _destinations = <PillDestination>[
  PillDestination(
    icon: Icons.home_outlined,
    selectedIcon: Icons.home_rounded,
    label: 'Home',
  ),
  PillDestination(
    icon: Icons.explore_outlined,
    selectedIcon: Icons.explore_rounded,
    label: 'Discover',
  ),
  PillDestination(
    icon: Icons.library_books_outlined,
    selectedIcon: Icons.library_books_rounded,
    label: 'Library',
  ),
  PillDestination(
    icon: Icons.bar_chart_outlined,
    selectedIcon: Icons.bar_chart_rounded,
    label: 'Stats',
  ),
  PillDestination(
    icon: Icons.emoji_events_outlined,
    selectedIcon: Icons.emoji_events_rounded,
    label: 'Trophies',
  ),
];

class AppShell extends StatelessWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  static int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;

    if (location == '/') return 0;
    if (location.startsWith('/discover') || location.startsWith('/search')) {
      return 1;
    }
    if (location.startsWith('/library')) return 2;
    if (location.startsWith('/stats')) return 3;
    if (location.startsWith('/trophies')) return 4;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/');
      case 1:
        context.go('/discover');
      case 2:
        context.go('/library');
      case 3:
        context.go('/stats');
      case 4:
        context.go('/trophies');
    }
  }

  @override
  Widget build(BuildContext context) {
    final index = _calculateSelectedIndex(context);
    final wide = MediaQuery.sizeOf(context).width >= 720;
    final systemPadding = MediaQuery.paddingOf(context);

    final pill = PillNav(
      axis: wide ? Axis.vertical : Axis.horizontal,
      index: index,
      destinations: _destinations,
      onSelect: (i) => _onItemTapped(i, context),
    );

    return PopScope(
      canPop: index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        context.go('/');
      },
      child: Scaffold(
        body: Stack(
          children: [
            // Each shell page owns its own top SafeArea. Do not add another
            // top SafeArea here, otherwise every page header is shifted down.
            Positioned.fill(
              child: Padding(
                padding: EdgeInsets.only(
                  left: wide ? 84 : 0,
                  bottom: wide ? 0 : 84 + systemPadding.bottom,
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 280),
                  switchInCurve: Curves.easeOutCubic,
                  switchOutCurve: Curves.easeInCubic,
                  transitionBuilder: (child, animation) {
                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0, 0.035),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    );
                  },
                  child: KeyedSubtree(
                    key: ValueKey(
                      GoRouterState.of(context).uri.path,
                    ),
                    child: child,
                  ),
                ),
              ),
            ),

            // Keep the profile avatar in the same 48dp header slot used by
            // page-level IconButtons, while leaving it at the top-right.
            Positioned(
              top: systemPadding.top + 16,
              right: 16,
              child: const SizedBox(
                width: 48,
                height: 48,
                child: Center(
                  child: AccountAvatarButton(size: 38),
                ),
              ),
            ),

            Positioned(
              left: wide ? 12 : 0,
              right: wide ? null : 0,
              top: wide ? 0 : null,
              bottom: wide ? 0 : 10 + systemPadding.bottom,
              child: wide
                  ? Center(child: pill)
                  : Align(
                      alignment: Alignment.bottomCenter,
                      child: pill,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
