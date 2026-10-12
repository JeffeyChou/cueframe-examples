#!/usr/bin/env bash
# manim-kepler end to end: narration (IndexTTS, cloned voice) → subtitle font → score → mix →
# schedule audio → mp4 → checks. Needs ../index-tts and ../voices next to this repo (see README).
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/manim-kepler
py() { uv run --project python cueframe-py "$@"; }
cf() { pnpm exec cueframe "$@"; }

FONT=$P/data/fonts/NotoSansSC.ttf
scripts/fetch-fonts.sh                                  # large OFL fonts are not committed

py tts $P/script.json                                   # build/vo, words.json, cues.json (cached per line)
py fonts $P/glyphs.txt $FONT --words
py synth $P/score.py                                    # build/stems/{bed,sfx}.wav
py mix $P/mix.json                                      # build/audio.wav (voice + ducked bed + accents)
cf cues $P                                              # build/schedule.json
py schedule-audio --project $P                          # build/audio.schedule.wav
cf export $P
cf measure $P/out/landscape.mp4
cf audit $P
