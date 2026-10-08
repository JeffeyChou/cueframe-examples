"""Instance the variable OFL fonts at the weights the film uses → build/fonts-src/*.ttf."""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

here = Path(__file__).parent
src, out = here / 'data' / 'fonts', here / 'build' / 'fonts-src'
out.mkdir(parents=True, exist_ok=True)
for file, name, wght in [
    ('NotoSerifSC.ttf', 'NotoSerifSC-Black', 900),
    ('NotoSerifSC.ttf', 'NotoSerifSC-Bold', 700),
    ('NotoSerifSC.ttf', 'NotoSerifSC-Medium', 500),
    ('CormorantGaramond-Italic.ttf', 'Cormorant-Italic', 500),
    ('Cinzel.ttf', 'Cinzel-SemiBold', 600),
]:
    f = instantiateVariableFont(TTFont(src / file), {'wght': wght}, updateFontNames=False)
    f.save(out / f'{name}.ttf')
    print(out / f'{name}.ttf', file=sys.stderr)
