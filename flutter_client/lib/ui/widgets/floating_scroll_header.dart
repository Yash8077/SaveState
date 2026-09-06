import 'package:flutter/material.dart';

/// Sticky page title above a scrolling body.
///
/// Laid out as a column so the list never paints through the title or into
/// the status bar (a stack + measured inset was leaking overscroll).
class FloatingScrollHeader extends StatelessWidget {
  final Widget header;
  final Widget body;
  final Color backgroundColor;

  const FloatingScrollHeader({
    super.key,
    required this.header,
    required this.body,
    required this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: backgroundColor,
      clipBehavior: Clip.hardEdge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          header,
          Expanded(
            child: ClipRect(child: body),
          ),
        ],
      ),
    );
  }
}
