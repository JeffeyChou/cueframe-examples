#!/usr/bin/env bash
# survey-of-rain end to end: Mixkit footage + music → plates with tracks, excerpt + hits → mp4 → checks.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/survey-of-rain
py() { uv run -q --project cueframe/python "$@"; }
cf() { pnpm exec cueframe "$@"; }

bash $P/scripts/fetch-media.sh
bash scripts/fetch-fonts.sh
[ -f $P/data/music.mp3 ] || curl -fsSL -o $P/data/music.mp3 https://assets.mixkit.co/music/122/122.mp3   # "Slow Rain"
py cueframe-py excerpt $P/data/music.mp3 --start 6.86 --dur 59.2 --fade-out 4 --project $P
py --group analysis cueframe-py hits $P/data/music.mp3 --start 6.86 --dur 59.2 --project $P
py --group footage cueframe-py footage $P/clips.json --track 60 --project $P
py cueframe-py fonts - $P/data/fonts/NotoSerifSC.ttf --project $P --text "雨的测绘测绘完毕" </dev/null
cf export $P
cf measure $P/out/landscape.mp4
cf sync $P/out/landscape.mp4 --hits $P/build/hits.json --min 0.5 --kinds kick,snare
cf audit $P
cf check determinism $P
