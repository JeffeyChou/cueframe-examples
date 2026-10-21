# LOCOMOTION · 每一台机器，都记得一种动物

A 58.5 s ASCII / three.js rhythm cut on one idea: a car's design borrows from animals. Muybridge's
1878 gallop becomes a three.js horse, then 60 000 surface points that flow into a red Ferrari. Four
chapters follow, each with one animal: FELIS (the haunch), OCULUS (the face), SQUALUS (the skin) and
ALA (the air). In each, a red trace drawn on the animal survives the cut and lands on the same
feature of the car. CHIMERA puts every trace on one car; its points run back into a horse; the
closing snare roll fills the grid and the end card lands on the downbeat.

- Music: excerpt from 6.43 s with three bars cut out (`--cut 53.149:58.292`), 140 BPM half-time;
  cuts snap to the strongest kick or snare within half a beat (`edit.ts`).
- Look: `lib/look.ts` draws every source (render targets, footage) as clean grey, dots, ASCII,
  matrix, dither or `print` (the car: ink edges, banded tone, an off-register red plate), with
  noise-field glyph cells, eased blocks and pixel-sort pillars; footage keeps only its reds.
- `shots/` holds one module per shot kind; `scenes/film.ts` composes them, draws the slate, the
  chapter openers and the red trace (`lib/trace.ts`) with its morph across cuts.

The finished film is `out/landscape.mp4`. `bash make.sh` rebuilds everything from the repository
root: it fetches footage, music, the Muybridge card, the three.js models and fonts (none
committed), cuts the Muybridge frames (`scripts/muybridge.py`), excerpts the music, finds hits and
envelopes, builds the footage plates from `clips.json`, then exports and checks. After the cut is
approved, `pnpm exec cueframe clean examples/locomotion` removes the intermediates and media again.

## Credits

- Music: "Need for speed" by Arulo, Mixkit (Mixkit Stock Music Free License),
  https://mixkit.co/free-stock-music/ (asset 369).
- Footage, Mixkit Stock Video Free License (Mixkit id in brackets): car-macro (63), car-pan (49), car-rear (74), car-road (52427), dash-accel (64), tunnel-dark (2026), night-drive (50989), eagle-glide (1706), shark (4406), chameleon (1489), cat-black (1541), horse-white (1157), horse-eye (100645).
- Footage, Mixkit **Restricted** License (marked `"licence": "restricted"` in `clips.json`; check
  the restricted terms before publishing): horses-run (15829), rider-beach (46807), dragonfly-grass (48445), dragonfly-pollen (48444), cheetah-hunt (11061), eagle-eye (48820), owl-eye (11393), lion-head (6736).
- Eadweard Muybridge, *The Horse in Motion* (1878), public domain, via Wikimedia Commons
  (`File:The_Horse_in_Motion_high_res.jpg`).
- `ferrari.glb` (and `ferrari_ao.png`) by vicent091036, CC BY 4.0, from the three.js examples (r186).
- `Horse.glb`, `Stork.glb`, `Parrot.glb`, `Flamingo.glb` from ro.me "3 Dreams of Black",
  CC BY-NC-SA 3.0, via the three.js examples (r186).
- Fonts: Michroma (The Michroma Project Authors) and JetBrains Mono, SIL Open Font License 1.1.
