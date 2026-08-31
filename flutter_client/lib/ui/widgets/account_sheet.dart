import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../state/auth_controller.dart';
import 'user_avatar.dart';

Future<void> showAccountSheet(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  final wide = MediaQuery.sizeOf(context).width >= 720;
  if (wide) {
    return showDialog<void>(
      context: context,
      barrierColor: Colors.black.withOpacity(0.55),
      builder: (ctx) => Dialog(
        backgroundColor: cs.surfaceContainerHigh,
        insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: const _AccountSheet(),
        ),
      ),
    );
  }
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: cs.surfaceContainerHigh,
    showDragHandle: true,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (ctx) => const _AccountSheet(),
  );
}

class AccountAvatarButton extends StatelessWidget {
  final double size;
  const AccountAvatarButton({super.key, this.size = 42});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final name = auth.user?.name.trim().split(RegExp(r'\s+')).first;
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => showAccountSheet(context),
        child: UserAvatar(
          image: auth.user?.image ?? guestAvatar,
          name: name,
          size: size,
        ),
      ),
    );
  }
}

class _AccountSheet extends StatelessWidget {
  const _AccountSheet();

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final theme = Theme.of(context);
    final auth = context.watch<AuthController>();
    final user = auth.user;
    final signedIn = auth.isSignedIn;
    final name = user?.name.trim().isNotEmpty == true
        ? user!.name.trim()
        : (user?.email ?? 'Guest');

    Future<void> closeThen(VoidCallback action) async {
      Navigator.of(context).pop();
      await Future<void>.delayed(const Duration(milliseconds: 40));
      action();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            contentPadding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
            leading: UserAvatar(
              image: user?.image ?? guestAvatar,
              name: name,
              size: 48,
            ),
            title: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            subtitle: Text(
              signedIn ? 'Tap to log out' : 'Sign in to sync your library',
              style: theme.textTheme.bodySmall?.copyWith(
                color: cs.onSurfaceVariant,
              ),
            ),
            onTap: () async {
              if (signedIn) {
                Navigator.of(context).pop();
                await auth.signOut();
                if (context.mounted) context.go('/');
              } else {
                await closeThen(() => context.push('/login'));
              }
            },
          ),
          const SizedBox(height: 4),
          DecoratedBox(
            decoration: BoxDecoration(
              color: cs.surface,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                if (signedIn)
                  _row(
                    context,
                    icon: Icons.person_outline_rounded,
                    label: 'View profile',
                    onTap: () => closeThen(() => context.push('/profile')),
                  ),
                _row(
                  context,
                  icon: Icons.settings_outlined,
                  label: 'Settings',
                  onTap: () => closeThen(() => context.push('/settings')),
                ),
                if (signedIn)
                  _row(
                    context,
                    icon: Icons.logout_rounded,
                    label: 'Log out',
                    danger: true,
                    onTap: () async {
                      Navigator.of(context).pop();
                      await auth.signOut();
                      if (context.mounted) context.go('/');
                    },
                  )
                else
                  _row(
                    context,
                    icon: Icons.login_rounded,
                    label: 'Sign in',
                    onTap: () => closeThen(() => context.push('/login')),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool danger = false,
  }) {
    final cs = Theme.of(context).colorScheme;
    return ListTile(
      leading: Icon(icon, color: danger ? cs.error : cs.onSurface),
      title: Text(
        label,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          color: danger ? cs.error : null,
        ),
      ),
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: cs.onSurfaceVariant,
      ),
      onTap: onTap,
    );
  }
}
