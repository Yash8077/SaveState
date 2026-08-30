import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
    return MaterialApp.router(
      title: 'SaveState',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F1416),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF3B82F6),
          surface: Color(0xFF1E293B),
        ),
      ),
      routerConfig: router,
    );
  }
}
