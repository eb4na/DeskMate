#!/usr/bin/env python3
"""Generate the Frostbloom Shrine desk: an entirely-snow study surface.

A soft, even bed of snow that ties into the Frostbloom Shrine background
(white snow with pale-periwinkle shadows + a cool-blue cast and faint
sparkle). Rendered cover-cropped full-width along the bottom of the screen,
like the other desks, so it reads as a flat snowy surface the book sits on.

Procedural (no AI): multi-octave smooth value-noise interpolating between a
snow-shadow tone and bright white, a gentle top-light gradient, and scattered
sparkle. Re-run to regenerate.

    python3 scripts/generate-snow-desk.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# Portrait ratio (~0.706) to match the other desk previews (marble/lavender),
# so it fills the shop's contain-fit preview box instead of letterboxing short.
W, H = 1080, 1530
OUT = Path(__file__).resolve().parent.parent / "assets/images/desks/snow.png"

# Palette — pulled to match the shrine's snow: bright white highlights, soft
# periwinkle dips, a cool-blue base.
SNOW_HI = np.array([255, 255, 255], dtype=np.float32)   # sun-lit snow
SNOW_BASE = np.array([236, 243, 251], dtype=np.float32)  # general snow field (a soft tone, not paper-white)
SNOW_SHADOW = np.array([194, 213, 237], dtype=np.float32)  # periwinkle dips (deeper, so the drifts actually read)


def smooth_noise(h, w, cells, rng):
    """Low-res random field upsampled with bicubic → soft, blobby noise in 0..1."""
    low = rng.random((cells, max(1, round(cells * w / h)))).astype(np.float32)
    img = Image.fromarray((low * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    a = np.asarray(img, dtype=np.float32) / 255.0
    return (a - a.min()) / (np.ptp(a) + 1e-6)


def main():
    rng = np.random.default_rng(20260615)

    # Multi-octave noise: big drifts + medium lumps + fine snow grain.
    n = (
        0.58 * smooth_noise(H, W, 5, rng)
        + 0.30 * smooth_noise(H, W, 13, rng)
        + 0.12 * smooth_noise(H, W, 34, rng)
    )
    n = (n - n.min()) / (np.ptp(n) + 1e-6)
    # Gamma toward bright, but not so hard the drifts vanish — keep visible midtones
    # so the surface reads as textured snow rather than a flat white void.
    n = n ** 0.82

    # Interpolate shadow→base→highlight across the noise range.
    rgb = np.empty((H, W, 3), dtype=np.float32)
    lo = np.clip(n * 1.7, 0, 1)[..., None]            # shadow → base (let the dips linger)
    hi = np.clip((n - 0.6) * 1.7, 0, 1)[..., None]    # base → highlight (only the brightest crests blow out)
    rgb = SNOW_SHADOW * (1 - lo) + SNOW_BASE * lo
    rgb = rgb * (1 - hi) + SNOW_HI * hi

    # Gentle top-light gradient: snow brighter where light hits (upper area),
    # a touch cooler/deeper toward the bottom for depth.
    grad = np.linspace(1.04, 0.90, H, dtype=np.float32)[:, None, None]
    rgb = rgb * grad
    # Nudge the lower third slightly bluer so it recedes like packed snow.
    cool = np.clip(np.linspace(-0.0, 0.04, H, dtype=np.float32), 0, 1)[:, None, None]
    rgb[..., 2] += cool[..., 0] * 5  # +blue
    rgb[..., 0] -= cool[..., 0] * 3  # -red

    # Sparkle: a scatter of bright pixels (snow glints).
    sparkle = rng.random((H, W)) > 0.9985
    rgb[sparkle] = np.array([255, 255, 255], dtype=np.float32)

    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    # Soften everything so the noise reads as drifted snow, not static.
    out = out.filter(ImageFilter.GaussianBlur(1.2))
    out.save(OUT)
    print(f"wrote {OUT}  {out.size}")


if __name__ == "__main__":
    main()
