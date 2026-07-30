"""Drive the booted iPhone simulator to capture the 9 raw App Store screens
for one app language, into ~/Desktop/memobun-captures-phone-<lang>/.

    python3 scripts/capture-appstore-screens.py ja --phase 1
    python3 scripts/capture-appstore-screens.py ja --phase 2
    python3 scripts/capture-appstore-screens.py ja --only progress

Phase 1 grabs the 8 screens that use the default companion (Bun); phase 2
grabs STUDY_MIEL alone, so the companion is switched twice for a whole 7-language
run instead of once per language. Feed the results to make-appstore-slides.py
with --src pointing at the per-language folder.

ORIGIN/SCALE below map app points to the Simulator window and MUST be re-read
whenever the window moves:
    osascript -e 'tell application "System Events" to tell process "Simulator" \
                  to get {position, size} of group 1 of window 1'

Four things this file exists to remember, each of which silently corrupted a
capture run before it was handled here:
  * the Shop remembers its last category, so F_shop must select Chef explicitly
    or it comes out identical to wood_check;
  * the picker's Start button drops ~50pt in es/fr (the subtitle wraps), and a
    blind "End session" tap at y=813 then lands ON it and starts a 90-minute
    session that bleeds into the next language — hence in_session() and
    _find_start_button();
  * the duration checkboxes SUM (30+60=90), and selecting one repaints the
    button, so the button must be located before a row is ticked;
  * the Progress tab keeps its scroll offset between visits, so it is pinned to
    the top before the per-language scroll.
"""
import os, subprocess, sys, time, argparse
import Quartz

ORIGIN = (1264.0, 131.0)
SCALE = 400.0 / 402.0

LANG = "en"

LANG_ROW = {"en": 252, "zh": 313, "zh-Hant": 374, "ja": 435,
            "ko": 496, "es": 557, "fr": 618}

# Total pt to scroll the Progress tab so the account e-mail is off screen and
# the streak card sits at the top. Card heights differ per language, so this is
# tuned per deck rather than shared.
PROGRESS_SCROLL = {"en": 445, "zh": 215, "zh-Hant": 215, "ja": 175,
                   "ko": 215, "es": 250, "fr": 250}


def g(x, y):
    return (ORIGIN[0] + x * SCALE, ORIGIN[1] + y * SCALE)


def _post(kind, pos):
    Quartz.CGEventPost(Quartz.kCGHIDEventTap,
                       Quartz.CGEventCreateMouseEvent(None, kind, pos, 0))


def focus():
    subprocess.run(["osascript", "-e", 'tell application "Simulator" to activate'],
                   capture_output=True)
    time.sleep(0.5)


def tap(x, y, after=2.0):
    _post(Quartz.kCGEventMouseMoved, g(x, y)); time.sleep(0.15)
    _post(Quartz.kCGEventLeftMouseDown, g(x, y)); time.sleep(0.12)
    _post(Quartz.kCGEventLeftMouseUp, g(x, y))
    time.sleep(after)


def drag(x0, y0, x1, y1, steps=30, after=1.2):
    _post(Quartz.kCGEventMouseMoved, g(x0, y0)); time.sleep(0.25)
    _post(Quartz.kCGEventLeftMouseDown, g(x0, y0)); time.sleep(0.35)
    for i in range(1, steps + 1):
        t = i / steps
        _post(Quartz.kCGEventLeftMouseDragged,
              g(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
        time.sleep(0.012)
    time.sleep(0.15)
    _post(Quartz.kCGEventLeftMouseUp, g(x1, y1))
    time.sleep(after)


def deeplink(url, after=3.0):
    subprocess.run(["xcrun", "simctl", "openurl", "booted", url], capture_output=True)
    time.sleep(after)


def shot(path):
    subprocess.run(["xcrun", "simctl", "io", "booted", "screenshot", path],
                   capture_output=True)


def set_language(code):
    deeplink("deskmate:///language-picker", 3.0)
    focus()
    tap(200, LANG_ROW[code], 1.2)   # pick the row
    tap(200, 687, 4.0)              # Continue


TMP = "/tmp/_cap_probe.png"


def in_session():
    """True only in the study room. Detected by the big timer's glyph colour —
    NOT by "isn't the home tab", because the session picker also isn't home and
    in es/fr its Start button sits exactly where End session does."""
    shot(TMP)
    from PIL import Image
    im = Image.open(TMP).convert("RGB"); px = im.load()
    c = 0
    for y in range(560, 900, 2):
        for x in range(160, 1050, 3):
            r, g, b = px[x, y]
            if abs(r - 208) <= 8 and abs(g - 175) <= 8 and abs(b - 149) <= 8:
                c += 1
    return c > 3000


def ensure_out_of_session(tries=3):
    for _ in range(tries):
        if not in_session():
            return True
        focus()
        tap(200, 813, 2.5)      # End session
        tap(200, 477, 4.0)      # Stop (confirm)
    return not in_session()


def _find_start_button():
    """y (pt) of the picker's Start button — it moves when the card's subtitle
    wraps, which it does in es/fr, so never hard-code it."""
    shot(TMP)
    from PIL import Image
    im = Image.open(TMP).convert("RGB"); px = im.load(); W, H = im.size
    rows = []
    for y in range(int(H * 0.60), H):
        c = 0
        for x in range(150, W - 150, 4):
            r, g, b = px[x, y]
            if 210 <= r <= 245 and 125 <= g <= 200 and 135 <= b <= 200:
                c += 1
        if c > 180:
            rows.append(y)
    if not rows:
        return None
    band = [rows[-1]]
    for y in reversed(rows[:-1]):
        if band[-1] - y <= 3:
            band.append(y)
        else:
            break
    return ((min(band) + max(band)) // 2) / 3


def _start_is_armed():
    """The Start button is pale until a duration is ticked, saturated after."""
    shot(TMP)
    from PIL import Image
    im = Image.open(TMP).convert("RGB"); px = im.load(); W, H = im.size
    for y in range(int(H * 0.60), H):
        for x in range(int(W * 0.45), int(W * 0.55), 3):
            r, g, b = px[x, y]
            if 215 <= r <= 240 and 125 <= g <= 155 and 140 <= b <= 172:
                return True
    return False


def start_session():
    """Home -> picker -> 30 min -> in-session, popup dismissed."""
    ensure_out_of_session()
    deeplink("deskmate:///", 3.0)
    focus()
    tap(200, 646, 3.0)                       # Start Session
    # The four duration checkboxes sit at ~293/366/435/506 pt in every language
    # (measured off the checkbox column), so the row is fixed. The Start BUTTON
    # is not — it drops ~50pt in es/fr where the card subtitle wraps.
    # Locate the button BEFORE ticking a row: selecting one repaints the button
    # from pale to saturated pink and the detector loses it.
    sy = _find_start_button() or 770
    tap(200, 366, 1.5)                       # Focus Boost (30 min)
    for dy in (0, 12, -12, 24):
        tap(200, round(sy + dy), 7.0)        # Start
        tap(200, 483, 3.5)                   # "Just focus" on the subject popup
        if in_session():
            return
        focus()


def end_session():
    ensure_out_of_session()


def capture_progress(out):
    focus(); tap(251, 785, 3.0)
    # The Progress tab KEEPS its scroll offset between visits, so a relative
    # drag compounds from an unknown start. Pin it to the top first.
    for _ in range(4):
        drag(200, 300, 200, 760, after=0.5)
    time.sleep(1.0)
    total = PROGRESS_SCROLL.get(LANG, 350)
    first = min(225, total)
    drag(200, 700, 200, 700 - first)
    if total - first > 0:
        drag(200, 700, 200, 700 - (total - first))
    shot(f"{out}/M2_progress.png")


def pass1(out):
    ensure_out_of_session()
    deeplink("deskmate:///", 3.5)
    shot(f"{out}/B_home.png")

    focus(); tap(150, 785, 3.0)
    shot(f"{out}/M_tasks.png")

    capture_progress(out)

    # The Shop remembers the last category, so land it on Chef explicitly —
    # otherwise F_shop and wood_check are the same (desk) screen.
    focus(); tap(351, 785, 3.0)
    tap(46, 209, 2.5)                 # Chef category
    shot(f"{out}/F_shop.png")

    focus(); tap(317, 209, 2.5)       # Desk category
    shot(f"{out}/wood_check.png")

    deeplink("deskmate:///edit-room", 3.5)
    shot(f"{out}/F_edit-room.png")

    deeplink("deskmate:///", 3.0)
    focus(); tap(200, 646, 3.0)
    shot(f"{out}/B_study.png")        # session picker, nothing selected

    sy = _find_start_button() or 770
    tap(200, 366, 1.5)
    for dy in (0, 12, -12, 24):
        tap(200, round(sy + dy), 7.0)
        tap(200, 483, 3.5)
        if in_session():
            break
        focus()
    shot(f"{out}/STUDY_BUNNY.png")
    end_session()


def pass2(out):
    start_session()
    shot(f"{out}/STUDY_MIEL.png")
    end_session()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("lang")
    ap.add_argument("--phase", type=int, default=1)
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    globals()["LANG"] = a.lang
    out = os.path.expanduser(f"~/Desktop/memobun-captures-phone-{a.lang}")
    os.makedirs(out, exist_ok=True)
    set_language(a.lang)
    if a.only == "progress":
        capture_progress(out)
    else:
        (pass1 if a.phase == 1 else pass2)(out)
    print(f"{a.lang} phase {a.phase} -> {out}")
