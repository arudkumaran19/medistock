import 'package:flutter/material.dart';
import 'core/routing/app_router.dart';

class MediStockApp extends StatelessWidget {
	const MediStockApp({super.key});
	@override
	Widget build(BuildContext context) => MaterialApp(title: 'MediStock Inventory', theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff17634d)), useMaterial3: true), onGenerateRoute: AppRouter.generate);
}
