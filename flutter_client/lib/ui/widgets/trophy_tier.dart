import 'package:flutter/material.dart';

const trophyTiers = ['platinum', 'gold', 'silver', 'bronze'];

String trophyTierAsset(String? type) {
  switch (type) {
    case 'platinum':
      return 'assets/trophies/platinum.png';
    case 'gold':
      return 'assets/trophies/gold.png';
    case 'silver':
      return 'assets/trophies/silver.png';
    default:
      return 'assets/trophies/bronze.png';
  }
}

/// Sony-style optical size: platinum biggest, bronze smallest.
/// Silver is the requested [size].
double trophyGradeScale(String? type) {
  switch (type) {
    case 'platinum':
      return 1.24;
    case 'gold':
      return 1.12;
    case 'silver':
      return 1.0;
    default:
      return 0.86;
  }
}

class TrophyTierIcon extends StatelessWidget {
  final String? type;
  final double size;
  final bool faded;
  final bool graded;

  const TrophyTierIcon({
    super.key,
    required this.type,
    this.size = 22,
    this.faded = false,
    this.graded = true,
  });

  @override
  Widget build(BuildContext context) {
    final scale = graded ? trophyGradeScale(type) : 1.0;
    final slot = size * (graded ? trophyGradeScale('platinum') : 1.0);
    final drawn = size * scale;

    return SizedBox(
      width: slot,
      height: slot,
      child: Opacity(
        opacity: faded ? 0.38 : 1,
        child: Center(
          child: Image.asset(
            trophyTierAsset(type),
            height: drawn,
            width: drawn,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
            gaplessPlayback: true,
          ),
        ),
      ),
    );
  }
}

class TrophyTierCount extends StatelessWidget {
  final String type;
  final String value;
  final double iconSize;
  final TextStyle? style;
  final bool stacked;
  final bool graded;

  const TrophyTierCount({
    super.key,
    required this.type,
    required this.value,
    this.iconSize = 22,
    this.style,
    this.stacked = false,
    this.graded = true,
  });

  @override
  Widget build(BuildContext context) {
    final icon = TrophyTierIcon(
      type: type,
      size: iconSize,
      graded: graded,
    );
    final label = Text(
      value,
      style: style ??
          const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
    );

    if (!stacked) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          icon,
          const SizedBox(width: 6),
          label,
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        icon,
        const SizedBox(height: 4),
        label,
      ],
    );
  }
}
