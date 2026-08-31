import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../services/api_client.dart';

String? resolveAvatarUrl(String? image) {
  if (image == null || image.isEmpty) return null;
  if (image.startsWith('/')) return '${ApiClient.origin}$image';
  return image;
}

class UserAvatar extends StatelessWidget {
  final String? image;
  final String? name;
  final double size;

  const UserAvatar({super.key, this.image, this.name, this.size = 40});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final src = resolveAvatarUrl(image);
    final initial = (name != null && name!.trim().isNotEmpty)
        ? name!.trim()[0].toUpperCase()
        : '?';
    Widget child;
    if (src == null) {
      child = Text(
        initial,
        style: TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: size * 0.4,
          color: cs.onPrimaryContainer,
        ),
      );
    } else if (src.endsWith('.svg')) {
      child = SvgPicture.network(
        src,
        fit: BoxFit.cover,
        placeholderBuilder: (_) => ColoredBox(color: cs.primaryContainer),
      );
    } else {
      child = Image.network(src, fit: BoxFit.cover);
    }
    return ClipOval(
      child: ColoredBox(
        color: cs.primaryContainer,
        child: SizedBox(width: size, height: size, child: child),
      ),
    );
  }
}
