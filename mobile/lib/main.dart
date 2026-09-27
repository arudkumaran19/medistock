// SHARED SCAFFOLDING - NOT owned by the Demand vertical.
// Created by Sathurstiga S. (IT24103156) so the demand feature runs. The mobile
// owners replace this on integration.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

void main() {
  runApp(const ProviderScope(child: MediStockApp()));
}
