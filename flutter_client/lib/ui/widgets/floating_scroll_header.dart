import 'package:flutter/material.dart';

/// Keeps a page header permanently anchored at the top of a vertically
/// scrollable surface while the body scrolls beneath it.
///
/// The header height is measured from the rendered widget, so the body inset
/// automatically adapts to text wrapping, orientation, and dynamic content.
class FloatingScrollHeader extends StatefulWidget {
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
  State<FloatingScrollHeader> createState() => _FloatingScrollHeaderState();
}

class _FloatingScrollHeaderState extends State<FloatingScrollHeader> {
  final GlobalKey _headerKey = GlobalKey();
  double _headerHeight = 0;

  @override
  void initState() {
    super.initState();
    _scheduleHeaderMeasure();
  }

  @override
  void didUpdateWidget(covariant FloatingScrollHeader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.header != widget.header ||
        oldWidget.backgroundColor != widget.backgroundColor) {
      _scheduleHeaderMeasure();
    }
  }

  void _scheduleHeaderMeasure() {
    WidgetsBinding.instance.addPostFrameCallback((_) => _measureHeader());
  }

  void _measureHeader() {
    if (!mounted) return;

    final renderObject = _headerKey.currentContext?.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.hasSize) return;

    final height = renderObject.size.height;
    if ((_headerHeight - height).abs() < 0.5) return;

    setState(() => _headerHeight = height);
  }

  @override
  Widget build(BuildContext context) {
    // Re-measure after parent constraint changes (rotation, window resize,
    // text/layout changes) so the body inset always matches the real header.
    _scheduleHeaderMeasure();

    return Stack(
      fit: StackFit.expand,
      children: [
        Padding(
          padding: EdgeInsets.only(top: _headerHeight),
          child: widget.body,
        ),
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: Material(
            color: widget.backgroundColor,
            child: SizeChangedLayoutNotifier(
              child: KeyedSubtree(
                key: _headerKey,
                child: widget.header,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
