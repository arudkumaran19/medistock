import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'features/auth/data/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await MobileAuthService().tryRestoreSession();

  // ProviderScope is required by the Demand & Shortage screens, which are Riverpod
  // consumers (Sathurstiga S., IT24103156). Without it they throw "No ProviderScope
  // found" the moment they render. The widget tests supplied their own scope, so the
  // gap only ever showed in the running app. Screens that do not use Riverpod are
  // unaffected by this wrapper.
  runApp(const ProviderScope(child: MediStockApp()));
}
