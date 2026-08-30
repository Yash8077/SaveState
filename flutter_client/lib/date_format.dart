String formatDmy(String? iso) {
  if (iso == null || iso.length < 10) return '';
  final y = iso.substring(0, 4);
  final m = iso.substring(5, 7);
  final d = iso.substring(8, 10);
  if (y.isEmpty || m.isEmpty || d.isEmpty) return '';
  return '$d-$m-$y';
}

String isoDate(DateTime d) {
  final y = d.year.toString().padLeft(4, '0');
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}
