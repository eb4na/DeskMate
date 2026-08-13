"""Drive a booted Android emulator to capture the 9 raw Play-listing screens.

The iOS twin of this file (capture-appstore-screens.py) clicks fixed points in
the macOS Simulator window, so every device and language needs its own hand-read
coordinate table. This one asks the device instead: `uiautomator dump` returns
every on-screen label with exact bounds, and the label text is resolved from the
app's own `src/i18n/<lang>.json`. One code path therefore covers the phone, both
tablets, and all seven languages.

    python3 scripts/capture-android-screens.py --serial emulator-5554 --lang en

Prerequisites: Metro running (`npx expo start --dev-client`), the debug APK
installed, and the account seeded — `scripts/seed-capture-state.py` sets the
streak, tasks, exams, session history AND the language this script then reads.

Four app behaviours that broke the iOS capture runs and bite here identically —
all four are handled below, do not "simplify" them away:
  * the Shop remembers its last category, so the Desk shot must select Desk
    explicitly or it comes out identical to the Chef shot;
  * the duration checkboxes SUM (30 + 60 = 90), so exactly one may be ticked;
  * every tick or subject tap REPAINTS the picker and moves the Start button, so
    it must be re-located immediately before the tap, never cached;
  * Progress keeps its scroll offset between visits, so it is pinned to the top
    before scrolling down.
"""
import argparse, json, os, re, subprocess, sys, time

PKG = "com.sophialin.memobun"
DEV_URL = ("exp+deskmate://expo-development-client/"
           "?url=http%3A%2F%2F10.0.2.2%3A8081")
ADB = os.environ.get("ADB", "/opt/homebrew/share/android-commandlinetools/platform-tools/adb")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Popups that can land on Home between captures (daily reward, birthday coins,
# Plus room ticket, companion-obtained). Matched loosely and dismissed on sight.
DISMISS_RE = re.compile(r"^(claim|sweet!|close)\b", re.I)


# Screen-fraction coordinates for the two screens uiautomator cannot read (see
# Driver.ui). Measured from a screenshot per device class — re-measure when a
# new AVD is added rather than assuming the phone numbers scale.
POINTS = {
    "phone": {                       # Pixel 8 Pro, 1344x2992
        "tab_y": 2694 / 2992,
        "tab_x": [168 / 1344, 501 / 1344, 837 / 1344, 1173 / 1344],
        "start_session": (0.5, 2271 / 2992),
        "end_session": (0.5, 2832 / 2992),
        "picker_start": (0.5, 2343 / 2992),
    },
    "tab7": {                        # Nexus 7 2013, 1200x1920 @ 320dpi
        # Note tab_y differs from the phone: the bar is a fixed height in dp, so
        # its share of the screen changes with density. Measured, not scaled.
        "tab_y": 1700 / 1920,
        "tab_x": [150 / 1200, 447 / 1200, 747 / 1200, 1047 / 1200],
        "start_session": (0.5, 1320 / 1920),
        "end_session": (0.5, 1716 / 1920),
        "picker_start": (0.5, 1736 / 1920),
    },
}


class Driver:
    def __init__(self, serial, lang, out, device):
        self.serial, self.lang, self.out = serial, lang, out
        if device not in POINTS:
            sys.exit(f"error: no POINTS profile for {device!r} — measure one "
                     f"from a screenshot before capturing on it")
        self.points = POINTS[device]
        self._size = None
        with open(os.path.join(ROOT, "src", "i18n", f"{lang}.json")) as fh:
            self.strings = json.load(fh)
        os.makedirs(out, exist_ok=True)

    # ── plumbing ──────────────────────────────────────────────────────────
    def sh(self, *args, **kw):
        pre = ["-s", self.serial] if self.serial else []
        return subprocess.run([ADB, *pre, *args], capture_output=True, **kw)

    def shell(self, cmd):
        r = self.sh("shell", cmd, text=True)
        # uiautomator reports "could not get idle state" on stderr, so a
        # stdout-only read would treat a failed dump as a success.
        return (r.stdout or "") + (r.stderr or "")

    def t(self, key):
        node = self.strings
        for part in key.split("."):
            node = node[part]
        return node

    def ui(self, tries=3):
        """[(text, (cx, cy))] for everything currently on screen.

        `uiautomator dump` needs the accessibility event queue to go idle, and
        Home and the study room never do — the companion animates forever. Those
        two screens are driven by POINTS below instead; here a failed dump just
        yields nothing so callers can fall back rather than read a stale file.
        """
        # Delete first: a failed dump leaves the PREVIOUS screen's file in place,
        # and reading that silently drives the run off the rails.
        self.shell("rm -f /sdcard/ui.xml")
        for _ in range(tries):
            res = self.shell("uiautomator dump /sdcard/ui.xml")
            if "dumped to" in res:
                break
            time.sleep(1.5)
        else:
            return []
        xml = self.shell("cat /sdcard/ui.xml")
        if "hierarchy" not in xml:
            return []
        out = []
        for m in re.finditer(r'text="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
            text = m.group(1)
            l, tp, r, b = map(int, m.groups()[1:])
            out.append((text, ((l + r) // 2, (tp + b) // 2)))
        return out

    def find(self, text, *, contains=False, last=False, nodes=None):
        hits = [(s, p) for s, p in (nodes if nodes is not None else self.ui())
                if (text.lower() in s.lower() if contains else s == text)]
        if not hits:
            return None
        hits.sort(key=lambda h: h[1][1])
        return (hits[-1] if last else hits[0])[1]

    def wait(self, text, *, contains=False, timeout=30, poll=1.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            pos = self.find(text, contains=contains)
            if pos:
                return pos
            time.sleep(poll)
        return None

    def wait_gone(self, text, *, timeout=60, poll=1.5):
        """Block until `text` is off screen. Returns False on timeout.

        Used instead of a flat sleep after the guest tap: the app takes anywhere
        from a few seconds to half a minute to load, and waiting for the login
        screen to disappear costs exactly as long as it actually takes.
        """
        deadline = time.time() + timeout
        while time.time() < deadline:
            if not self.find(text):
                return True
            time.sleep(poll)
        return False

    def tap(self, pos, after=2.5):
        self.shell(f"input tap {pos[0]} {pos[1]}")
        time.sleep(after)

    def tap_text(self, text, *, contains=False, last=False, after=2.5, required=True):
        pos = self.find(text, contains=contains, last=last)
        if not pos:
            if required:
                sys.exit(f"error: could not find {text!r} on screen")
            return False
        self.tap(pos, after)
        return True

    def shot(self, name):
        raw = self.sh("exec-out", "screencap", "-p").stdout
        path = os.path.join(self.out, f"{name}.png")
        with open(path, "wb") as fh:
            fh.write(raw)
        print(f"  {name}.png", flush=True)

    def deeplink(self, url, verify_key, tries=3, settle=3.5):
        """Open a deep link and confirm the router actually navigated.

        `am start` reports success as soon as the intent is delivered to the
        running app ("delivered to currently running top-most instance"), which
        says nothing about whether the route changed — on a slow device it often
        does not, leaving the previous screen to be captured under the new name.
        """
        for _ in range(tries):
            # Check before firing again: a re-sent intent restarts the entrance
            # animation, which blocks uiautomator and makes the next check fail
            # too — the retry defeats itself.
            if self.wait(self.t(verify_key), timeout=2):
                return True
            self.shell(f'am start -a android.intent.action.VIEW -d "{url}"')
            time.sleep(settle)
            if self.wait(self.t(verify_key), timeout=18):
                return True
        sys.exit(f"error: {url} never opened ({verify_key} never appeared)")

    def collapse_shade(self):
        """Close the notification shade if a stray swipe opened it."""
        self.shell("cmd statusbar collapse")
        time.sleep(1.0)

    def back(self, after=3.0):
        self.shell("input keyevent KEYCODE_BACK")
        time.sleep(after)

    def swipe(self, x, y0, y1, ms=400):
        self.shell(f"input swipe {x} {y0} {x} {y1} {ms}")
        time.sleep(0.5)

    def size(self):
        if self._size is None:
            m = re.search(r"(\d+)x(\d+)", self.shell("wm size"))
            self._size = (int(m.group(1)), int(m.group(2)))
        return self._size

    # ── app state ─────────────────────────────────────────────────────────
    def dismiss_popups(self, rounds=4):
        """Clear reward/celebration popups that queue up on Home."""
        for _ in range(rounds):
            nodes = self.ui()
            hit = next((p for s, p in nodes if DISMISS_RE.match(s.strip())), None)
            if not hit:
                return
            self.tap(hit, after=3.0)

    def enter_app(self):
        """Launch, and take guest mode through the login screen if it shows.

        A cold start always lands on login even with guestMode persisted, so this
        is the normal path rather than an error case. It is also retried and
        verified: a tap that lands while the screen is still animating in does
        nothing, and an unverified failure here silently captures nine
        screenshots of the login screen.
        """
        self.collapse_shade()
        self.shell(f'am start -a android.intent.action.VIEW -d "{DEV_URL}"')
        guest = self.t("auth.continueAsGuest")
        for attempt in range(3):
            # Poll for the login screen rather than sleeping a flat 30s for the
            # bundle to load: on a warm Metro this returns in a few seconds.
            if not self.wait(guest, timeout=75 if attempt == 0 else 12):
                self.dismiss_popups()
                return                              # inside the app
            self.tap_text(guest, last=True, after=2.5)
            # The confirm sheet repeats the same label; the warning title above
            # it tells the two apart, and the button sits below that title.
            title = self.find(self.t("auth.guestWarnTitle"))
            if not title:
                continue                            # sheet never opened; tap again
            hits = sorted([p for s, p in self.ui() if s == guest],
                          key=lambda p: p[1])
            pick = next((p for p in hits if p[1] > title[1]), None)
            if pick:
                self.tap(pick, after=1.0)
                # Done as soon as the login screen is gone, instead of a flat
                # 30s wait for the slowest possible load.
                if self.wait_gone(guest, timeout=75):
                    # Home is still mounting when the login screen goes; on the
                    # tablets a shorter settle made the first Start Session tap
                    # miss and the picker never open.
                    time.sleep(9)
                    self.dismiss_popups()
                    return
        sys.exit("error: could not get past the login screen after 3 tries")

    def pt(self, name):
        """A POINTS fraction resolved to this device's pixels."""
        w, h = self.size()
        fx, fy = self.points[name]
        return (round(w * fx), round(h * fy))

    def tab(self, index, after=4.0):
        """Bottom-bar tab by position (0=Home … 3=Shop).

        By coordinate, not by label: Home never goes idle so uiautomator cannot
        read it, and the tab label is duplicated by the screen heading anyway.
        """
        w, h = self.size()
        self.tap((round(w * self.points["tab_x"][index]),
                  round(h * self.points["tab_y"])), after)

    # ── screens ───────────────────────────────────────────────────────────
    def capture_static(self):
        self.tab(0)
        self.dismiss_popups(rounds=2)
        self.shot("B_home")

        self.tab(1)
        self.shot("M_tasks")

        self.tab(2)
        w, h = self.size()
        # Pin to top — the tab keeps its scroll offset between visits. Kept well
        # clear of the top edge: a downward swipe that starts too high pulls the
        # notification shade down instead, and every later tap hits that.
        for _ in range(4):
            self.swipe(w // 2, int(h * 0.50), int(h * 0.86))
        self.collapse_shade()
        time.sleep(1.0)
        self.shot("M2_progress")

        # Retry the tab tap: on a loaded machine the first one can land before
        # the screen is interactive, and the category names are the only proof
        # the Shop actually opened.
        for _ in range(3):
            self.tab(3, after=1.5)
            if self.wait(self.t("shop.cat_companion"), timeout=15):
                break
        else:
            sys.exit("error: the Shop tab never opened")
        # Explicitly select Chef: the Shop remembers its last category, so
        # without this the Chef and Desk shots can come out identical.
        self.tap_text(self.t("shop.cat_companion"), after=3.5)
        self.shot("F_shop")
        self.tap_text(self.t("shop.cat_desk"), after=3.5)
        self.shot("wood_check")

        self.deeplink("deskmate://edit-room", "editRoom.editRoom")
        self.shot("F_edit-room")
        # Edit Room covers the tab bar; leaving it mounted makes every later
        # "tab" tap land on a room card instead.
        self.back()

    def _unused_set_room(self, name_key):
        self.shell('am start -a android.intent.action.VIEW -d "deskmate://edit-room"')
        time.sleep(6)
        w, h = self.size()
        target = self.t(name_key)
        for _ in range(8):
            if self.find(target):
                break
            self.swipe(60, int(h * 0.8), int(h * 0.45))
        self.tap_text(target, after=3.0)
        self.back()

    def _unused_set_companion(self, display_name):
        self.shell('am start -a android.intent.action.VIEW -d "deskmate://companion-gallery"')
        time.sleep(6)
        w, h = self.size()
        name = None
        for _ in range(8):
            name = self.find(display_name)
            if name:
                break
            self.swipe(60, int(h * 0.8), int(h * 0.45))
        if not name:
            sys.exit(f"error: companion {display_name!r} not in the gallery")
        # "Set Active" repeats per card; take the one directly under this name.
        label = self.t("gallery.setActive")
        below = [p for s, p in self.ui() if s == label and p[1] > name[1]]
        if below:
            self.tap(min(below, key=lambda p: p[1]), after=3.5)
        self.back()                                 # gallery also covers the tabs

    def open_picker(self):
        """Tap Start Session and confirm the picker actually opened.

        Start Session is a coordinate (Home never goes idle, so it cannot be
        read), and a tap that lands early does nothing — which silently yields a
        second copy of the Home screen instead of the picker.
        """
        for _ in range(4):
            self.tab(0)
            self.dismiss_popups(rounds=2)
            self.tap(self.pt("start_session"), after=2.5)
            # A duration preset name appears only on the picker.
            if self.wait(self.t("sessionPicker.len_30"), timeout=15):
                return
        sys.exit("error: the session picker never opened")

    def capture_picker(self):
        """The session picker, with nothing selected."""
        self.open_picker()
        self.shot("B_study")
        # Safe to back out: the picker was pushed by an in-app tap, unlike the
        # deep-linked screens where BACK leaves the app altogether.
        self.back()

    def run_session(self, shot_name):
        """Start a real session and shoot the study room, then stop it.

        The companion and room come from the seeded state, not from driving the
        gallery and Edit Room — see seed-capture-state.py --companion/--room.
        """
        self.open_picker()

        # Exactly one duration: they SUM, so a second tick makes it 90 minutes.
        # By preset name, not "30 min" — that string is localised ("30分").
        self.tap_text(self.t("sessionPicker.len_30"), after=2.5, required=False)
        # Re-find the Start button AFTER the tick — the tick repaints the sheet
        # and moves it. The arrow glyph is what separates the button from the
        # identically-worded screen heading. On the tablets the button starts
        # below the fold, so scroll until it appears.
        w, h = self.size()
        arrow = []
        for _ in range(4):
            arrow = [p for s, p in self.ui() if "→" in s]
            if arrow:
                break
            self.swipe(w // 2, int(h * 0.78), int(h * 0.42))
        self.tap(arrow[-1] if arrow else self.pt("picker_start"), after=11.0)

        # The room opens behind a "What are you studying?" overlay. Pick a
        # subject so the study room shows one; the subject names are seeded
        # account data, so they read the same in every language.
        if not self.tap_text("Biology", after=4.0, required=False):
            self.tap_text(self.t("studyRoom.justFocus"), after=4.0, required=False)
        time.sleep(3)

        self.shot(shot_name)
        self.stop_session()

    def stop_session(self):
        # The study room animates, so End session is a coordinate; the confirm
        # dialog that follows is static and readable.
        self.tap(self.pt("end_session"), after=3.5)
        self.tap_text(self.t("home.stopSession"), after=9.0, required=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--serial", required=True, help="adb serial, e.g. emulator-5554")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--out", default=None, help="output folder")
    ap.add_argument("--device", default="phone", help="label for the output folder")
    ap.add_argument("--mode", default="static", choices=["static", "session"],
                    help="static = the six tab/shop screens plus the picker; "
                         "session = one study-room shot for the seeded scene")
    ap.add_argument("--name", default="STUDY_BUNNY",
                    help="output name for --mode session")
    args = ap.parse_args()

    # One language per run. Switching in-app was tried and removed: the Settings
    # and language-picker screens never go idle (so uiautomator cannot read
    # them), and deep-linking the picker over Settings crashes
    # react-native-screens outright. The language is seeded instead.
    out = args.out or os.path.expanduser(
        f"~/Desktop/memobun-captures-android/{args.device}-{args.lang}")
    d = Driver(args.serial, args.lang, out, args.device)

    print(f"[{args.device}/{args.lang}/{args.mode}] -> {out}", flush=True)
    d.enter_app()
    if args.mode == "static":
        d.capture_static()
        d.capture_picker()
    else:
        d.run_session(args.name)
    print(f"  done: {len(os.listdir(out))} files", flush=True)


if __name__ == "__main__":
    main()
