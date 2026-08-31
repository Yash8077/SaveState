import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../services/api_client.dart';

final _badge = RegExp(r'^/avatars/([a-z]+)\.svg$');

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
    final match = image == null ? null : _badge.firstMatch(image!.trim());
    final disc = Color.lerp(
      cs.primary,
      const Color(0xFF05090B),
      cs.brightness == Brightness.light ? 0.42 : 0.16,
    )!;
    Widget child;
    if (match != null) {
      child = SvgPicture.asset(
        'assets/avatars/${match.group(1)}.svg',
        fit: BoxFit.cover,
        theme: SvgTheme(currentColor: disc),
        placeholderBuilder: (_) => ColoredBox(color: disc),
      );
    } else if (image != null && image!.isNotEmpty) {
      final src = image!.startsWith('/')
          ? '${ApiClient.origin}$image'
          : image!;
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
