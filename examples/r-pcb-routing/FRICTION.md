# r-pcb-routing: friction log

A spike built with CueFrame as it is (submodule 2d33d44, no framework changes) to measure what a
dense, game-like engineering animation costs. Workarounds are marked `// cueframe:` in the code.

## Reference

`骑着线头躲石头 拉远才发现是十层板布线｜SK-AM62B 布线＋Ansys压降＋热仿真` (Bilibili, 64.6 s,
1280×720 @ 30, AAC 48 kHz). No narration: a licensed vocal song (Whisper hears the hook) under the
whole piece, mean −16.6 dB, no silence; the picture is cut to it.

| Time | Shot | Technique |
|---|---|---|
| 0–2, 58–64 | Photo of the real board, pixel riders standing on it, a speech bubble "十层 布完了" | footage/photo + sprite overlay |
| 2–14 | A pixel rider rides the head of a glowing 4–6-trace bus through a field of grey pixel "stones"; 45° bends, sparks, boulders dodged; camera follows | 2D game scene, camera follow |
| 14–24 | The frame splits 1→2→4→8→10 on the beat, every panel its own ride (other colours, riders, copper textures); panels become ten portrait layer tiles F.Cu…B.Cu, then real layer artwork (title: "拉远才发现是十层板") | **nested, instanced animations**; grid re-layout |
| 24–31 | Length matching: three DQ traces meander (serpentines), live bar meters (6→42) with a target line, a red ✕, bubble "绕弯是为了一起到"; a flash of the real EDA screen | path animation + HUD + screen capture |
| 32–40 | IR drop as a pixel/voxel waterfall and river the riders surf; HUD "压降仿真 · VDD_CORE · Ansys SIwave" | particle/voxel fluid, stylised |
| 40–48 | Thermal: 3D board with a heat-map, colour bar, "U12 71.8 °C" readout, bubbles "烫"/"凉了", a heat sink drops, airflow streaks, the readout counts down to 50.7 °C | 3D + scalar field + HUD |
| 48–58 | Exploded 3D stack of ten translucent textured layers with riders, counter "In8.Cu 2/10 … F.Cu 10/10", layers collapse into the board, top view with all riders | 3D stack, billboards, counter |

Style: dark navy, neon copper colours per layer, pixel-art characters (≈11×10 px, hats in many
colours), pixel blobs as obstacles, bloom on trace heads, thin gold panel frames. Motion is fast and
dense (a new idea every 1–2 s), mostly cuts and splits on the beat, almost no easing showcase.

### How far current CueFrame gets on the whole piece (estimate)

| Part | Share | Today |
|---|---|---|
| Ride, split, tiles, 3D stack, counters, bubbles | ~55 % | done in this slice, close in look; motion simpler |
| Length matching with meters | ~10 % | doable (paths + `hud` meters); serpentine generation by hand |
| Photo/footage bookends | ~6 % | `ctx.video`/`<img>` work; needs the real photo |
| Thermal 3D heat map | ~12 % | doable with three.js or a Blender plate; field data must be faked or exported from a solver |
| IR-drop voxel waterfall | ~12 % | hard: a fluid/particle look; a Blender plate or a replay particle sim, both slow to author |
| EDA screen capture | ~3 % | footage |

Overall ≈ 70 % of the piece at similar quality with today's tools, ≈ 85 % with more time; the fluid
shot and the authored feel of the ride (dodging timed to the music) are what is left.

## Slice

48.7 s (narration made it longer than the 40 s target). Own script in nine lines, IndexTTS voice `me`
with Whisper word times, phrase subtitles, a synthesized chiptune bed at 120 BPM with SFX (pops on
splits, whooshes per layer, drill zaps, power-up), ducked, −16 LUFS.

1. **ride** (r1–r3): a chip, then the bus leaves its pins on "出发" and winds between stones; camera follows.
2. **split** (s1–s2): pull back on "镜头拉远", then 1→2→4→8→10 panels on the beat after "不止", "每一层", +2 beats, "布线".
3. **tiles** (s3): panels become ten portrait tiles; each shows its copper when the narration names its kind (顶层 / 内层 / 电源层 / 地层 / 十层).
4. **stack** (k1–k3): tiles fly bottom-first into an exploded CSS 3D stack with a counter, misalign then align on "对齐", vias drill through on "打孔", a scan flashes on "互不打架", the stack presses into one board and the riders hop on top on "布完", bubble "十层，布完了".

## Metrics

| | |
|---|---|
| Code | lib.ts 352, scenes/field.ts 93, scenes/stack.ts 124, timeline.ts 31 (TS 600) + score.py 92 |
| Hand timing | 15 `seg(…)` windows, 10 `lerp`s, 1 hand-built pose interpolator (6 parameters), 0 continuity keys |
| Times | all from `said()` on Whisper words or the next beat; 0 hard-coded seconds in scenes |
| TTS + align | 79 s wall (9 lines, cold) |
| Export | 1462 frames in 45–50 s wall (~33 fps, 25 segments) |
| Checks | determinism 5/5 PASS (after two fixes below), audit 0 errors / 4 warnings, measure 5/5 PASS, `pnpm check r-pcb-routing` PASS |
| Iterations | 4 still rounds, 3 exports, 3 determinism runs, 4 audit runs |

## Friction, ranked

### 1. No nested composition: a panel cannot be "the ride, again" (core)

- **Wanted:** the split shot is one ride animation instanced ten times, each with its own params
  (seed, colour, rider), clock offset and camera, placed in a rect that animates; later the same
  instances shrink into tiles.
- **Did:** wrote the ride as a plain function `drawWorld(g, world, t, rect, zoom)` in lib.ts and
  called it per rect inside one `field` scene on one canvas. Ride, zoom-out, split and tiles had to be
  one scene, because a scene cannot hand its running content to another.
- **Cost:** ~180 lines of lib.ts are a hand-made "composition" (clip, camera, culling, time offset per
  instance); a DOM or three.js sub-animation could not be instanced this way at all (only Canvas2D
  code that already takes a target rect). No audit, keys or motion blur inside the panels.
- **Change:** core `ctx.comp(id | scene, { t: (f) => local, rect, params })` that renders a scene (or
  timeline) into a rect/texture at a remapped time, instancable, with keys/audit seeing through.
  Additive; does not limit the ceiling (plain code still works). Same need as the editing-village
  study's P1.

### 2. Canvas → DOM/3D hand-off at a scene cut is by hand (core/recipe)

- **Wanted:** the ten tiles drawn on the field canvas become 3D layers in the stack scene.
- **Did:** recomputed the same tile rects in both scenes, drew the same art and rider positions, and
  hard-cut at `scene.k1.start` so the frames match. `ctx.key` only moves DOM boxes in 2D (FLIP), so it
  cannot take a canvas region or a 3D pose.
- **Cost:** ~40 lines duplicated layout knowledge (tile rects, rider spot, bob formula, border); a
  1 px bob mismatch is possible at the cut.
- **Change:** let a key be a canvas region (`ctx.key(rect-fn, name)` drawn as a snapshot during the
  move) and allow 3D target poses (`transform` matrices instead of boxes). Additive.

### 3. CSS 3D poses are hand-composed transform strings (recipe)

- **Wanted:** "layer i lies in the stack at lift z, viewed from (rx, rz)"; billboards (riders) standing
  on a layer; vias as columns through the stack; a counter that knows which layer landed.
- **Did:** a `Pose {x, y, rx, rz, s, lift}` interpolator and `tf()` string, inverse rotations for
  billboards, a separate composed transform for each via, transform-origin reasoning, a scale
  compensation so riders keep their screen size.
- **Cost:** ~60 lines and two still rounds to get the via orientation (rotateX sign, scale before
  translateZ) right; nothing checks it except looking.
- **Change:** a small `recipes/space.ts`: a CSS 3D group with a camera (`orbit`, `look`), planes with
  lifts, billboards, columns between planes, and `project(point)` for HUD labels on 3D points (what
  `ctx.plate` tracks give Blender plates). Opt-in recipe; raw CSS stays possible.

### 4. Paths authored by seed, not by story (recipe/tool)

- **Wanted:** the bus dodges a boulder on "一起躲" and turns on "拐弯".
- **Did:** procedural random routes; turned up turn probability and camera lag until the ride read as
  dodging; the dodge is not synced to the words.
- **Cost:** ~120 lines of route/offset/obstacle code; a timed dodge would need search over seeds or a
  hand-made path.
- **Change:** a `paths` recipe: 45° router with obstacles, parallel lanes (offset with miters),
  serpentine/length matching, `at(s)`, and "turn here at time t" constraints from cues. Useful well
  beyond PCB (maps, flows). Opt-in.

### 5. Canvas state persists across frames, silently (core guard)

- **Wanted:** "no border" on single-panel frames.
- **Did:** `g.lineWidth = 0` is ignored by Canvas2D, so the previous frame's 2 px stayed and the
  frame drew a border only when rendered after a split frame: determinism FAIL (shuffled,
  multi-worker) with a full-frame diff. Found by `check determinism`, fixed by branching.
- **Cost:** one determinism round + diagnosis (~10 min).
- **Change:** `ctx.canvas()` resets the 2D state (`reset()` / save-restore) before each render, or the
  dev guard flags reads of state not set this frame. Does not limit anything.

### 6. Fractional element opacity on text is not deterministic; the fix fights audit (core)

- **Wanted:** fade tile labels in.
- **Did:** `opacity: 0.066` on label divs differed by up to 11 levels between render orders even with
  the automatic `will-change: opacity`; switched to colour alpha, which passes determinism but makes
  `audit` treat transparent text as visible (10 safe/offstage errors, contrast 1.0:1); added
  `visibility: hidden` at alpha 0.
- **Cost:** two check rounds; a non-obvious rule ("fade text by colour, hide at 0").
- **Change:** fix the opacity promotion for text (or document it), and make audit read effective
  alpha (colour alpha × opacity) when deciding visibility/contrast.

### 7. Event times live in two languages (tool)

- **Wanted:** SFX on the picture's events (splits on the beat after a word, layer fly-ins).
- **Did:** `score.py` re-implements `said()`, `onBeat()` and the fly-in stagger from the scenes.
- **Cost:** ~25 duplicated lines; any change in a scene's timing rule silently desyncs the SFX.
- **Change:** let scenes publish derived cues (`ctx.cue('split.2', t)` at mount) that `cueframe cues`
  writes to build/cues.json for `synth` to read. Additive.

### 8. Narration-first vs music-first (docs/tool)

- **Wanted:** the reference is cut to a song; the brief asked for narration, so visuals follow words and
  then snap to the next beat of a bed synthesized at a fixed BPM.
- **Did:** `onBeat()` helper; the bed is generated to the narration's length, beat 0 = t 0.
- **Cost:** small here; for a real song (fixed beats) the narration would have to be placed on the
  music, which `tts` slots do not support (slots are sequential with pads).
- **Change:** `tts` slots that can be anchored to beats/bars (`"at": "bar 8"`), and a guide section on
  music-led explainers.

### 9. Small things

- Pixel art: no sprite helper (grid strings → canvas, palette swaps, integer scaling); wrote ~40 lines.
- Bootstrap of a fresh worktree: `pnpm bootstrap` clones submodules, runs three installs, `uv sync`
  and downloads the large fonts (several minutes); each example duplicates Noto Sans SC (17 MB) under its own
  `data/fonts` and adds two lines to `fetch-fonts.sh`.
- Whisper heard "时层不晚了" for "十层，布完了" (k3 matched 40 %); timings still usable, nothing flags
  a low-match line beyond the `tts` log.
- `stills` writes into `out/stills` and keeps old PNGs; reviewing a batch needed my own ffmpeg tiling
  (a `stills --sheet` would help, `sheet --times` too).
- Frame bursts at 6 fps around a cue (to judge motion) were done with ffmpeg on the export; a
  `cueframe burst <p> --at cue --fps 6` would let an agent check motion without a full export.

## What was easy

- Narration → word times → visuals: `said()` drove every event; changing a line re-times the picture.
- Pure Canvas2D worlds with seeded generation; determinism caught both real bugs.
- `synth` helpers (square/tri, whoosh, pop, powerup) were enough for a chiptune bed; `mix` ducking and
  `measure` passed first time.
- CSS 3D through ordinary DOM in `ctx.root` just worked in export, including translucency and
  preserve-3d sorting.

## Follow-up (CueFrame phase 6a, authored paths)

The hero's ride is authored with `recipes/paths.ts` instead of a seeded walk: waypoints on 45°
(`turn`, `around`, `turn2`, `dodge` marks), a 4-lane bus by `lanes`, stones kept off it by
`clearance` (the slice's margin), a boulder on the heading at the dodge (`assertClear`), and `travel`
pins each mark to its word time from `timing.ts` (events, also read by `score.py` for the turn pops
and the dodge whoosh). The other nine panels build `path`s from their seeded walks.

- Turn on "拐", jog on "绕开", dodge on "躲": exact by construction (asserted in `heroWorld`), seen in
  `cueframe motion` strips at the four words.
- Controlled edit: pinning the dodge to the second "一起" (16.68 s instead of 17.02 s) needed one line
  in `timing.ts`; no seed search, the checks still passed and the corner moved to the new word.
- Code: lib.ts 350 → 347 lines; the hand-written offset, distance and length-lookup helpers (~50
  lines) are gone, the hero's route (~30 lines) is new. Export 56.1 s before and after (1462
  frames); determinism 5/5; audit 0 errors.
