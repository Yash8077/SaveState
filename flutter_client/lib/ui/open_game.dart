import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models/types.dart';
import '../services/api_client.dart';

void openGame(BuildContext context, CatalogGame game) {
  context.read<ApiClient>().prefetchGameDetails(game.id);
  context.push('/game/${game.id}', extra: game);
}

void openGameId(
  BuildContext context,
  String id, {
  String? title,
  String? coverUrl,
  String? headerUrl,
}) {
  final preview = title == null
      ? null
      : CatalogGame(
          id: id,
          title: title,
          coverUrl: coverUrl,
          headerUrl: headerUrl,
        );
  context.read<ApiClient>().prefetchGameDetails(id);
  context.push('/game/$id', extra: preview);
}
