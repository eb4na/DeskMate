"""
Generate missing home screen decorative assets.

Outputs:
  assets/images/home/home-top-garland.png
  assets/images/home/settings-scallop-btn.png

Usage: python3 scripts/generate-home-assets.py
"""

from __future__ import annotations

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
    print("ERROR: pip3 install Pillow numpy")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets/images/home")

PROMPTS = {
    "home-top-garland.png": (
        "Wide horizontal mobile app header decoration ONLY. "
        "Delicate hanging pearl bead garland and tiny pink ribbon bows across the top, "
        "kawaii patisserie princess style, soft pastel pink and cream, very light and airy. "
        "Center area mostly empty/transparent for status widgets below. "
        "BACKGROUND: solid flat chroma-key green #00FF00 everywhere else. No phone frame, no text."
    ),
    "settings-scallop-btn.png": (
        "Single small UI button icon for a mobile app. "
        "Scalloped circular lace doily frame in cream-white with thin rose-brown border, "
        "warm brown bakery gear/cog symbol centered inside. "
        "Kawaii cozy study app style, soft watercolour. "
        "BACKGROUND: solid flat #00FF00 only. No shadow outside frame."
    ),
}


def load_api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        env_path = os.path.join(ROOT, ".env")
        if os.path.isfile(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.strip().startswith("OPENAI_API_KEY="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
    return key


def strip_green(img_bytes: bytes) -> bytes:
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
            (max(0, bbox[0] - 8), max(0, bbox[1] - 8), min(w, bbox[2] + 8), min(h, bbox[3] + 8))
        )
    buf = BytesIO()
    result.save(buf, format="PNG")
    return buf.getvalue()


def generate(api_key: str, prompt: str, size: str) -> bytes:
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
    b64 = result["data"][0].get("b64_json")
    if not b64:
        raise RuntimeError("No image returned")
    return base64.b64decode(b64)


def main() -> None:
    api_key = load_api_key()
    if not api_key:
        print("ERROR: OPENAI_API_KEY missing")
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)
    sizes = {
        "home-top-garland.png": "1536x1024",
        "settings-scallop-btn.png": "1024x1024",
    }

    for name, prompt in PROMPTS.items():
        print(f"Generating {name}…")
        try:
            raw = generate(api_key, prompt, sizes[name])
            out = os.path.join(OUT_DIR, name)
            with open(out, "wb") as f:
                f.write(strip_green(raw))
            print(f"  Saved {out}")
        except urllib.error.HTTPError as e:
            print(f"  Failed {name}: {e.read().decode()[:300]}")

    print("Done.")


if __name__ == "__main__":
    main()
