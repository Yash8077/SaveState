import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/types.dart';
import '../../services/api_client.dart';
import '../widgets/game_rail.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  List<FeaturedRail> _featuredRails = [];
  List<GameEntry> _libraryEntries = [];
  
  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final apiClient = context.read<ApiClient>();
      final rails = await apiClient.getFeaturedRails();
      final library = await apiClient.getLibrary();
      
      if (mounted) {
        setState(() {
          _featuredRails = rails;
          _libraryEntries = library;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading data: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final playing = _libraryEntries.where((e) => e.status == GameStatus.playing).toList();
    final backlog = _libraryEntries.where((e) => e.status == GameStatus.backlog).toList();
    final beaten = _libraryEntries.where((e) => e.status == GameStatus.beaten).toList();
    
    // For now assuming not signed in logic to match the default empty state
    final bool signedIn = false; 

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 24.0),
          children: [
            if (!signedIn)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Your games',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, letterSpacing: -0.5),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Log what you play. Syncs across phones and tablets.',
                      style: TextStyle(fontSize: 14, color: Colors.grey[400]),
                    ),
                  ],
                ),
              ),
              
            if (playing.isNotEmpty)
              GameRailWidget(title: 'Continue playing', games: playing.map((e) => _entryToCatalogGame(e)).toList()),
              
            if (backlog.isNotEmpty)
              GameRailWidget(title: 'Backlog', games: backlog.take(16).map((e) => _entryToCatalogGame(e)).toList()),
              
            if (beaten.isNotEmpty)
              GameRailWidget(title: 'Recently beaten', games: beaten.take(12).map((e) => _entryToCatalogGame(e)).toList()),
              
            ..._featuredRails.map((rail) => GameRailWidget(title: rail.title, games: rail.games)),
          ],
        ),
      ),
    );
  }
  
  CatalogGame _entryToCatalogGame(GameEntry entry) {
    return CatalogGame(
      id: entry.catalogId,
      title: entry.title,
      coverUrl: entry.coverUrl,
      headerUrl: entry.headerUrl,
      platforms: [], // Populate if needed
    );
  }
}
