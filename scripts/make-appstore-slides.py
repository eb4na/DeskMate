"""Bold, game-style App Store screenshots — iPhone 6.9 / 6.5 + iPad 13".

Reference look: saturated colour blocks, chunky headline with a script accent,
tilted device mockups, code-drawn decorations. No emoji anywhere (repo rule) —
every ornament is drawn with polygons/arcs.

Raw captures live in SRC (default ~/Desktop/memobun-captures) and MUST be taken
on the matching device: phone frames from an iPhone sim, tablet frames from a
13" iPad Pro sim (native portrait 2064x2752). A phone capture stretched into an
iPad slide shows the phone layout and is exactly the bug this file once shipped.

Usage:
    python3 scripts/make-appstore-slides.py --sets tablet
    python3 scripts/make-appstore-slides.py --sets phone tablet --src ~/Desktop/caps
"""
import os, math, colorsys, re, argparse, sys, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = os.path.expanduser("~/Desktop/memobun-captures")
OUT = os.path.expanduser("~/Desktop/memobun-appstore-bold")

RND = "/System/Library/Fonts/SFNSRounded.ttf"
SCRIPT = "/System/Library/Fonts/Supplemental/SignPainter.ttc"

# SF Rounded carries no CJK glyphs -- Chinese/Japanese/Korean render as tofu
# boxes. Each CJK language gets a system face that actually covers its script.
# (path, ttc_index_by_weight) -- heavier index first, fall back to lighter.
CJK_FONTS = {
    "zh":      ("/System/Library/Fonts/Hiragino Sans GB.ttc", {"Heavy": 2, "Bold": 2, "Medium": 0}),
    "zh-Hant": ("/System/Library/Fonts/Hiragino Sans GB.ttc", {"Heavy": 2, "Bold": 2, "Medium": 0}),
    "ja":      ("/System/Library/Fonts/Hiragino Sans GB.ttc", {"Heavy": 2, "Bold": 2, "Medium": 0}),
    "ko":      ("/System/Library/Fonts/AppleSDGothicNeo.ttc", {"Heavy": 6, "Bold": 6, "Medium": 2}),
}

# Set by main() before rendering; picks the face `fr()` hands back.
LANG = "en"

COPY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "appstore-slide-copy.json")

CREAM = (255, 248, 240)
YELL = (255, 209, 102)
BGS = [(253, 205, 205),    # light pastel red
       (254, 224, 191),    # light pastel orange
       (254, 243, 199),    # light pastel yellow
       (206, 229, 250)]    # light pastel blue


def _shade(bg, sat, val):
    """A darker, richer version of the SAME hue — keeps each frame tonal."""
    h, l, v = colorsys.rgb_to_hsv(*[c / 255 for c in bg])
    r, g, b = colorsys.hsv_to_rgb(h, min(1.0, l * sat), v * val)
    return (int(r * 255), int(g * 255), int(b * 255))


def ink_for(bg):
    """Heading / accent / sub, all darker shades of the background hue."""
    return _shade(bg, 2.6, 0.34), _shade(bg, 2.3, 0.55), _shade(bg, 1.9, 0.62)


def fr(size, weight="Heavy"):
    cjk = CJK_FONTS.get(LANG)
    if cjk:
        path, idx = cjk
        return ImageFont.truetype(path, size,
                                  index=idx.get(weight, next(iter(idx.values()))))
    f = ImageFont.truetype(RND, size)
    for w in (weight, "Bold", "Regular"):
        try:
            f.set_variation_by_name(w); break
        except Exception:
            continue
    return f


def fs(size):
    # SignPainter is a Latin-only script face — CJK text renders as tofu boxes in
    # it, and l2 (the accent line) is CJK in five of the seven decks. Fall back to
    # the language's own face at a lighter weight, which keeps the accent line
    # visually subordinate to the heavy l1 the way the script face does.
    if CJK_FONTS.get(LANG):
        return fr(size, "Medium")
    try:
        return ImageFont.truetype(SCRIPT, size)
    except Exception:
        return fr(size, "Bold")


# ── ornaments (all code-drawn, no emoji) ──────────────────────────────────────
def star(d, cx, cy, r, fill, points=5):
    pts = []
    for i in range(points * 2):
        ang = -math.pi / 2 + i * math.pi / points
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    d.polygon(pts, fill=fill)


def sparkle(d, cx, cy, r, fill):
    d.polygon([(cx, cy - r), (cx + r * .22, cy - r * .22), (cx + r, cy),
               (cx + r * .22, cy + r * .22), (cx, cy + r), (cx - r * .22, cy + r * .22),
               (cx - r, cy), (cx - r * .22, cy - r * .22)], fill=fill)


def heart(d, cx, cy, r, fill):
    d.ellipse([cx - r, cy - r * .9, cx, cy + r * .1], fill=fill)
    d.ellipse([cx, cy - r * .9, cx + r, cy + r * .1], fill=fill)
    d.polygon([(cx - r * .96, cy - r * .12), (cx + r * .96, cy - r * .12), (cx, cy + r)], fill=fill)


def laurel(d, cx, cy, r, fill):
    """Two symmetric laurel sprigs flanking a stat."""
    for side in (-1, 1):
        for i in range(6):
            f = i / 5.0
            x = cx + side * (r * 1.05 + r * 0.62 * f)
            y = cy + r * 0.40 - r * 0.95 * f
            lw, lh = r * 0.20, r * 0.085
            d.ellipse([x - lw, y - lh, x + lw, y + lh], fill=fill)
        d.line([(cx + side * r * 1.02, cy + r * 0.50),
                (cx + side * r * 1.70, cy - r * 0.52)], fill=fill, width=max(2, int(r * .045)))


def chip(img, d, x, y, text, size, fillbg, fillfg):
    f = fr(size, "Bold")
    w = d.textlength(text, font=f)
    pad = size * 0.62
    d.rounded_rectangle([x, y, x + w + pad * 2, y + size * 1.75], (size * 1.75) / 2, fill=fillbg)
    d.text((x + pad, y + size * 0.32), text, font=f, fill=fillfg)
    return y + size * 1.75



ART = os.path.expanduser("~/DeskMate/assets/images/")
CAST = [ART + "cocoa/cocoa.png", ART + "bunny/bunny.png", ART + "honey/honey.png",
        ART + "tira/tira.png"]                                    # no Hanji: secret character


def peek_cast(img, W, H, paths=None, top=None):
    """Casual art leaning in from the sides — left tilts like \\, right like /.

    Sized by HEIGHT so every character reads the same size regardless of how
    wide its artwork is, and clamped inside the canvas so none is ever cut.
    They sit in the side margins, clear of the phone's screen content.

    `top` is the caller's text-safe baseline. The upper pair is pinned below it,
    because a fixed fraction that cleared the headline on the tall iPhone canvas
    lands on top of the subtitle on Play's shorter 9:16 one.
    """
    paths = paths or CAST
    ftop = max(.180, (top / H) if top else 0)
    spots = [(0.0, ftop, -34), (1.0, ftop, 34), (0.0, .790, -30), (1.0, .790, 30)]
    for path, (fx, fy, ang) in zip(paths, spots):
        if not os.path.exists(path):
            continue
        c = Image.open(path).convert("RGBA")
        c = c.crop(c.getbbox())                        # drop transparent padding
        th = int(W * .44)                              # uniform height
        c = c.resize((max(1, int(th * c.width / c.height)), th), Image.LANCZOS)
        c = c.rotate(ang, resample=Image.BICUBIC, expand=True)
        c = c.crop(c.getbbox())        # rotation adds transparent corners — retrim
        x = max(0, min(int(W * fx) - (c.width if fx > 0.5 else 0), W - c.width))
        y = max(0, min(int(H * fy), H - c.height))
        img.paste(c, (x, y), c)


# ── device mockup ─────────────────────────────────────────────────────────────
def rounded(im, rad):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], rad, fill=255)
    o = im.convert("RGBA"); o.putalpha(m); return o


def device(src, w, tilt=0.0):
    s = Image.open(src).convert("RGB")
    h = int(s.height * w / s.width)
    s = s.resize((w, h), Image.LANCZOS)
    bez = max(10, int(w * .022))
    body = rounded(Image.new("RGBA", (w + bez * 2, h + bez * 2), (38, 26, 22, 255)), int(w * .115))
    inner = rounded(s, int(w * .095))
    body.paste(inner, (bez, bez), inner)
    if tilt:
        body = body.rotate(tilt, resample=Image.BICUBIC, expand=True)
    return body


def drop(img, body, pos):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh = Image.new("RGBA", body.size, (0, 0, 0, 0))
    sh.paste((30, 10, 20, 120), (0, 0), body.split()[-1])
    sh = sh.filter(ImageFilter.GaussianBlur(int(img.size[0] * .022)))
    layer.paste(sh, (pos[0] + int(img.size[0] * .006), pos[1] + int(img.size[0] * .014)), sh)
    layer.paste(body, pos, body)
    img.paste(layer, (0, 0), layer)


def fit_line(d, text, maxw, size, weight="Heavy"):
    while size > 20 and d.textlength(text, font=fr(size, weight)) > maxw:
        size = int(size * .95)
    return size


def centered(d, text, y, size, W, fill, weight="Heavy"):
    f = fr(size, weight)
    d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=fill)


def centered_script(d, text, y, size, W, fill):
    """Accent line — same rounded family as the heading, a weight lighter."""
    f = fr(size, "Bold")
    d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=fill)



def fill_size(src, top, H, W, maxfrac):
    """Width that makes the device tall enough to run off the bottom edge.

    Returns (width, top) — if the width cap binds, the device is pushed DOWN so
    it still bleeds instead of leaving dead space under it.
    """
    im = Image.open(src)
    ar = im.height / im.width
    need_h = (H - top) * 1.06
    pw = int(need_h / ar)
    cap = int(W * maxfrac)
    if pw > cap:
        pw = cap
        h = int(pw * ar)
        top = max(top, H - h + int(H * .035))
    return pw, top


# ── layouts ───────────────────────────────────────────────────────────────────
def render(spec, W, H, kind):
    bg = spec["bg"]
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    # soft vignette + scattered ornaments
    for (ox, oy, orr, fn) in spec.get("orn", []):
        fn(d, int(W * ox), int(H * oy), int(W * orr), (255, 255, 255, 60))

    HEAD, SCRIPT, SUB = ink_for(bg)
    _lum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
    CHIP_FG = HEAD if _lum > 165 else bg
    lay = spec["layout"]
    pad = int(W * .06)
    l1s = fit_line(d, spec["l1"], W - pad * 2, int(W * .105))
    scr = fit_line(d, spec["l2"], W - pad * 2, int(W * .088), "Bold")

    if lay in ("top", "pills", "dual", "intro"):
        y = int(H * .045)
        centered(d, spec["l1"], y, l1s, W, HEAD)
        y += int(l1s * 1.18)
        centered_script(d, spec["l2"], y, scr, W, SCRIPT)
        y += int(scr * 1.40)
        if spec.get("sub"):
            ss = fit_line(d, spec["sub"], W - pad * 2, int(W * .040), "Medium")
            centered(d, spec["sub"], y, ss, W, SUB, "Medium")
            y += int(ss * 1.6)
        top0 = y + int(H * .055)   # text-safe gap: nothing may intrude above this

        if lay == "dual":
            # One large device filling the frame, a second overlapping it — two
            # side-by-side phones can never be tall enough to fill a 1:2.17
            # canvas without burying each other.
            pw, top = fill_size(spec["src"][0], top0, H, W, .96 if kind == "phone" else .86)
            a = device(spec["src"][0], pw, tilt=-4)
            drop(img, a, (int(-W * .11), top))
            ipw = int(pw * .55)
            b = device(spec["src"][1], ipw, tilt=7)
            drop(img, b, (W - b.width + int(W * .085), top + int(H * .175)))
        elif lay == "pills":
            # device occupies the right column only; chips live in the left one
            pw, top = fill_size(spec["src"][0], top0, H, W, .58 if kind == "phone" else .56)
            body = device(spec["src"][0], pw, tilt=-5)
            bx = W - body.width + int(W * .07)
            drop(img, body, (bx, top))
            cy = top + int(H * .02)
            for t in spec.get("chips", []):
                cy = chip(img, d, int(W * .05), cy, t, int(W * .032), (255, 255, 255, 255), CHIP_FG) + int(H * .014)
        elif lay == "intro":
            pw = int(W * (.50 if kind == "phone" else .48))
            body = device(spec["src"][0], pw, tilt=spec.get("tilt", 0))
            drop(img, body, ((W - body.width) // 2, top0))
            peek_cast(img, W, H, top=top0)   # in front of the device
        else:
            pw, top = fill_size(spec["src"][0], top0, H, W, .92 if kind == "phone" else .94)
            body = device(spec["src"][0], pw, tilt=spec.get("tilt", 0))
            drop(img, body, ((W - body.width) // 2, top))

    elif lay == "bottom":       # device bleeds off the TOP, headline fills below
        src = Image.open(spec["src"][0])
        target_h = int(H * .70)
        pw = min(int(target_h * src.width / src.height), int(W * (.92 if kind == "phone" else .94)))
        body = device(spec["src"][0], pw, tilt=spec.get("tilt", 4))
        drop(img, body, ((W - body.width) // 2, int(-H * .045)))
        y = int(H * .745)
        centered(d, spec["l1"], y, l1s, W, HEAD)
        y += int(l1s * 1.18)
        centered_script(d, spec["l2"], y, scr, W, SCRIPT)

    elif lay == "badge":        # big stat with laurels
        y = int(H * .045)
        centered(d, spec["l1"], y, l1s, W, HEAD)
        y += int(l1s * 1.18)
        centered_script(d, spec["l2"], y, scr, W, SCRIPT)
        by = y + int(scr * 1.05)
        centered(d, spec["stat"], by, int(W * .20), W, CREAM)
        laurel(d, W // 2, by + int(W * .145), int(W * .165), (255, 236, 190))
        top0 = by + int(W * .28)
        pw, top = fill_size(spec["src"][0], top0, H, W, .74 if kind == "phone" else .82)
        body = device(spec["src"][0], pw, tilt=-4)
        drop(img, body, ((W - body.width) // 2, top))

    return img


def build(W, H, kind, srcs, outdir, deck=None):
    """kind picks the device width fractions; deck picks which slide list.

    They are separate so the iPad can run the 7-slide phone deck (same headlines
    and screens as the iPhone listing) off iPad captures -- which is what the
    store listing wants -- rather than the older 5-slide tablet-only variant.
    """
    deck = deck or kind
    os.makedirs(outdir, exist_ok=True)
    S = srcs
    orn_a = []          # no sparkles: art should carry the frame
    # Built per-deck: the phone deck references capture keys (e.g. "desks") that
    # the tablet-only set has no equivalent for, so it must not be built for it.
    specs = [] if deck == "tablet" else [
        {"bg": BGS[0], "layout": "top", "tilt": 0, "src": [S["home"]],
         "l1": "YOUR DESK,", "l2": "your companion",
         "sub": "Start a session and focus together", "orn": orn_a},
        {"bg": BGS[1], "layout": "top", "tilt": 0, "src": [S["study"]],
         "l1": "SET A TIMER,", "l2": "then study",
         "sub": "Pick a length, a subject and a mood", "orn": orn_a},
        {"bg": BGS[2], "layout": "dual", "src": [S["dual_a"], S["dual_b"]],
         "l1": "OUTFITS AND ROOMS", "l2": "to unlock",
         "sub": "Dress your companion, then decorate", "orn": orn_a},
        {"bg": BGS[3], "layout": "dual", "src": [S["rooms"], S["desks"]],
         "l1": "ROOMS AND DESKS", "l2": "to mix and match",
         "sub": "Any background with any desk", "orn": orn_a},
        {"bg": BGS[0], "layout": "intro", "tilt": 0, "src": [S["shop"]],
         "l1": "COLLECT EVERY", "l2": "companion",
         "sub": "Each with their own wardrobe and story", "orn": orn_a},
        {"bg": BGS[1], "layout": "top", "tilt": 3, "src": [S["progress"]],
         "l1": "TRACK YOUR", "l2": "progress",
         "sub": "Weekly reports, achievements and streak freezes", "orn": orn_a},
        {"bg": BGS[2], "layout": "top", "tilt": -3, "src": [S["tasks"]],
         "l1": "TASKS, EXAMS", "l2": "and moods",
         "sub": "Plan everything in one place", "orn": orn_a},
    ]
    if deck == "tablet":
        specs = [
            {"bg": BGS[3], "layout": "top", "tilt": 0, "src": [S["home"]],
             "l1": "YOUR DESK,", "l2": "your companion",
             "sub": "Start a session and focus together", "orn": orn_a},
            {"bg": BGS[0], "layout": "intro", "src": [S["study"]],
             "l1": "COLLECT EVERY", "l2": "companion", "sub": "Each with their own wardrobe and story",
             "chips": ["Own wardrobes", "Level them up", "Swap anytime", "Each with a story"],
             "orn": orn_a},
            {"bg": BGS[1], "layout": "bottom", "src": [S["rooms"]], "tilt": 4,
             "l1": "ROOMS AND DESKS", "l2": "to mix and match", "sub": None, "orn": orn_a},
            {"bg": BGS[2], "layout": "top", "tilt": -3, "src": [S["shop"]],
             "l1": "SPEND WHAT", "l2": "you earn",
             "sub": "Companions \u00b7 Outfits \u00b7 Recipes \u00b7 Rooms \u00b7 Desks \u00b7 Sounds",
             "orn": orn_a},
            {"bg": BGS[3], "layout": "top", "tilt": 3, "src": [S["progress"]],
             "l1": "COLLECT EVERY", "l2": "recipe badge",
             "sub": "Bake your way through the menu", "orn": orn_a},
        ]
    # Overlay translated marketing copy. Only the 7-slide deck is translated;
    # the 5-slide tablet-only variant keeps its English strings.
    if LANG != "en":
        copy = json.load(open(COPY_PATH)).get(LANG)
        if copy and len(copy) == len(specs):
            for sp, tr in zip(specs, copy):
                sp["l1"], sp["l2"] = tr["l1"], tr["l2"]
                if sp.get("sub") is not None:
                    sp["sub"] = tr["sub"]

    for i, sp in enumerate(specs, 1):
        render(sp, W, H, kind).save(os.path.join(outdir, f"{i:02d}.png"))
    print(f"{W}x{H} ({kind}): {len(specs)} frames -> {outdir}")
    return len(specs)


PHONE_FILES = {"home": "B_home.png", "study": "B_study.png",
               "dual_a": "STUDY_BUNNY.png", "dual_b": "STUDY_MIEL.png",
               "rooms": "F_edit-room.png", "shop": "F_shop.png",
               "progress": "M2_progress.png", "tasks": "M_tasks.png",
               "desks": "wood_check.png"}

# iPad set deliberately uses only screens with NO personal data on them, so
# nothing needs masking: home, companion gallery, shop, edit-room, recipes.
TABLET_FILES = {"home": "P_home.png", "study": "P_companion-gallery.png",
                "dual_a": "P_home.png", "dual_b": "P_edit-room.png",
                "rooms": "P_edit-room.png", "shop": "P_shop.png",
                "progress": "P_food-gallery.png", "tasks": "P_companion-gallery.png"}

# Raw capture size each set requires, so a phone folder can never be rendered
# into an iPad canvas (the defect this script shipped in July 2026).
EXPECT = {"phone": (1206, 2622), "tablet": (2064, 2752),
          # Google Play decks, shot on the AVDs in scripts/capture-android-screens.py.
          "android-phone": (1344, 2992),      # Pixel 8 Pro
          "android-tab7": (1200, 1920),       # Nexus 7, portrait
          "android-tab10": (1600, 2560)}      # Nexus 10, forced portrait

# Play states a 16:9 / 9:16 requirement for every screenshot slot, so these
# canvases are exactly 9:16 (width divisible by 9) rather than the taller iPhone
# ratio — rendering native beats rendering tall and cropping the art afterwards.
PLAY_CANVAS = {"android-phone": (1440, 2560),
               "android-tab7": (1620, 2880),
               "android-tab10": (1800, 3200)}


def resolve(files, src, kind):
    """Map the capture filenames onto src, and refuse wrong-device captures."""
    out, missing, wrong = {}, [], []
    for key, name in files.items():
        path = os.path.join(src, name)
        if not os.path.exists(path):
            missing.append(name)
            continue
        size = Image.open(path).size
        if size != EXPECT[kind]:
            wrong.append(f"{name} is {size[0]}x{size[1]}, expected "
                         f"{EXPECT[kind][0]}x{EXPECT[kind][1]}")
        out[key] = path
    if missing:
        raise SystemExit(f"error: missing {kind} captures in {src}: "
                         + ", ".join(sorted(set(missing))))
    if wrong:
        raise SystemExit(f"error: {kind} captures taken on the wrong device:\n  "
                         + "\n  ".join(wrong))
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=SRC, help="folder of raw captures")
    ap.add_argument("--out", default=OUT, help="output folder")
    ap.add_argument("--sets", nargs="*", default=["ipad"],
                    choices=["phone", "ipad", "ipad-alt",
                             "android-phone", "android-tab7", "android-tab10"],
                    help="phone = the 7-slide iPhone deck; ipad = that same "
                         "7-slide deck off iPad captures (matches the listing); "
                         "ipad-alt = the older 5-slide tablet-only variant; "
                         "android-* = the same 7-slide deck for Google Play, off "
                         "emulator captures, on a 9:16 canvas")
    ap.add_argument("--lang", default="en",
                    choices=["en", "zh", "zh-Hant", "ja", "ko", "es", "fr"],
                    help="marketing-copy language (also picks the CJK font)")
    args = ap.parse_args()
    LANG = args.lang
    globals()["LANG"] = args.lang
    src, out = os.path.expanduser(args.src), os.path.expanduser(args.out)

    if "phone" in args.sets:
        phone = resolve(PHONE_FILES, src, "phone")
        build(1320, 2868, "phone", phone, os.path.join(out, "iphone-6.9"))
        build(1284, 2778, "phone", phone, os.path.join(out, "iphone-6.5"))
    if "ipad" in args.sets:
        # Same capture filenames as the phone deck, but shot on the iPad sim.
        ipad = resolve(PHONE_FILES, src, "tablet")
        build(2064, 2752, "tablet", ipad, os.path.join(out, "ipad-13"),
              deck="phone")
    if "ipad-alt" in args.sets:
        tablet = resolve(TABLET_FILES, src, "tablet")
        build(2064, 2752, "tablet", tablet, os.path.join(out, "ipad-13-alt"),
              deck="tablet")
    for kind in ("android-phone", "android-tab7", "android-tab10"):
        if kind not in args.sets:
            continue
        # `kind` picks the capture size to validate; the layout still uses the
        # phone/tablet device-width fractions, which is a separate axis.
        shots = resolve(PHONE_FILES, src, kind)
        W, H = PLAY_CANVAS[kind]
        build(W, H, "phone" if kind == "android-phone" else "tablet",
              shots, os.path.join(out, kind), deck="phone")
