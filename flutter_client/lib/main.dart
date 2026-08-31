import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dynamic_color/dynamic_color.dart';
import 'services/api_client.dart';
import 'state/auth_controller.dart';
import 'state/catalog_controller.dart';
import 'state/home_layout_controller.dart';
import 'state/theme_controller.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  await api.hydrate();
  final auth = AuthController(api);
  final theme = ThemeController();
  final catalog = CatalogController();
  final homeLayout = HomeLayoutController();
  unawaited(api.getFeaturedRails());
  unawaited(auth.load());
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
    splashFactory: InkSparkle.splashFactory,
    visualDensity: VisualDensity.standard,
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: scheme.primary,
      linearTrackColor: scheme.surfaceContainerHighest,
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
      },
    ),
  );
}
