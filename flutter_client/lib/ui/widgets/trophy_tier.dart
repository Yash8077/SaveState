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

class TrophyTierIcon extends StatelessWidget {
  final String? type;
  final double size;
  final bool faded;

  const TrophyTierIcon({
    super.key,
    required this.type,
    this.size = 22,
    this.faded = false,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: faded ? 0.38 : 1,
      child: Image.asset(
        trophyTierAsset(type),
        height: size,
        width: size * 0.82,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.high,
        gaplessPlayback: true,
      ),
    );
  }
}

class TrophyTierCount extends StatelessWidget {
  final String type;
  final String value;
  final double iconSize;
  final TextStyle? style;

  const TrophyTierCount({
    super.key,
    required this.type,
    required this.value,
    this.iconSize = 22,
    this.style,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        TrophyTierIcon(type: type, size: iconSize),
        const SizedBox(width: 6),
        Text(
          value,
          style: style ??
              const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
        ),
      ],
    );
  }
}
