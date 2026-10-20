#!/usr/bin/env bash
# Footage (Mixkit Stock Video Free License) and music (Mixkit Stock Music Free License), not committed.
set -euo pipefail
cd "$(dirname "$0")/.."
get() { [ -f "$1" ] || { echo "fetch $1" >&2; curl -fsSL --create-dirs -o "$1.part" "$2" && mv "$1.part" "$1"; }; }
while read -r id name; do
  [ -z "$id" ] && continue
  get "data/clips/$name.mp4" "https://assets.mixkit.co/videos/$id/$id-720.mp4"
done <<LIST
9704 clouds-dark
9624 clouds-moving
47947 lightning-clouds
29354 lightning-cut
45575 lightning-city
45239 waves-storm
5458 city-rain
4331 traffic-night
4332 times-square
27704 cars-rain
20264 lamp-rain
28087 rain-dark
2716 roof
2846 window
28098 screen-rain
45372 puddle
45263 puddle-slow
3897 drops-puddle
51966 drop-macro
2206 leaves
6901 lily
20624 flowers-rain
1324 reflection-men
2455 reflection-house
47251 umbrella-jump
33520 umbrella-girl
18219 umbrella-park
9317 gulls-sunset
45246 gull-glide
9782 flock
30222 gulls-silhouette
4433 moon
1704 night-lake
LIST
[ -f data/fonts/JetBrainsMono.ttf ] || curl -fsSL --create-dirs -o data/fonts/JetBrainsMono.ttf "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
