// Pins the Kotlin Gradle plugin on the root Android buildscript classpath.
// React Native 0.82 pins Kotlin 2.1.20, which cannot read Google's
// play-services-ads 25.4.0 (Kotlin 2.3 metadata) pulled in by
// react-native-google-mobile-ads. Keep in sync with the
// expo-build-properties android.kotlinVersion value in app.json.
const { withProjectBuildGradle } = require('expo/config-plugins');

const KOTLIN_VERSION = '2.2.20';

module.exports = function withAndroidKotlinPin(config) {
  return withProjectBuildGradle(config, (config) => {
    const unpinned = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')";
    const pinned = `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}')`;
    if (config.modResults.contents.includes(unpinned)) {
      config.modResults.contents = config.modResults.contents.replace(unpinned, pinned);
    } else if (!config.modResults.contents.includes(pinned)) {
      throw new Error(
        'with-android-kotlin-pin: could not find the kotlin-gradle-plugin classpath line in android/build.gradle'
      );
    }
    return config;
  });
};
