import 'package:expressive_refresh/expressive_refresh.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/api_client.dart';
import '../../services/sync_health_api.dart';
import '../../state/auth_controller.dart';
import '../widgets/m3_progress.dart';
import '../widgets/pill_nav.dart';

class SyncHealthPage extends StatefulWidget {
  const SyncHealthPage({super.key});

  @override
  State<SyncHealthPage> createState() => _SyncHealthPageState();
}

class _SyncHealthPageState extends State<SyncHealthPage> {
  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

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

  Widget _pill(BuildContext context, Object? raw) {
    final color = _statusColor(context, raw);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        _statusLabel(raw),
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _hero(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final activity = _data?['activity'];
    final trophies = _data?['trophies'];
    final device = _data?['device'];
    final statuses = [
      if (activity is Map) activity['status']?.toString(),
      if (trophies is Map) trophies['status']?.toString(),
    ];
    final raw = statuses.contains('failed')
        ? 'failed'
        : statuses.contains('syncing')
            ? 'syncing'
            : statuses.contains('synced')
                ? 'synced'
                : 'never_synced';
    final title = switch (raw) {
      'synced' => 'All caught up',
      'syncing' => 'Sync in progress',
      'failed' => 'Needs attention',
      _ => 'Not synced yet',
    };
    final hint = device is Map
        ? 'Last seen ${_when(device['lastSeenAt'])}'
        : 'Connect a PS5 payload to start logging play.';

    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: cs.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              raw == 'failed'
                  ? Icons.error_outline_rounded
                  : Icons.monitor_heart_outlined,
              color: _statusColor(context, raw),
              size: 28,
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 4),
            Text(hint, style: TextStyle(color: cs.onSurfaceVariant)),
            const SizedBox(height: 14),
            _pill(context, raw),
          ],
        ),
      ),
    );
  }

  Widget _deviceCard(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final device = _data?['device'];
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: cs.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'PS5 DEVICE',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
                color: cs.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 12),
            if (device is! Map)
              Text(
                'No device linked yet.',
                style: TextStyle(color: cs.onSurfaceVariant),
              )
            else ...[
              Text(
                device['name']?.toString() ?? 'PS5',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Last seen ${_when(device['lastSeenAt'])}',
                style: TextStyle(color: cs.onSurfaceVariant),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _syncTile(
    BuildContext context, {
    required String title,
    required IconData icon,
    required Map<String, dynamic> data,
    List<Widget> extra = const [],
  }) {
    final cs = Theme.of(context).colorScheme;
    final error = data['lastError']?.toString();
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: cs.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: cs.primaryContainer,
                  foregroundColor: cs.onPrimaryContainer,
                  child: Icon(icon, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                _pill(context, data['status']),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              'Last success ${_when(data['lastSyncedAt'])}',
              style: TextStyle(color: cs.onSurfaceVariant),
            ),
            Text(
              'Last attempt ${_when(data['lastAttemptAt'])}',
              style: TextStyle(color: cs.onSurfaceVariant),
            ),
            if (extra.isNotEmpty) ...[
              const SizedBox(height: 14),
              Row(
                children: extra
                    .map((child) => Expanded(child: child))
                    .toList(),
              ),
            ],
            if (error != null && error.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: cs.errorContainer,
                  borderRadius: BorderRadius.circular(16),
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

  Widget _count(BuildContext context, String label, Object? value) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      children: [
        Text(
          value == null ? '0' : value.toString(),
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final activity = _data?['activity'];
    final trophies = _data?['trophies'];
    final wide = MediaQuery.sizeOf(context).width >= 720;

    final activityTile = activity is Map
        ? _syncTile(
            context,
            title: 'PS5 Activity',
            icon: Icons.history_rounded,
            data: Map<String, dynamic>.from(activity),
          )
        : const SizedBox.shrink();
    final trophyTile = trophies is Map
        ? _syncTile(
            context,
            title: 'Trophies',
            icon: Icons.emoji_events_outlined,
            data: Map<String, dynamic>.from(trophies),
            extra: [
              _count(context, 'Synced', trophies['syncedSets']),
              _count(context, 'Failed', trophies['failedSets']),
              _count(context, 'Syncing', trophies['syncingSets']),
              _count(context, 'Pending', trophies['pendingSets']),
            ],
          )
        : const SizedBox.shrink();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sync & Health'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refreshing ? null : () => _load(refresh: true),
            icon: _refreshing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: M3Loading())
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
              : ExpressiveRefreshIndicator(
                  onRefresh: () => _load(refresh: true),
                  child: wide
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SizedBox(
                              width: 360,
                              child: ListView(
                                padding: const EdgeInsets.fromLTRB(16, 8, 8, 24),
                                children: [
                                  _hero(context),
                                  const SizedBox(height: 12),
                                  _deviceCard(context),
                                ],
                              ),
                            ),
                            Expanded(
                              child: ListView(
                                padding: const EdgeInsets.fromLTRB(8, 8, 16, 24),
                                children: [
                                  activityTile,
                                  const SizedBox(height: 12),
                                  trophyTile,
                                ],
                              ),
                            ),
                          ],
                        )
                      : ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: EdgeInsets.fromLTRB(
                            16,
                            8,
                            16,
                            32 + floatingPillClearance(context),
                          ),
                          children: [
                            _hero(context),
                            const SizedBox(height: 12),
                            _deviceCard(context),
                            const SizedBox(height: 12),
                            activityTile,
                            const SizedBox(height: 12),
                            trophyTile,
                          ],
                        ),
                ),
    );
  }
}
