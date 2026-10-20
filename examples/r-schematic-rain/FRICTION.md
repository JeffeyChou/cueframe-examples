# r-schematic-rain spike: friction log

Spike: a 12 s rhythm-cut ("卡点") rain montage after `你和雨有个共同点#雨.mp4`, with a ComfyUI-Schematic
style overlay (detection circles, connections, coordinate labels, crosshair frame, tangent chain,
pixelation zone, corner slate). CueFrame main f71e783, no framework changes. Footage and music are
Mixkit (free licences), fetched by `scripts/fetch-media.sh`.

Cost: 5 project files (edit.ts 70 lines, schematic.ts 150, scenes/montage.ts 170, tools/hits.py 65,
tools/prep.py 105), 2 debugging rounds, export 29 s for 12 s (17 fps; frame p50 32 ms, render p50 1.9 ms).

## Reference analysis (what the edit does)

- 9.1 s, 30 fps, shots of 1–1.7 s; hard cuts on accents (frames 34, 60, 90, 137, 188,
  222, 248); sub-beat activity inside shots changes every 2–5 frames.
- Grammar: a tinted rectangle of the same footage (cobalt `color` blend) that jumps in place and size;
  a picture-in-picture window showing another clip; a window that grows to full frame and becomes the
  next shot; thin vertical slivers of another clip on hats; a circle mask with an exposure flash; a
  half-frame split in the complementary orange; at the end a letterbox that alternates with full frame
  every frame, then a thin outline box. Everything is graded to one blue.
- Audio (librosa on the AAC track): onsets at 0.06, 1.15, 2.02, 3.02, 3.46, 5.99, 6.28, 8.27 s line up
  with the big visual changes (34, 60, 90, 188, 248 frames). Gemini's listening report gave an exact
  120 BPM grid with a cut every 1.00 s, which the frame-difference analysis contradicts: good for
  describing sounds, unusable for timing.

## Friction

| # | Friction | Workaround in the spike | Generalisable as |
|---|---|---|---|
| F1 | `cueframe-py analyze` gives beats and band envelopes, no discrete hits. My onset + band classifier found 100 onsets in 12 s (43 "other"); the beat tracker started at 1.9 s. | `tools/hits.py`, then strength ≥ 0.45 and ≥ 0.1 s apart in `edit.ts`. | `cueframe-py hits`: onsets classed kick/snare/hat with strengths, deduplicated, beat-snapped; timeline `hits` + frame helpers (last hit, index, since). |
| F2 | No way to cut a song excerpt with a fade; the raw excerpt failed `measure` (−9.2 LUFS, +1.7 dBTP). | `hits.py --wav`. | `cueframe-py excerpt` (start, dur, fades, normalise) or `hits --excerpt`. |
| F3 | Shots on beats, windows on hits, a seeded layout per hit: all hand code. | `edit.ts` (cuts every 2 beats snapped to strong hits, `lastHit`, `lastScan`, hash rng per hit). | A beat-cut recipe: cut list from beats/hits, per-shot hit index, per-hit seeded rng. |
| F4 | Footage → plate folders exists only for Blender. | `tools/prep.py`: ffmpeg at the timeline fps, cover crop, manifest by hand. | `cueframe-py footage clips.json` → plate folders. |
| F5 | No feature tracks for footage; tracks.json has no scalar channel (score). Track flags must be 0/1: booleans silently make every point invisible (one debugging round). | OpenCV KLT in `prep.py`, score in a side `points.json` fetched in mount. | `footage --track` (KLT + schematic score channel); plate loader validates flags; `plate.track()` returns extra channels. |
| F6 | A clip used twice, or as an insert before its own cut, needs its own plate (one start per plate): 18 plates for 9 shots. Every plate swaps and decodes its `<img>` every frame even when the shot is not drawn: frame 32 ms vs render 1.9 ms. | One plate per use. | Plates that decode only when drawn; a frame source that can be sampled at any clip time from render. |
| F7 | Plates are DOM `<img>` layers; compositing in a canvas needs hiding the layer and redoing the fit. | `layer.style.visibility = 'hidden'`, `drawImage(plate.el, 0, 0, W, H)`. | `plate.draw(g, rect, fit)` and tracks mapped through the same rect (the boxed strobe shows points over the black border today). |
| F8 | Windows, masks, tints, grow-to-full, slivers, split, strobe, duotone grade: ~100 lines of Canvas2D compositing. | `montage.ts`. | A colour-block / window recipe with a duotone grade. |
| F9 | The schematic apparatus: circles, connections, labels, crosshair, chain, pixel zone (frame canvas readback with dpr maths), slate; labels collide where points are dense. | `schematic.ts`. | `recipes/schematic.ts` with a label collision resolver and point selection (score, spacing, cap, jitter) from any point source. |
| F10 | `check determinism` warns "`lineWidth = 1.3` was ignored (kept 1.2999999523)": a float32 round-trip, not an ignored assignment. | — | Fix the ignored-assignment detector (compare in float32). |
| F11 | `audit` passes with 0 warnings: canvas labels (13 px, overlapping, slate at 56 px from the edge) are invisible to it. | — | The schematic recipe declares its labels with `audit.text`. |
| F12 | Checking sync needs ears: `cueframe sync` works on cues only. I measured frame-difference peaks against onsets with my own script for the reference. | `vdiff.py`, Gemini. | `cueframe sync --hits`: visual-change peaks against hits (on time / early / late / missed). |
