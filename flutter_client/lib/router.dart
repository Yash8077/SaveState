import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';

import 'ui/screens/home_screen.dart';
import 'ui/screens/search_screen.dart';
import 'ui/screens/library_screen.dart';
import 'ui/screens/stats_screen.dart';
import 'ui/screens/login_screen.dart';
import 'ui/screens/game_details_screen.dart';
import 'ui/widgets/app_shell.dart';

final router = GoRouter(
  initialLocation: '/',
  routes: [
    ShellRoute(
      builder: (context, state, child) {
        return AppShell(child: child);
      },
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(
          path: '/search',
          builder: (context, state) => SearchScreen(q: state.uri.queryParameters['q']),
        ),
        GoRoute(
          path: '/library',
          builder: (context, state) => const LibraryScreen(),
        ),
        GoRoute(
          path: '/stats',
          builder: (context, state) => const StatsScreen(),
        ),
      ],
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/game/:id',
      builder: (context, state) => GameDetailsScreen(id: state.pathParameters['id']!),
    ),
  ],
);
