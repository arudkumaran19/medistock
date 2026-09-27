import 'package:flutter/material.dart';
import '../../features/redistribution/models/transfer_models.dart';
import '../../features/redistribution/screens/create_transfer_screen.dart';
import '../../features/redistribution/screens/receive_transfer_screen.dart';
import '../../features/redistribution/screens/transfer_details_screen.dart';
import '../../features/redistribution/screens/transfer_list_screen.dart';
import '../../features/redistribution/screens/transfer_tracking_screen.dart';

class AppRoutes {
  static const String home = '/';
  static const String create = '/create';
  static const String details = '/details';
  static const String tracking = '/tracking';
  static const String receive = '/receive';
}

class AppRouter {
  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.home:
        return MaterialPageRoute(builder: (_) => const TransferListScreen());

      case AppRoutes.create:
        return MaterialPageRoute(builder: (_) => const CreateTransferScreen());

      case AppRoutes.details:
        final transferId = settings.arguments as String;
        return MaterialPageRoute(
          builder: (_) => TransferDetailsScreen(transferId: transferId),
        );

      case AppRoutes.tracking:
        final transfer = settings.arguments as Transfer;
        return MaterialPageRoute(
          builder: (_) => TransferTrackingScreen(transfer: transfer),
        );

      case AppRoutes.receive:
        final transfer = settings.arguments as Transfer;
        return MaterialPageRoute(
          builder: (_) => ReceiveTransferScreen(transfer: transfer),
        );

      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(
              child: Text('No route defined for ${settings.name}'),
            ),
          ),
        );
    }
  }
}
