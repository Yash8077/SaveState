import 'package:flutter/material.dart';

/// Wraps a vertically scrollable surface with a floating header that hides
/// while scrolling down and reveals immediately when scrolling up.
///
/// Header height is measured from the rendered widget, so it adapts to
/// available width, text wrapping, orientation and dynamic content.
class FloatingScrollHeader extends StatefulWidget {
  final Widget header;
  final Widget body;
  final Color backgroundColor;
  final double topThreshold;
  final double hideThreshold;
  final Duration animationDuration;

  const FloatingScrollHeader({
    super.key,
    required this.header,
    required this.body,
    required this.backgroundColor,
    this.topThreshold = 4,
    this.hideThreshold = 6,
    this.animationDuration = const Duration(milliseconds: 220),
  });

  @override
  State<FloatingScrollHeader> createState() => _FloatingScrollHeaderState();
}

class _FloatingScrollHeaderState extends State<FloatingScrollHeader> {
  final GlobalKey _headerKey = GlobalKey();

  double _headerHeight = 0;
  double _lastPixels = 0;
  double _downDistance = 0;
  bool _headerVisible = true;

  @override
  void initState() {
    super.initState();
    _scheduleHeaderMeasure();
  }

  @override
  void didUpdateWidget(covariant FloatingScrollHeader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.header != widget.header) {
      _scheduleHeaderMeasure();
    }
  }

  void _measureHeader() {
    if (!mounted) return;

    final renderObject = _headerKey.currentContext?.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.hasSize) return;

    final height = renderObject.size.height;
    if ((_headerHeight - height).abs() < 0.5) return;

    setState(() => _headerHeight = height);
  }

  void _scheduleHeaderMeasure() {
    WidgetsBinding.instance.addPostFrameCallback((_) => _measureHeader());
  }

  void _showHeader() {
    _downDistance = 0;
    if (_headerVisible || !mounted) return;
    setState(() => _headerVisible = true);
  }

  void _hideHeader() {
    _downDistance = 0;
    if (!_headerVisible || !mounted) return;
    setState(() => _headerVisible = false);
  }

  bool _handleScrollNotification(ScrollNotification notification) {
    // Horizontal rails/grids must never affect the floating header.
    if (notification.metrics.axis != Axis.vertical) return false;

    if (notification is SizeChangedLayoutNotification) {
      _scheduleHeaderMeasure();
      return false;
    }

    if (notification is ScrollStartNotification) {
      _lastPixels = notification.metrics.pixels;
      _downDistance = 0;
      return false;
    }

    if (notification is! ScrollUpdateNotification) return false;

    final pixels = notification.metrics.pixels;
    final delta = pixels - _lastPixels;
    _lastPixels = pixels;

    // Keep the header visible at the top and during pull-to-refresh.
    if (pixels <= widget.topThreshold) {
      _showHeader();
      return false;
    }

    final direction = notification.metrics.userScrollDirection;

    if (direction == ScrollDirection.reverse && delta > 0) {
      _downDistance += delta;
      if (_downDistance >= widget.hideThreshold) {
        _hideHeader();
      }
    } else if (direction == ScrollDirection.forward && delta < 0) {
      // Any upward movement reveals immediately.
      _showHeader();
    } else if (direction == ScrollDirection.idle) {
      _downDistance = 0;
    }

    return false;
  }

  @override
  Widget build(BuildContext context) {
    // Measurement is intentionally tied to the rendered header, not a
    // hard-coded height. This also lets orientation/width changes settle.
    _scheduleHeaderMeasure();

    final bodyTopPadding = _headerHeight;

    return NotificationListener<ScrollNotification>(
      onNotification: _handleScrollNotification,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Padding(
            padding: EdgeInsets.only(top: bodyTopPadding),
            child: widget.body,
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: IgnorePointer(
              ignoring: !_headerVisible,
              child: AnimatedSlide(
                offset: _headerVisible
                    ? Offset.zero
                    : const Offset(0, -1),
                duration: widget.animationDuration,
                curve: Curves.easeOutCubic,
                child: ColoredBox(
                  color: widget.backgroundColor,
                  child: SizeChangedLayoutNotifier(
                    child: KeyedSubtree(
                      key: _headerKey,
                      child: widget.header,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
