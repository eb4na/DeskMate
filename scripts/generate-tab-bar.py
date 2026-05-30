"""
Generate a new tab bar image using OpenAI gpt-image-1 and save it to assets.
Uses green-screen then strips it locally with PIL for reliable transparency.

Usage:
    OPENAI_API_KEY=sk-... python3 scripts/generate-tab-bar.py
"""

import base64
import os
import sys
import urllib.request
import urllib.error
import json

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("ERROR: Pillow and numpy are required.")
    print("Run:  pip3 install Pillow numpy")
    sys.exit(1)

API_KEY = os.environ.get("OPENAI_API_KEY", "")
OUT_PATH = "assets/images/tab-bar-full.png"

PROMPT = (
    "Recreate this exact mobile app bottom navigation bar in a luxury princess patisserie anime style. "
    "SHAPE: A very wide, very flat rounded-rectangle pill — approximately 3 times wider than it is tall. "
    "The pill is centred as a horizontal band in the middle of the image, with large empty space above and below (filled with chroma-key green). "
    "BORDER: Ornate scalloped lace doily trim all around the pill edge — the lace is warm PINK/ROSE tinted (#F5B8C4), not white. "
    "INTERIOR: Soft warm cream-blush (#FFF3EE). "
    "TABS: Four evenly spaced tab items inside the pill, separated by subtle vertical dashed lines: "
    "1) Home — a rectangular slice of strawberry shortcake with visible sponge layers, thick cream, and a fresh strawberry on top. "
    "2) Tasks — a pastel pink clipboard notepad with a small pink ribbon bow at the top, two pink checkmark lines, and a plump strawberry beside it. "
    "3) Progress — an elegant three-tier layered strawberry cake with pink cream frosting and strawberries on each tier. "
    "4) Shop — a clear glass bell-jar cloche on a pink pedestal stand, filled with stacked pastel macarons (pink, peach, cream). "
    "LABELS: warm rose-brown serif text below each icon: Home, Tasks, Progress, Shop. "
    "BOW: A medium pink satin ribbon bow with a gold heart-shaped jewel clasp, centred at the BOTTOM CENTRE of the pill, "
    "sitting right at the lower lace border edge — only slightly overlapping below the lace border, not hanging far below. "
    "Two small gold sparkle stars flanking the bow. "
    "STYLE: Rich detailed soft watercolour illustration, luxury princess patisserie anime game aesthetic. "
    "Warm rose-pink palette: #F2A0B8, #F7CAC9, #FFF0F3, warm cream whites. "
    "BACKGROUND: Everything outside the pill shape is solid flat chroma-key green #00FF00. No shadows or glow outside the pill."
)


def strip_green_screen(img_bytes: bytes) -> bytes:
    from io import BytesIO

    img = Image.open(BytesIO(img_bytes)).convert("RGBA")
    arr = np.array(img, dtype=np.float32)

    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    # Pixels where green is dominant and bright
    green_mask = (g > 120) & (g > r * 1.5) & (g > b * 1.5)

    arr[:, :, 3] = np.where(green_mask, 0, a)
    result = Image.fromarray(arr.astype(np.uint8), "RGBA")

    # Trim transparent borders so the asset has a tight bounding box
    bbox = result.getbbox()
    if bbox:
        pad = 20
        w, h = result.size
        left  = max(0, bbox[0] - pad)
        upper = max(0, bbox[1] - pad)
        right = min(w, bbox[2] + pad)
        lower = min(h, bbox[3] + pad)
        result = result.crop((left, upper, right, lower))
        print(f"Cropped to {result.size[0]}x{result.size[1]} (ratio {result.size[0]/result.size[1]:.2f}:1)")

    buf = BytesIO()
    result.save(buf, format="PNG")
    return buf.getvalue(), result.size


def main():
    if not API_KEY:
        print("ERROR: OPENAI_API_KEY is not set.")
        print("Run:  OPENAI_API_KEY=sk-... python3 scripts/generate-tab-bar.py")
        sys.exit(1)

    print("Generating tab bar image with gpt-image-1…")

    payload = json.dumps({
        "model": "gpt-image-1",
        "prompt": PROMPT,
        "size": "1536x1024",
        "quality": "high",
        "output_format": "png",
        "background": "opaque",
        "n": 1,
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"OpenAI error {e.code}: {body[:500]}")
        sys.exit(1)

    b64 = result["data"][0].get("b64_json")
    if not b64:
        print("ERROR: No image data returned.")
        print(json.dumps(result, indent=2)[:500])
        sys.exit(1)

    print("Stripping green screen and trimming…")
    raw_bytes = base64.b64decode(b64)
    final_bytes, size = strip_green_screen(raw_bytes)

    with open(OUT_PATH, "wb") as f:
        f.write(final_bytes)

    kb = len(final_bytes) // 1024
    print(f"Saved {kb}KB → {OUT_PATH} ({size[0]}x{size[1]})")
    print("Done! Reload your app to see the new tab bar.")


if __name__ == "__main__":
    main()
