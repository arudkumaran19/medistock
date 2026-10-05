/// Shared presentation contracts for paged API payloads.
///
/// SHARED FLUTTER DESIGN SYSTEM - primary owner: Sathurstiga S. (IT24103156).
/// Mirrors the frozen API convention: ?page=1&pageSize=20.
library;

/// One page of results returned by a list endpoint.
class PagedResponse<T> {
  const PagedResponse({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.totalCount,
    required this.totalPages,
    required this.hasNextPage,
    required this.hasPreviousPage,
  });

  final List<T> items;
  final int page;
  final int pageSize;
  final int totalCount;
  final int totalPages;
  final bool hasNextPage;
  final bool hasPreviousPage;

  factory PagedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) {
    final List<dynamic> rawItems = (json['items'] as List<dynamic>?) ?? <dynamic>[];

    return PagedResponse<T>(
      items: rawItems
          .map((dynamic item) => fromItem(item as Map<String, dynamic>))
          .toList(growable: false),
      page: json['page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? 20,
      totalCount: json['totalCount'] as int? ?? 0,
      totalPages: json['totalPages'] as int? ?? 0,
      hasNextPage: json['hasNextPage'] as bool? ?? false,
      hasPreviousPage: json['hasPreviousPage'] as bool? ?? false,
    );
  }

  bool get isEmpty => items.isEmpty;
}

/// Failure carrying the agreed API error contract.
///
/// Shape owned by Arudkumaran V. (IT24103011):
/// { success: false, error: { code, message, traceId } }
class ApiFailure implements Exception {
  const ApiFailure({required this.code, required this.message, this.traceId});

  final String code;
  final String message;
  final String? traceId;

  factory ApiFailure.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? error = json['error'] as Map<String, dynamic>?;

    return ApiFailure(
      code: error?['code'] as String? ?? 'UNKNOWN_ERROR',
      message: error?['message'] as String? ?? 'An unexpected error occurred.',
      traceId: error?['traceId'] as String?,
    );
  }

  @override
  String toString() => message;
}
