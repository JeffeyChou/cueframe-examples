#!/usr/bin/env bash
# Download the footage and music (Mixkit free licenses, not committed) into data/.
set -euo pipefail
cd "$(dirname "$0")/.."
get() { [ -f "$1" ] || { echo "fetch $1" >&2; curl -fsSL --create-dirs -o "$1.part" "$2" && mv "$1.part" "$1"; }; }
while read -r id name; do
  [ -z "$id" ] && continue
  get "data/clips/$name.mp4" "https://assets.mixkit.co/videos/$id/$id-720.mp4"
done <<LIST
45372 puddle
51966 drops
2716 roof
47947 lightning
9317 gulls-sunset
45246 gull-glide
2846 window
6901 lily
LIST
