enum AnalyticsEvent {
  onboardingCompleted('onboarding_completed'),
  calculatorGameStarted('calculator_game_started'),
  calculatorGameFinished('calculator_game_finished'),
  singleGameStarted('single_game_started'),
  singleGameFinished('single_game_finished'),
  casualQueueStarted('casual_queue_started'),
  casualQueueFinished('casual_queue_finished'),
  casualGameFinished('casual_game_finished'),
  rankedQueueStarted('ranked_queue_started'),
  rankedQueueFinished('ranked_queue_finished'),
  securityEvent('security_event');

  const AnalyticsEvent(this.name);

  final String name;
}

abstract interface class AnalyticsClient {
  void track(AnalyticsEvent event, {Map<String, Object?> properties});
}

class NoopAnalyticsClient implements AnalyticsClient {
  const NoopAnalyticsClient();

  @override
  void track(
    AnalyticsEvent event, {
    Map<String, Object?> properties = const {},
  }) {}
}

AnalyticsClient analyticsClient = const NoopAnalyticsClient();
