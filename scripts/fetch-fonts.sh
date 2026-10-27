#!/usr/bin/env bash
# Download the large OFL fonts these examples use (not committed) from google/fonts; checks sha1.
set -euo pipefail
cd "$(dirname "$0")/.."
G=https://github.com/google/fonts/raw/main/ofl
SANS="$G/notosanssc/NotoSansSC%5Bwght%5D.ttf 0a2195ed94416288d4c6ffc6cfcbed27b7043318"
PLEX="$G/ibmplexmono/IBMPlexMono"
JOST="$G/jost/Jost%5Bwght%5D.ttf 90aca5f3bcd075b2894da532c88b168edcb4ce9d"
SERIF="$G/notoserifsc/NotoSerifSC%5Bwght%5D.ttf 4eced3ca8111d4e9221bf8cb76b42965951ed789"
JBMONO="$G/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf bef242b36d905170007caed53cd6a07775dbfb82"
MICHROMA="$G/michroma/Michroma-Regular.ttf 0a7c420d18378e3fb797cfb3407ca743cc50cad9"
KUAILE="$G/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf 39cd8fac42b18c2abbdc7ee041460c37b00fccd9"
HUANGYOU="$G/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf 36d5f22524ec738791e64d78098b580f15086999"
BANGERS="$G/bangers/Bangers-Regular.ttf f5ad4d08a82369a9cb8f8a37a224f2f9d08f8f66"
# A machine-wide cache by sha1 (outside any repo, invisible to the browser): a font is downloaded once and
# cloned (APFS copy-on-write, no extra disk) into every project that needs it.
CACHE="${CUEFRAME_FONT_CACHE:-$HOME/Library/Caches/cueframe/fonts}"
mkdir -p "$CACHE"
while read -r dest url sha; do
  [ -f "$dest" ] && continue
  mkdir -p "$(dirname "$dest")"
  if [ ! -f "$CACHE/$sha" ]; then
    echo "fetch $dest" >&2
    curl -fsSL -o "$CACHE/$sha.part" "$url"
    [ "$(shasum "$CACHE/$sha.part" | cut -d' ' -f1)" = "$sha" ] || { rm -f "$CACHE/$sha.part"; echo "fetch-fonts: sha1 mismatch for $dest" >&2; exit 1; }
    mv "$CACHE/$sha.part" "$CACHE/$sha"
  fi
  cp -c "$CACHE/$sha" "$dest" 2>/dev/null || cp "$CACHE/$sha" "$dest"
done <<LIST
examples/manim-kepler/data/fonts/NotoSansSC.ttf $SANS
examples/r-ascii/data/fonts/NotoSansSC.ttf $SANS
examples/r-promo/data/fonts/NotoSansSC.ttf $SANS
examples/r-algebra/data/fonts/NotoSerifSC.ttf $SERIF
examples/r-gb300/data/fonts/NotoSansSC.ttf $SANS
examples/r-chipdesign/data/fonts/NotoSansSC.ttf $SANS
examples/r-editing-village/data/fonts/NotoSansSC.ttf $SANS
examples/r-editing-village/data/fonts/NotoSerifSC.ttf $SERIF
examples/r-chipdesign/data/fonts/IBMPlexMono-Regular.ttf $PLEX-Regular.ttf 2b7c2393fff41a6e1446fd6351002e1aa1a999e8
examples/r-chipdesign/data/fonts/IBMPlexMono-Medium.ttf $PLEX-Medium.ttf d1246280a315c377a651879047723bab6e3b411e
examples/r-pcb-routing/data/fonts/NotoSansSC.ttf $SANS
examples/r-pcb-routing/data/fonts/IBMPlexMono-Medium.ttf $PLEX-Medium.ttf d1246280a315c377a651879047723bab6e3b411e
examples/utc8-customs/data/fonts/NotoSansSC.ttf $SANS
examples/utc8-customs/data/fonts/NotoSerifSC.ttf $SERIF
examples/survey-of-rain/data/fonts/NotoSerifSC.ttf $SERIF
examples/utc8-customs/data/fonts/Jost.ttf $JOST
examples/utc8-customs/data/fonts/IBMPlexMono-Medium.ttf $PLEX-Medium.ttf d1246280a315c377a651879047723bab6e3b411e
examples/locomotion/data/fonts/JetBrainsMono.ttf $JBMONO
examples/survey-of-rain/data/fonts/JetBrainsMono.ttf $JBMONO
examples/locomotion/data/fonts/Michroma-Regular.ttf $MICHROMA
examples/locomotion/data/fonts/NotoSansSC.ttf $SANS
examples/style-comic/data/fonts/ZCOOLKuaiLe.ttf $KUAILE
examples/style-comic/data/fonts/ZCOOLQingKeHuangYou.ttf $HUANGYOU
examples/style-comic/data/fonts/Bangers.ttf $BANGERS
examples/style-bauhaus/data/fonts/NotoSansSC.ttf $SANS
examples/style-bauhaus/data/fonts/NotoSerifSC.ttf $SERIF
examples/style-bauhaus/data/fonts/Jost.ttf $JOST
LIST
