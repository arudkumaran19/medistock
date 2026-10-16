import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';
import 'package:medistock_mobile/core/constants/app_constants.dart';
import 'package:medistock_mobile/features/redistribution/models/transfer_models.dart';
import 'package:medistock_mobile/features/redistribution/widgets/transfer_live_map_widget.dart';
import 'package:medistock_mobile/shared/models/facility_model.dart';

const List<int> _kTransparentImage = <int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
  0x42, 0x60, 0x82,
];

class _MockHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) => _MockHttpClient();
}

class _MockHttpClient implements HttpClient {
  @override
  Future<HttpClientRequest> getUrl(Uri url) async => _MockHttpRequest();
  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async => _MockHttpRequest();
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class _MockHttpHeaders implements HttpHeaders {
  @override
  void set(String name, Object value, {bool preserveHeaderCase = false}) {}
  @override
  void add(String name, Object value, {bool preserveHeaderCase = false}) {}
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class _MockHttpRequest implements HttpClientRequest {
  @override
  final HttpHeaders headers = _MockHttpHeaders();
  @override
  bool followRedirects = true;
  @override
  int maxRedirects = 5;
  @override
  void add(List<int> data) {}
  @override
  Future addStream(Stream<List<int>> stream) async {}
  @override
  Future<HttpClientResponse> close() async => _MockHttpResponse();
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class _MockHttpResponse extends Stream<List<int>> implements HttpClientResponse {
  @override
  final HttpHeaders headers = _MockHttpHeaders();
  @override
  int get statusCode => 200;
  @override
  String get reasonPhrase => 'OK';
  @override
  bool get isRedirect => false;
  @override
  bool get persistentConnection => true;
  @override
  List<RedirectInfo> get redirects => const <RedirectInfo>[];
  @override
  int get contentLength => _kTransparentImage.length;
  @override
  HttpClientResponseCompressionState get compressionState =>
      HttpClientResponseCompressionState.notCompressed;
  @override
  StreamSubscription<List<int>> listen(void Function(List<int> event)? onData,
      {Function? onError, void Function()? onDone, bool? cancelOnError}) {
    return Stream<List<int>>.fromIterable([_kTransparentImage]).listen(
      onData,
      onError: onError,
      onDone: onDone,
      cancelOnError: cancelOnError,
    );
  }
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

void main() {
  setUpAll(() {
    HttpOverrides.global = _MockHttpOverrides();
  });

  group('Phase 2: Facilities and Maps Integrity Tests', () {
    test('1. mobile/lib contains no India or demo text (Chennai, Tamil, Guindy, etc.)', () {
      final libDir = Directory('lib');
      expect(libDir.existsSync(), isTrue, reason: 'lib directory must exist');

      final forbiddenPatterns = [
        RegExp(r'\bChennai\b', caseSensitive: false),
        RegExp(r'\bTamil\b', caseSensitive: false),
        RegExp(r'\bGuindy\b', caseSensitive: false),
        RegExp(r'\bAnna\s+Nagar\b', caseSensitive: false),
        RegExp(r'48\s+active\s+hubs', caseSensitive: false),
        RegExp(r'\bTambaram\b', caseSensitive: false),
        RegExp(r'\bKavitha\b', caseSensitive: false),
        RegExp(r'\bRaman\b', caseSensitive: false),
        RegExp(r'\bApollo\b', caseSensitive: false),
        RegExp(r'\bMedPlus\b', caseSensitive: false),
        RegExp(r'TN-\d\d', caseSensitive: false),
        RegExp(r'\bexample\.com\b', caseSensitive: false),
        RegExp(r'\bFuture\.delayed\b', caseSensitive: false),
        RegExp(r'TODO:\s*replace', caseSensitive: false),
        RegExp(r'\b(mock|dummy)\b', caseSensitive: false),
        RegExp(r'\b(Rajesh\s+Kumar|Kilpauk|Poonamallee|Rajiv\s+Gandhi)\b', caseSensitive: false),
        RegExp(r'13\.0827|80\.2707'),
        RegExp(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'),
        RegExp(r'\b(defaultDestinationFacilityId|defaultMedicineId|defaultSourceFacilityId|defaultFieldUserId)\b'),
      ];

      final violations = <String>[];

      for (final entity in libDir.listSync(recursive: true)) {
        if (entity is File && entity.path.endsWith('.dart')) {
          final content = entity.readAsStringSync();
          for (final pattern in forbiddenPatterns) {
            if (pattern.hasMatch(content)) {
              violations.add('${entity.path} matches pattern "${pattern.pattern}"');
            }
          }
        }
      }

      expect(violations, isEmpty, reason: 'Found demo/India strings in mobile/lib:\n${violations.join("\n")}');
    });

    test('2. Facility list from API with mocked HTTP and parsing', () async {
      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/api/facilities')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                {
                  'id': 'a0000000-0000-0000-0000-000000000001',
                  'code': 'NH-COL',
                  'name': 'National Hospital of Sri Lanka',
                  'address': 'Regent Street, Colombo 10',
                  'city': 'Colombo',
                  'latitude': 6.9175,
                  'longitude': 79.8653,
                  'isActive': true,
                },
                {
                  'id': 'a0000000-0000-0000-0000-000000000002',
                  'code': 'TH-GAL',
                  'name': 'Teaching Hospital Karapitiya Galle',
                  'address': 'Karapitiya, Galle',
                  'city': 'Galle',
                  'latitude': 6.0535,
                  'longitude': 80.2210,
                  'isActive': true,
                },
              ]
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"success": false}', 404);
      });

      final response = await mockClient.get(Uri.parse('http://localhost:5050/api/facilities'));
      expect(response.statusCode, equals(200));

      final decoded = jsonDecode(response.body);
      final facilities = (decoded['data'] as List).map((j) => FacilityModel.fromJson(j)).toList();

      expect(facilities.length, equals(2));
      expect(facilities[0].name, equals('National Hospital of Sri Lanka'));
      expect(facilities[0].city, equals('Colombo'));
      expect(facilities[0].latitude, equals(6.9175));
      expect(facilities[0].hasValidCoordinates, isTrue);

      expect(facilities[1].name, equals('Teaching Hospital Karapitiya Galle'));
      expect(facilities[1].city, equals('Galle'));
      expect(facilities[1].latitude, equals(6.0535));
      expect(facilities[1].hasValidCoordinates, isTrue);
    });

    testWidgets('3. TransferLiveMapWidget renders Location unavailable when coordinates are (0, 0)', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TransferLiveMapWidget(
              sourceCoords: LatLng(0, 0),
              sourceFacilityName: 'Unknown Origin',
              destinationCoords: LatLng(0, 0),
              destinationFacilityName: 'Unknown Destination',
              status: 'Draft',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Location unavailable'), findsOneWidget);
      expect(find.text('Facility coordinates or transit route data are not available.'), findsOneWidget);
      expect(find.byIcon(Icons.location_off_rounded), findsOneWidget);
    });

    testWidgets('4. TransferLiveMapWidget camera bounds from route and Sri Lanka center constants', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(800, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      const source = LatLng(6.9175, 79.8653); // Colombo
      const dest = LatLng(6.0535, 80.2210); // Galle

      final waypoints = <RouteWaypoint>[
        RouteWaypoint(latitude: 6.8000, longitude: 79.9000, label: 'Expressway Interchange'),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TransferLiveMapWidget(
              sourceCoords: source,
              sourceFacilityName: 'National Hospital Colombo',
              destinationCoords: dest,
              destinationFacilityName: 'Karapitiya Teaching Hospital Galle',
              vehicleCoords: const LatLng(6.5000, 80.0000),
              waypoints: waypoints,
              distanceKm: 117.88,
              durationMinutes: 97.78,
              status: 'InTransit',
            ),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 100));

      // Does not show "Location unavailable"
      expect(find.text('Location unavailable'), findsNothing);

      // Verifies Sri Lanka constants exist and match specification
      expect(AppConstants.sriLankaCenterLatitude, equals(7.8731));
      expect(AppConstants.sriLankaCenterLongitude, equals(80.7718));
      expect(AppConstants.sriLankaDefaultZoom, equals(7.0));
    });
  });
}
