import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppThemeMode { system, dark, oled }

class ThemeController extends ChangeNotifier {
  static const _modeKey = 'theme_mode';
  static const _dynamicKey = 'dynamic_color';
  static const _accentKey = 'accent_index';

  static const accents = <Color>[
    Color(0xFF4FD8C4),
    Color(0xFF8EC8FF),
    Color(0xFFD0BCFF),
    Color(0xFFE4C18A),
    Color(0xFFFFB4AB),
  ];

  static const accentLabels = <String>[
    'Teal',
    'Blue',
    'Violet',
    'Amber',
    'Rose',
  ];

  AppThemeMode mode = AppThemeMode.dark;
  bool useDynamicColor = true;
  int accentIndex = 0;

  Color get accent =>
      accents[accentIndex.clamp(0, accents.length - 1)];

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final modeIndex = prefs.getInt(_modeKey) ?? AppThemeMode.dark.index;
    mode = AppThemeMode.values[modeIndex.clamp(0, AppThemeMode.values.length - 1)];
    useDynamicColor = prefs.getBool(_dynamicKey) ?? true;
    accentIndex = (prefs.getInt(_accentKey) ?? 0).clamp(0, accents.length - 1);
    notifyListeners();
  }

  Future<void> setMode(AppThemeMode value) async {
    mode = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_modeKey, value.index);
    notifyListeners();
  }

  Future<void> setDynamicColor(bool value) async {
    useDynamicColor = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_dynamicKey, value);
    notifyListeners();
  }

  Future<void> setAccentIndex(int value) async {
    accentIndex = value.clamp(0, accents.length - 1);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_accentKey, accentIndex);
    notifyListeners();
  }

  ThemeMode get materialThemeMode {
    switch (mode) {
      case AppThemeMode.system:
        return ThemeMode.system;
      case AppThemeMode.dark:
      case AppThemeMode.oled:
        return ThemeMode.dark;
    }
  }

  ColorScheme darkScheme(ColorScheme? dynamicScheme) {
    final base = (useDynamicColor && dynamicScheme != null)
        ? dynamicScheme
        : ColorScheme.fromSeed(
            seedColor: accent,
            brightness: Brightness.dark,
          );
    if (mode != AppThemeMode.oled) return base;
    return base.copyWith(
      surface: Colors.black,
      surfaceContainer: const Color(0xFF0C1012),
      surfaceContainerLow: const Color(0xFF0A0A0A),
      surfaceContainerHigh: const Color(0xFF151B1D),
      surfaceContainerHighest: const Color(0xFF1A2224),
    );
  }

  ColorScheme lightScheme(ColorScheme? dynamicScheme) {
    if (useDynamicColor && dynamicScheme != null) return dynamicScheme;
    return ColorScheme.fromSeed(
      seedColor: accent,
      brightness: Brightness.light,
    );
  }
}
