"""
Generate 4 individual tab bar icon images using OpenAI gpt-image-1.
White background, cute flashy whipped-cream patisserie style.

Usage:
    OPENAI_API_KEY=sk-... python3 scripts/generate-tab-icons.py
"""

import base64, json, os, sys, urllib.request, urllib.error

API_KEY = os.environ.get("OPENAI_API_KEY", "")
OUT_DIR  = "assets/images/tabIcons"

STYLE = (
    "Cute, flashy, modern Japanese patisserie illustration. "
    "Bright vivid colours, soft pink and white dominant palette. "
    "Fluffy whipped cream details, glossy strawberries, pastel accents. "
    "Chibi/kawaii food illustration style, high detail, clean lines. "
    "Pure white background. Centered subject. Square composition. No text, no labels."
)

ICONS = [
    ("gen-home",     "A single slice of strawberry shortcake: three golden sponge layers, thick fluffy whipped cream between each layer, topped with a generous swirl of whipped cream and a large glossy red strawberry. " + STYLE),
    ("gen-tasks",    "A cute pink pastel clipboard with a small pink ribbon bow clipped at the top, two pink checkmark tick lines on the notepad, and a plump glossy strawberry leaning against the bottom corner. " + STYLE),
    ("gen-progress", "An elegant three-tier layered strawberry celebration cake: each tier has pink whipped cream frosting with rosette swirls, fresh strawberry slices on the sides, and a large glossy strawberry on top. " + STYLE),
    ("gen-shop",     "A clear glass bell-jar cloche dome on a pastel pink pedestal stand, with a cute pink satin bow on top of the dome lid, and a tall stack of pastel macarons (pink, peach, lavender, cream) inside. " + STYLE),
]


def generate(name: str, prompt: str) -> None:
    print(f"  Generating {name}...")
    payload = json.dumps({
        "model": "gpt-image-1",
        "prompt": prompt,
        "size": "1024x1024",
        "quality": "high",
        "output_format": "png",
        "background": "opaque",
        "n": 1,
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()[:300]}")
        return

    b64 = result["data"][0].get("b64_json")
    if not b64:
        print(f"  ERROR: no image data returned")
        return

    path = f"{OUT_DIR}/{name}.png"
    with open(path, "wb") as f:
        f.write(base64.b64decode(b64))
    print(f"  Saved → {path}")


def main():
    if not API_KEY:
        print("ERROR: set OPENAI_API_KEY")
        sys.exit(1)
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, prompt in ICONS:
        generate(name, prompt)
    print("Done!")


if __name__ == "__main__":
    main()
