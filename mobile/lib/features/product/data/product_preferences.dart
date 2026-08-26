import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

final appThemeMode = ValueNotifier<ThemeMode>(ThemeMode.system);
final appReduceMotion = ValueNotifier<bool>(false);

class ProductPreferences {
  static const onboardingKey = 'pocha.product.onboarding.complete';
  static const themeKey = 'pocha.product.theme';
  static const reduceMotionKey = 'pocha.product.reduce_motion';
  static const hapticsKey = 'pocha.product.haptics';
  static const soundKey = 'pocha.product.sound';
  static const musicKey = 'pocha.product.music';
  static const notificationsKey = 'pocha.product.notifications';
  static const usernameKey = 'pocha.product.username';

  static Future<SharedPreferences> instance() =>
      SharedPreferences.getInstance();

  static Future<bool> onboardingComplete() async =>
      (await instance()).getBool(onboardingKey) ?? false;

  static Future<void> setOnboardingComplete() async =>
      (await instance()).setBool(onboardingKey, true);

  static Future<ThemeMode> themeMode() async {
    final value = (await instance()).getString(themeKey);
    return switch (value) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  static Future<void> saveThemeMode(ThemeMode mode) async =>
      (await instance()).setString(themeKey, mode.name);

  static Future<bool> getBool(String key, {bool fallback = false}) async =>
      (await instance()).getBool(key) ?? fallback;

  static Future<void> setBool(String key, bool value) async =>
      (await instance()).setBool(key, value);

  static Future<String?> username() async =>
      (await instance()).getString(usernameKey);

  static Future<void> saveUsername(String value) async =>
      (await instance()).setString(usernameKey, value);

  static Future<void> clearAccountData() async =>
      (await instance()).remove(usernameKey);
}
