"""
Generate tab bar lace frame + bow as separate transparent PNGs.

Outputs:
  assets/images/home/bottom-nav-lace.png  — wide lace pill only (no bow)
  assets/images/home/bottom-nav-bow.png   — bow + sparkles only

Usage:
    python3 scripts/generate-tab-bar-lace.py
    python3 scripts/generate-tab-bar-lace.py --lace-only
    python3 scripts/generate-tab-bar-lace.py --bow-only
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("ERROR: Pillow and numpy required. Run: pip3 install Pillow numpy")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LACE_OUT = os.path.join(ROOT, "assets/images/home/bottom-nav-lace.png")
BOW_OUT = os.path.join(ROOT, "assets/images/home/bottom-nav-bow.png")

LACE_PROMPT = (
    "Mobile app bottom navigation LACE FRAME ONLY — NO bow, NO ribbon, NO icons, NO food, NO text. "
    "One wide flat rounded-rectangle pill, aspect ratio about 5:1 (very wide, not tall). "
    "The pill occupies only the horizontal center band of the canvas (~40% of image height max) — "
    "large solid chroma-key green #00FF00 above and below the pill. "
    "LACE: Ornate scalloped white doily lace trim with warm blush-pink (#F5B8C4) tint on scallops. "
    "INTERIOR: Empty smooth cream-white (#FFFDF9) panel for four app tabs. "
    "No dividers, no dashed lines, no separators inside the panel — a single clean continuous interior. "
    "BOTTOM EDGE of pill: clean flat lace edge — absolutely nothing below the pill (no bow, no tails, no extras). "
    "STYLE: Soft watercolour kawaii patisserie princess café UI, pastel pink and cream. "
    "BACKGROUND: Only #00FF00 outside the pill. No shadow outside pill."
)

BOW_PROMPT = (
    "Single isolated decorative element for a mobile app tab bar — ONLY this, nothing else. "
    "One medium pink satin ribbon bow with a small gold heart-shaped jewel clasp at the center knot. "
    "Two tiny gold sparkle stars, one slightly left and one slightly right of the bow. "
    "Bow is compact, roughly square composition, facing forward. "
    "STYLE: Soft watercolour kawaii patisserie princess anime game UI, pastel pink #F2A0B8 and gold accents. "
    "BACKGROUND: Entire image solid flat chroma-key green #00FF00 only. No lace, no bar, no text, no floor."
)


def load_api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "")
    if key:
        return key
    env_path = os.path.join(ROOT, ".env")
    if os.path.isfile(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("OPENAI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def strip_green_screen(img_bytes: bytes, pad: int = 12) -> tuple[bytes, tuple[int, int]]:
    from io import BytesIO

    img = Image.open(BytesIO(img_bytes)).convert("RGBA")
    arr = np.array(img, dtype=np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    green_mask = (g > 120) & (g > r * 1.5) & (g > b * 1.5)
    arr[:, :, 3] = np.where(green_mask, 0, a)
    result = Image.fromarray(arr.astype(np.uint8), "RGBA")
    bbox = result.getbbox()
    if bbox:
        w, h = result.size
        result = result.crop(
            (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(w, bbox[2] + pad),
                min(h, bbox[3] + pad),
            )
        )
    buf = BytesIO()
    result.save(buf, format="PNG")
    return buf.getvalue(), result.size


def generate_image(api_key: str, prompt: str, size: str) -> bytes:
    payload = json.dumps(
        {
            "model": "gpt-image-1",
            "prompt": prompt,
            "size": size,
            "quality": "high",
            "output_format": "png",
            "background": "opaque",
            "n": 1,
        }
    ).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=180) as resp:
        result = json.loads(resp.read())

    b64 = result.get("data", [{}])[0].get("b64_json")
    if not b64:
        raise RuntimeError(f"No image data: {json.dumps(result)[:400]}")
    return base64.b64decode(b64)


def save_asset(path: str, raw: bytes, label: str) -> None:
    print(f"  Stripping green screen ({label})…")
    final_bytes, size = strip_green_screen(raw)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(final_bytes)
    print(f"  Saved → {path} ({size[0]}x{size[1]}, {len(final_bytes) // 1024}KB)")


def gen_lace(api_key: str) -> None:
    print("Generating lace frame (no bow)…")
    raw = generate_image(api_key, LACE_PROMPT, "1536x1024")
    save_asset(LACE_OUT, raw, "lace")


def gen_bow(api_key: str) -> None:
    print("Generating bow (separate)…")
    raw = generate_image(api_key, BOW_PROMPT, "1024x1024")
    save_asset(BOW_OUT, raw, "bow")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lace-only", action="store_true")
    parser.add_argument("--bow-only", action="store_true")
    args = parser.parse_args()

    api_key = load_api_key()
    if not api_key:
        print("ERROR: OPENAI_API_KEY not set (env or .env)")
        sys.exit(1)

    run_lace = not args.bow_only
    run_bow = not args.lace_only

    if run_lace:
        gen_lace(api_key)
    if run_bow:
        gen_bow(api_key)

    print("Done. Reload the app.")


if __name__ == "__main__":
    main()
