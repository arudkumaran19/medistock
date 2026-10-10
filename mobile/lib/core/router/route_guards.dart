import '../storage/secure_storage.dart';

class RouteGuards {
  static final SecureStorageService _storage = SecureStorageService();

  static Future<String?> handleRedirect(String currentPath) async {
    final token = await _storage.getToken();
    final user = await _storage.getUser();
    final selectedRole = await _storage.getSelectedRole();

    final isAuth = token != null && token.isNotEmpty;
    final isSplash = currentPath == '/splash';
    final isRoleSelect = currentPath == '/role-selection';
    final isLogin = currentPath.startsWith('/login');

    if (isSplash) return null;

    if (!isAuth) {
      if (!isRoleSelect && !isLogin) {
        return '/role-selection';
      }
      return null;
    }

    // User is authenticated
    final role = user?['role']?.toString().toUpperCase() ??
        user?['roles']?[0]?.toString().toUpperCase() ??
        selectedRole?.toUpperCase() ??
        'FACILITYUSER';

    final isOfficer = role == 'FIELD_OFFICER' || role == 'FIELDOFFICER' || role == 'LOGISTICSCOORDINATOR';

    if (isRoleSelect || isLogin) {
      return isOfficer ? '/officer/dashboard' : '/user/dashboard';
    }

    if (currentPath.startsWith('/user') && isOfficer) {
      return '/officer/dashboard';
    }

    if (currentPath.startsWith('/officer') && !isOfficer) {
      return '/user/dashboard';
    }

    return null;
  }
}
