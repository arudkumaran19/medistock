import '../../../shared/models/user_model.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated, error }

class AuthState {
  final AuthStatus status;
  final UserModel? user;
  final String? selectedRole;
  final String? errorMessage;

  const AuthState({
    required this.status,
    this.user,
    this.selectedRole,
    this.errorMessage,
  });

  factory AuthState.initial() => const AuthState(status: AuthStatus.initial);

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    String? selectedRole,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      selectedRole: selectedRole ?? this.selectedRole,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
