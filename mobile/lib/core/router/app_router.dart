import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/role_selection_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/facility_user/alerts/alerts_screen.dart';
import '../../features/facility_user/dashboard/user_home_screen.dart';
import '../../features/facility_user/inventory/inventory_list_screen.dart';
import '../../features/facility_user/profile/profile_screen.dart';
import '../../features/facility_user/requests/new_request_wizard.dart';
import '../../features/facility_user/requests/request_detail_screen.dart';
import '../../features/facility_user/requests/request_list_screen.dart';
import '../../features/field_officer/dashboard/officer_home_screen.dart';
import '../../features/field_officer/profile/officer_profile_screen.dart';
import '../../features/field_officer/tasks/active_delivery_screen.dart';
import '../../features/field_officer/tasks/task_history_screen.dart';
import 'route_guards.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/splash',
  redirect: (BuildContext context, GoRouterState state) async {
    return await RouteGuards.handleRedirect(state.uri.toString());
  },
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/role-selection',
      builder: (context, state) => const RoleSelectionScreen(),
    ),
    GoRoute(
      path: '/login/:role',
      builder: (context, state) {
        final roleType = state.pathParameters['role'] ?? 'user';
        return LoginScreen(roleType: roleType);
      },
    ),

    // FACILITY USER DASHBOARD ROUTES
    GoRoute(
      path: '/user/dashboard',
      builder: (context, state) => const UserHomeScreen(),
    ),
    GoRoute(
      path: '/user/inventory',
      builder: (context, state) => const InventoryListScreen(),
    ),
    GoRoute(
      path: '/user/requests',
      builder: (context, state) => const RequestListScreen(),
    ),
    GoRoute(
      path: '/user/requests/new',
      builder: (context, state) => const NewRequestWizard(),
    ),
    GoRoute(
      path: '/user/requests/:id',
      builder: (context, state) {
        final id = state.pathParameters['id'] ?? 'req-8842';
        return RequestDetailScreen(requestId: id);
      },
    ),
    GoRoute(
      path: '/user/alerts',
      builder: (context, state) => const AlertsScreen(),
    ),
    GoRoute(
      path: '/user/profile',
      builder: (context, state) => const ProfileScreen(),
    ),

    // FIELD OFFICER DASHBOARD ROUTES
    GoRoute(
      path: '/officer/dashboard',
      builder: (context, state) => const OfficerHomeScreen(),
    ),
    GoRoute(
      path: '/officer/tasks',
      builder: (context, state) => const TaskHistoryScreen(),
    ),
    GoRoute(
      path: '/officer/active/:id',
      builder: (context, state) {
        final id = state.pathParameters['id'] ?? 'req-8842';
        return ActiveDeliveryScreen(transferId: id);
      },
    ),
    GoRoute(
      path: '/officer/profile',
      builder: (context, state) => const OfficerProfileScreen(),
    ),
  ],
);
