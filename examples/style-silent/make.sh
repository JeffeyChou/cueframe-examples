#!/usr/bin/env bash
# 市场街 1906 (the silent-film demo) end to end: footage → plates → fonts → event cues → score → mix →
# credits → mp4 → checks. The score plays a sampled upright: `cueframe-py instruments fetch vsco2ce` once.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=examples/style-silent
py() { uv run --project cueframe/python --group instruments cueframe-py "$@"; }
cf() { pnpm exec cueframe "$@"; }

# 25 s of the Library of Congress access copy (public domain; data/sources.json), seeked over HTTP so
# the 227 MB file is never downloaded whole. Never committed.
LOC=https://tile.loc.gov/storage-services/service/mbrs/ntscrm/00015143/00015143.mp4
if [ ! -f $P/data/clips/market.mp4 ]; then
  mkdir -p $P/data/clips
  ffmpeg -v error -y -user_agent 'cueframe-examples (style-silent)' -ss 455 -i "$LOC" -t 25 -an \
    -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -movflags +faststart $P/data/clips/market.part.mp4
  mv $P/data/clips/market.part.mp4 $P/data/clips/market.mp4
fi
py footage $P/clips.json --project $P --fps 24 --size 1440x1080

bash scripts/fetch-fonts.sh
py fonts - $P/data/fonts/NotoSerifSC.ttf --project $P --text "$(cat $P/*.ts $P/scenes/*.ts) 0123456789" </dev/null
cf cues $P
py synth $P/score.py --project $P
py mix $P/mix.json --project $P
py credits --project $P
cf export $P
cf measure $P/out/landscape.mp4
cf audit $P
cf check determinism $P --quick
