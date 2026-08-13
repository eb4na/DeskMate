#!/usr/bin/env bash
# One complete 9-screen Play deck for a single device + language.
#
#   scripts/capture-android-deck.sh emulator-5554 phone en
#
# Three passes, because the two study-room shots need different companions and
# rooms and the scene is set by seeding rather than by driving the gallery and
# Edit Room screens (BACK out of a deep-linked screen exits the app, which
# cold-starts it back to the login screen).
#
# Requires Metro (`npx expo start --dev-client`) and the debug APK installed.
set -euo pipefail

SERIAL="${1:?usage: capture-android-deck.sh <serial> <device> <lang>}"
DEVICE="${2:?}"
LANG_CODE="${3:?}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
seed() { python3 "$ROOT/scripts/seed-capture-state.py" --serial "$SERIAL" --lang "$LANG_CODE" "$@"; }
grab() { python3 -u "$ROOT/scripts/capture-android-screens.py" \
           --serial "$SERIAL" --device "$DEVICE" --lang "$LANG_CODE" "$@"; }

# Pass 1 — the default scene: Bun in the Cozy Bakery. Six tab/shop screens plus
# the session picker.
seed --companion "starter:girl" --room "cozy"
grab --mode static

# Passes 2 and 3 — the two halves of the "outfits and rooms" slide. Different
# companion AND room, or the two halves twin and the slide looks like a bug.
seed --companion "shop:companion_bunny" --room "buns-room"
grab --mode session --name STUDY_BUNNY

seed --companion "shop:companion_honey" --room "miels-room"
grab --mode session --name STUDY_MIEL

echo "deck complete: $DEVICE/$LANG_CODE"
