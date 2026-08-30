import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dynamic_color/dynamic_color.dart';
import 'models/types.dart';
import 'services/api_client.dart';
import 'router.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>(create: (_) => ApiClient()),
      ],
      child: const SaveStateApp(),
    ),
  );
}

class SaveStateApp extends StatelessWidget {
  const SaveStateApp({super.key});

  @override
  Widget build(BuildContext context) {
    return DynamicColorBuilder(
      builder: (ColorScheme? lightDynamic, ColorScheme? darkDynamic) {
        ColorScheme darkColorScheme;

        if (darkDynamic != null) {
          // On Android 12+, use the wallpaper's extracted colors (Material You)
          darkColorScheme = darkDynamic.copyWith(
            surface: darkDynamic.surfaceContainer,
            background: darkDynamic.surface,
          );
        } else {
          // Fallback M3 color scheme if dynamic color isn't supported
          darkColorScheme = ColorScheme.fromSeed(
            seedColor: const Color(0xFF3B82F6),
            brightness: Brightness.dark,
          );
        }

        return MaterialApp.router(
          title: 'SaveState',
          themeMode: ThemeMode.dark, // Force dark theme for now
          darkTheme: ThemeData(
            useMaterial3: true,
            colorScheme: darkColorScheme,
            scaffoldBackgroundColor: darkColorScheme.background,
            appBarTheme: const AppBarTheme(
              centerTitle: true,
              elevation: 0,
            ),
          ),
          routerConfig: router,
        );
      },
    );
  }
}
