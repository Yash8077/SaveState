import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../services/api_client.dart';
import '../../models/types.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key});

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  List<GameEntry> _entries = [];
  bool _isLoading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _fetchStats();
  }

  Future<void> _fetchStats() async {
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
          _error = 'Please sign in to view your stats.';
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
        appBar: AppBar(title: const Text('Stats')),
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

    final gamesPlayed = _entries.length;
    final totalHours = _entries.fold<int>(0, (sum, e) => sum + (e.hours ?? 0));
    final beaten = _entries.where((e) => e.status == GameStatus.beaten).length;
    final completionRate = gamesPlayed > 0 ? ((beaten / gamesPlayed) * 100).toStringAsFixed(1) : '0';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Stats', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          _buildStatCard('Games Played', gamesPlayed.toString(), context),
          const SizedBox(height: 16),
          _buildStatCard('Total Hours', totalHours.toString(), context),
          const SizedBox(height: 16),
          _buildStatCard('Completion Rate', '$completionRate%', context),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String value, BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24.0),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: Colors.grey[400], fontSize: 16)),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
