# Kits

Helpers that more than one example here uses, moved out of CueFrame's recipes (CueFrame keeps
only what nearly every video needs: `motion`, `camera`, `subtitles`). Import them with a relative
path (`../../kits/texture.js`); a helper only one piece uses lives in that piece's folder (its
`lib/`). Copy a kit into your project when you want to change it.

| File | What it gives you | Used by |
|---|---|---|
| `acting.ts` | pose layers (`pose`), action `envelope`s with explicit phases, secondary motion (`lag`, `springy`), opt-in `blink`/`breath`, verbs (`hop`, `nod`, `flinch`, …), styles `snappy` and `floaty` | r-editing-village, utc8-customs |
| `texture.ts` | object texture as geometry for any outline: `material()` prints a rough edge, surface layers (`scatter`, `hatch`, `shade`, `gradient`), an ink line and a cast shadow; `dress` is the pure plan | r-editing-village, utc8-customs |
| `materials.ts` | presets for `texture.ts`: `paper`, `halftone`, `engraving`, `flat`, `chalk`, `felt`, `wood`; `mix` | r-editing-village, utc8-customs |
| `paper.ts` | printed and cut paper on `texture.ts`: `roughen`, `fiber`, `cut`, opt-in `boil`, `shadowOffset`, `sheet` (grain and vignette over the stage) | r-editing-village, utc8-customs |
| `beatcut.ts` | cut lists from beats and drum hits, and a Canvas2D window grammar (below) | locomotion, survey-of-rain |
| `comic.ts` | the newspaper-comic look (style bible `styles/comic.md`): Ben-Day plates off register, panels, balloons, captions, sound effects, bursts, speed lines | style-comic |
| `bauhaus.ts` | the Bauhaus-fable look (style bible `styles/bauhaus.md`): grid, masked headlines (also timed per glyph, for lyrics), stepped mechanics, primitives, shape characters, stamps, circle, column and bar wipes that cover or reveal the next set | style-bauhaus |
| `print.ts` | spot-ink printing (style bible `styles/riso.md`): plates drawn as ink densities and printed in one WebGL pass — dots, lines, solids, wood grain; misregistration fixed per shot, kicks and drift; a roller that lays each plate down; presets `riso`, `silkscreen`, `woodcut`, `halftone` | style-riso |
| `film.ts` | film looks for archival and screen stories (style bible `styles/silent.md`): footage redrawn as ink (`redraw`), a projected print (`film`: weave, flicker, halation, dust, hairs, scratches, toning, tint, iris, burn) and a tube fed by a worn tape (`crt`) | style-silent |
| `svg.ts` | plain SVG helpers the style kits share: `el`, `stageSvg`, `place`, `text`, `clipUrl`, `bbox` | comic.ts, bauhaus.ts |

## Styles

A style kit is a look you can start a film from: its bible in `styles/<name>.md` (what reads in
three seconds, palette, type, composition, motion, sound, the kit's functions) and a short demo
film in `examples/style-<name>`. Start a piece in that look by reading the bible and the demo's
scenes, then import the kit. A new bible starts from [`styles/TEMPLATE.md`](styles/TEMPLATE.md):
only what stays true for every film; the demo's story, shots and score go in its README.

### Make a style your own

Restyling a look (for a brand, a series, a mood) is a short conversation, then a frame, then a
demo. The bible and the demo's scenes come first, read in full.

1. **Ask, one question at a time** (two or three options, the recommended one first): what the
   film is for and where it plays (format, platform, brand or IP); what should change; then
   section by section. About ten questions at most; "you decide" means take the recommendations.
2. **Sort each wish** into one of three groups and say which before agreeing to it:

   | Group | Sections | Means |
   |---|---|---|
   | Safe to change | palette within its colour logic, type, motion tempo and amount, sound palette, one signature move swapped | the style stays itself |
   | Changes its character | the medium or rendering, the colour logic itself, the camera grammar | possible; say what is lost |
   | Can't change | the three-second read and *what it is not*, the kit's engine | that is another style: suggest a closer one |

   Vague wishes, translated: **premium / 高级** → fewer colours, stronger light–dark contrast,
   slower motion, more empty space, lighter type. **Younger / 活泼** → a brighter accent, cuts on
   the beat, bouncier easing, more percussion. **Calmer / 安静** → slower tempo, longer holds,
   fewer moving things, sparser instruments. **Our brand** → the brand colour as an accent, not
   the ground; the brand face for titles only if it covers the film's language and allows video;
   the logo at the open or the end.
3. **At most five changes a round**, and changes travel together: faster motion wants denser
   sound, a darker palette rechecks type contrast, a new material brings new pitfalls. Keep the
   signature: swap one signature move at most. Story, cast, opening, ending, pacing and voice are
   free in every film and need no restyle.
4. **Summarise** (before → after → what it costs) and wait for an OK. Then copy the bible to
   `styles/<new>.md` ("Based on <base>"), changes in place, and a `## Changes` table at the end
   (section | base | now | why).
5. **Prove it on one frame**: the same composition rendered with the base settings and the new
   ones, side by side (base on the left), from real code. Show it and wait. After two rounds of
   notes that don't land, suggest a closer base.
6. **Demo, 15–30 s**, with a story unlike the base demo's: every row of the changes table visible
   on screen, one signature move, one real silence, music and effects (no voice unless asked).

Designs: cueframe `docs/design/camera-space-acting.md` (acting), `docs/design/materials.md` and
`docs/design/paths-paper-music.md` (texture, materials, paper),
`docs/design/rhythm-footage-schematic.md` (beatcut). Hits, footage and `f.hit` are CueFrame's
(`docs/guide/rhythm.md`); `survey-of-rain/lib/` has the schematic overlay drawn over the cut.

## beatcut

A rhythm cut ("卡点") changes the picture on the music: shots start on accents, windows jump on
drum hits, small things tick on hats. `beatcut.ts` takes plain data (`hits.json` from
`cueframe-py hits`, or your own analysis) and returns a cut list; the windows draw on it.

### The cut list

```ts
import { cutList, cutSections, tiers, shotAt, hitIn, pulse } from '../../kits/beatcut.js'
const ranked = tiers(hitsFile.hits)        // tier 0: kicks and snares ≥ 0.5; tier 1: other hits ≥ 0.2
export const SHOTS = cutList({ dur, beats: hitsFile.beats, hits: ranked, every: 2, holds: [[8, 10]], at: [10] })
```

- A cut every `every` beats, moved to the strongest tier-0 hit within `snap` (60 ms), shots at least
  `min` (0.8 s) long, none in the last `tail` (0.6 s). `at` forces cuts; `holds` are ranges with no
  beat cut (a still before the drop at 10 s).
- A fixed `every` turns into a metronome over a long section. Phrase it with `pattern` instead:
  beats per shot, cycled, e.g. `[4, 2, 1, 1, 2, 0.5, 0.5, 1]` (a hold, then a burst); fractions cut
  between beats. Vary it per section and keep a hold before each big accent.
- A song in sections (verse, build, drop) gets a rule per section with `cutSections`: each section
  has its own `every` or `pattern`, `phase`, `min`, `tail`, `snap`, `guard`, and its `cuts` (forced)
  and `holds` in seconds from the section's start. Every section start is a cut, and `every` or
  `pattern` counts beats per shot from it: the start's place on the grid (interpolated between the
  surrounding beats; within `snap` of a beat it is that beat) plus `phase` plus the cumulative
  pattern gives each mark, timed by the grid and snapped to the strongest accent inside the
  section. A section that starts on a syncopated kick half a beat early keeps its cuts half a beat
  early (`[3, 1]` gives a first shot of 3 beats); a start rounded a few ms past its beat still counts
  that beat. `cutList` counts from 0 the same way, or from the grid's first beat when the grid
  starts later. Sections must be sorted
  and contiguous (a gap or an overlap throws, naming both); with `dur` they must cover the piece.
  Shots keep the global `i` and add `section`, `n` and `of` (index and count in the section);
  `sectionAt(shots, t)` gives the section's id, span and shots.

  ```ts
  const SHOTS = cutSections([
    { id: 'intro', at: 0, end: 6.86, pattern: [64] },
    { id: 'build', at: 6.86, end: 13.71, pattern: [64], cuts: [2, 3, 4, 4.5, 5, 6.24] },
    { id: 'drop', at: 13.71, end: 27.43, pattern: [2, 2, 1, 1, 2, 4, 1, 0.5, 0.5], min: 0.25 },
  ], { beats: hitsFile.beats, hits: ranked, dur, min: 0.5, tail: 0.5 })   // defaults for every section
  const kind = KINDS[shot.section][shot.n % KINDS[shot.section].length]
  ```
- Map accents to big changes and ticks to small ones: `hitIn(shot, t)` is the last tier-0 hit in the
  shot (`k` = −1 before the first), `hitIn(shot, t, { tier: 1 })` counts hats too. `hitRng(shot, k)`
  is seeded per shot and hit, so a window keeps its place until the next hit. `pulse(since)` is a
  decaying envelope for a kick.


### Windows

```ts
const shot = shotAt(SHOTS, f.t)
const base: Paint = (g, r) => s.rain.draw(g, s.rain.frameAt(f.lt), r)   // or cover(img, w, h)
drawWindow(g, 'pip', { stage: f.stage, shot, t: f.t, frame: f.frame, base, insert, grade: DUO.cobalt })
```

The kinds are `tint` (a colour block), `pip` (another clip in a window), `grow` (a window that opens
to full frame before the cut and becomes the next shot), `sliver` (thin strips on a hit), `circle`,
`split` (half the frame in a complementary grade), `letterbox` (full and boxed, switching on each
hit) and `outline`. Everything is graded with a `duotone`; the parts (`windowRect`, `growRect`, `tint`,
`within`, …) are exported for your own grammar. `chroma(g, rect, dx)` shifts the red and blue
channels of what is drawn apart, a glitch for a few frames on a kick (`9 * pulse(since, 0.1)`).

Nothing may strobe: a window that changes every frame over a large area is a photosensitivity
hazard (WCAG 2.3.1: no more than three flashes a second). Change windows on hits, as `drawWindow`
does; `letterbox(stage, n)` takes the hit count `n` (`hitIn(...).k + 1`), not a frame number.

