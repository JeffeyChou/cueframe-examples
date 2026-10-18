#!/usr/bin/env bash
# r-editing-village end to end: narration (IndexTTS, cloned voice) → fonts → bed + effects → mix → mp4 → checks.
# Needs ../index-tts and ../voices next to this repository (see README).
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/r-editing-village
py() { uv run --project cueframe/python cueframe-py "$@"; }
cf() { pnpm exec cueframe "$@"; }

bash scripts/fetch-fonts.sh
uv run --project cueframe/python --group align cueframe-py tts $P/script.json
py fonts - $P/data/fonts/NotoSansSC.ttf $P/data/fonts/NotoSerifSC.ttf --project $P --words \
  --text "$(cat $P/script.json $P/*.ts $P/scenes/*.ts) 0123456789" </dev/null
cf cues $P                                                    # events of timing.ts → build/page-cues.json
py synth $P/score.py
py mix $P/mix.json --project $P
cf sheet $P --every 2 --out $P/out/sheet.png
cf export $P
cf measure $P/out/landscape.mp4
cf audit $P
cf check determinism $P --quick
