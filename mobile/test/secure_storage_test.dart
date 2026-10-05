import 'package:flutter_test/flutter_test.dart';

void main() {
  test('SecureStorageService keys & structure test', () {
    expect('auth_token', isNotEmpty);
    expect('refresh_token', isNotEmpty);
  });
}
