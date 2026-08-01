"""Google Play feature graphic — 1024x500, required for the store listing.

Same bold-pastel look as the App Store slides (make-appstore-slides.py): flat
pink field, chunky SF Rounded headline with a SignPainter accent, code-drawn
ornaments only (repo rule: no emoji). The companion is the adaptive-icon
foreground, which is already a transparent cut-out.

Play may overlay its own app title/controls near the edges on some surfaces, so
everything that matters sits inside a centred safe box.

Usage:
    python3 scripts/make-play-feature-graphic.py
"""
import os, math, colorsys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.expanduser("~/Desktop/memobun-play-feature-graphic.png")

RND = "/System/Library/Fonts/SFNSRounded.ttf"
SCRIPT = "/System/Library/Fonts/Supplemental/SignPainter.ttc"

W, H = 1024, 500
PINK = (253, 196, 210)      # app.json android adaptiveIcon backgroundColor
CREAM = (255, 248, 240)


def _shade(bg, sat, val):
    h, l, v = colorsys.rgb_to_hsv(*[c / 255 for c in bg])
    r, g, b = colorsys.hsv_to_rgb(h, min(1.0, l * sat), v * val)
    return (int(r * 255), int(g * 255), int(b * 255))


def fr(size, weight="Heavy"):
    f = ImageFont.truetype(RND, size)
    for w in (weight, "Bold", "Regular"):
        try:
            f.set_variation_by_name(w); break
        except Exception:
            continue
    return f


def strawberry(d, cx, cy, r, rot=0.0):
    """Code-drawn strawberry ornament — body, leaf crown, seeds."""
    body = _shade(PINK, 2.4, 0.95)
    pts = []
    for i in range(37):
        a = math.pi * 2 * i / 36
        # teardrop: wide shoulders, tapered point at the bottom
        rr = r * (1.0 - 0.30 * math.sin(a - math.pi / 2))
        pts.append((cx + math.cos(a + rot) * rr * 0.86,
                    cy + math.sin(a + rot) * rr))
    d.polygon(pts, fill=body)
    leaf = _shade((186, 225, 176), 1.5, 0.82)
    for k in range(5):
        a = rot - math.pi / 2 + (k - 2) * 0.42
        d.polygon([(cx, cy - r * 0.72),
                   (cx + math.cos(a) * r * 0.80, cy - r * 0.72 + math.sin(a) * r * 0.46),
                   (cx + math.cos(a) * r * 0.30, cy - r * 0.40)], fill=leaf)
    for sx, sy in ((-0.34, -0.10), (0.30, -0.16), (0.02, 0.16),
                   (-0.24, 0.34), (0.28, 0.28)):
        d.ellipse([cx + sx * r - r * 0.055, cy + sy * r - r * 0.075,
                   cx + sx * r + r * 0.055, cy + sy * r + r * 0.075], fill=CREAM)


def sparkle(d, cx, cy, r, fill):
    """Four-point star."""
    d.polygon([(cx, cy - r), (cx + r * 0.26, cy - r * 0.26), (cx + r, cy),
               (cx + r * 0.26, cy + r * 0.26), (cx, cy + r),
               (cx - r * 0.26, cy + r * 0.26), (cx - r, cy),
               (cx - r * 0.26, cy - r * 0.26)], fill=fill)


def main():
    img = Image.new("RGB", (W, H), PINK)
    d = ImageDraw.Draw(img)

    ink, accent, sub = (_shade(PINK, 2.6, 0.34),
                        _shade(PINK, 2.3, 0.55),
                        _shade(PINK, 1.9, 0.62))

    # Soft cream disc behind the companion, right of centre.
    cat_cx, cat_cy, disc_r = 762, 250, 214
    d.ellipse([cat_cx - disc_r, cat_cy - disc_r,
               cat_cx + disc_r, cat_cy + disc_r], fill=_shade(PINK, 0.30, 1.06))

    # Ornaments, kept clear of the text block and the safe edges.
    pale = _shade(PINK, 0.62, 1.03)
    for cx, cy, r in ((92, 92, 15), (984, 424, 13), (520, 62, 11), (472, 452, 12)):
        sparkle(d, cx, cy, r, pale)
    strawberry(d, 58, 452, 27, rot=-0.18)
    strawberry(d, 968, 108, 27, rot=0.24)

    # Companion — adaptive-icon foreground is a transparent cut-out already.
    fg = Image.open(os.path.join(ROOT, "assets/images/android-icon-foreground.png")).convert("RGBA")
    bbox = fg.getbbox()
    if bbox:
        fg = fg.crop(bbox)
    target_h = int(disc_r * 1.86)
    fg = fg.resize((max(1, round(fg.width * target_h / fg.height)), target_h),
                   Image.LANCZOS)
    img.paste(fg, (cat_cx - fg.width // 2, cat_cy - fg.height // 2 + 6), fg)

    # Headline block, left.
    x = 96
    f1 = fr(92, "Heavy")
    d.text((x, 150), "Memobun", font=f1, fill=ink)

    fa = ImageFont.truetype(SCRIPT, 62)
    d.text((x + 4, 252), "study together", font=fa, fill=accent)

    f2 = fr(31, "Bold")
    d.text((x, 336), "Focus timer, streaks,", font=f2, fill=sub)
    d.text((x, 376), "and a bakery to decorate.", font=f2, fill=sub)

    img.save(OUT)
    print(f"wrote {OUT}  {img.size[0]}x{img.size[1]}  "
          f"{os.path.getsize(OUT) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
