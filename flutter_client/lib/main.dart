import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dynamic_color/dynamic_color.dart';
import 'services/api_client.dart';
import 'state/auth_controller.dart';
import 'router.dart';

void main() {
  final api = ApiClient();
  final auth = AuthController(api);
  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<AuthController>.value(value: auth),
      ],
      child: SaveStateApp(auth: auth),
    ),
  );
}

class SaveStateApp extends StatefulWidget {
  final AuthController auth;
  const SaveStateApp({super.key, required this.auth});

  @override
  State<SaveStateApp> createState() => _SaveStateAppState();
}

class _SaveStateAppState extends State<SaveStateApp> {
  @override
  void initState() {
    super.initState();
    widget.auth.load();
  }

  @override
  Widget build(BuildContext context) {
    return DynamicColorBuilder(
      builder: (lightDynamic, darkDynamic) {
        final darkColorScheme = darkDynamic != null
            ? darkDynamic.copyWith(
                surface: darkDynamic.surfaceContainer,
              )
            : ColorScheme.fromSeed(
                seedColor: const Color(0xFF4FD8C4),
                brightness: Brightness.dark,
              );

        return MaterialApp.router(
          title: 'SaveState',
          themeMode: ThemeMode.dark,
          darkTheme: ThemeData(
            useMaterial3: true,
            colorScheme: darkColorScheme,
            scaffoldBackgroundColor: darkColorScheme.surface,
          ),
          routerConfig: router,
        );
      },
    );
  }
}
