#!/usr/bin/env bash
# 雨停了 (the risograph demo) end to end: fonts → event cues → score → mix → mp4 → checks.
# The score plays sampled instruments: `cueframe-py instruments fetch vcsl karoryfer` once.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/style-riso
py() { uv run --project cueframe/python --group instruments cueframe-py "$@"; }
cf() { pnpm exec cueframe "$@"; }

bash scripts/fetch-fonts.sh
py fonts - $P/data/fonts/NotoSansSC.ttf $P/data/fonts/Jost.ttf \
  --project $P --text "$(cat $P/*.ts $P/scenes/*.ts) 0123456789" </dev/null
cf cues $P
py synth $P/score.py --project $P
py mix $P/mix.json --project $P
py credits --project $P
cf export $P
cf measure $P/out/landscape.mp4
cf audit $P
cf check determinism $P --quick
