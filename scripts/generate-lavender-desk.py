#!/usr/bin/env python3
"""Generate the Lavender Palace desk: a clean pale-wood plank surface.

Replaces the old asset, which had harsh horizontal light-flare streaks that read
as a rendering glitch. This is a soft, even pale honey-wood floor with a faint
lavender tint — matching the Lavender Palace background's wooden floor — drawn
procedurally (no AI): horizontal wood grain, gentle plank seams, and a soft
vertical light gradient. Re-run to regenerate.

    python3 scripts/generate-lavender-desk.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# Portrait ratio (~0.706) to match the other desk previews (marble/snow).
W, H = 1080, 1530
OUT = Path(__file__).resolve().parent.parent / "assets/images/desks/lavender.png"

# Palette — pale honey-wood with a faint cool lavender cast, from the palace floor.
WOOD_BASE = np.array([231, 212, 195], dtype=np.float32)   # pale warm wood
WOOD_DARK = np.array([211, 190, 174], dtype=np.float32)   # grain / seam shadow
WOOD_LIGHT = np.array([244, 230, 217], dtype=np.float32)  # lit grain
LAVENDER = np.array([214, 203, 224], dtype=np.float32)    # faint tint blended in
PLANK_H = 168  # plank height in px


def streak_noise(h, w, rows, cols, rng):
    """Low-res field upsampled with bicubic. rows>>cols → horizontal streaks
    (wood grain runs along the plank, so it varies fast vertically)."""
    low = rng.random((rows, cols)).astype(np.float32)
    img = Image.fromarray((low * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    a = np.asarray(img, dtype=np.float32) / 255.0
    return (a - a.min()) / (np.ptp(a) + 1e-6)


def main():
    rng = np.random.default_rng(20260615)

    # Wood grain: fast vertical variation, slow horizontal → long horizontal streaks.
    grain = (
        0.6 * streak_noise(H, W, 220, 6, rng)
        + 0.4 * streak_noise(H, W, 90, 10, rng)
    )
    grain = (grain - grain.min()) / (np.ptp(grain) + 1e-6)

    # Map grain across dark→base→light.
    g = grain[..., None]
    lo = np.clip(g * 1.8, 0, 1)
    hi = np.clip((g - 0.55) * 2.0, 0, 1)
    rgb = WOOD_DARK * (1 - lo) + WOOD_BASE * lo
    rgb = rgb * (1 - hi) + WOOD_LIGHT * hi

    # Faint lavender tint over the whole surface.
    rgb = rgb * 0.88 + LAVENDER * 0.12

    # Plank seams: a soft darker line at each plank boundary.
    ys = np.arange(H)
    seam = (np.abs(((ys % PLANK_H) - 0)) < 3) | (np.abs(((ys % PLANK_H) - PLANK_H)) < 3)
    rgb[seam] *= 0.90

    # Gentle top-light gradient so the surface isn't flat.
    grad = np.linspace(1.04, 0.95, H, dtype=np.float32)[:, None, None]
    rgb = rgb * grad

    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    out = out.filter(ImageFilter.GaussianBlur(0.6))  # soften, keep grain readable
    out.save(OUT)
    print(f"wrote {OUT}  {out.size}")


if __name__ == "__main__":
    main()
