import 'package:flutter/material.dart';
import '../../features/auth/data/auth_service.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/dashboard_screen.dart';
import '../../features/admin/screens/user_management_screen.dart';
import '../../features/inventory/models/inventory_models.dart';
import '../../features/inventory/screens/batch_detail_screen.dart';
import '../../features/inventory/screens/receive_stock_screen.dart';
import '../../features/inventory/screens/scan_batch_screen.dart';
import '../../features/inventory/screens/stock_adjustment_screen.dart';
import '../../features/inventory/screens/stock_lookup_screen.dart';
import '../../features/inventory/screens/medicine_catalogue_screen.dart';
import '../../features/inventory/screens/expiry_monitor_screen.dart';
import '../../features/procurement/screens/procurement_request_screen.dart';
import '../../features/procurement/screens/purchase_status_screen.dart';
import '../../features/procurement/screens/approval_status_screen.dart';
// Demand & Shortage vertical - Sathurstiga S. (IT24103156).
import '../../features/demand/presentation/consumption_entry_screen.dart';
import '../../features/demand/presentation/demand_history_screen.dart';
import '../../features/demand/presentation/forecast_screen.dart';
import '../../features/demand/presentation/shortage_alerts_screen.dart';

/// Single global auth service instance used to share session across routes.
/// In production, use a proper dependency injection / state management solution.
final _authService = MobileAuthService();

class AppRouter {
  // Auth routes
  static const login = '/login';
  static const register = '/register';
  static const dashboard = '/dashboard';

  // Admin routes
  static const userManagement = '/admin/users';

  // Inventory routes
  static const inventory = '/inventory';
  static const receiveStock = '/inventory/receive';
  static const scanBatch = '/inventory/scan';
  static const batchDetail = '/inventory/batch';
  static const stockAdjustment = '/inventory/adjust';
  static const medicineCatalogue = '/inventory/medicines';
  static const expiryMonitor = '/inventory/expiry';

  // Procurement routes
  static const procurement = '/procurement';
  static const procurementRequest = '/procurement/request';
  static const procurementApprovals = '/procurement/approvals';

  // Demand & Shortage routes - Sathurstiga S. (IT24103156).
  static const demandShortages = '/demand/shortages';
  static const demandForecasts = '/demand/forecasts';
  static const demandConsumption = '/demand/consumption';
  static const demandHistory = '/demand/history';

  static Route<dynamic> generate(RouteSettings settings) {
    final Widget page;
    switch (settings.name) {
      // ─── Auth ────────────────────────────────────────────────────────
      case login:
        page = const LoginScreen();
        break;

      case register:
        page = const RegisterScreen();
        break;

      case dashboard:
        final user = (settings.arguments as AuthUser?) ?? _authService.currentUser;
        if (user == null) {
          page = const LoginScreen();
        } else {
          page = DashboardScreen(user: user, authService: _authService);
        }
        break;

      case userManagement:
        final user = _authService.currentUser;
        page = user != null && user.isAdmin
            ? UserManagementScreen(currentUser: user)
            : const LoginScreen();
        break;

      // ─── Root: guard → dashboard or login ────────────────────────────
      case '/':
        if (_authService.isAuthenticated) {
          page = DashboardScreen(
            user: _authService.currentUser!,
            authService: _authService,
          );
        } else {
          page = const LoginScreen();
        }
        break;

      // ─── Inventory ───────────────────────────────────────────────────
      case inventory:
        page = const StockLookupScreen();
        break;

      case receiveStock:
        page = const ReceiveStockScreen();
        break;

      case scanBatch:
        page = const ScanBatchScreen();
        break;

      case batchDetail:
        final batchNumber = settings.arguments as String?;
        page = batchNumber == null
            ? const StockLookupScreen()
            : BatchDetailScreen(batchNumber: batchNumber);
        break;

      case medicineCatalogue:
        page = const MedicineCatalogueScreen();
        break;

      case expiryMonitor:
        page = const ExpiryMonitorScreen();
        break;

      case stockAdjustment:
        final balance = settings.arguments;
        page = balance is InventoryBalance
            ? StockAdjustmentScreen(balance: balance)
            : const StockLookupScreen();
        break;

      // ─── Procurement ─────────────────────────────────────────────────
      case procurement:
        page = const PurchaseStatusScreen();
        break;

      case procurementRequest:
        page = const ProcurementRequestScreen();
        break;

      case procurementApprovals:
        page = const ApprovalStatusScreen();
        break;

      // ─── Demand & Shortage ───────────────────────────────────────────
      // Sathurstiga S. (IT24103156). These screens and their tests already
      // existed; only the routing that reaches them is added here.
      case demandShortages:
        page = const ShortageAlertsScreen();
        break;

      case demandForecasts:
        page = const ForecastScreen();
        break;

      case demandConsumption:
        page = const ConsumptionEntryScreen();
        break;

      case demandHistory:
        page = const DemandHistoryScreen();
        break;

      default:
        page = const LoginScreen();
    }

    return MaterialPageRoute<void>(settings: settings, builder: (_) => page);
  }
}
