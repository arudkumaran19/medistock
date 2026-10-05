import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/auth_repository.dart';
import '../domain/auth_state.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository());

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref.read(authRepositoryProvider));
});

class AuthController extends StateNotifier<AuthState> {
  final AuthRepository _repository;

  AuthController(this._repository) : super(AuthState.initial()) {
    checkAuthStatus();
  }

  Future<void> checkAuthStatus() async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final user = await _repository.getCurrentUser();
      if (user != null) {
        state = state.copyWith(status: AuthStatus.authenticated, user: user, selectedRole: user.role);
      } else {
        state = state.copyWith(status: AuthStatus.unauthenticated);
      }
    } catch (_) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
    }
  }

  void selectRole(String role) {
    state = state.copyWith(selectedRole: role);
  }

  Future<bool> login({required String email, required String password}) async {
    final role = state.selectedRole ?? 'FACILITYUSER';
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);

    try {
      final user = await _repository.login(email: email, password: password, expectedRole: role);
      state = state.copyWith(status: AuthStatus.authenticated, user: user);
      return true;
    } catch (e) {
      state = state.copyWith(status: AuthStatus.error, errorMessage: e.toString().replaceAll('Exception: ', ''));
      return false;
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = state.copyWith(status: AuthStatus.unauthenticated, user: null, selectedRole: null);
  }
}
