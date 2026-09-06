import 'package:flutter/material.dart';

/// Wraps a primary vertical scrolling surface with a floating page header.
///
/// The header hides after a small downward gesture and reappears immediately
/// when the user scrolls upward. Only the direct vertical scroll surface
/// controls the header; nested and horizontal scrollables are ignored.
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
  double _bodyTopPadding = 0;
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

  void _scheduleHeaderMeasure() {
    WidgetsBinding.instance.addPostFrameCallback((_) => _measureHeader());
  }

  void _measureHeader() {
    if (!mounted) return;
    final renderObject = _headerKey.currentContext?.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.hasSize) {
      _scheduleHeaderMeasure();
      return;
    }

    final height = renderObject.size.height;
    if ((_headerHeight - height).abs() < 0.5) return;

    setState(() {
      _headerHeight = height;
      if (_headerVisible) {
        _bodyTopPadding = height;
      }
    });
  }

  void _showHeader({bool atTop = false}) {
    _downDistance = 0;
    if (!mounted) return;

    final double nextPadding = atTop ? _headerHeight : 0.0;
    final visibilityChanged = !_headerVisible;
    final paddingChanged = (_bodyTopPadding - nextPadding).abs() >= 0.5;

    if (!visibilityChanged && !paddingChanged) return;

    setState(() {
      _headerVisible = true;
      _bodyTopPadding = nextPadding;
    });
  }

  void _hideHeader() {
    _downDistance = 0;
    if (!mounted) return;
    if (!_headerVisible && _bodyTopPadding == 0) return;

    setState(() {
      _headerVisible = false;
      _bodyTopPadding = 0;
    });
  }

  bool _handleScrollNotification(ScrollNotification notification) {
    // Only the primary, direct vertical scroll surface controls the header.
    // This prevents horizontal rails and nested vertical panels from moving it.
    if (notification.depth != 0 || notification.metrics.axis != Axis.vertical) {
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

    // Pull-to-refresh / top overscroll always restores the header and the
    // initial content inset. The body inset remains collapsed everywhere else.
    if (pixels <= widget.topThreshold) {
      _showHeader(atTop: true);
      return false;
    }

    if (delta > 0) {
      _downDistance += delta;
      if (_downDistance >= widget.hideThreshold) {
        _hideHeader();
      }
    } else if (delta < 0) {
      // Any upward movement reveals the header immediately without pushing the
      // already-scrolled content back down.
      _showHeader();
    } else {
      _downDistance = 0;
    }

    return false;
  }

  @override
  Widget build(BuildContext context) {
    _scheduleHeaderMeasure();

    return NotificationListener<ScrollNotification>(
      onNotification: _handleScrollNotification,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedPadding(
            duration: widget.animationDuration,
            curve: Curves.easeOutCubic,
            padding: EdgeInsets.only(top: _bodyTopPadding),
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
            ),
          ),
        ],
      ),
    );
  }
}
