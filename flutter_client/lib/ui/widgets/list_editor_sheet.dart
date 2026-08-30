import 'package:flutter/material.dart';
import '../../models/types.dart';

class ListEditorResult {
  final GameStatus status;
  final int? score;
  final bool favorite;
  final bool remove;

  const ListEditorResult({
    required this.status,
    this.score,
    this.favorite = false,
    this.remove = false,
  });
}

Future<ListEditorResult?> showListEditorSheet({
  required BuildContext context,
  required String title,
  GameEntry? entry,
}) {
  return showModalBottomSheet<ListEditorResult>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (context) => ListEditorSheet(title: title, entry: entry),
  );
}

class ListEditorSheet extends StatefulWidget {
  final String title;
  final GameEntry? entry;

  const ListEditorSheet({super.key, required this.title, this.entry});

  @override
  State<ListEditorSheet> createState() => _ListEditorSheetState();
}

class _ListEditorSheetState extends State<ListEditorSheet> {
  late GameStatus _status;
  int? _score;
  late bool _favorite;

  @override
  void initState() {
    super.initState();
    _status = widget.entry?.status ?? GameStatus.backlog;
    _score = widget.entry?.score;
    _favorite = widget.entry?.favorite ?? false;
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            editing ? 'Edit list' : 'Add to library',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: cs.onSurfaceVariant,
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
            'Status',
            style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant),
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
            style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant),
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
                backgroundColor: selected ? cs.primary : cs.surfaceContainerHigh,
                labelStyle: TextStyle(
                  color: selected ? cs.onPrimary : cs.onSurface,
                  fontWeight: FontWeight.w600,
                ),
                onPressed: () =>
                    setState(() => _score = _score == n ? null : n),
              );
            }),
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
                    favorite: _favorite,
                  ),
                ),
                child: Text(editing ? 'Save' : 'Add to library'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
