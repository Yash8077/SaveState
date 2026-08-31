import 'package:flutter/material.dart';
import 'package:material3_expressive_loading_indicator/material3_expressive_loading_indicator.dart';

/// Material 3 Expressive morphing-shape loader (Android 16 style).
class M3Loading extends StatelessWidget {
  final Color? color;
  final double size;

  const M3Loading({super.key, this.color, this.size = 48});

  @override
  Widget build(BuildContext context) {
    return ExpressiveLoadingIndicator(
      color: color ?? Theme.of(context).colorScheme.primary,
      constraints: BoxConstraints.tight(Size.square(size)),
    );
  }
}

/// Wavy Material 3 Expressive linear progress.
class M3LinearProgress extends StatelessWidget {
  final double? value;
  final double minHeight;
  final Color? color;
  final Color? backgroundColor;

  const M3LinearProgress({
    super.key,
    this.value,
    this.minHeight = 4,
    this.color,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return ExpressiveLinearProgressIndicator(
      value: value,
      minHeight: minHeight,
      color: color,
      backgroundColor: backgroundColor,
    );
  }
}
