import 'package:flutter/material.dart';

import '../../auth/data/auth_service.dart';

class UserManagementScreen extends StatelessWidget {
  const UserManagementScreen({super.key, this.currentUser});

  final AuthUser? currentUser;

  @override
  Widget build(BuildContext context) {
    final user = currentUser ?? const AuthUser(userId: '', email: 'admin@medistock.com', roles: ['Administrator']);

    return Scaffold(
      appBar: AppBar(
        title: const Text('User Management'),
        backgroundColor: const Color(0xFF0D4A38),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Admin Access Control',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Current session: ${user.email}',
              style: TextStyle(color: Colors.grey[700], fontSize: 14),
            ),
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.security, color: Color(0xFF7C3AED)),
                      SizedBox(width: 8),
                      Text('Administrative controls', style: TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Role changes, status updates, and deletions should be managed from the secure admin console. This mobile view keeps the admin dashboard aligned with the web experience.',
                    style: TextStyle(color: Colors.grey[700], height: 1.5),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text('Current Role', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: user.roles
                  .map(
                    (role) => Chip(
                      label: Text(role),
                      backgroundColor: const Color(0xFF7C3AED).withOpacity(0.12),
                      side: BorderSide.none,
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}
