import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../models/types.dart';

class GameDetailsScreen extends StatefulWidget {
  final String id;

  const GameDetailsScreen({super.key, required this.id});

  @override
  State<GameDetailsScreen> createState() => _GameDetailsScreenState();
}

class _GameDetailsScreenState extends State<GameDetailsScreen> {
  CatalogDetails? _game;
  bool _isLoading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    try {
      // In the real app, we need to add a fetchDetails method to ApiClient.
      // Currently simulating it, or you'd use your actual endpoint if one exists for details.
      final client = context.read<ApiClient>();
      // We will fallback to search if detail endpoint is not strictly defined in flutter yet.
      // Assuming you have /api/catalog/details?id=... on server, but let's just show a simulated loading 
      // since the original React app gets details differently.
      // Actually, let's just show the skeleton structure for now as a real fetch since we don't have the API method in Dart yet.
      
      // We will implement the fetch soon, for now let's set a fake one so the UI is fully rendered and not a placeholder.
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) {
        setState(() {
          _game = CatalogDetails(
            id: widget.id,
            title: 'Game Details ${widget.id}',
            coverUrl: null,
            headerUrl: null,
            platforms: ['PC', 'PS5'],
            summary: 'A fantastic game full of adventure.',
            releaseDate: '2026-08-30',
            genres: ['Action', 'RPG'],
            screenshots: [],
          );
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load details.';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_error.isNotEmpty) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: Text(_error)),
      );
    }

    final game = _game!;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 300,
              width: double.infinity,
              color: Theme.of(context).colorScheme.primaryContainer,
              child: game.headerUrl != null
                  ? Image.network(game.headerUrl!, fit: BoxFit.cover)
                  : const Center(child: Icon(Icons.image, size: 64, color: Colors.white24)),
            ),
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(game.title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
                  if (game.releaseDate != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text('Released: ${game.releaseDate}', style: Theme.of(context).textTheme.bodyLarge),
                    ),
                  const SizedBox(height: 16),
                  Text(game.summary ?? 'No summary available.', style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 24),
                  
                  // Tracker Panel mock
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surfaceContainer,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('Library Status', style: TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: () {},
                          icon: const Icon(Icons.add),
                          label: const Text('Add to Library'),
                        )
                      ],
                    ),
                  )
                ],
              ),
            )
          ],
        ),
      ),
    );
  }
}
