import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/session_events.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../shared/models/paged_response.dart';
import '../data/dev_auth_repository.dart';
import '../domain/session.dart';

/// TEMPORARY DEVELOPMENT SESSION STATE. DELETE ON INTEGRATION.
///
/// Authentication is owned by Vaisnavi L. (IT24102469). Her real sign-in replaces this.

final Provider<DevAuthRepository> devAuthRepositoryProvider =
    Provider<DevAuthRepository>(
  (Ref ref) => DevAuthRepository(ref.watch(apiClientProvider)),
);

/// State of the sign-in screen and the session it produces.
class AuthState {
  const AuthState({
    this.session,
    this.isRestoring = true,
    this.isSigningIn = false,
    this.errorMessage,
  });

  final Session? session;

  /// True until the stored session has been read at launch.
  final bool isRestoring;

  final bool isSigningIn;
  final String? errorMessage;

  bool get isSignedIn => session != null;

  AuthState copyWith({
    Session? session,
    bool clearSession = false,
    bool? isRestoring,
    bool? isSigningIn,
    String? errorMessage,
  }) {
    return AuthState(
      session: clearSession ? null : (session ?? this.session),
      isRestoring: isRestoring ?? this.isRestoring,
      isSigningIn: isSigningIn ?? this.isSigningIn,
      errorMessage: errorMessage,
    );
  }
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._repository, this._storage) : super(const AuthState()) {
    // Lets the network layer drop the session when the API rejects the token,
    // without core needing to import this feature.
    SessionEvents.onUnauthorized = onUnauthorized;
    _restore();
  }

  final DevAuthRepository _repository;
  final SecureStorage _storage;

  /// Reads any stored session at launch, discarding one that has expired.
  Future<void> _restore() async {
    final Map<String, dynamic>? stored = await _storage.readSession();

    if (stored == null) {
      state = state.copyWith(isRestoring: false);
      return;
    }

    try {
      final Session session = Session.fromJson(stored);

      if (session.isExpired) {
        await _storage.clearSession();
        state = state.copyWith(isRestoring: false, clearSession: true);
        return;
      }

      state = state.copyWith(session: session, isRestoring: false);
    } catch (_) {
      await _storage.clearSession();
      state = state.copyWith(isRestoring: false, clearSession: true);
    }
  }

  Future<void> signIn(UserRole role) async {
    state = state.copyWith(isSigningIn: true, errorMessage: null);

    try {
      final Session session = await _repository.signIn(role);
      await _storage.writeSession(session.toJson());

      state = AuthState(session: session, isRestoring: false);
    } on ApiFailure catch (failure) {
      state = state.copyWith(isSigningIn: false, errorMessage: failure.message);
    }
  }

  Future<void> signOut() async {
    await _storage.clearSession();
    state = const AuthState(isRestoring: false);
  }

  /// Called by the auth interceptor when the API rejects the token.
  Future<void> onUnauthorized() async {
    if (!mounted) {
      return;
    }

    await _storage.clearSession();
    state = const AuthState(isRestoring: false);
  }
}

final StateNotifierProvider<AuthController, AuthState> authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>(
  (Ref ref) => AuthController(
    ref.watch(devAuthRepositoryProvider),
    ref.watch(secureStorageProvider),
  ),
);
