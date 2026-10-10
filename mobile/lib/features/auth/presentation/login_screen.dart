import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../domain/auth_state.dart';
import 'auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  final String roleType; // 'user' or 'officer'

  const LoginScreen({super.key, required this.roleType});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _emailController;
  late TextEditingController _passwordController;
  bool _obscurePassword = true;

  bool get isOfficer => widget.roleType == 'officer';

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(
      text: isOfficer ? 'officer@medistock.com' : 'user@medistock.com',
    );
    _passwordController = TextEditingController(text: 'Password123!');
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final controller = ref.read(authControllerProvider.notifier);
    final success = await controller.login(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );

    if (success && mounted) {
      if (isOfficer) {
        context.go('/officer/dashboard');
      } else {
        context.go('/user/dashboard');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final roleColor = isOfficer ? AppColors.secondary : AppColors.primary;
    final roleTitle = isOfficer ? 'Field Officer Sign In' : 'Facility User Sign In';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.go('/role-selection'),
        ),
        title: Text(roleTitle),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header badge
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: roleColor.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: roleColor.withOpacity(0.2)),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isOfficer ? Icons.local_shipping_rounded : Icons.local_hospital_rounded,
                        color: roleColor,
                        size: 28,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isOfficer ? 'FIELD LOGISTICS DISPATCH' : 'FACILITY & CLINIC PORTAL',
                              style: AppTextStyles.badge.copyWith(color: roleColor),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isOfficer ? 'Authorized Courier Network' : 'Apollo Anna Nagar Hub',
                              style: AppTextStyles.titleSmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 28),

                if (authState.status == AuthStatus.error && authState.errorMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 20),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.errorLight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.error.withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded, color: AppColors.error),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            authState.errorMessage!,
                            style: AppTextStyles.bodySmall.copyWith(color: AppColors.error),
                          ),
                        ),
                      ],
                    ),
                  ),

                Text('Email Address', style: AppTextStyles.labelLarge),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  style: AppTextStyles.bodyLarge,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.email_outlined),
                    hintText: 'name@medistock.com',
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'Please enter your email';
                    if (!val.contains('@')) return 'Enter a valid email address';
                    return null;
                  },
                ),

                const SizedBox(height: 20),

                Text('Password', style: AppTextStyles.labelLarge),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  style: AppTextStyles.bodyLarge,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    hintText: '••••••••',
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                      onPressed: () {
                        setState(() => _obscurePassword = !_obscurePassword);
                      },
                    ),
                  ),
                  validator: (val) {
                    if (val == null || val.isEmpty) return 'Please enter your password';
                    return null;
                  },
                ),

                const SizedBox(height: 28),

                ElevatedButton(
                  onPressed: authState.status == AuthStatus.loading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: roleColor,
                  ),
                  child: authState.status == AuthStatus.loading
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('Sign In to Dashboard', style: AppTextStyles.labelLarge.copyWith(color: Colors.white)),
                            const SizedBox(width: 8),
                            const Icon(Icons.arrow_forward_rounded, size: 18),
                          ],
                        ),
                ),

                const SizedBox(height: 20),

                // Quick Demo Login helper
                Center(
                  child: TextButton.icon(
                    onPressed: () {
                      _emailController.text = isOfficer ? 'officer@medistock.com' : 'user@medistock.com';
                      _passwordController.text = 'Password123!';
                      _submit();
                    },
                    icon: const Icon(Icons.flash_on_rounded, size: 16),
                    label: Text(
                      'Use Demo Credentials & Sign In Instantly',
                      style: AppTextStyles.bodySmall.copyWith(color: roleColor, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
