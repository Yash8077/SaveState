import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../state/auth_controller.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _signup = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = context.read<AuthController>();
    try {
      if (_signup) {
        await auth.signUp(
          email: _email.text,
          password: _password.text,
          name: _name.text,
        );
      } else {
        await auth.signIn(_email.text, _password.text);
      }
      if (mounted) context.go('/');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: Text(_signup ? 'Create account' : 'Sign in')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              'Same account as save-state-jade.vercel.app. Your library syncs.',
              style: TextStyle(color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            if (_signup)
              TextField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
            if (_signup) const SizedBox(height: 12),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: true,
              autofillHints: [
                _signup ? AutofillHints.newPassword : AutofillHints.password
              ],
              decoration: const InputDecoration(
                labelText: 'Password',
                helperText: 'At least 8 characters',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: cs.error)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(_busy
                  ? 'Please wait…'
                  : _signup
                      ? 'Create account'
                      : 'Sign in'),
            ),
            TextButton(
              onPressed: _busy
                  ? null
                  : () => setState(() {
                        _signup = !_signup;
                        _error = null;
                      }),
              child: Text(_signup
                  ? 'Already have an account? Sign in'
                  : 'Need an account? Create one'),
            ),
          ],
        ),
      ),
    );
  }
}
