class RoomDeepLink {
  const RoomDeepLink({required this.code});

  final String code;

  static RoomDeepLink? parse(String value) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null || uri.pathSegments.length < 2) return null;
    final index = uri.pathSegments.indexWhere(
      (segment) => segment.toLowerCase() == 'join',
    );
    if (index < 0 || index + 1 >= uri.pathSegments.length) return null;
    final code = uri.pathSegments[index + 1].trim().toUpperCase();
    return RegExp(r'^[A-Z0-9]{6}$').hasMatch(code)
        ? RoomDeepLink(code: code)
        : null;
  }
}
