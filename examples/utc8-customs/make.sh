#!/usr/bin/env bash
# 东八区海关 end to end: narration (MOSS-TTS on mlx-audio, official voices) → fonts → cues → bed + effects
# → mix → mp4 → checks. Needs ../mlx-audio (with models/moss-tts-local-1.7b-8bit) and ../voices next to
# this repository (see README).
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/utc8-customs
py() { uv run --project cueframe/python cueframe-py "$@"; }
cf() { pnpm exec cueframe "$@"; }

bash scripts/fetch-fonts.sh
uv run --project cueframe/python --group align cueframe-py tts $P/script.json
py fonts - $P/data/fonts/NotoSansSC.ttf $P/data/fonts/NotoSerifSC.ttf $P/data/fonts/Jost.ttf $P/data/fonts/IBMPlexMono-Medium.ttf \
  --project $P --words --text "$(cat $P/storyboard.json $P/script.json $P/*.ts $P/scenes/*.ts) 0123456789−–" </dev/null
cf cues $P                                                    # events of timing.ts → build/page-cues.json
py synth $P/score.py
py mix $P/mix.json --project $P
cf export $P
cf measure $P/out/landscape.mp4
cf audit $P
cf check determinism $P --quick
