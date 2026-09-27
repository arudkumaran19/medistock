import 'package:flutter/material.dart';
import 'core/routing/app_router.dart';

class MediStockApp extends StatelessWidget {
  const MediStockApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediStock Clinical Inventory',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F766E),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
        inputDecorationTheme: const InputDecorationTheme(
          contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
        cardTheme: const CardThemeData(
          elevation: 2,
          shadowColor: Color(0x1A000000),
        ),
      ),
      initialRoute: AppRouter.login,
      onGenerateRoute: AppRouter.generate,
    );
  }
}
