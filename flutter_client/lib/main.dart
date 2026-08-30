import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dynamic_color/dynamic_color.dart';
import 'services/api_client.dart';
import 'state/auth_controller.dart';
import 'state/catalog_controller.dart';
import 'state/home_layout_controller.dart';
import 'state/theme_controller.dart';
import 'router.dart';

void main() {
  final api = ApiClient();
  final auth = AuthController(api);
  final theme = ThemeController();
  final catalog = CatalogController();
  final homeLayout = HomeLayoutController();
  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<AuthController>.value(value: auth),
        ChangeNotifierProvider<ThemeController>.value(value: theme),
        ChangeNotifierProvider<CatalogController>.value(value: catalog),
        ChangeNotifierProvider<HomeLayoutController>.value(value: homeLayout),
      ],
      child: SaveStateApp(
        auth: auth,
        theme: theme,
        catalog: catalog,
        homeLayout: homeLayout,
      ),
    ),
  );
}

class SaveStateApp extends StatefulWidget {
  final AuthController auth;
  final ThemeController theme;
  final CatalogController catalog;
  final HomeLayoutController homeLayout;
  const SaveStateApp({
    super.key,
    required this.auth,
    required this.theme,
    required this.catalog,
    required this.homeLayout,
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
    widget.homeLayout.load();
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
          theme: _appTheme(lightColorScheme),
          darkTheme: _appTheme(darkColorScheme),
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

ThemeData _appTheme(ColorScheme scheme) {
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
        TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
      },
    ),
  );
}
