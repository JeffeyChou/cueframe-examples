#!/usr/bin/env bash
# 周一 (the comic-style demo) end to end: fonts → event cues → bed + foley → mix → mp4 → checks.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/style-comic
py() { uv run --project cueframe/python cueframe-py "$@"; }
cf() { pnpm exec cueframe "$@"; }

bash scripts/fetch-fonts.sh
py fonts - $P/data/fonts/ZCOOLKuaiLe.ttf $P/data/fonts/ZCOOLQingKeHuangYou.ttf $P/data/fonts/Bangers.ttf \
  --project $P --text "$(cat $P/*.ts $P/scenes/*.ts $P/lib/*.ts) 0123456789Z" </dev/null
cf cues $P
py synth $P/score.py --project $P
py mix $P/mix.json --project $P
cf export $P
cf measure $P/out/landscape.mp4
cf audit $P
cf check determinism $P --quick
