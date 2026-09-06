import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/api_client.dart';
import '../../services/sync_health_api.dart';
import '../../state/auth_controller.dart';

class SyncHealthPage extends StatefulWidget {
  const SyncHealthPage({super.key});

  @override
  State<SyncHealthPage> createState() => _SyncHealthPageState();
}

class _SyncHealthPageState extends State<SyncHealthPage> {
  static const _origin = 'https://save-state-jade.vercel.app';
  static const _timeout = Duration(seconds: 10);

  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Map<String, String> _headers(String? token) => {
        'Accept': 'application/json',
        'Origin': _origin,
        if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
      };

  Future<void> _load({bool refresh = false}) async {
    if (refresh) {
      setState(() {
        _refreshing = true;
        _error = null;
      });
    } else {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      if (!context.read<AuthController>().isSignedIn) {
        throw ApiException(401, 'Sign in to view synchronization health.');
      }

      final data = await context.read<ApiClient>().getSyncStatus();
      if (mounted) {
        setState(() => _data = data);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _refreshing = false;
      });
    }
  }

  String _statusLabel(Object? raw) {
    switch (raw?.toString()) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing';
      case 'failed':
        return 'Failed';
      default:
        return 'Never synced';
    }
  }

  Color _statusColor(BuildContext context, Object? raw) {
    final cs = Theme.of(context).colorScheme;
    switch (raw?.toString()) {
      case 'synced':
        return cs.primary;
      case 'failed':
        return cs.error;
      case 'syncing':
        return cs.tertiary;
      default:
        return cs.onSurfaceVariant;
    }
  }

  String _when(Object? raw) {
    if (raw == null || raw.toString().isEmpty) return 'Never';
    final date = DateTime.tryParse(raw.toString())?.toLocal();
    if (date == null) return raw.toString();
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hr ago';
    if (diff.inDays < 7) return '${diff.inDays} day${diff.inDays == 1 ? '' : 's'} ago';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  Widget _statusRow(
    BuildContext context, {
    required String label,
    required Object? value,
  }) {
    final cs = Theme.of(context).colorScheme;
    final color = _statusColor(context, value);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(Icons.circle, size: 10, color: color),
      title: const SizedBox.shrink(),
      subtitle: Text(label, style: TextStyle(color: cs.onSurfaceVariant)),
      trailing: Text(
        _statusLabel(value),
        style: TextStyle(fontWeight: FontWeight.w700, color: color),
      ),
    );
  }

  Widget _infoRow(String label, Object? value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 150,
            child: Text(
              label,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value == null || value.toString().isEmpty ? '—' : value.toString(),
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _syncCard(
    BuildContext context, {
    required String title,
    required IconData icon,
    required Map<String, dynamic> data,
    required String syncedLabel,
  }) {
    final cs = Theme.of(context).colorScheme;
    final error = data['lastError']?.toString();
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: cs.primaryContainer,
                  foregroundColor: cs.primary,
                  child: Icon(icon, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _statusRow(
              context,
              label: 'Current status',
              value: data['status'],
            ),
            const Divider(height: 1),
            _infoRow('Last attempt', _when(data['lastAttemptAt'])),
            _infoRow(syncedLabel, _when(data['lastSyncedAt'])),
            if (error != null && error.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: cs.errorContainer,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  error,
                  style: TextStyle(color: cs.onErrorContainer, height: 1.35),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final device = _data?['device'];
    final activity = _data?['activity'];
    final trophies = _data?['trophies'];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sync & Health'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refreshing ? null : () => _load(refresh: true),
            icon: _refreshing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.cloud_off_rounded, size: 44, color: cs.error),
                        const SizedBox(height: 12),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: cs.onSurfaceVariant),
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: () => _load(refresh: true),
                          child: const Text('Try again'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => _load(refresh: true),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      if (device is Map) ...[
                        Card(
                          color: cs.surfaceContainerHighest,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'PS5 device',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 8),
                                _infoRow('Device', device['name']),
                                _infoRow('Last seen', _when(device['lastSeenAt'])),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                      Text(
                        'DATA SYNCHRONIZATION',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: .8,
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (activity is Map)
                        _syncCard(
                          context,
                          title: 'PS5 Activity',
                          icon: Icons.history_rounded,
                          data: Map<String, dynamic>.from(activity),
                          syncedLabel: 'Last successful sync',
                        ),
                      if (trophies is Map)
                        _syncCard(
                          context,
                          title: 'Trophies',
                          icon: Icons.emoji_events_outlined,
                          data: Map<String, dynamic>.from(trophies),
                          syncedLabel: 'Last successful sync',
                        ),
                      if (trophies is Map) ...[
                        const SizedBox(height: 4),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Trophy sync sets',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 8),
                                _infoRow('Synced sets', trophies['syncedSets']),
                                _infoRow('Failed sets', trophies['failedSets']),
                                _infoRow('Syncing sets', trophies['syncingSets']),
                                _infoRow('Pending sets', trophies['pendingSets']),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}
