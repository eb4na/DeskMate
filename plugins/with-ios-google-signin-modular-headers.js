// @react-native-google-signin/google-signin -> GoogleSignIn -> AppCheckCore, a
// Swift pod that cannot be integrated as a static library unless its transitive C
// dependencies (GoogleUtilities, RecaptchaInterop) expose module maps. Without
// this, `pod install` fails: "The following Swift pods cannot yet be integrated as
// static libraries". expo-build-properties has no hook for per-pod modular headers,
// so inject the lines into the generated Podfile ourselves (runs on every prebuild,
// idempotent). Mirrors the manual edit in ios/Podfile so a clean prebuild keeps it.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULAR_HEADER_PODS = [
  "  pod 'GoogleUtilities', :modular_headers => true",
  "  pod 'RecaptchaInterop', :modular_headers => true",
  "  pod 'AppCheckCore', :modular_headers => true",
].join('\n');

module.exports = function withIosGoogleSigninModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      // With Expo modules built from source (usePrecompiledModules: false),
      // RNGoogleSignin's podspec says iOS 15.1 but its Expo adapter imports
      // ExpoModulesCore (16.4) — Swift refuses to compile that. Raise any pod below
      // the app's 16.4 floor to 16.4 after install. Idempotent via the marker.
      const DT_MARKER = '# [memobun] min pod deployment target';
      if (!contents.includes(DT_MARKER)) {
        const rnPostInstall = /(    react_native_post_install\([\s\S]*?\n    \)\n)/;
        if (!rnPostInstall.test(contents)) {
          throw new Error('with-ios-google-signin-modular-headers: could not find react_native_post_install in the Podfile');
        }
        contents = contents.replace(
          rnPostInstall,
          `$1    ${DT_MARKER}\n` +
            `    installer.pods_project.targets.each do |t|\n` +
            `      t.build_configurations.each do |c|\n` +
            `        dt = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']\n` +
            `        c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4' if dt && Gem::Version.new(dt) < Gem::Version.new('16.4')\n` +
            `      end\n` +
            `    end\n`,
        );
        fs.writeFileSync(podfilePath, contents);
      }
      if (contents.includes("pod 'GoogleUtilities', :modular_headers => true")) {
        return config; // already injected
      }
      const anchor = '  use_expo_modules!\n';
      if (!contents.includes(anchor)) {
        throw new Error(
          'with-ios-google-signin-modular-headers: could not find `use_expo_modules!` in the Podfile',
        );
      }
      fs.writeFileSync(
        podfilePath,
        contents.replace(anchor, `${anchor}\n${MODULAR_HEADER_PODS}\n`),
      );
      return config;
    },
  ]);
};
