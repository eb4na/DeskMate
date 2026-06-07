"""
Generate a cute magnifying-glass (zoom/inspect) UI icon for the shop.
Output: assets/images/shop/magnifier.png  (transparent)

Usage: python3 scripts/generate-magnifier-icon.py
"""
from __future__ import annotations
import base64, json, os, sys, urllib.error, urllib.request
from io import BytesIO
try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("pip3 install Pillow numpy"); sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets/images/shop/magnifier.png")

PROMPT = (
    "Single small mobile-app UI icon: a cute magnifying glass for a search / zoom-in "
    "button. Round empty clear glass lens with a soft glossy highlight and a thin warm "
    "rose-pink rim, a short rounded cocoa-brown handle, one tiny sparkle. Cozy patisserie "
    "bakery study-app style, soft watercolour, clean simple bold shape, centered, fills most "
    "of the frame. The lens is plain and empty — absolutely NO face, NO eyes, NO mouth, NO "
    "character, just glass. BACKGROUND: solid flat chroma-key green #00FF00 everywhere else. "
    "No text, no drop shadow outside the icon, no extra objects."
)


def load_key() -> str:
    k = os.environ.get("OPENAI_API_KEY", "")
    if k:
        return k
    p = os.path.join(ROOT, ".env")
    if os.path.isfile(p):
        for line in open(p):
            if line.strip().startswith("OPENAI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def strip_green(raw: bytes) -> bytes:
    img = Image.open(BytesIO(raw)).convert("RGBA")
    a = np.array(img, dtype=np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    green = (g > 120) & (g > r * 1.4) & (g > b * 1.4)
    a[:, :, 3] = np.where(green, 0, a[:, :, 3])
    out = Image.fromarray(a.astype(np.uint8), "RGBA")
    bb = out.getbbox()
    if bb:
        w, h = out.size
        out = out.crop((max(0, bb[0] - 6), max(0, bb[1] - 6), min(w, bb[2] + 6), min(h, bb[3] + 6)))
    out.thumbnail((256, 256), Image.LANCZOS)
    buf = BytesIO(); out.save(buf, "PNG"); return buf.getvalue()


def main() -> None:
    key = load_key()
    if not key:
        print("OPENAI_API_KEY missing"); sys.exit(1)
    payload = json.dumps({
        "model": "gpt-image-1", "prompt": PROMPT, "size": "1024x1024",
        "quality": "high", "output_format": "png", "background": "opaque", "n": 1,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations", data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST")
    print("Generating magnifier icon…")
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print("Failed:", e.read().decode()[:300]); sys.exit(1)
    b64 = result["data"][0].get("b64_json")
    if not b64:
        print("No image"); sys.exit(1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(strip_green(base64.b64decode(b64)))
    print("Saved", OUT)


if __name__ == "__main__":
    main()
