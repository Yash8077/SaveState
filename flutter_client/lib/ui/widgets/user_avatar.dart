import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../services/api_client.dart';

final _badge = RegExp(r'^/avatars/([a-z0-9_]+)\.(png|svg)$');
final _robot = RegExp(r'^/avatars/robot_0*(\d+)\.png$');

String? canonicalizeAvatar(String? src) {
  if (src == null) return null;
  final value = src.trim();
  final robot = _robot.firstMatch(value);
  if (robot != null) return '/avatars/avatar_${int.parse(robot.group(1)!)}.png';
  return value;
}

class UserAvatar extends StatelessWidget {
  final String? image;
  final String? name;
  final double size;

  const UserAvatar({super.key, this.image, this.name, this.size = 40});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final initial = (name != null && name!.trim().isNotEmpty)
        ? name!.trim()[0].toUpperCase()
        : '?';
    final resolved = canonicalizeAvatar(image);
    final match = resolved == null ? null : _badge.firstMatch(resolved);
    final disc = Color.lerp(
      cs.primary,
      const Color(0xFF05090B),
      cs.brightness == Brightness.light ? 0.42 : 0.16,
    )!;
    Widget child;
    if (match != null) {
      final id = match.group(1)!;
      final ext = match.group(2)!;
      final asset = 'assets/avatars/$id.$ext';
      if (ext == 'png') {
        child = Image.asset(
          asset,
          fit: BoxFit.cover,
          gaplessPlayback: false,
          errorBuilder: (_, __, ___) => Image.network(
            '${ApiClient.origin}/avatars/$id.$ext',
            fit: BoxFit.cover,
          ),
        );
      } else {
        child = SvgPicture.asset(
          asset,
          fit: BoxFit.cover,
          theme: SvgTheme(currentColor: disc),
          placeholderBuilder: (_) => ColoredBox(color: disc),
        );
      }
    } else if (resolved != null && resolved.isNotEmpty) {
      final src =
          resolved.startsWith('/') ? '${ApiClient.origin}$resolved' : resolved;
      if (src.endsWith('.svg')) {
        child = SvgPicture.network(
          src,
          fit: BoxFit.cover,
          theme: SvgTheme(currentColor: disc),
          placeholderBuilder: (_) => ColoredBox(color: disc),
        );
      } else {
        child = Image.network(src, fit: BoxFit.cover);
      }
    } else {
      child = Text(
        initial,
        style: TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: size * 0.4,
          color: cs.onPrimary,
        ),
      );
    }
    return DecoratedBox(
      key: ValueKey(resolved ?? ''),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.black.withValues(alpha: 0.28)),
      ),
      child: ClipOval(
        child: ColoredBox(
          color: disc,
          child: SizedBox(width: size, height: size, child: child),
        ),
      ),
    );
  }
}
