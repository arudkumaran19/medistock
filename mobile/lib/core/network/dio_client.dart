import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import '../storage/secure_storage.dart';
import 'api_exceptions.dart';

class DioClient {
  late final Dio _dio;
  final SecureStorageService _storage = SecureStorageService();

  DioClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(milliseconds: AppConfig.connectTimeoutMs),
        receiveTimeout: const Duration(milliseconds: AppConfig.receiveTimeoutMs),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          if (kDebugMode) {
            debugPrint('🌐 [DIO REQ] ${options.method} -> ${options.uri}');
          }
          return handler.next(options);
        },
        onResponse: (response, handler) {
          if (kDebugMode) {
            debugPrint('✅ [DIO RES] ${response.statusCode} <- ${response.requestOptions.path}');
          }
          return handler.next(response);
        },
        onError: (DioException e, handler) async {
          if (kDebugMode) {
            debugPrint('❌ [DIO ERR] ${e.response?.statusCode} <- ${e.requestOptions.path}: ${e.message}');
          }
          if (e.response?.statusCode == 401) {
            await _storage.clearAll();
          }
          return handler.next(e);
        },
      ),
    );
  }

  Dio get dio => _dio;

  Future<dynamic> get(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParameters);
      return _parseResponse(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<dynamic> post(String path, {dynamic data}) async {
    try {
      final response = await _dio.post(path, data: data);
      return _parseResponse(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<dynamic> put(String path, {dynamic data}) async {
    try {
      final response = await _dio.put(path, data: data);
      return _parseResponse(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<dynamic> delete(String path) async {
    try {
      final response = await _dio.delete(path);
      return _parseResponse(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  dynamic _parseResponse(Response response) {
    final data = response.data;
    if (data is Map<String, dynamic>) {
      if (data.containsKey('data')) {
        return data['data'];
      }
      if (data.containsKey('items')) {
        return data['items'];
      }
    }
    return data;
  }

  ApiException _handleDioError(DioException e) {
    final status = e.response?.statusCode ?? 500;
    String message = 'Network connection error';

    if (e.response?.data != null) {
      final resData = e.response?.data;
      if (resData is Map) {
        message = resData['message']?.toString() ??
            resData['error']?.toString() ??
            resData['title']?.toString() ??
            'An error occurred';
      }
    }

    return ApiException(
      statusCode: status,
      message: message,
      details: e.response?.data,
    );
  }
}
