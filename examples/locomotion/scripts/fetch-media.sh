#!/usr/bin/env bash
# Footage from Mixkit (Stock Video Free License, or Restricted License where marked) and music
# (Mixkit Stock Music Free License), the Muybridge card and the three.js models; none committed.
set -euo pipefail
cd "$(dirname "$0")/.."
get() { [ -f "$1" ] || { echo "fetch $1" >&2; curl -fsSL -A "cueframe-examples (https://github.com)" --create-dirs -o "$1.part" "$2" && mv "$1.part" "$1"; }; }
# Lines: id name [url]; newer clips only resolve through their active_storage url.
while read -r id name url _; do
  [ -z "$id" ] && continue
  case "$url" in http*) ;; *) url="https://assets.mixkit.co/videos/$id/$id-720.mp4" ;; esac
  get "data/clips/$name.mp4" "$url"
done <<LIST
63 car-macro
49 car-pan
74 car-rear
52427 car-road
64 dash-accel
2026 tunnel-dark
50989 night-drive
1706 eagle-glide
4406 shark
1489 chameleon
1541 cat-black
1157 horse-white
100645 horse-eye https://assets.mixkit.co/active_storage/video_items/100645/1730328549/100645-video-720.mp4
15829 horses-run # restricted
46807 rider-beach # restricted
48445 dragonfly-grass # restricted
48444 dragonfly-pollen # restricted
11061 cheetah-hunt # restricted
48820 eagle-eye # restricted
11393 owl-eye # restricted
6736 lion-head # restricted
LIST
# Muybridge, The Horse in Motion (1878, public domain), via Wikimedia Commons.
get data/muybridge/card.jpg "https://upload.wikimedia.org/wikipedia/commons/d/d2/The_Horse_in_Motion_high_res.jpg"
# three.js r186 example models: ferrari.glb (vicent091036, CC BY 4.0); Horse/Stork/Parrot/Flamingo
# (ro.me "3 Dreams of Black", CC BY-NC-SA 3.0).
for f in ferrari.glb ferrari_ao.png Horse.glb Stork.glb Parrot.glb Flamingo.glb; do
  get "data/models/$f" "https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/models/gltf/$f"
done
# ferrari.glb is Draco-compressed: the decoder comes from the installed three
mkdir -p data/draco && cp ../../node_modules/three/examples/jsm/libs/draco/gltf/draco_{decoder.js,decoder.wasm,wasm_wrapper.js} data/draco/
