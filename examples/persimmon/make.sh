#!/usr/bin/env bash
# The last persimmon end to end: events → score → mix → mp4 → checks. brushFrame is the submodule beside
# cueframe/ (or CUEFRAME_BRUSHFRAME).
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/persimmon
cf() { node cueframe/packages/cli/bin/cueframe.js "$@"; }
py() { uv run --project cueframe/python cueframe-py "$@"; }

cf cues $P                      # build/page-cues.json: the picture's event times
py synth $P/score.py            # build/stems/{bed,sfx}.wav, beats.json, spectrum.png
py mix $P/mix.json              # build/audio.wav
cf export $P
cf measure $P/out/landscape.mp4
cf check determinism $P --strict
