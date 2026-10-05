import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'features/auth/data/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await MobileAuthService().tryRestoreSession();

  runApp(const ProviderScope(child: MediStockApp()));
}
