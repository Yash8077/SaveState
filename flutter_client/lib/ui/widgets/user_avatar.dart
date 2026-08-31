import 'package:flutter/material.dart';
import '../../services/api_client.dart';

const guestAvatar = '/avatars/avatar_6.png';

final _badge = RegExp(r'^/avatars/(avatar_\d+)\.png$');
final _robot = RegExp(r'^/avatars/robot_0*(\d+)\.png$');

String canonicalizeAvatar(String? src) {
  if (src == null || src.trim().isEmpty) return guestAvatar;
  final value = src.trim();
  final robot = _robot.firstMatch(value);
  if (robot != null) return '/avatars/avatar_${int.parse(robot.group(1)!)}.png';
  if (value.endsWith('.svg')) return guestAvatar;
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
    final resolved = canonicalizeAvatar(image);
    final match = _badge.firstMatch(resolved);
    final disc = Color.lerp(
      cs.primary,
      const Color(0xFF05090B),
      cs.brightness == Brightness.light ? 0.42 : 0.16,
    )!;
    Widget child;
    if (match != null) {
      final id = match.group(1)!;
      child = Image.asset(
        'assets/avatars/$id.png',
        fit: BoxFit.cover,
        gaplessPlayback: false,
        errorBuilder: (_, __, ___) => Image.network(
          '${ApiClient.origin}/avatars/$id.png',
          fit: BoxFit.cover,
        ),
      );
    } else {
      final src =
          resolved.startsWith('/') ? '${ApiClient.origin}$resolved' : resolved;
      child = Image.network(src, fit: BoxFit.cover);
    }
    return DecoratedBox(
      key: ValueKey(resolved),
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
