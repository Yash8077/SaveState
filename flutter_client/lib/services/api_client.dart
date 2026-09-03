  Future<Map<String, dynamic>> getActivity({
    bool force = false,
    String? month,
  }) async {
    final query = StringBuffer('/api/activity?limit=200');
    if (month != null && month.isNotEmpty) {
      query.write('&month=${Uri.encodeQueryComponent(month)}');
    }
    final decoded = await _send('GET', _u(query.toString()));
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    throw ApiException(500, 'Invalid activity response');
  }
