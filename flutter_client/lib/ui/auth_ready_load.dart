import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/auth_controller.dart';

/// Reloads when the session is restored or sign-in state changes.
/// Home/Library/Stats used to fetch before [AuthController.load] finished,
/// so a signed-in library looked empty until pull-to-refresh.
mixin AuthReadyLoad<T extends StatefulWidget> on State<T> {
  AuthController? _auth;
  bool? _loadedSignedIn;

  void onAuthReady(bool signedIn);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _auth = context.read<AuthController>();
      _auth!.addListener(_handleAuth);
      if (_auth!.ready) _handleAuth();
    });
  }

  void _handleAuth() {
    if (!mounted || _auth == null || !_auth!.ready) return;
    final signedIn = _auth!.isSignedIn;
    if (_loadedSignedIn == signedIn) return;
    _loadedSignedIn = signedIn;
    onAuthReady(signedIn);
  }

  @override
  void dispose() {
    _auth?.removeListener(_handleAuth);
    super.dispose();
  }
}
