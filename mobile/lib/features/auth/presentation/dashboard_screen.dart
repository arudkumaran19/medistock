import 'package:flutter/material.dart';
import '../../auth/data/auth_service.dart';
import '../../../core/routing/app_router.dart';


// ─────────────────────────────────────────────────────────────────────
// Quick action tile used inside each role panel
// ─────────────────────────────────────────────────────────────────────
class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: cs.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: cs.primary, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey[400]),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, required this.icon, this.accentColor});
  final String label;
  final String value;
  final IconData icon;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final color = accentColor ?? cs.primary;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 10),
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main Dashboard Screen — role-routed
// ─────────────────────────────────────────────────────────────────────
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key, required this.user, required this.authService});

  final AuthUser user;
  final MobileAuthService authService;

  void _logout(BuildContext context) {
    authService.logout();
    Navigator.of(context).pushReplacementNamed(AppRouter.login);
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (user.isAdmin) {
      body = _AdminPanel(user: user, onAction: _handleAction(context));
    } else if (user.isManager) {
      body = _ManagerPanel(user: user, onAction: _handleAction(context));
    } else if (user.isSupplierOfficer) {
      body = _SupplierOfficerPanel(user: user, onAction: _handleAction(context));
    } else {
      body = _StaffPanel(user: user, onAction: _handleAction(context));
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D4A38),
        foregroundColor: Colors.white,
        title: const Text('MediStock', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -0.3)),
        actions: [
          Chip(
            label: Text(
              user.roleLabel,
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white),
            ),
            backgroundColor: Colors.white.withOpacity(0.15),
            side: BorderSide.none,
            padding: EdgeInsets.zero,
            labelPadding: const EdgeInsets.symmetric(horizontal: 8),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
            onPressed: () => _logout(context),
          ),
        ],
      ),
      body: body,
    );
  }

  void Function(String route) _handleAction(BuildContext context) {
    return (String route) => Navigator.of(context).pushNamed(route);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Facility Manager Panel
// ─────────────────────────────────────────────────────────────────────
class _ManagerPanel extends StatelessWidget {
  const _ManagerPanel({required this.user, required this.onAction});
  final AuthUser user;
  final void Function(String route) onAction;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header('Facility Management', 'Welcome, ${user.email}'),
          const SizedBox(height: 20),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.3,
            children: const [
              _StatCard(label: 'Pending Approvals', value: '—', icon: Icons.check_circle_outline, accentColor: Color(0xFFD97706)),
              _StatCard(label: 'Active POs', value: '—', icon: Icons.description_outlined),
              _StatCard(label: 'Policy Violations', value: '—', icon: Icons.warning_amber_outlined, accentColor: Color(0xFFDC2626)),
              _StatCard(label: 'Low Stock Alerts', value: '—', icon: Icons.trending_down, accentColor: Color(0xFF7C3AED)),
            ],
          ),
          const SizedBox(height: 24),
          const Text('Quick Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _QuickAction(
            icon: Icons.approval,
            title: 'Review Pending Approvals',
            subtitle: 'Approve or reject submitted purchase orders',
            onTap: () => onAction(AppRouter.procurementApprovals),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.list_alt,
            title: 'Purchase Orders',
            subtitle: 'View and manage all purchase order records',
            onTap: () => onAction(AppRouter.procurement),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.inventory_2_outlined,
            title: 'Inventory Overview',
            subtitle: 'Monitor stock levels and expiry',
            onTap: () => onAction(AppRouter.inventory),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.inbox,
            title: 'Receive Stock',
            subtitle: 'Record incoming stock deliveries',
            onTap: () => onAction(AppRouter.receiveStock),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.add_shopping_cart,
            title: 'Create Procurement Request',
            subtitle: 'Draft a new purchase order',
            onTap: () => onAction(AppRouter.procurementRequest),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.medication_liquid_outlined,
            title: 'Medicine Catalogue',
            subtitle: 'Create, edit and archive medicines',
            onTap: () => onAction(AppRouter.medicineCatalogue),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.event_busy_outlined,
            title: 'Expiry Monitor',
            subtitle: 'Batches approaching their expiry date',
            onTap: () => onAction(AppRouter.expiryMonitor),
          ),
          const SizedBox(height: 24),
          // Demand & Shortage - Sathurstiga S. (IT24103156).
          const Text('Demand & Shortage', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _DemandActions(onAction: onAction),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Demand & Shortage quick actions - Sathurstiga S. (IT24103156).
// Shared by the manager and staff panels so both reach the same screens.
// ─────────────────────────────────────────────────────────────────────
class _DemandActions extends StatelessWidget {
  const _DemandActions({required this.onAction});
  final void Function(String route) onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _QuickAction(
          icon: Icons.warning_amber_outlined,
          title: 'Shortage Alerts',
          subtitle: 'Medicines projected to run out before resupply',
          onTap: () => onAction(AppRouter.demandShortages),
        ),
        const SizedBox(height: 10),
        _QuickAction(
          icon: Icons.trending_up,
          title: 'Demand Forecasts',
          subtitle: 'Projected demand and days of cover',
          onTap: () => onAction(AppRouter.demandForecasts),
        ),
        const SizedBox(height: 10),
        _QuickAction(
          icon: Icons.edit_note_outlined,
          title: 'Record Consumption',
          subtitle: 'Log what was dispensed today',
          onTap: () => onAction(AppRouter.demandConsumption),
        ),
        const SizedBox(height: 10),
        _QuickAction(
          icon: Icons.history,
          title: 'Consumption History',
          subtitle: 'Review and correct recorded usage',
          onTap: () => onAction(AppRouter.demandHistory),
        ),
        const SizedBox(height: 10),
        _QuickAction(
          icon: Icons.auto_awesome,
          title: 'Demand Agent',
          subtitle: 'Ask the AI agent to assess shortage risk',
          onTap: () => onAction(AppRouter.demandAgent),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Supplier Officer Panel
// ─────────────────────────────────────────────────────────────────────
class _SupplierOfficerPanel extends StatelessWidget {
  const _SupplierOfficerPanel({required this.user, required this.onAction});
  final AuthUser user;
  final void Function(String route) onAction;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header('Procurement Operations', 'Welcome, ${user.email}'),
          const SizedBox(height: 20),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.3,
            children: const [
              _StatCard(label: 'Draft Orders', value: '—', icon: Icons.description_outlined, accentColor: Color(0xFFD97706)),
              _StatCard(label: 'Pending Approval', value: '—', icon: Icons.hourglass_empty, accentColor: Color(0xFF7C3AED)),
              _StatCard(label: 'Active Suppliers', value: '—', icon: Icons.business_outlined),
              _StatCard(label: 'Delivered This Month', value: '—', icon: Icons.local_shipping_outlined),
            ],
          ),
          const SizedBox(height: 24),
          const Text('Quick Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _QuickAction(
            icon: Icons.add_shopping_cart,
            title: 'Create Purchase Request',
            subtitle: 'Submit a new procurement order',
            onTap: () => onAction(AppRouter.procurementRequest),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.list_alt,
            title: 'Purchase Orders',
            subtitle: 'Track order lifecycle from draft to delivery',
            onTap: () => onAction(AppRouter.procurement),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.inventory_2_outlined,
            title: 'Inventory Status',
            subtitle: 'Check current stock levels',
            onTap: () => onAction(AppRouter.inventory),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Operational Staff Panel
// ─────────────────────────────────────────────────────────────────────
class _StaffPanel extends StatelessWidget {
  const _StaffPanel({required this.user, required this.onAction});
  final AuthUser user;
  final void Function(String route) onAction;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header('Inventory Operations', 'Welcome, ${user.email}'),
          const SizedBox(height: 20),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.3,
            children: const [
              _StatCard(label: 'Inventory Items', value: '—', icon: Icons.medication_outlined),
              _StatCard(label: 'Expiring Soon', value: '—', icon: Icons.event_outlined, accentColor: Color(0xFFD97706)),
              _StatCard(label: 'Low Stock', value: '—', icon: Icons.trending_down, accentColor: Color(0xFFDC2626)),
              _StatCard(label: 'Recent Receipts', value: '—', icon: Icons.inbox_outlined),
            ],
          ),
          const SizedBox(height: 24),
          const Text('Quick Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _QuickAction(
            icon: Icons.medication_outlined,
            title: 'Inventory Catalogue',
            subtitle: 'Browse and search medicine inventory',
            onTap: () => onAction(AppRouter.inventory),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.inbox,
            title: 'Receive Stock',
            subtitle: 'Record incoming stock deliveries',
            onTap: () => onAction(AppRouter.receiveStock),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.qr_code_scanner,
            title: 'Scan Batch',
            subtitle: 'Look up a batch by scanning its code',
            onTap: () => onAction(AppRouter.scanBatch),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.medication_liquid_outlined,
            title: 'Medicine Catalogue',
            subtitle: 'Create, edit and archive medicines',
            onTap: () => onAction(AppRouter.medicineCatalogue),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.event_busy_outlined,
            title: 'Expiry Monitor',
            subtitle: 'Batches approaching their expiry date',
            onTap: () => onAction(AppRouter.expiryMonitor),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.list_alt,
            title: 'View Purchase Orders',
            subtitle: 'Track procurement status',
            onTap: () => onAction(AppRouter.procurement),
          ),
          const SizedBox(height: 24),
          // Demand & Shortage - Sathurstiga S. (IT24103156). Store keepers are
          // the ones recording what was dispensed, so they get these too.
          const Text('Demand & Shortage', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _DemandActions(onAction: onAction),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Administrator Panel
// ─────────────────────────────────────────────────────────────────────
class _AdminPanel extends StatelessWidget {
  const _AdminPanel({required this.user, required this.onAction});
  final AuthUser user;
  final void Function(String route) onAction;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header('System Administration', 'Welcome, ${user.email}'),
          const SizedBox(height: 20),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.3,
            children: const [
              _StatCard(label: 'System Status', value: 'Online', icon: Icons.circle, accentColor: Color(0xFF16A34A)),
              _StatCard(label: 'Active Facilities', value: '—', icon: Icons.local_hospital_outlined),
              _StatCard(label: 'Pending Approvals', value: '—', icon: Icons.check_circle_outline, accentColor: Color(0xFFD97706)),
              _StatCard(label: 'Total Users', value: '—', icon: Icons.group_outlined),
            ],
          ),
          const SizedBox(height: 24),
          const Text('Administration Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _QuickAction(
            icon: Icons.approval,
            title: 'Global Approval Console',
            subtitle: 'Approve or escalate any procurement decision',
            onTap: () => onAction(AppRouter.procurementApprovals),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.list_alt,
            title: 'All Purchase Orders',
            subtitle: 'System-wide procurement view',
            onTap: () => onAction(AppRouter.procurement),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.inventory_2_outlined,
            title: 'Inventory Overview',
            subtitle: 'System-wide stock status',
            onTap: () => onAction(AppRouter.inventory),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.group_outlined,
            title: 'User Management',
            subtitle: 'Manage access, roles, and account status',
            onTap: () => onAction(AppRouter.userManagement),
          ),
          const SizedBox(height: 10),
          _QuickAction(
            icon: Icons.add_shopping_cart,
            title: 'Create Procurement Request',
            subtitle: 'Draft a new purchase order',
            onTap: () => onAction(AppRouter.procurementRequest),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              border: Border.all(color: const Color(0xFFFDE68A)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Icon(Icons.warning_amber, color: Color(0xFF78350F), size: 18),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Admin Notice: Changes here affect all facilities. Privileged role assignments must use secure administration channels only.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF78350F)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Shared header helper
// ─────────────────────────────────────────────────────────────────────
Widget _header(String title, String subtitle) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.4),
      ),
      const SizedBox(height: 4),
      Text(subtitle, style: TextStyle(fontSize: 13, color: Colors.grey[600])),
    ],
  );
}
