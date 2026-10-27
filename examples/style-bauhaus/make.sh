#!/usr/bin/env bash
# 方圆 (the Bauhaus-fable demo) end to end: fonts → event cues → bed + foley → mix → mp4 → checks.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/style-bauhaus
py() { uv run --project cueframe/python cueframe-py "$@"; }
cf() { pnpm exec cueframe "$@"; }

bash scripts/fetch-fonts.sh
py fonts - $P/data/fonts/NotoSansSC.ttf $P/data/fonts/NotoSerifSC.ttf $P/data/fonts/Jost.ttf \
  --project $P --text "$(cat $P/*.ts $P/scenes/*.ts kits/bauhaus.ts) 0123456789" </dev/null
cf cues $P
py synth $P/score.py --project $P
py mix $P/mix.json --project $P
cf export $P
cf measure $P/out/landscape.mp4
cf audit $P
cf check determinism $P --quick
