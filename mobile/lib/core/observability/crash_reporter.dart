abstract interface class CrashReporter {
  Future<void> report(
    Object error,
    StackTrace stack, {
    String? reason,
    Map<String, Object?> context,
  });
}

class NoopCrashReporter implements CrashReporter {
  const NoopCrashReporter();

  @override
  Future<void> report(
    Object error,
    StackTrace stack, {
    String? reason,
    Map<String, Object?> context = const {},
  }) async {}
}

CrashReporter crashReporter = const NoopCrashReporter();
