import 'package:flutter/material.dart';
import '../../models/types.dart';
import 'package:cached_network_image/cached_network_image.dart';

class GameCardWidget extends StatelessWidget {
  final CatalogGame game;

  const GameCardWidget({super.key, required this.game});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8.0),
              child: Container(
                color: const Color(0xFF1E293B), // placeholder color
                width: double.infinity,
                child: game.coverUrl != null
                    ? CachedNetworkImage(
                        imageUrl: game.coverUrl!.replaceFirst('t_cover_big', 't_cover_big_2x'),
                        fit: BoxFit.cover,
                        errorWidget: (context, url, error) => const Icon(Icons.error),
                      )
                    : const Center(child: Icon(Icons.image, color: Colors.white24)),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            game.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
