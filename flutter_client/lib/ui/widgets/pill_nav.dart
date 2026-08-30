import 'dart:ui';
import 'package:flutter/material.dart';

class PillDestination {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  const PillDestination({
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });
}

class PillNav extends StatelessWidget {
  final Axis axis;
  final int index;
  final List<PillDestination> destinations;
  final ValueChanged<int> onSelect;
  final VoidCallback? onSettings;
  final bool settingsSelected;

  const PillNav({
    super.key,
    required this.axis,
    required this.index,
    required this.destinations,
    required this.onSelect,
    this.onSettings,
    this.settingsSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final vertical = axis == Axis.vertical;
    return ClipRRect(
      borderRadius: BorderRadius.circular(40),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: cs.surface.withOpacity(0.78),
            borderRadius: BorderRadius.circular(40),
            border: Border.all(color: cs.outlineVariant.withOpacity(0.35)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.28),
                blurRadius: 28,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: vertical ? 8 : 10,
              vertical: vertical ? 12 : 8,
            ),
            child: Flex(
              direction: axis,
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < destinations.length; i++)
                  _PillButton(
                    destination: destinations[i],
                    selected: i == index,
                    onTap: () => onSelect(i),
                  ),
                if (onSettings != null) ...[
                  Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: vertical ? 10 : 6,
                      vertical: vertical ? 6 : 10,
                    ),
                    child: SizedBox(
                      width: vertical ? 22 : 1,
                      height: vertical ? 1 : 22,
                      child: ColoredBox(
                        color: cs.outlineVariant.withOpacity(0.5),
                      ),
                    ),
                  ),
                  _PillButton(
                    destination: const PillDestination(
                      icon: Icons.settings_outlined,
                      selectedIcon: Icons.settings_rounded,
                      label: 'Settings',
                    ),
                    selected: settingsSelected,
                    onTap: onSettings!,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PillButton extends StatelessWidget {
  final PillDestination destination;
  final bool selected;
  final VoidCallback onTap;
  const _PillButton({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Tooltip(
      message: destination.label,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          width: 46,
          height: 46,
          margin: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: selected ? cs.primary.withOpacity(0.22) : Colors.transparent,
            shape: BoxShape.circle,
          ),
          child: Icon(
            selected ? destination.selectedIcon : destination.icon,
            color: selected ? cs.primary : cs.onSurfaceVariant,
            size: 24,
          ),
        ),
      ),
    );
  }
}
