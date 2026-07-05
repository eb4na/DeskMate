#!/usr/bin/env python3
"""
Render the companion SIZE CHART — every character side by side at the exact height
the study room will show, so the HEIGHT_LADDER can be dialed by eye.

Run from the repo root:  python3 scripts/render-height-chart.py
Output:                  scripts/height-chart.png

Row 1  — the cast lineup (classic skins) on a shared floor line, with the study
         room's desk band (bottom ~31% hidden) and a dashed guide at Bunny's head.
Row 2+ — one row per companion showing ALL its skins: after normalization these
         must be equal height (catches a mis-measured skin).

Numbers come from the app's single sources of truth — HEIGHT_LADDER is parsed out
of src/lib/figure-height.ts and the art is re-measured live (same function the
calibration generator uses) — so what this chart shows is what the app renders.
Tuning loop: edit HEIGHT_LADDER → re-run this script → the app already matches.
"""
import importlib.util
import os
import re

from PIL import Image, ImageDraw, ImageFont

# Share discover_images()/measure() with the calibration generator (hyphenated
# filename, so a plain `import` can't load it).
_spec = importlib.util.spec_from_file_location(
    'measure_figure_heights', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'measure-figure-heights.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
discover_images, measure = _mod.discover_images, _mod.measure

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LADDER_TS = os.path.join(ROOT, 'src', 'lib', 'figure-height.ts')
OUT_PNG = os.path.join(ROOT, 'scripts', 'height-chart.png')

BOX = 360          # the shared square render box, like the app's (px per column)
DESK_FRAC = 0.31   # fraction of the box hidden behind the desk (solo scene)
LABEL_H = 78
PAD = 28

NAMES = {
    'bun': 'Bun', 'companion_cocoa': 'Cocoa', 'companion_bunny': 'Bunny',
    'companion_honey': 'Miel', 'companion_tira': 'Tira', 'hanji': 'Hanji',
}
LINEUP = ['bun', 'companion_cocoa', 'companion_bunny', 'companion_honey', 'companion_tira', 'hanji']

CREAM, BROWN, PINK = (255, 250, 243), (120, 90, 70), (228, 138, 154)


def load_ladder() -> dict[str, float]:
    src = open(LADDER_TS, encoding='utf-8').read()
    block = re.search(r'HEIGHT_LADDER[^=]*= \{(.*?)\n\};', src, re.S).group(1)
    return {k: float(v) for k, v in re.findall(r'(\w+): ([\d.]+),', block)}


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', size)
    except OSError:
        return ImageFont.load_default()


def paste_figure(canvas: Image.Image, path: str, key: str, ladder: dict[str, float],
                 ref: tuple[float, float], col_x: int, floor_y: int) -> None:
    """Paste one figure exactly as the app renders it: contain-fit into BOX, then
    the calibration scale about the feet, content bottom landing on the shared
    baseline (ref pad above the floor)."""
    companion = key.split('/')[0]
    fill, pad = measure(path)
    scale = (ref[0] * ladder[companion]) / fill
    im = Image.open(os.path.join(ROOT, path)).convert('RGBA')
    w, h = im.size
    s = (BOX * min(1.0 / w, 1.0 / h)) * scale  # final px per source px
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    # Content bottom sits ref-pad above the box bottom (the floor line).
    alpha = im.getchannel('A')
    y1 = alpha.getbbox()[3]  # content bottom in the resized image
    top = floor_y - round(ref[1] * BOX) - y1
    canvas.alpha_composite(im, (col_x + (BOX - im.width) // 2, top))


def draw_row(canvas: Image.Image, draw: ImageDraw.ImageDraw, entries: list[tuple[str, str, str]],
             ladder: dict[str, float], ref: tuple[float, float], y: int,
             sublabel, desk: bool) -> None:
    floor_y = y + BOX
    for i, (key, path, label) in enumerate(entries):
        x = PAD + i * BOX
        paste_figure(canvas, path, key, ladder, ref, x, floor_y)
        draw.text((x + BOX / 2, floor_y + 14), label, font=font(30), fill=BROWN, anchor='ma')
        sub = sublabel(key)
        if sub:
            draw.text((x + BOX / 2, floor_y + 50), sub, font=font(22), fill=(170, 140, 120), anchor='ma')
    row_w = len(entries) * BOX
    if desk:  # translucent desk band over what the study room hides
        band = Image.new('RGBA', (row_w, round(DESK_FRAC * BOX)), (222, 184, 158, 175))
        canvas.alpha_composite(band, (PAD, floor_y - band.height))
    draw.line([(PAD, floor_y), (PAD + row_w, floor_y)], fill=BROWN, width=3)
    # Dashed guide at Bunny's head height (the reference the ladder is relative to).
    guide_y = floor_y - round((ref[1] + ref[0]) * BOX)
    for x in range(PAD, PAD + row_w, 24):
        draw.line([(x, guide_y), (x + 12, guide_y)], fill=PINK, width=3)


def main() -> None:
    ladder = load_ladder()
    images = discover_images()
    ref = measure(images['companion_bunny/classic'])

    # Row 1: the classic-skin lineup; rows 2+: each companion's full wardrobe.
    lineup = [(f'{c}/classic', images[f'{c}/classic'], NAMES[c]) for c in LINEUP]
    wardrobe_rows = []
    for c in LINEUP:
        skins = sorted(k for k in images if k.startswith(f'{c}/'))
        if len(skins) > 1:
            wardrobe_rows.append((NAMES[c], [(k, images[k], k.split('/')[1]) for k in skins]))

    row_h = BOX + LABEL_H
    width = PAD * 2 + max(len(lineup), *(len(r[1]) for r in wardrobe_rows)) * BOX
    height = PAD + 60 + row_h + sum(56 + row_h for _ in wardrobe_rows) + PAD
    canvas = Image.new('RGBA', (width, height), CREAM + (255,))
    draw = ImageDraw.Draw(canvas)

    def pct(key: str) -> str:
        companion = key.split('/')[0]
        return f'{ladder[companion]:.2f}  ({ladder[companion] * 100:.0f}% of Bunny)'

    draw.text((PAD, PAD), 'Height ladder — edit HEIGHT_LADDER in src/lib/figure-height.ts, then re-run', font=font(26), fill=BROWN)
    y = PAD + 60
    draw_row(canvas, draw, lineup, ladder, ref, y, pct, desk=True)
    y += row_h
    for name, entries in wardrobe_rows:
        draw.text((PAD, y + 14), f'{name} — all outfits (must be equal height)', font=font(26), fill=BROWN)
        y += 56
        draw_row(canvas, draw, entries, ladder, ref, y, lambda k: '', desk=False)
        y += row_h

    canvas.convert('RGB').save(OUT_PNG)
    print(f'Wrote {os.path.relpath(OUT_PNG, ROOT)} ({width}x{height})')


if __name__ == '__main__':
    main()
