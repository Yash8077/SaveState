import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../models/types.dart';
import '../../services/api_client.dart';
import '../widgets/game_card.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<GameEntry> _entries = [];
  bool _isLoading = true;
  String _error = '';
  String _selectedStatus = 'all';

  @override
  void initState() {
    super.initState();
    _fetchLibrary();
  }

  Future<void> _fetchLibrary() async {
    try {
      final entries = await context.read<ApiClient>().getLibrary();
      if (mounted) {
        setState(() {
          _entries = entries;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Please sign in to view your library.';
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
        appBar: AppBar(title: const Text('Library')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline, size: 64, color: Colors.white24),
              const SizedBox(height: 16),
              Text(_error, style: const TextStyle(fontSize: 18)),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => context.go('/login'),
                child: const Text('Go to Login'),
              )
            ],
          ),
        ),
      );
    }

    final filtered = _selectedStatus == 'all'
        ? _entries
        : _entries.where((e) => e.status.value == _selectedStatus).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Library', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {},
          )
        ],
      ),
      body: _entries.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.videogame_asset_off, size: 64, color: Colors.white24),
                  const SizedBox(height: 16),
                  const Text('Your library is empty', style: TextStyle(fontSize: 18)),
                  const SizedBox(height: 8),
                  Text('Search for games to add them here.', 
                      style: TextStyle(color: Colors.grey[400])),
                ],
              ),
            )
          : GridView.builder(
              padding: const EdgeInsets.all(16.0),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                childAspectRatio: 0.65,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: filtered.length,
              itemBuilder: (context, index) {
                final entry = filtered[index];
                return GameCardWidget(
                  game: CatalogGame(
                    id: entry.catalogId,
                    title: entry.title,
                    coverUrl: entry.coverUrl,
                    headerUrl: entry.headerUrl,
                    platforms: [],
                  ),
                );
              },
            ),
    );
  }
}
