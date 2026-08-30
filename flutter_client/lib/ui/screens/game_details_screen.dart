import 'package:flutter/material.dart';

class GameDetailsScreen extends StatelessWidget {
  final String id;

  const GameDetailsScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Game details: $id'),
      ),
      body: const Center(
        child: Text('Game Details Placeholder. Add to library form goes here.'),
      ),
    );
  }
}
