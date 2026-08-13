"""Seed the Android emulator's guest account with the data a store screenshot needs.

`devMaxOutAccount` (Settings → "Max out account", __DEV__ only) grants the shop
catalog, recipes, badges, coins, bond and Plus — but not the things that make the
Home / Tasks / Progress screens look like a real user's: a streak longer than a
day, upcoming tasks and exams, and a session history for the weekly report.

Those live in the persisted state file rather than behind any UI, so this edits
it directly:

    adb shell run-as <pkg> cat files/deskmate_guest_state.json   ->  patch  ->  push back

The app holds the same object in memory and rewrites the file on its next save,
so it MUST be force-stopped before patching and relaunched after — which this
script does.

    python3 scripts/seed-capture-state.py

Guest state only. A signed-in account persists to `deskmate_user_state_<id>.json`
and also syncs to Supabase, where a hand-edited streak would be pushed to the
real backend — don't point this at one.
"""
import json, os, subprocess, sys, datetime, argparse

PKG = "com.sophialin.memobun"
REMOTE = "files/deskmate_guest_state.json"
TMP = "/data/local/tmp/memobun_seed.json"
ADB = os.environ.get("ADB", "/opt/homebrew/share/android-commandlinetools/platform-tools/adb")

LANGS = ["en", "zh", "zh-Hant", "ja", "ko", "es", "fr"]

TODAY = datetime.date.today()

# Set by main(); every adb call is pinned to one device so a phone run can't
# reach into a booted tablet.
SERIAL = None


def sh(*args, **kw):
    pre = ["-s", SERIAL] if SERIAL else []
    return subprocess.run([ADB, *pre, *args], capture_output=True, text=True, **kw)


def iso(days):
    return (TODAY + datetime.timedelta(days=days)).isoformat()


def task(tid, title, subject_id, due_days, priority, status="not_started", minutes=None):
    return {
        "id": tid, "title": title, "subjectId": subject_id,
        "dueDate": iso(due_days), "isDeadline": True, "dueTime": None,
        "estimatedMinutes": minutes, "priority": priority, "status": status,
        "createdAt": f"{iso(-3)}T09:00:00.000Z",
        "completedAt": f"{iso(-1)}T18:20:00.000Z" if status == "done" else None,
        "postponeCount": 0, "lastActivityAt": None,
        "notifyAt": None, "notifId": None,
    }


TASKS = [
    task("t1", "Read chapter 4", "2", 0, "high", minutes=45),
    task("t2", "Physics quiz revision", "1", 1, "high", minutes=60),
    task("t3", "Math problem set", "1", 2, "medium", minutes=30),
    task("t4", "History essay draft", "3", 4, "medium", minutes=90),
    task("t5", "Flashcards: unit 3", "2", 6, "low", minutes=20),
    task("t6", "Lab report", "2", -1, "medium", status="done", minutes=50),
]

EXAMS = [
    {"id": "e1", "name": "Midterm", "subject": "Math", "dateISO": iso(12),
     "time": "09:00", "reminderEnabled": True, "shape": "heart"},
    {"id": "e2", "name": "Biology final", "subject": "Biology", "dateISO": iso(25),
     "time": "14:00", "reminderEnabled": False, "shape": "tear"},
]

# 10 days of study, newest first — drives the streak, the weekly report and the
# subject breakdown. Minutes vary so the charts aren't a flat bar.
PATTERN = [
    (0, [("Biology", 50), ("Math", 25)]),
    (-1, [("Math", 60)]),
    (-2, [("History", 45), ("Biology", 30)]),
    (-3, [("Math", 40)]),
    (-4, [("Biology", 55)]),
    (-5, [("History", 35), ("Math", 30)]),
    (-6, [("Math", 50)]),
    (-7, [("Biology", 45)]),
    (-8, [("History", 60)]),
    (-9, [("Math", 35)]),
]


def build_history():
    history, by_subject, total = [], {}, 0
    for day, blocks in PATTERN:
        for name, minutes in blocks:
            history.append({"dateISO": iso(day), "minutes": minutes, "subjectName": name})
            by_subject[name] = by_subject.get(name, 0) + minutes
            total += minutes
    return history, by_subject, total


def main():
    global SERIAL
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="en", choices=LANGS,
                    help="app language to seed (the in-app picker is bypassed)")
    ap.add_argument("--serial", default=None,
                    help="adb serial, e.g. emulator-5554 (required with >1 device)")
    # Setting the scene here rather than driving the gallery / Edit Room screens:
    # both are opened by deep link, and BACK out of a deep-linked screen leaves
    # the app entirely, which cold-starts it back to the login screen.
    ap.add_argument("--companion", default="starter:girl",
                    help="activeCompanionId, e.g. shop:companion_bunny")
    ap.add_argument("--room", default="cozy",
                    help="ROOM_PAIRS id, e.g. buns-room")
    args = ap.parse_args()
    SERIAL = args.serial

    got = sh("shell", f"run-as {PKG} cat {REMOTE}")
    if got.returncode != 0 or not got.stdout.strip():
        sys.exit(f"could not read state: {got.stderr.strip() or 'empty'}")
    state = json.loads(got.stdout)

    # Stop first: the running app would rewrite the file from memory on its next
    # save and silently undo everything below.
    sh("shell", f"am force-stop {PKG}")

    # Pre-grant notifications, or Android's runtime permission dialog appears
    # mid-run and covers whatever screen is being captured.
    sh("shell", f"pm grant {PKG} android.permission.POST_NOTIFICATIONS")

    history, by_subject, total = build_history()
    days = len({h["dateISO"] for h in history})

    state["streak"] = {"currentStreak": days, "longestStreak": max(days, 14),
                       "lastStudyDate": iso(0)}
    state["tasks"] = TASKS
    state["examCountdowns"] = EXAMS
    state["sessionHistory"] = history
    state["subjectTimeMap"] = by_subject
    state["totalMinutes"] = total
    state["sessionsCompleted"] = len(history)
    state["lifetimeTasksCompleted"] = sum(1 for t in TASKS if t["status"] == "done")
    # Seeding the language skips the login-screen picker entirely. languageSelected
    # must be set too, or the app re-asks and overwrites this on first launch.
    state["language"] = args.lang
    state["languageSelected"] = True
    # Pin the scene. Without this every run inherits whatever room the emulator
    # was last left in, so Home differs between languages and devices.
    state["equippedBackgroundRoomId"] = args.room
    state["equippedDeskRoomId"] = args.room
    state["activeCompanionId"] = args.companion

    local = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".seed-state.json")
    with open(local, "w") as fh:
        json.dump(state, fh)

    if sh("push", local, TMP).returncode != 0:
        sys.exit("adb push failed")
    cp = sh("shell", f"run-as {PKG} cp {TMP} {REMOTE}")
    if cp.returncode != 0:
        sys.exit(f"copy into app sandbox failed: {cp.stderr.strip()}")
    sh("shell", f"rm {TMP}")
    os.remove(local)

    # MainActivity alone lands on the dev-client launcher; this URL opens the app
    # itself. 10.0.2.2 is the emulator's alias for the host, so it works on any AVD.
    sh("shell", 'am start -a android.intent.action.VIEW '
                '-d "exp+deskmate://expo-development-client/'
                '?url=http%3A%2F%2F10.0.2.2%3A8081"')
    print(f"seeded [{args.lang}]: streak {days}d, {len(TASKS)} tasks, {len(EXAMS)} exams, "
          f"{len(history)} sessions, {total} min across {len(by_subject)} subjects")


if __name__ == "__main__":
    main()
