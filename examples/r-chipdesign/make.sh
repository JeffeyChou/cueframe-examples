#!/usr/bin/env bash
# r-chipdesign end to end: narration (IndexTTS, cloned voice) → fonts → voice mix → mp4 → checks.
# Needs ../index-tts and ../voices next to this repository (see README).
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/r-chipdesign
py() { uv run --project cueframe/python cueframe-py "$@"; }
cf() { pnpm exec cueframe "$@"; }

bash scripts/fetch-fonts.sh                                   # Noto Sans SC and Plex Mono are not committed
uv run --project cueframe/python --group align cueframe-py tts $P/script.json   # wavs, then Whisper word times (cached per line)
py fonts - $P/data/fonts/NotoSansSC.ttf --project $P --text "$(cat $P/script.json $P/*.ts $P/scenes/*.ts) 0123456789" </dev/null
py mix $P/mix.json --project $P                               # build/audio.wav: voice only, −16 LUFS
py blender $P/blender/die.py --shot die --quality final --engine eevee   # the 3D die: EEVEE, about 2 minutes
cf sheet $P --every 2.5 --out $P/out/sheet.png
cf export $P
cf measure $P/out/landscape.mp4
cf audit $P
cf check determinism $P --quick
