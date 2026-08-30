import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';

import 'ui/screens/home_screen.dart';
import 'ui/screens/search_screen.dart';
import 'ui/screens/library_screen.dart';
import 'ui/screens/stats_screen.dart';
import 'ui/screens/login_screen.dart';
import 'ui/screens/game_details_screen.dart';
import 'ui/screens/settings_screen.dart';
import 'ui/widgets/app_shell.dart';

final _rootKey = GlobalKey<NavigatorState>();

/// Tab pages stay in the shell; no extra stack entry, so Android back
/// is handled by [AppShell] (inner tab → Home, Home → launcher).
CustomTransitionPage<void> _tabPage(GoRouterState state, Widget child) {
  return NoTransitionPage<void>(
    key: state.pageKey,
    child: child,
  );
}

final router = GoRouter(
  navigatorKey: _rootKey,
  initialLocation: '/',
  routes: [
    ShellRoute(
      builder: (context, state, child) {
        return AppShell(child: child);
      },
      routes: [
        GoRoute(
          path: '/',
          pageBuilder: (context, state) =>
              _tabPage(state, const HomeScreen()),
        ),
        GoRoute(
          path: '/search',
          pageBuilder: (context, state) => _tabPage(
            state,
            SearchScreen(q: state.uri.queryParameters['q']),
          ),
        ),
        GoRoute(
          path: '/library',
          pageBuilder: (context, state) =>
              _tabPage(state, const LibraryScreen()),
        ),
        GoRoute(
          path: '/stats',
          pageBuilder: (context, state) =>
              _tabPage(state, const StatsScreen()),
        ),
      ],
    ),
    GoRoute(
      path: '/login',
      parentNavigatorKey: _rootKey,
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/settings',
      parentNavigatorKey: _rootKey,
      builder: (context, state) => const SettingsScreen(),
    ),
    GoRoute(
      path: '/game/:id',
      parentNavigatorKey: _rootKey,
      builder: (context, state) =>
          GameDetailsScreen(id: state.pathParameters['id']!),
    ),
  ],
);
