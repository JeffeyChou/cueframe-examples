#!/usr/bin/env bash
# r-schematic-rain spike: Mixkit footage + music → plates, hits → mp4 → checks.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/r-schematic-rain
cf() { pnpm exec cueframe "$@"; }
bash $P/scripts/fetch-media.sh
[ -f $P/data/music.mp3 ] || curl -fsSL -o $P/data/music.mp3 https://assets.mixkit.co/music/122/122.mp3   # "Slow Rain"
bash scripts/fetch-fonts.sh
(cd $P && uv run -q --with opencv-python-headless --with numpy python -I tools/prep.py clips.json --project .)
(cd $P && uv run -q --project ../../cueframe/python --group analysis python -I tools/hits.py data/music.mp3 --start 25 --dur 12 --out build/hits.json --wav build/music.wav)
cf export $P
cf check determinism $P --quick
