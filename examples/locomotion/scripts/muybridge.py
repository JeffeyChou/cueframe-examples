"""Muybridge, The Horse in Motion (1878, public domain): cut the card into its 12 cells and crop the horse.

Usage: uv run --with pillow --with numpy python -I scripts/muybridge.py data/muybridge
Reads <dir>/card.jpg (Wikimedia Commons "The Horse in Motion high res.jpg"), writes <dir>/f01.png ..
f11.png (the gallop, cells 1-11 in order), <dir>/stand.png (cell 12, the mare standing) and
<dir>/frames.json (grid, crop boxes in card pixels, frame order). Every crop has the same size: the
same rows of each cell (below the printed ruler digits, above the cell numbers) and a fixed width
centred on the silhouette. Grayscale, levels stretched per frame from the 1st to the 99.5th percentile.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

TOP, BOTTOM = 72, 778      # crop rows inside a cell: under the ruler digits, over the cell number
WIDTH = 1060               # crop width, centred on the silhouette
DARK = 70                  # silhouette threshold (0..255)
FIND = 640                 # rows searched for the silhouette (above the track lines)
INSET = 24                 # columns ignored at each cell edge (separator residue)


def runs(mask, min_len):
    out, start = [], None
    for i, v in enumerate(list(mask) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    return out


def separators(profile, min_len=20):
    return runs(profile < 60, min_len)


def main(folder):
    d = Path(folder)
    card = Image.open(d / 'card.jpg').convert('L')
    a = np.asarray(card).astype(np.float32)
    h, w = a.shape
    cols = separators(a[int(h * 0.1):int(h * 0.75)].mean(0))
    rows = separators(a[:, int(w * 0.05):int(w * 0.95)].mean(1))
    if len(cols) != 5 or len(rows) != 4:
        raise SystemExit(f'muybridge: expected a 4x3 grid, found {len(cols) - 1}x{len(rows) - 1} cells')
    cells = [(cols[c][1], rows[r][1], cols[c + 1][0], rows[r + 1][0]) for r in range(3) for c in range(4)]

    frames = []
    for n, (x0, y0, x1, y1) in enumerate(cells, 1):
        cell = a[y0 + TOP:y0 + BOTTOM, x0:x1]
        dark = cell[:FIND - TOP] < DARK
        dark[:, :INSET] = dark[:, -INSET:] = False
        bx0, bx1 = max(runs(dark.mean(0) > 0.02, 3), key=lambda r: r[1] - r[0])
        by0, by1 = max(runs(dark[:, bx0:bx1].mean(1) > 0.02, 3), key=lambda r: r[1] - r[0])
        cx = x0 + (bx0 + bx1) // 2
        left = int(min(max(cx - WIDTH // 2, x0), x1 - WIDTH))
        box = [left, y0 + TOP, WIDTH, BOTTOM - TOP]
        if bx0 + x0 < left or bx1 + x0 > left + WIDTH:
            print(f'muybridge: cell {n}: silhouette {bx0 + x0}..{bx1 + x0} wider than the crop', file=sys.stderr)
        crop = a[box[1]:box[1] + box[3], box[0]:box[0] + box[2]]
        lo, hi = np.percentile(crop, [1, 99.5])
        out = np.clip((crop - lo) * 255.0 / max(hi - lo, 1), 0, 255).astype(np.uint8)
        name = f'f{n:02d}.png' if n <= 11 else 'stand.png'
        Image.fromarray(out).save(d / name, optimize=True)
        frames.append({'file': name, 'cell': n, 'box': box,
                       'silhouette': [int(x0 + bx0), int(y0 + TOP + by0), int(bx1 - bx0), int(by1 - by0)],
                       'levels': [round(float(lo), 1), round(float(hi), 1)]})

    meta = {
        'source': 'https://commons.wikimedia.org/wiki/File:The_Horse_in_Motion_high_res.jpg',
        'credit': 'Eadweard Muybridge, The Horse in Motion, 1878 (public domain)',
        'card': [w, h],
        'grid': {'cols': 4, 'rows': 3, 'cells': [list(map(int, c)) for c in cells]},
        'size': [WIDTH, BOTTOM - TOP],
        'order': [f['file'] for f in frames if f['cell'] <= 11],
        'note': 'f01..f11 are the gallop (cells 1-11, one stride); stand.png is cell 12, the mare at rest. '
                'box and silhouette are [x, y, w, h] in card pixels.',
        'frames': frames,
    }
    (d / 'frames.json').write_text(json.dumps(meta, indent=1) + '\n')
    print(f'muybridge: {len(meta["order"])} gallop frames + stand, {WIDTH}x{BOTTOM - TOP}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'data/muybridge')
