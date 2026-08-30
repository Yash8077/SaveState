import 'package:flutter/material.dart';

/// Stacked save-card mark. Screen and ticks follow [ColorScheme.primary]
/// so Material You / the picked accent recolors it live.
class SaveStateMark extends StatelessWidget {
  const SaveStateMark({super.key, this.size = 32});

  final double size;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        size: Size.square(size),
        painter: _SaveStateMarkPainter(
          back: Color.lerp(cs.surfaceContainerHighest, cs.primary, 0.18)!,
          mid: Color.lerp(cs.surfaceContainerHighest, cs.primary, 0.08)!,
          front: cs.surfaceContainerHighest,
          glow: cs.primary,
          glowSoft: cs.primary.withOpacity(0.55),
          edge: cs.outlineVariant.withOpacity(0.6),
        ),
      ),
    );
  }
}

class _SaveStateMarkPainter extends CustomPainter {
  _SaveStateMarkPainter({
    required this.back,
    required this.mid,
    required this.front,
    required this.glow,
    required this.glowSoft,
    required this.edge,
  });

  final Color back;
  final Color mid;
  final Color front;
  final Color glow;
  final Color glowSoft;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    void card(Rect rect, Color fill) {
      final rrect = RRect.fromRectAndRadius(rect, Radius.circular(w * 0.12));
      canvas.drawRRect(rrect, Paint()..color = fill);
      canvas.drawRRect(
        rrect,
        Paint()
          ..color = edge
          ..style = PaintingStyle.stroke
          ..strokeWidth = w * 0.02,
      );
    }

    card(Rect.fromLTWH(w * 0.30, h * 0.04, w * 0.58, h * 0.72), back);
    card(Rect.fromLTWH(w * 0.20, h * 0.12, w * 0.58, h * 0.72), mid);
    final frontRect = Rect.fromLTWH(w * 0.10, h * 0.20, w * 0.58, h * 0.72);
    card(frontRect, front);

    final screen = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        frontRect.left + w * 0.09,
        frontRect.top + h * 0.08,
        w * 0.40,
        h * 0.28,
      ),
      Radius.circular(w * 0.06),
    );
    canvas.drawRRect(screen, Paint()..color = glow);

    final bar1 = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        frontRect.left + w * 0.09,
        frontRect.top + h * 0.42,
        w * 0.40,
        h * 0.07,
      ),
      Radius.circular(w * 0.04),
    );
    canvas.drawRRect(bar1, Paint()..color = glow);

    final bar2 = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        frontRect.left + w * 0.09,
        frontRect.top + h * 0.53,
        w * 0.26,
        h * 0.07,
      ),
      Radius.circular(w * 0.04),
    );
    canvas.drawRRect(bar2, Paint()..color = glowSoft);
  }

  @override
  bool shouldRepaint(covariant _SaveStateMarkPainter old) {
    return old.back != back ||
        old.mid != mid ||
        old.front != front ||
        old.glow != glow ||
        old.glowSoft != glowSoft ||
        old.edge != edge;
  }
}
