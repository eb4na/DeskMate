#!/usr/bin/env bash
# Provision a freshly booted emulator for capture runs.
#
#   scripts/setup-android-device.sh emulator-5558
#
# Installs the debug APK, pre-grants notifications (the runtime dialog otherwise
# lands mid-run and covers whatever is being captured), and copies a seeded
# guest state across from another device so this one skips the whole onboarding
# flow — legal gate, birthday wheel, starter chooser and tutorial.
#
# The state file is plain JSON and device-independent, so any already-seeded
# emulator works as the source.
set -euo pipefail

TARGET="${1:?usage: setup-android-device.sh <target-serial> [source-serial]}"
SOURCE="${2:-emulator-5554}"

PKG=com.sophialin.memobun
ADB=/opt/homebrew/share/android-commandlinetools/platform-tools/adb
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
STATE=files/deskmate_guest_state.json

echo "installing APK on $TARGET"
"$ADB" -s "$TARGET" install -r "$APK" >/dev/null
"$ADB" -s "$TARGET" shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
"$ADB" -s "$TARGET" shell svc power stayon true || true

echo "launching once so the app's files/ directory exists"
"$ADB" -s "$TARGET" shell 'am start -a android.intent.action.VIEW -d "exp+deskmate://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"' >/dev/null
sleep 40

echo "copying seeded state from $SOURCE"
tmp=$(mktemp)
"$ADB" -s "$SOURCE" shell "run-as $PKG cat $STATE" > "$tmp"
python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$tmp"   # refuse a truncated copy
"$ADB" -s "$TARGET" push "$tmp" /data/local/tmp/seed.json >/dev/null
"$ADB" -s "$TARGET" shell "run-as $PKG cp /data/local/tmp/seed.json $STATE"
rm -f "$tmp"

echo "done. Dismiss the dev-client menu once by hand, then capture:"
echo "  scripts/capture-android-deck.sh $TARGET <device> <lang>"
