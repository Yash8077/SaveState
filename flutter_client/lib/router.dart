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

CustomTransitionPage<void> _fadeSlide(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 320),
    reverseTransitionDuration: const Duration(milliseconds: 240),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.05),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}

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
          pageBuilder: (context, state) =>
              _fadeSlide(state, const HomeScreen()),
        ),
        GoRoute(
          path: '/search',
          pageBuilder: (context, state) => _fadeSlide(
            state,
            SearchScreen(q: state.uri.queryParameters['q']),
          ),
        ),
        GoRoute(
          path: '/library',
          pageBuilder: (context, state) =>
              _fadeSlide(state, const LibraryScreen()),
        ),
        GoRoute(
          path: '/stats',
          pageBuilder: (context, state) =>
              _fadeSlide(state, const StatsScreen()),
        ),
      ],
    ),
    GoRoute(
      path: '/login',
      pageBuilder: (context, state) => _fadeSlide(state, const LoginScreen()),
    ),
    GoRoute(
      path: '/settings',
      pageBuilder: (context, state) =>
          _fadeSlide(state, const SettingsScreen()),
    ),
    GoRoute(
      path: '/game/:id',
      pageBuilder: (context, state) => _fadeSlide(
        state,
        GameDetailsScreen(id: state.pathParameters['id']!),
      ),
    ),
  ],
);
