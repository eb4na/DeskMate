#!/usr/bin/env python3
"""Remove background from main-character.png (keeps desk + full scene)."""
from __future__ import annotations

import io
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    os.environ.get(
        'SOURCE_IMAGE',
        '/Users/ebanalin/.cursor/projects/Users-ebanalin-DeskMate/assets/'
        'ChatGPT_Image_May_28__2026__09_09_34_PM-c883080a-7f88-4c77-aab0-1e24dc2e607c.png',
    ),
)
DEST = ROOT / 'assets/images/companion/main-character.png'


def soften_white_fringe(image: Image.Image) -> Image.Image:
    px = image.load()
    w, h = image.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                px[x, y] = (0, 0, 0, 0)
                continue
            if a > 200 and r > 228 and g > 228 and b > 228:
                px[x, y] = (r, g, b, max(0, a - 180))
    return image


def remove_with_rembg(source: Path) -> Image.Image:
    session = new_session('isnet-general-use')
    with source.open('rb') as image_file:
        result = remove(image_file.read(), session=session)
    return soften_white_fringe(Image.open(io.BytesIO(result)).convert('RGBA'))


def remove_with_remove_bg(source: Path, api_key: str) -> Image.Image:
    boundary = '----DeskMateBoundary7MA4YWxkTrZu0gW'
    body = bytearray()
    for name, value in (
        ('size', 'auto'),
        ('format', 'png'),
        ('type', 'graphics'),
        ('semitransparency', 'true'),
    ):
        body.extend(f'--{boundary}\r\n'.encode())
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.extend(f'{value}\r\n'.encode())

    image_bytes = source.read_bytes()
    body.extend(f'--{boundary}\r\n'.encode())
    body.extend(
        b'Content-Disposition: form-data; name="image_file"; filename="source.png"\r\n'
        b'Content-Type: image/png\r\n\r\n',
    )
    body.extend(image_bytes)
    body.extend(f'\r\n--{boundary}--\r\n'.encode())

    request = urllib.request.Request(
        'https://api.remove.bg/v1.0/removebg',
        data=bytes(body),
        headers={
            'X-Api-Key': api_key,
            'Content-Type': f'multipart/form-data; boundary={boundary}',
        },
        method='POST',
    )

    with urllib.request.urlopen(request, timeout=120) as response:
        return soften_white_fringe(Image.open(io.BytesIO(response.read())).convert('RGBA'))


def composite_rembg_with_desk(source: Path) -> Image.Image:
    """Clean rembg edges on character; restore desk/props from white-edge pass."""
    from collections import deque

    white_image = remove_white_edges_only(source)
    rembg_image = remove_with_rembg(source)
    width, height = white_image.size
    output = Image.new('RGBA', (width, height))
    rembg_pixels = rembg_image.load()
    white_pixels = white_image.load()
    output_pixels = output.load()

    for y in range(height):
        for x in range(width):
            r1, g1, b1, a1 = rembg_pixels[x, y]
            r2, g2, b2, a2 = white_pixels[x, y]
            if a1 > 24:
                output_pixels[x, y] = (r1, g1, b1, a1)
            elif a2 > 24:
                output_pixels[x, y] = (r2, g2, b2, a2)
            else:
                output_pixels[x, y] = (0, 0, 0, 0)

    return soften_white_fringe(output)


def remove_white_edges_only(source: Path) -> Image.Image:
    """Keeps full illustration (desk + props); only removes connected white backdrop."""
    from collections import deque

    image = Image.open(source).convert('RGBA')
    w, h = image.size
    px = image.load()

    def is_white_bg(r: int, g: int, b: int, a: int = 255) -> bool:
        if a < 20:
            return True
        if max(r, g, b) - min(r, g, b) > 14:
            return False
        return r >= 242 and g >= 242 and b >= 242

    visited = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_white_bg(*px[x, y][:4]):
                index = y * w + x
                if not visited[index]:
                    visited[index] = 1
                    queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_white_bg(*px[x, y][:4]):
                index = y * w + x
                if not visited[index]:
                    visited[index] = 1
                    queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                index = ny * w + nx
                if not visited[index] and is_white_bg(*px[nx, ny][:4]):
                    visited[index] = 1
                    queue.append((nx, ny))

    return soften_white_fringe(image)


def main() -> None:
    if not SOURCE.exists():
        print(f'Source image not found: {SOURCE}', file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get('REMOVE_BG_API_KEY', '').strip()
    mode = os.environ.get('REMOVE_BG_MODE', 'composite').strip().lower()

    if api_key and mode == 'graphics':
        print('Using remove.bg (graphics mode)...')
        image = remove_with_remove_bg(SOURCE, api_key)
    elif api_key and mode == 'auto':
        print('Using remove.bg (auto mode)...')
        image = remove_with_remove_bg(SOURCE, api_key)
    elif mode == 'rembg':
        print('Using rembg isnet-general-use...')
        image = remove_with_rembg(SOURCE)
    elif mode == 'white-edge':
        print('Using white-edge removal (keeps desk + full scene)...')
        image = remove_white_edges_only(SOURCE)
    else:
        print('Using rembg + desk composite (default)...')
        image = composite_rembg_with_desk(SOURCE)

    DEST.parent.mkdir(parents=True, exist_ok=True)
    image.save(DEST, 'PNG')
    print(f'Saved {DEST} ({image.size[0]}x{image.size[1]})')


if __name__ == '__main__':
    main()
