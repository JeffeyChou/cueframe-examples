#!/usr/bin/env bash
# locomotion end to end: Mixkit footage + music, Muybridge card, three.js models → plates, excerpt + hits + envelopes → mp4 → checks.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/locomotion
py() { uv run -q --project cueframe/python "$@"; }
cf() { pnpm exec cueframe "$@"; }

bash $P/scripts/fetch-media.sh
bash scripts/fetch-fonts.sh
py cueframe-py fonts - $P/data/fonts/NotoSansSC.ttf --project $P --text "每一台机器，都记得一种动物" </dev/null
[ -f $P/data/music.mp3 ] || curl -fsSL -o $P/data/music.mp3 https://assets.mixkit.co/music/369/369.mp3   # "Need for speed", Arulo
uv run -q --with pillow --with numpy python -I $P/scripts/muybridge.py $P/data/muybridge
node $P/scripts/models-info.mjs
py cueframe-py excerpt $P/data/music.mp3 --start 6.43 --dur 63.6 --cut 53.149:58.292 --fade-out 1.9 --mode auto --peak -2.5 --project $P
py --group analysis cueframe-py hits $P/data/music.mp3 --start 6.43 --dur 63.6 --cut 53.149:58.292 --project $P
py cueframe-py analyze $P/build/music.wav --no-beats --project $P
py --group footage cueframe-py footage $P/clips.json --grid 32 --project $P
cf export $P
cf measure $P/out/landscape.mp4
cf sync $P/out/landscape.mp4 --hits $P/build/hits.json --min 0.5 --kinds kick,snare
cf audit $P
cf check determinism $P
