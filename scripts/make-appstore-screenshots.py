#!/usr/bin/env python3
"""
Turn raw device screenshots into App Store Connect upload images.

Takes the raw captures (any single consistent size) and renders each one onto a
code-drawn bakery-style canvas: headline + subhead in the app's own Baloo2 face,
the real screenshot inside a device frame, on a warm gradient + graph-paper
backdrop built from BakeryColors. Nothing about the app UI is redrawn or
invented -- only the marketing surround.

Output sizes come from Apple's screenshot specification:
  6.9" iPhone  1320 x 2868  (required if the app runs on iPhone)
  6.5" iPhone  1284 x 2778  (only needed if 6.9" is absent -- emitted for safety)
  13"  iPad    2064 x 2752  (required for iPad apps -- needs iPad captures)

Usage:
    python3 scripts/make-appstore-screenshots.py
    python3 scripts/make-appstore-screenshots.py --sizes 6.9
    python3 scripts/make-appstore-screenshots.py --src ~/Desktop/shots --out ~/Desktop/out
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass, field

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULT_SRC = os.path.expanduser("~/Desktop/memobun-screenshots")
DEFAULT_OUT = os.path.expanduser("~/Desktop/memobun-appstore")

# ---------------------------------------------------------------------------
# Palette -- mirrors BakeryColors in src/constants/theme.ts
# ---------------------------------------------------------------------------

COCOA = (122, 82, 64)
COCOA_DARK = (93, 60, 46)
FROSTING = (255, 248, 241)
CREAM = (255, 240, 227)
SHORTBREAD = (247, 223, 196)
JAM = (228, 138, 154)
HONEY = (246, 201, 107)
MINT = (242, 198, 209)
ROSE = (246, 200, 194)
LATTE = (213, 178, 154)
TEXT_SECONDARY = (156, 125, 104)
GRID = (222, 178, 132)

# Fonts: the app's display face lives in the repo; the rounded system face
# stands in for the lighter subhead weight (only ExtraBold Baloo2 is bundled).
FONT_DISPLAY = os.path.join(REPO, "assets", "fonts", "Baloo2-ExtraBold.ttf")
FONT_ROUNDED = "/System/Library/Fonts/SFCompactRounded.ttf"

# Apple's accepted portrait upload sizes.
# iPad needs its own captures -- an iPhone shot cannot be stretched into an
# iPad slide, the layout is different. Capture on a 13" iPad Pro sim (its
# native portrait is exactly 2064x2752) and pass --src at that folder.
SIZES = {
    "6.9": (1320, 2868),
    "6.5": (1284, 2778),
    "ipad-13": (2064, 2752),
}

# Which raw aspect ratio each output size expects, so a phone folder can't be
# silently rendered into an iPad canvas.
TALL, WIDE = "tall", "wide"
SIZE_SHAPE = {"6.9": TALL, "6.5": TALL, "ipad-13": WIDE}


@dataclass
class Shot:
    """One App Store slide: a raw capture plus the copy that sits above it."""

    src: str
    headline: str
    subhead: str
    accent: tuple = JAM
    # Rects in RAW screenshot pixel coords to paint out (personal data).
    # Each entry: (x0, y0, x1, y1, replacement_text_or_None)
    redactions: list = field(default_factory=list)
    # Raw capture size the rects above were measured against.
    redaction_base: tuple | None = None


# The slide deck. Order is the order they appear on the store listing.
# Copy is written against what is actually visible in each capture.
DECK = [
    Shot(
        "1-home.png",
        "A desk that feels like home",
        "Your companion, your streak, and what's due next",
        accent=JAM,
    ),
    Shot(
        "2-studying.png",
        "Deep focus, gently timed",
        "Just you, your book, and the clock",
        accent=ROSE,
    ),
    Shot(
        "3-studying-with-friends.png",
        "Study together, live",
        "Open a room and work alongside friends",
        accent=MINT,
    ),
    Shot(
        "4-tasks.png",
        "Never miss a deadline",
        "Exams and tasks on one calendar",
        accent=HONEY,
    ),
    Shot(
        "5-progress.png",
        "Keep the streak alive",
        "Weekly hours, achievements, milestones",
        accent=JAM,
        # The raw capture shows the founder's real email address.
        redactions=[(118, 556, 665, 612, "hello@memobun.app")],
    ),
    Shot(
        "6-shop.png",
        "Earn coins, unlock companions",
        "Outfits, rooms and desks to collect",
        accent=LATTE,
    ),
]


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------


def lerp(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default(size)


def backdrop(w: int, h: int, accent: tuple) -> Image.Image:
    """Warm vertical gradient + faint graph paper + soft accent blooms."""
    bg = Image.new("RGB", (w, h))
    px = ImageDraw.Draw(bg)

    # Three-stop gradient: frosting at the top, cream through the middle,
    # a whisper of shortbread at the foot so the phone has something to sit on.
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.55:
            col = lerp(FROSTING, CREAM, t / 0.55)
        else:
            col = lerp(CREAM, SHORTBREAD, (t - 0.55) / 0.45 * 0.55)
        px.line([(0, y), (w, y)], fill=col)

    # Accent blooms, drawn big and soft so they read as light not shapes.
    bloom = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bloom)
    r = int(w * 0.52)
    bd.ellipse([-r // 3, int(h * 0.04), r, int(h * 0.04) + r], fill=accent + (46,))
    bd.ellipse(
        [w - r, int(h * 0.60), w + r // 3, int(h * 0.60) + r], fill=accent + (34,)
    )
    bloom = bloom.filter(ImageFilter.GaussianBlur(int(w * 0.09)))
    bg = Image.alpha_composite(bg.convert("RGBA"), bloom).convert("RGB")

    # Graph paper, kept warm and very faint (matches the notebook redesign).
    grid = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    step = max(8, int(h * 0.0165))
    for x in range(0, w, step):
        gd.line([(x, 0), (x, h)], fill=GRID + (30,), width=1)
    for y in range(0, h, step):
        gd.line([(0, y), (w, y)], fill=GRID + (30,), width=1)
    return Image.alpha_composite(bg.convert("RGBA"), grid).convert("RGB")


def wrap(draw, text: str, font, max_w: int) -> list:
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def apply_redactions(shot: Image.Image, redactions: list, expect: tuple, name: str) -> Image.Image:
    """Paint over personal data, sampling the surrounding card colour.

    The rects are raw pixel coords measured against one specific capture. If
    that screen is ever recaptured at a different size the rects would quietly
    paint the wrong region, so refuse rather than ship leaked data.
    """
    if not redactions:
        return shot
    if expect and shot.size != expect:
        raise SystemExit(
            f"error: {name} is {shot.size}, but its redaction rects were measured "
            f"against {expect}. Re-measure the rects in DECK before generating."
        )
    out = shot.copy()
    d = ImageDraw.Draw(out)
    for x0, y0, x1, y1, replacement in redactions:
        # Sample just right of the text -- inside the card, past the glyphs.
        sample = out.getpixel((min(out.width - 1, x1 + 12), (y0 + y1) // 2))
        d.rectangle([x0, y0, x1, y1], fill=sample)
        if replacement:
            size = int((y1 - y0) * 0.78)
            f = load_font(FONT_ROUNDED, size)
            d.text((x0, (y0 + y1) // 2), replacement, font=f,
                   fill=TEXT_SECONDARY, anchor="lm")
    return out


def device_frame(shot: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Round the screenshot's corners and wrap it in a slim cocoa bezel."""
    inner = shot.resize((target_w, target_h), Image.LANCZOS).convert("RGBA")

    radius = int(target_w * 0.092)
    mask = Image.new("L", (target_w, target_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, target_w - 1, target_h - 1], radius=radius, fill=255
    )
    inner.putalpha(mask)

    bez = max(4, int(target_w * 0.019))
    ow, oh = target_w + bez * 2, target_h + bez * 2
    frame = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle(
        [0, 0, ow - 1, oh - 1], radius=radius + bez, fill=COCOA_DARK + (255,)
    )
    # Inner hairline so the bezel reads as glass, not a flat slab.
    fd.rounded_rectangle(
        [bez - 2, bez - 2, ow - bez + 1, oh - bez + 1],
        radius=radius + 2,
        outline=(255, 255, 255, 40),
        width=2,
    )
    frame.paste(inner, (bez, bez), inner)
    return frame


def compose(shot: Shot, raw: Image.Image, w: int, h: int) -> Image.Image:
    canvas = backdrop(w, h, shot.accent).convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    # ---- copy block -------------------------------------------------------
    head_size = int(h * 0.0375)
    sub_size = int(h * 0.0205)
    head_font = load_font(FONT_DISPLAY, head_size)
    sub_font = load_font(FONT_ROUNDED, sub_size)
    max_text_w = int(w * 0.84)

    head_lines = wrap(draw, shot.headline, head_font, max_text_w)
    sub_lines = wrap(draw, shot.subhead, sub_font, max_text_w)

    head_lh = int(head_size * 1.12)
    sub_lh = int(sub_size * 1.3)
    swash_h = max(5, int(h * 0.0022))
    swash_gap = int(h * 0.017)  # clear of the last headline line, not an underline
    sub_gap = int(h * 0.020)

    # Centre the whole copy block in a fixed band so one- and two-line
    # headlines both sit at a deliberate height across the set.
    block_h = (
        len(head_lines) * head_lh + swash_gap + swash_h + sub_gap + len(sub_lines) * sub_lh
    )
    band_top, band_bottom = int(h * 0.042), int(h * 0.215)
    y = band_top + max(0, (band_bottom - band_top - block_h) // 2)

    for line in head_lines:
        draw.text((w // 2, y), line, font=head_font, fill=COCOA_DARK, anchor="ma")
        y += head_lh

    # Short accent swash separating headline from subhead.
    swash_w = int(w * 0.13)
    y += swash_gap
    draw.rounded_rectangle(
        [w // 2 - swash_w // 2, y, w // 2 + swash_w // 2, y + swash_h],
        radius=int(h * 0.002),
        fill=shot.accent,
    )
    y += swash_h + sub_gap

    for line in sub_lines:
        draw.text((w // 2, y), line, font=sub_font, fill=TEXT_SECONDARY, anchor="ma")
        y += sub_lh

    # ---- device -----------------------------------------------------------
    top = int(h * 0.238)
    avail_h = int(h * 0.735)
    aspect = raw.height / raw.width
    dev_h = avail_h
    dev_w = int(dev_h / aspect)
    if dev_w > w * 0.80:
        dev_w = int(w * 0.80)
        dev_h = int(dev_w * aspect)

    frame = device_frame(apply_redactions(raw, shot.redactions), dev_w, dev_h)
    fx = (w - frame.width) // 2
    fy = top

    # Soft drop shadow so the phone lifts off the paper.
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [fx, fy + int(h * 0.008), fx + frame.width, fy + frame.height + int(h * 0.008)],
        radius=int(dev_w * 0.11),
        fill=(132, 87, 63, 92),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(w * 0.022)))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.paste(frame, (fx, fy), frame)

    # App Store rejects alpha channels.
    return canvas.convert("RGB")


# ---------------------------------------------------------------------------


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=DEFAULT_SRC, help="folder of raw captures")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output folder")
    ap.add_argument(
        "--sizes",
        nargs="*",
        default=["6.9", "6.5"],
        choices=sorted(SIZES),
        help="which display sizes to emit",
    )
    args = ap.parse_args()

    src = os.path.expanduser(args.src)
    out_root = os.path.expanduser(args.out)

    missing = [s.src for s in DECK if not os.path.exists(os.path.join(src, s.src))]
    if missing:
        print(f"error: missing captures in {src}:", file=sys.stderr)
        for m in missing:
            print(f"  - {m}", file=sys.stderr)
        return 1

    for key in args.sizes:
        w, h = SIZES[key]
        out_dir = os.path.join(out_root, f"iphone-{key}")
        os.makedirs(out_dir, exist_ok=True)
        for i, shot in enumerate(DECK, start=1):
            raw = Image.open(os.path.join(src, shot.src)).convert("RGB")
            img = compose(shot, raw, w, h)
            name = f"{i:02d}-{os.path.splitext(shot.src)[0].split('-', 1)[-1]}.png"
            path = os.path.join(out_dir, name)
            img.save(path, "PNG")
            print(f"{key:>4}  {img.size[0]}x{img.size[1]}  {name}")
        print(f"      -> {out_dir}\n")

    print(f"{len(DECK)} slides x {len(args.sizes)} size(s). Max allowed is 10 per size.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
