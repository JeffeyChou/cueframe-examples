#!/usr/bin/env bash
# r-promo: narration → cues → score → mix → schedule audio → mp4 + covers → checks.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/r-promo
py() { uv run --project python cueframe-py "$@"; }
mkdir -p $P/build
jq -s '.[0] + {cues: .[1]}' $P/data/script.json $P/cues.json > $P/build/script.json
py tts $P/build/script.json --project $P
scripts/fetch-fonts.sh                                  # NotoSansSC is not committed
py fonts - $P/data/fonts/NotoSansSC.ttf $P/data/fonts/JBM-Bold.ttf --project $P --words --text "$(cat $P/*.ts $P/scenes/*.ts)" </dev/null
pnpm exec cueframe cues $P
py synth $P/score.py
py mix $P/mix.json
py schedule-audio --project $P
pnpm exec cueframe export $P --out $P/out/r-promo.mp4
pnpm exec cueframe stills $P --holds cover --out $P/out/covers && cp $P/out/covers/vertical-hold-cover.png $P/out/cover-9x16.png
pnpm exec cueframe stills $P --holds cover --format cover34 --out $P/out/covers && cp $P/out/covers/cover34-hold-cover.png $P/out/cover-3x4.png
pnpm exec cueframe audit $P
pnpm exec cueframe check determinism $P --gpu swiftshader
pnpm exec cueframe measure $P/out/r-promo.mp4
