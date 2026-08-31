import 'package:flutter/material.dart';
import '../../date_format.dart';
import '../../models/types.dart';

class ListEditorResult {
  final GameStatus status;
  final int? score;
  final num? hours;
  final bool favorite;
  final bool remove;
  final String? startedAt;
  final String? finishedAt;

  const ListEditorResult({
    required this.status,
    this.score,
    this.hours,
    this.favorite = false,
    this.remove = false,
    this.startedAt,
    this.finishedAt,
  });
}

Future<ListEditorResult?> showListEditorSheet({
  required BuildContext context,
  required String title,
  GameEntry? entry,
  bool favoriteHint = false,
  GameStatus? initialStatus,
}) {
  return showModalBottomSheet<ListEditorResult>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (context) => ListEditorSheet(
      title: title,
      entry: entry,
      favoriteHint: favoriteHint,
      initialStatus: initialStatus,
    ),
  );
}

class ListEditorSheet extends StatefulWidget {
  final String title;
  final GameEntry? entry;
  final bool favoriteHint;
  final GameStatus? initialStatus;

  const ListEditorSheet({
    super.key,
    required this.title,
    this.entry,
    this.favoriteHint = false,
    this.initialStatus,
  });

  @override
  State<ListEditorSheet> createState() => _ListEditorSheetState();
}

class _ListEditorSheetState extends State<ListEditorSheet> {
  late GameStatus _status;
  int? _score;
  late final TextEditingController _hours;
  late bool _favorite;
  String? _startedAt;
  String? _finishedAt;

  @override
  void initState() {
    super.initState();
    _status =
        widget.entry?.status ?? widget.initialStatus ?? GameStatus.playing;
    _score = widget.entry?.score;
    _hours = TextEditingController(
      text: widget.entry?.hours?.toString() ?? '',
    );
    _favorite = widget.entry?.favorite ?? widget.favoriteHint;
    _startedAt = _ymd(widget.entry?.startedAt);
    _finishedAt = _ymd(widget.entry?.finishedAt);
  }

  @override
  void dispose() {
    _hours.dispose();
    super.dispose();
  }

  String? _ymd(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    return raw.length >= 10 ? raw.substring(0, 10) : raw;
  }

  num? _parseHours(String raw) {
    final text = raw.trim();
    if (text.isEmpty) return null;
    return num.tryParse(text);
  }

  Future<void> _pick(bool start) async {
    final current = DateTime.tryParse(start ? (_startedAt ?? '') : (_finishedAt ?? ''));
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? now,
      firstDate: DateTime(1970),
      lastDate: DateTime(now.year + 3),
    );
    if (picked == null) return;
    final value = isoDate(picked);
    setState(() {
      if (start) {
        _startedAt = value;
      } else {
        _finishedAt = value;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final editing = widget.entry != null;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        8,
        20,
        16 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              editing ? 'EDIT LIST' : 'ADD TO LIBRARY',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.1,
                color: cs.primary,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.4,
                    ),
                  ),
                ),
                IconButton.filledTonal(
                  onPressed: () => setState(() => _favorite = !_favorite),
                  icon: Icon(_favorite ? Icons.favorite : Icons.favorite_border),
                  color: _favorite ? cs.primary : cs.onSurfaceVariant,
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(
              'Category',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: cs.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: GameStatus.values.map((s) {
                final selected = _status == s;
                return ChoiceChip(
                  label: Text(s.label),
                  selected: selected,
                  onSelected: (_) => setState(() => _status = s),
                );
              }).toList(),
            ),
            const SizedBox(height: 18),
            Text(
              'Score',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: cs.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: List.generate(10, (i) {
                final n = i + 1;
                final selected = _score == n;
                return ActionChip(
                  label: Text('$n'),
                  backgroundColor:
                      selected ? cs.primary : cs.surfaceContainerHigh,
                  labelStyle: TextStyle(
                    color: selected ? cs.onPrimary : cs.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                  onPressed: () =>
                      setState(() => _score = _score == n ? null : n),
                );
              }),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _hours,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Hours played',
                hintText: '0',
                isDense: true,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 18),
            _dateTile(
              cs,
              label: 'Start date',
              value: _startedAt,
              onTap: () => _pick(true),
              onClear: _startedAt == null
                  ? null
                  : () => setState(() => _startedAt = null),
            ),
            const SizedBox(height: 10),
            _dateTile(
              cs,
              label: 'End date',
              value: _finishedAt,
              onTap: () => _pick(false),
              onClear: _finishedAt == null
                  ? null
                  : () => setState(() => _finishedAt = null),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                if (editing)
                  TextButton(
                    onPressed: () => Navigator.pop(
                      context,
                      ListEditorResult(
                        status: _status,
                        score: _score,
                        favorite: _favorite,
                        remove: true,
                      ),
                    ),
                    child: const Text('Remove'),
                  ),
                const Spacer(),
                FilledButton(
                  onPressed: () => Navigator.pop(
                    context,
                    ListEditorResult(
                      status: _status,
                      score: _score,
                      hours: _parseHours(_hours.text),
                      favorite: _favorite,
                      startedAt: _startedAt,
                      finishedAt: _finishedAt,
                    ),
                  ),
                  child: Text(editing ? 'Save' : 'Add to library'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateTile(
    ColorScheme cs, {
    required String label,
    required String? value,
    required VoidCallback onTap,
    VoidCallback? onClear,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          border: const OutlineInputBorder(),
          suffixIcon: onClear == null
              ? const Icon(Icons.event, size: 18)
              : IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: onClear,
                ),
        ),
        child: Text(
          formatDmy(value).isEmpty ? 'Not set' : formatDmy(value),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: value == null ? cs.onSurfaceVariant : cs.onSurface,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
