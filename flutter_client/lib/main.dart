import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dynamic_color/dynamic_color.dart';
import 'services/api_client.dart';
import 'state/auth_controller.dart';
import 'state/catalog_controller.dart';
import 'state/theme_controller.dart';
import 'router.dart';

void main() {
  final api = ApiClient();
  final auth = AuthController(api);
  final theme = ThemeController();
  final catalog = CatalogController();
  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<AuthController>.value(value: auth),
        ChangeNotifierProvider<ThemeController>.value(value: theme),
        ChangeNotifierProvider<CatalogController>.value(value: catalog),
      ],
      child: SaveStateApp(auth: auth, theme: theme, catalog: catalog),
    ),
  );
}

class SaveStateApp extends StatefulWidget {
  final AuthController auth;
  final ThemeController theme;
  final CatalogController catalog;
  const SaveStateApp({
    super.key,
    required this.auth,
    required this.theme,
    required this.catalog,
  });

  @override
  State<SaveStateApp> createState() => _SaveStateAppState();
}

class _SaveStateAppState extends State<SaveStateApp> {
  @override
  void initState() {
    super.initState();
    widget.auth.load();
    widget.theme.load();
    widget.catalog.load();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeController>();
    return DynamicColorBuilder(
      builder: (lightDynamic, darkDynamic) {
        final darkColorScheme = theme.darkScheme(darkDynamic);
        final lightColorScheme = theme.lightScheme(lightDynamic);

        return MaterialApp.router(
          title: 'SaveState',
          themeMode: theme.materialThemeMode,
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: lightColorScheme,
            scaffoldBackgroundColor: lightColorScheme.surface,
          ),
          darkTheme: ThemeData(
            useMaterial3: true,
            colorScheme: darkColorScheme,
            scaffoldBackgroundColor: darkColorScheme.surface,
          ),
          builder: (context, child) {
            final page = child ?? const SizedBox.shrink();
            if (!theme.grain) return page;
            final opacity = [0.04, 0.08, 0.14][theme.grainIntensity.clamp(0, 2)];
            return Stack(
              fit: StackFit.expand,
              children: [
                page,
                IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Color.fromRGBO(255, 255, 255, opacity),
                    ),
                  ),
                ),
              ],
            );
          },
          routerConfig: router,
        );
      },
    );
  }
}
