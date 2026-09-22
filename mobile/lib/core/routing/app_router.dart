import 'package:flutter/material.dart';
import '../../features/inventory/models/inventory_models.dart';
import '../../features/inventory/screens/batch_detail_screen.dart';
import '../../features/inventory/screens/receive_stock_screen.dart';
import '../../features/inventory/screens/scan_batch_screen.dart';
import '../../features/inventory/screens/stock_adjustment_screen.dart';
import '../../features/inventory/screens/stock_lookup_screen.dart';

class AppRouter {
	static const inventory = '/inventory';
	static const receiveStock = '/inventory/receive';
	static const scanBatch = '/inventory/scan';
	static const batchDetail = '/inventory/batch';
	static const stockAdjustment = '/inventory/adjust';

	static Route<dynamic> generate(RouteSettings settings) {
		final Widget page;
		switch (settings.name) {
			case '/':
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
				page = batchNumber == null ? const StockLookupScreen() : BatchDetailScreen(batchNumber: batchNumber);
				break;
			case stockAdjustment:
				final balance = settings.arguments;
				page = balance is InventoryBalance ? StockAdjustmentScreen(balance: balance) : const StockLookupScreen();
				break;
			default:
				page = const StockLookupScreen();
		}
		return MaterialPageRoute<void>(settings: settings, builder: (_) => page);
	}
}
