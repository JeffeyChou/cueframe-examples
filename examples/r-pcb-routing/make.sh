#!/usr/bin/env bash
# r-pcb-routing end to end: chiptune bed → narration on its bars (IndexTTS, cloned voice) → fonts → SFX → mix → mp4 → checks.
# Needs ../index-tts and ../voices next to this repository (see README).
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/r-pcb-routing
py() { uv run --project cueframe/python cueframe-py "$@"; }
cf() { pnpm exec cueframe "$@"; }

bash scripts/fetch-fonts.sh                                   # Noto Sans SC and Plex Mono are not committed
py synth $P/bed.py --project $P --duration 50                # music first: build/stems/bed.wav + build/beats.json
uv run --project cueframe/python --group align cueframe-py tts $P/script.json   # wavs, Whisper word times, lines placed on the bed's bars
py fonts - $P/data/fonts/NotoSansSC.ttf --project $P --text "$(cat $P/script.json $P/*.ts $P/scenes/*.ts) 0123456789" </dev/null
cf cues $P                                                    # timing.ts events → build/page-cues.json
py synth $P/score.py --project $P                            # build/stems/sfx.wav on the picture's events
py mix $P/mix.json --project $P                               # build/audio.wav: voice over ducked bed, −16 LUFS
cf sheet $P --every 2 --out $P/out/sheet.png
cf export $P
cf measure $P/out/landscape.mp4
cf audit $P
cf check determinism $P
