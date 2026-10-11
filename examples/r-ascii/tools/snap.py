"""Rasterises cell dumps (term/dump.ts) into PNG stills and an optional contact sheet."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
src, outdir = sys.argv[1], Path(sys.argv[2])
outdir.mkdir(parents=True, exist_ok=True)
d = json.load(open(src))
cols, rows = d['cols'], d['rows']
CW, RH = 10, 20
mono = ImageFont.truetype(str(ROOT / 'data/fonts/JetBrainsMono-Regular.woff'), 16)
bold = ImageFont.truetype(str(ROOT / 'data/fonts/JetBrainsMono-ExtraBold.woff'), 16)
cjk = ImageFont.truetype(str(ROOT / 'data/fonts/NotoSansSC.ttf'), 17)
def col(v): return ((v >> 16) & 255, (v >> 8) & 255, v & 255)
BLOCK = {'█': 1, '▓': .7, '▒': .45, '░': .2}
LOW = '▁▂▃▄▅▆▇'
LEFT = '▏▎▍▌▋▊▉'
paths = []
for f in d['frames']:
    im = Image.new('RGB', (cols * CW, rows * RH), (5, 8, 11))
    g = ImageDraw.Draw(im)
    ch = f['ch'].split('\u0001')
    for y in range(rows):
        for x in range(cols):
            i = y * cols + x
            b = f['bg'][i]
            if b >= 0: g.rectangle([x * CW, y * RH, x * CW + CW - 1, y * RH + RH - 1], fill=col(b))
    for y in range(rows):
        for x in range(cols):
            i = y * cols + x
            c = ch[i]
            if c in (' ', ''): continue
            fg = col(f['fg'][i]); px, py = x * CW, y * RH
            if c in BLOCK:
                bgc = col(f['bg'][i]) if f['bg'][i] >= 0 else (5, 8, 11)
                k = BLOCK[c]; fc = tuple(int(bgc[j] + (fg[j] - bgc[j]) * k) for j in range(3))
                g.rectangle([px, py, px + CW - 1, py + RH - 1], fill=fc)
            elif c in LOW:
                h = (LOW.index(c) + 1) / 8 * RH; g.rectangle([px, py + RH - h, px + CW - 1, py + RH - 1], fill=fg)
            elif c in LEFT:
                w = (LEFT.index(c) + 1) / 8 * CW; g.rectangle([px, py, px + w, py + RH - 1], fill=fg)
            elif c == '▀': g.rectangle([px, py, px + CW - 1, py + RH // 2 - 1], fill=fg)
            elif c == '▄': g.rectangle([px, py + RH // 2, px + CW - 1, py + RH - 1], fill=fg)
            elif ord(c) >= 0x2e80: g.text((px, py + 1), c, font=cjk, fill=fg)
            else: g.text((px, py + 1), c, font=bold if f['at'][i] & 1 else mono, fill=fg)
    p = outdir / f"t{f['t']:07.2f}.png"
    im.save(p); paths.append(p)
if len(sys.argv) > 3:
    ims = [Image.open(p) for p in paths]
    w, h = ims[0].size; s = 0.5; n = int(sys.argv[3])
    tw, th = int(w * s), int(h * s)
    rows_ = (len(ims) + n - 1) // n
    sheet = Image.new('RGB', (n * tw + (n + 1) * 8, rows_ * (th + 26) + 8), (18, 18, 18))
    dg = ImageDraw.Draw(sheet)
    for k, (im, f) in enumerate(zip(ims, d['frames'])):
        x, y = 8 + (k % n) * (tw + 8), 8 + (k // n) * (th + 26)
        sheet.paste(im.resize((tw, th)), (x, y)); dg.text((x, y + th + 4), f"t={f['t']:.2f}s  {f['ms']:.1f}ms", font=mono, fill=(220, 220, 220))
    sheet.save(outdir / 'sheet.png')
print('\n'.join(str(p) for p in paths))
