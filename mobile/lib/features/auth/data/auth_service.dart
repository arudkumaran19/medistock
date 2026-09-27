import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/network/api_client.dart';

class AuthUser {
  final String userId;
  final String email;
  final List<String> roles;

  const AuthUser({
    required this.userId,
    required this.email,
    required this.roles,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final rawRoles = json['roles'];
    final roles = rawRoles is List
        ? rawRoles.map((e) => e.toString()).toList()
        : <String>[];
    return AuthUser(
      userId: json['userId']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      roles: roles,
    );
  }

  bool hasRole(String role) => roles.contains(role) || roles.contains('ADMIN') || roles.contains('Administrator');

  bool get isAdmin => roles.any((r) => ['Administrator', 'ADMIN'].contains(r));
  bool get isManager => roles.any((r) => ['FacilityManager', 'FACILITY_MANAGER'].contains(r));
  bool get isSupplierOfficer => roles.any((r) => ['SupplierOfficer', 'SUPPLIER_OFFICER'].contains(r));
  bool get isOperationalStaff => roles.any((r) => ['OperationalStaff', 'STORE_OFFICER'].contains(r));

  String get roleLabel {
    if (isAdmin) return 'System Administrator';
    if (isManager) return 'Facility Manager';
    if (isSupplierOfficer) return 'Supplier Officer';
    return 'Operational Staff';
  }
}

class AuthResponse {
  final String accessToken;
  final String refreshToken;
  final String expiresAt;
  final AuthUser user;

  const AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: json['accessToken']?.toString() ?? '',
      refreshToken: json['refreshToken']?.toString() ?? '',
      expiresAt: json['expiresAt']?.toString() ?? '',
      user: AuthUser.fromJson(json),
    );
  }
}

class MobileAuthService {
  static final MobileAuthService _instance = MobileAuthService._internal();

  factory MobileAuthService({ApiClient? client}) {
    if (client != null) {
      _instance._client = client;
    }
    return _instance;
  }

  MobileAuthService._internal({ApiClient? client}) : _client = client ?? ApiClient();

  ApiClient _client;

  // In-memory session; in production, persist via SharedPreferences or flutter_secure_storage
  AuthUser? _currentUser;
  String? _token;

  AuthUser? get currentUser => _currentUser;
  String? get token => _token;
  bool get isAuthenticated => _token != null && _currentUser != null;

  Future<bool> tryRestoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedToken = prefs.getString('auth_token');
      final savedUserJson = prefs.getString('auth_user');
      if (savedToken != null && savedUserJson != null) {
        _token = savedToken;
        _client.authToken = _token;
        _currentUser = AuthUser.fromJson(jsonDecode(savedUserJson) as Map<String, dynamic>);
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<AuthResponse> login({
    required String email,
    required String password,
  }) async {
    final res = await _client.request(
      '/api/auth/login',
      method: 'POST',
      body: {'email': email, 'password': password},
    );
    final response = AuthResponse.fromJson(res as Map<String, dynamic>);
    _token = response.accessToken;
    _client.authToken = _token;
    _currentUser = response.user;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', _token!);
      await prefs.setString('auth_user', jsonEncode({
        'userId': _currentUser!.userId,
        'email': _currentUser!.email,
        'roles': _currentUser!.roles,
      }));
    } catch (_) {}

    return response;
  }

  Future<AuthResponse> register({
    required String email,
    required String password,
    required String confirmPassword,
    String firstName = 'Staff',
    String lastName = 'Member',
    String role = 'OperationalStaff',
  }) async {
    final res = await _client.request(
      '/api/auth/register',
      method: 'POST',
      body: {
        'email': email,
        'password': password,
        'confirmPassword': confirmPassword,
        'firstName': firstName,
        'lastName': lastName,
        'role': role,
      },
    );
    final response = AuthResponse.fromJson(res as Map<String, dynamic>);
    _token = response.accessToken;
    _client.authToken = _token;
    _currentUser = response.user;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', _token!);
      await prefs.setString('auth_user', jsonEncode({
        'userId': _currentUser!.userId,
        'email': _currentUser!.email,
        'roles': _currentUser!.roles,
      }));
    } catch (_) {}

    return response;
  }

  void logout() {
    _token = null;
    _client.authToken = null;
    _currentUser = null;
    SharedPreferences.getInstance().then((prefs) {
      prefs.remove('auth_token');
      prefs.remove('auth_user');
    }).catchError((_) {});
  }
}
