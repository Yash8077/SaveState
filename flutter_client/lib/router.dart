import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';

import 'ui/screens/home_screen.dart';
import 'ui/screens/discover_screen.dart';
import 'ui/screens/library_screen.dart';
import 'ui/screens/stats_screen.dart';
import 'ui/screens/trophies_screen.dart';
import 'ui/screens/trophy_game_details_screen.dart';
import 'ui/screens/login_screen.dart';
import 'ui/screens/game_details_screen.dart';
import 'ui/screens/settings_screen.dart';
import 'ui/screens/profile_screen.dart';
import 'ui/widgets/app_shell.dart';
import 'models/types.dart';

final _rootKey = GlobalKey<NavigatorState>();

CustomTransitionPage<void> _tabPage(GoRouterState state, Widget child) {
  return NoTransitionPage<void>(key: state.pageKey, child: child);
}

final router = GoRouter(
  navigatorKey: _rootKey,
  initialLocation: '/',
  routes: [
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(path: '/', pageBuilder: (context, state) => _tabPage(state, const HomeScreen())),
        GoRoute(
          path: '/discover',
          pageBuilder: (context, state) => _tabPage(state, DiscoverScreen(
            q: state.uri.queryParameters['q'],
            focus: state.uri.queryParameters['focus'] == '1',
          )),
        ),
        GoRoute(
          path: '/search',
          redirect: (context, state) {
            final q = state.uri.queryParameters['q'];
            if (q != null && q.isNotEmpty) return '/discover?q=$q';
            return '/discover';
          },
        ),
        GoRoute(path: '/library', pageBuilder: (context, state) => _tabPage(state, const LibraryScreen())),
        GoRoute(path: '/stats', pageBuilder: (context, state) => _tabPage(state, const StatsScreen())),
        GoRoute(path: '/trophies', pageBuilder: (context, state) => _tabPage(state, const TrophiesScreen())),
      ],
    ),
    GoRoute(path: '/login', parentNavigatorKey: _rootKey, builder: (context, state) => const LoginScreen()),
    GoRoute(path: '/settings', parentNavigatorKey: _rootKey, builder: (context, state) => const SettingsScreen()),
    GoRoute(path: '/profile', parentNavigatorKey: _rootKey, builder: (context, state) => const ProfileScreen()),
    GoRoute(
      path: '/trophies/:catalogId',
      parentNavigatorKey: _rootKey,
      builder: (context, state) => TrophyGameDetailsScreen(
        catalogId: state.pathParameters['catalogId']!,
      ),
    ),
    GoRoute(
      path: '/game/:id',
      parentNavigatorKey: _rootKey,
      builder: (context, state) => GameDetailsScreen(
        id: state.pathParameters['id']!,
        preview: state.extra is CatalogGame ? state.extra as CatalogGame : null,
      ),
    ),
  ],
);
