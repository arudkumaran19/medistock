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
    final isRegister = currentPath == '/auth/register';

    if (isSplash) return null;

    if (!isAuth) {
      if (!isRoleSelect && !isLogin && !isRegister) {
        return '/role-selection';
      }
      return null;
    }

    // User is authenticated
    final rawUserRole = user?['role']?.toString().toUpperCase() ??
        user?['roles']?[0]?.toString().toUpperCase() ??
        '';

    final isOperationalStaff = rawUserRole == 'OPERATIONALSTAFF' || rawUserRole == 'STAFF';

    String effectiveRole;
    if (selectedRole != null && selectedRole.isNotEmpty) {
      effectiveRole = selectedRole.toUpperCase();
    } else if (isOperationalStaff) {
      final userFacilityId = user?['facilityId']?.toString();
      effectiveRole = (userFacilityId != null && userFacilityId.isNotEmpty) ? 'FACILITYUSER' : 'FIELD_OFFICER';
    } else {
      effectiveRole = rawUserRole.isNotEmpty ? rawUserRole : 'FACILITYUSER';
    }

    final isOfficer = effectiveRole == 'FIELD_OFFICER' ||
        effectiveRole == 'FIELDOFFICER' ||
        effectiveRole == 'LOGISTICSCOORDINATOR';

    if (isRoleSelect || isLogin || isRegister) {
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
