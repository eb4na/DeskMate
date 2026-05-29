#!/usr/bin/env python3
"""Remove baked-in gray checkerboard from companion PNGs (edge flood-fill)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'assets/images/companion/main-character.png'


def is_bg(r: int, g: int, b: int, a: int = 255) -> bool:
    if a == 0:
        return True
    if max(r, g, b) - min(r, g, b) > 12:
        return False
    return r >= 236 and g >= 236 and b >= 236


def strip_checkerboard(path: Path) -> None:
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()

    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(*px[x, y][:3], px[x, y][3]):
                i = y * w + x
                if not visited[i]:
                    visited[i] = 1
                    q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(*px[x, y][:3], px[x, y][3]):
                i = y * w + x
                if not visited[i]:
                    visited[i] = 1
                    q.append((x, y))

    while q:
        x, y = q.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not visited[i]:
                    nr, ng, nb, na = px[nx, ny]
                    if is_bg(nr, ng, nb, na):
                        visited[i] = 1
                        q.append((nx, ny))

    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if max(r, g, b) - min(r, g, b) <= 10 and r >= 232:
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        px[x, y] = (r, g, b, 0)
                        break

    im.save(path, 'PNG')


if __name__ == '__main__':
    strip_checkerboard(TARGET)
    print(f'Updated {TARGET}')
