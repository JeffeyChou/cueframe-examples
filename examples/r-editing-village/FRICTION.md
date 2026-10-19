# Friction log: r-editing-village (character animation with current CueFrame)

Spike, 2026-10-18. Reference: Bilibili 守拙 "AI对传统剪辑的冲击" (5 min, flat geometric characters on
printed paper, narration + bed + effects), slice ≈ 86–125 s rebuilt with our own wording. CueFrame
pinned at cueframe main 2d33d44; no framework changes (the point was to measure). Workarounds are
marked `// cueframe:` in the code.

## Metrics

| | |
|---|---|
| Code | 841 lines: `lib.ts` 278 (rigs ≈ 170), scenes 454, `score.py` 85, timeline 24 |
| Shots | 7 shot scenes + 2 overlays (paper, subtitles); 2 of the 7 exist only to get motion blur |
| Hand timing | 38 `seg`/`bump` windows, 16 pose `set()` calls per frame, all derived from `said()` |
| Narration | IndexTTS + Whisper alignment, 12 lines, 2 m 29 s |
| Export | 1558 frames 1440×1080@30 in 2 m 34 s (10.6 fps); three scenes at 6 blur samples |
| Review | `sheet` for layout; motion only visible in hand-made ffmpeg burst strips (5 fps) |

## Friction, ranked

### 1. No nested compositions (the story is about an animation inside the animation)
- **Wanted:** one 12-card animation that plays on the monitor (s2) and the stage screen (s3–s6), the
  camera pushing into it until it is the frame, a red ring that rides with card 3.
- **Did:** `strip()` factory drawn in its own W×H frame from its own clock (`play(t, T0)`), instanced
  by hand in two scenes, each with its own clipPath (ids must be unique per document, so counters);
  the ring is appended into the strip's internal group because there is no mapping from a nested
  piece to the outer frame.
- **Cost:** ~20 lines of plumbing per instance; blur, `audit`, keys and `stills` know nothing about the
  inner piece; a second version (the "fixed" camera the plot needs next) would be another flag
  threaded through by hand.
- **Change (core):** `ctx.comp(piece, { time, params })` — a sub-timeline instanced with a time remap
  and parameters, rendered into any element, with `map(point)` from inner to outer coordinates so
  annotations and the camera can target inner elements. Additive: inside a comp you still write
  free-form scenes.

### 2. Characters and acting are all hand-written
- **Wanted:** blinks, eye direction, expressions (^^, --, ··), chuckle, hop, flinch, lean-in, point,
  squash and stretch, anticipation and overshoot.
- **Did:** five rigs in `lib.ts` (ball, Claude, elder, villager, cube) with a pose per frame; every
  action is a `seg`/`bump` window and a squash in each scene.
- **Cost:** the biggest token sink of the slice; acting still reads stiffer than the reference (no
  secondary motion, no settle, no overlapping action), because each extra nuance is another window.
- **Change (recipe):** `rig.ts` (parts, named expressions, automatic blink/breath/idle) and a small
  acting vocabulary (`hop`, `nod`, `flinch`, `lean`, `look`, `squashStretch` with anticipation and
  overshoot defaults) as pure functions of time. Ceiling: they return poses; scenes can mix,
  override or ignore them.

### 3. Camera, parallax and depth of field
- **Wanted:** push from a wide shot through the screen, foreground crowd moving at a different rate,
  rack focus out of the book tower.
- **Did:** `camAt` + `camera` in `lib.ts`; the foreground crowd is a second group scaled by
  `zoom^0.3` and offset by hand; rack focus is a CSS `blur()` on the whole world group.
- **Change (recipe + gfx):** `camera.ts` with layers by depth (parallax factor), focus distance and
  aperture, follow targets, and push-through into a comp (§1). Blur by depth belongs in gfx for speed.

### 4. Motion blur is per scene
- **Wanted:** blur on a 0.3 s whip pan and a 0.8 s rush.
- **Did:** the whole laugh and point scenes carry 6 samples for a 0.3 s whip; the rush is split into a
  second scene that rebuilds the whole stage world (`build()` twice) so only it is blurred.
- **Change (core):** blur windows (`blur: { samples, when: [[a, b]] }` or a per-frame `f`-driven
  shutter), so a scene pays for samples only while something moves fast.

### 5. Paper look on DOM art
- gfx `post` (grain, vignette) only reaches WebGL layers; DOM/SVG art needs its own overlay.
- `mix-blend-mode: multiply` on the overlay's own SVG silently did not blend (scene roots isolate), so
  the first stills were blank paper; it works only on the scene root. Nothing warned.
- Per-shape texture and cut-paper edges (the reference has both) were not attempted.
- **Change:** a `paper` recipe (grain, mottling, vignette, per-shape texture and edge roughness as
  SVG filters), the scene-root blend rule in the docs, and an `audit` warning when an overlay
  covers the stage opaquely.

### 6. Effects cannot follow scene events
- **Wanted:** a thud on every book landing, whooshes on whip and rush, a pop and a ding on the
  instruction.
- **Did:** `score.py` reimplements `said()` and the book schedule in Python; two copies of the same
  timing rules must be kept in step by hand.
- **Change (core + python):** scenes publish event times (`ctx.event('book.3', t)`) that
  `cueframe cues` writes to `page-cues.json`, so `score.py` reads them; a Python `said()`.
- Crowd murmur, applause and foley are beyond the synth helpers; a local sample-library tool
  (licensed packs, placed by cue) would cover them.

### 7. Seeing motion
- `stills`/`sheet` show poses, not motion. The stutter, the rush and the landing squash were only
  judged from ffmpeg 5 fps burst strips cut from the mp4 by hand. The rush was too fast to read in the
  first export, and no still showed it.
- **Change (tool):** `cueframe motion <p> --around <cue|said>`: burst strips, onion skin and
  trajectories of named elements, plus `audit` hints for dead stretches (narration runs, nothing
  moves), constant-velocity moves and everything starting on the same frame. This raises the
  ceiling most: it lets the agent see the motion, without prescribing any of it.

### 8. Small ones
- `subtitles` has no boxed style; the band is restyled through `querySelector` after mount.
- `said()` needs a mount context, so module-level schedules (book landings) take times in `mount`.
- SVG `clipPath`/`filter` ids are document-global across scenes; easy to collide.
- `audit` treats world content under a camera like UI text: card numbers that pan out of frame with
  the strip are "outside the safe area" (2 errors left, not hidden), and `allow-offstage` does not
  cover partly visible text. Blinks and idles are "jitter" until each rig is marked `allow-motion`.
  A `data-cf-audit="world"` (camera content: no safe-area or off-stage rules) would fit animation.
- Audit warnings kept: cream labels on orange books (2.7:1, as in the reference), the shrinking
  "流畅" blob, the subtitle over the bottom book in the close shot.

## Not attempted in the slice
Per-shape paper texture and rough edges, crowd chatter and applause, illustrated backgrounds
(cave painting, mosaic sun, ukiyo-e waves), the strip's second and third versions.

## Follow-up (CueFrame character-animation phases 1–3)

Rebuilt on the phase-3 branch: `timing.ts` declares the shared times as events, `score.py` reads them
(`ctx.event`, no Python timing code), the `rush` duplicate scene is gone (a blur window on the stage),
whip blur only during the whip. Same export conditions: sub-frames 3140 → 1895, blurred frames
316 → 67, export 2 m 34 s → 1 m 13 s; the blurred frames are pixel-identical (frames 92, 99, 639,
648, 663). Narration: four lines directed, Owner picked take 3 (PR #27).

## Follow-up (CueFrame phase 6b, paper)

The characters, the strip's cards and the books are printed paper (`lib.ts` `paperShape`: a slightly
rough edge from `roughen` in the rig's own units and a speckle of ink or paper from `fiber`), and the
overlay is `sheet()`. The reference has no cast shadows, so none are drawn. Measured on the way:
an SVG `<pattern>` texture failed `check determinism` (its raster tile is reused across scales), and
a canvas page over the stage was order-dependent, as an `<img>` it doubled the export; the recipe now
uses geometry for textures and static SVG turbulence for the page. Determinism 7/7, audit 0 errors,
export 76.8 s against 71.7 s.
