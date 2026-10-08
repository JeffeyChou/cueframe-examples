#!/usr/bin/env bash
# r-algebra: fonts (instance + subset) → stills → sheet → mp4 → checks.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/r-algebra
D=$P/data/film.json
py() { uv run --project python cueframe-py "$@"; }
S=$P/build/fonts-src
[ -f $S/Cinzel-SemiBold.ttf ] || uv run --project python python $P/fonts.py
CJK=$(jq -r '[.question.cn1, .question.cn2, .title.cn, .title.tag, (.subs[] | .cn)] | join("")' $D)
EN=$(jq -r '[.question.en1, .question.en2, (.subs[] | .en)] | join("")' $D)
SYM=$(jq -r '.symbols | join("") | gsub("_"; "")' $D)
for w in Black Bold Medium; do py fonts - $S/NotoSerifSC-$w.ttf --project $P --flavor none --text "$CJK" </dev/null; done
py fonts - $S/Cormorant-Italic.ttf --project $P --flavor none --text "$EN" </dev/null
py fonts - $S/Cinzel-SemiBold.ttf --project $P --flavor none --text "$(jq -r .title.en $D)" </dev/null
py fonts - $P/data/fonts/STIXTwoMath.ttf --project $P --flavor none --text "$SYM" </dev/null
[ "${1:-}" = fonts ] && exit 0
pnpm exec cueframe sheet $P --every 1 --out $P/out/sheet.png
pnpm exec cueframe export $P --out $P/out/r-algebra.mp4
pnpm exec cueframe audit $P
pnpm exec cueframe check determinism $P --gpu swiftshader
