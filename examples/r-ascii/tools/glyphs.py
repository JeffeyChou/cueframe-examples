"""Rasterises JetBrains Mono ExtraBold into a coverage atlas for block-letter banners: build/glyphs.json."""
import json, sys, base64
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CHARS = ''.join(chr(c) for c in range(33, 127))
H = 48  # atlas rows per glyph

font = ImageFont.truetype(str(ROOT / 'data/fonts/JetBrainsMono-ExtraBold.woff'), 52)
asc, desc = font.getmetrics()
W = round(font.getlength('M'))
out = {'w': W, 'h': H, 'glyphs': {}}
for c in CHARS:
    im = Image.new('L', (W, asc + desc), 0)
    ImageDraw.Draw(im).text((0, 0), c, font=font, fill=255)
    top = asc - 38  # cap height window
    im = im.crop((0, max(0, top - 2), W, max(0, top - 2) + H))
    out['glyphs'][c] = base64.b64encode(im.tobytes()).decode()
(ROOT / 'build').mkdir(exist_ok=True)
(ROOT / 'build/glyphs.json').write_text(json.dumps(out))
print('glyphs', len(CHARS), 'cell', W, 'x', H, file=sys.stderr)
