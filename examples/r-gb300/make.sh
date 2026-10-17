#!/usr/bin/env bash
# r-gb300: plates (Blender) → fonts → stills → mp4 → checks. `make.sh draft` stops after draft plates.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/r-gb300
py() { uv run --project cueframe/python cueframe-py "$@"; }
bash scripts/fetch-fonts.sh                                   # NotoSansSC is not committed
for shot in rack tray scale; do                               # EEVEE drafts: seconds per shot
  py blender $P/blender/$shot.py --shot $shot --deps $P/blender/model.py
done
py fonts - $P/data/fonts/NotoSansSC.ttf --project $P --text "$(cat $P/*.ts $P/scenes/*.ts) 0123456789,.·×：，。（）／/% TFLOPSLOG" </dev/null
[ "${1:-}" = draft ] && exit 0
for shot in rack tray scale; do                               # Cycles finals: about 15 minutes on an M-series GPU
  py blender $P/blender/$shot.py --shot $shot --quality final --deps $P/blender/model.py
done
pnpm exec cueframe sheet $P --every 1.5 --out $P/out/sheet.png
pnpm exec cueframe export $P --out $P/out/r-gb300.mp4
pnpm exec cueframe audit $P
pnpm exec cueframe check determinism $P
