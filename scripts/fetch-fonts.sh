#!/usr/bin/env bash
# Download the large OFL fonts these examples use (not committed) from google/fonts; checks sha1.
set -euo pipefail
cd "$(dirname "$0")/.."
G=https://github.com/google/fonts/raw/main/ofl
SANS="$G/notosanssc/NotoSansSC%5Bwght%5D.ttf 0a2195ed94416288d4c6ffc6cfcbed27b7043318"
SERIF="$G/notoserifsc/NotoSerifSC%5Bwght%5D.ttf 4eced3ca8111d4e9221bf8cb76b42965951ed789"
while read -r dest url sha; do
  [ -f "$dest" ] && continue
  echo "fetch $dest" >&2
  curl -fsSL --create-dirs -o "$dest.part" "$url"
  [ "$(shasum "$dest.part" | cut -d' ' -f1)" = "$sha" ] || { rm -f "$dest.part"; echo "fetch-fonts: sha1 mismatch for $dest" >&2; exit 1; }
  mv "$dest.part" "$dest"
done <<LIST
examples/manim-kepler/data/fonts/NotoSansSC.ttf $SANS
examples/r-ascii/data/fonts/NotoSansSC.ttf $SANS
examples/r-promo/data/fonts/NotoSansSC.ttf $SANS
examples/r-algebra/data/fonts/NotoSerifSC.ttf $SERIF
LIST
