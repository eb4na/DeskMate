"""Check captured Play decks for missing screens and silent wrong-screen shots.

The capture run drives a real device, so a tap that lands early or a screen that
is slow to open yields a *plausible* screenshot of the wrong screen rather than
an error — that is how a Chinese deck ended up with the Home screen saved as the
session picker, which only showed up once the slides were rendered.

    python3 scripts/verify-android-captures.py
    python3 scripts/verify-android-captures.py ~/Desktop/memobun-captures-android

Flags three things per deck:
  * a missing or extra file against the nine the slide renderer consumes;
  * a capture whose pixels are the wrong size for its device;
  * two captures that are near-identical, which means one screen never opened.
"""
import os, sys, glob, itertools
from PIL import Image

EXPECTED = ["B_home", "B_study", "F_edit-room", "F_shop", "M2_progress",
            "M_tasks", "STUDY_BUNNY", "STUDY_MIEL", "wood_check"]

SIZES = {"phone": (1344, 2992), "tab7": (1200, 1920), "tab10": (1600, 2560)}

# Pairs that legitimately look alike are still different screens; anything under
# this mean per-pixel distance on a thumbnail is treated as the same screen.
DUPE_THRESHOLD = 2.0


def fingerprint(path):
    im = Image.open(path).convert("L").resize((32, 64), Image.LANCZOS)
    return list(im.tobytes())


def distance(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def check(folder):
    name = os.path.basename(folder.rstrip("/"))
    device = name.split("-")[0]
    problems = []

    files = {os.path.splitext(os.path.basename(p))[0]: p
             for p in glob.glob(os.path.join(folder, "*.png"))}
    for want in EXPECTED:
        if want not in files:
            problems.append(f"missing {want}.png")
    for extra in sorted(set(files) - set(EXPECTED)):
        problems.append(f"unexpected {extra}.png")

    want_size = SIZES.get(device)
    prints = {}
    for key, path in sorted(files.items()):
        im = Image.open(path)
        if want_size and im.size != want_size:
            problems.append(f"{key} is {im.size[0]}x{im.size[1]}, "
                            f"expected {want_size[0]}x{want_size[1]}")
        prints[key] = fingerprint(path)

    for a, b in itertools.combinations(sorted(prints), 2):
        d = distance(prints[a], prints[b])
        if d < DUPE_THRESHOLD:
            problems.append(f"{a} and {b} are the same screen (distance {d:.2f})")

    return name, problems


def main():
    root = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1
                              else "~/Desktop/memobun-captures-android")
    folders = sorted(d for d in glob.glob(os.path.join(root, "*")) if os.path.isdir(d))
    if not folders:
        sys.exit(f"no capture folders in {root}")

    bad = 0
    for folder in folders:
        name, problems = check(folder)
        if problems:
            bad += 1
            print(f"FAIL {name}")
            for p in problems:
                print(f"       {p}")
        else:
            print(f"ok   {name}")
    print(f"\n{len(folders) - bad}/{len(folders)} decks clean")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
