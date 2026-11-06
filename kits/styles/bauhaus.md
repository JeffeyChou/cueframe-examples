# Bauhaus fable (包豪斯寓言)

Flat shapes printed on warm paper act out a fable; a Swiss poster grid, black serif headlines and
mechanical, stepped motion keep it dry. Kit: [`kits/bauhaus.ts`](../bauhaus.ts). Demo:
[`examples/style-bauhaus`](../../examples/style-bauhaus) (方圆, 19 s).

Two sources, one look:

- **Ours** ([utc8-customs](../../examples/utc8-customs), [r-editing-village](../../examples/r-editing-village)):
  warm paper and muted primaries, characters that are one flat shape on two thin ink legs with
  stroke eyes, a side view on one ground line, rubber stamps, a red pencil ring, speech bubbles.
- **The poster** (the *Bauhaus* clip of
  [animasyon-stil-katalogu](https://github.com/yasinozmeen/animasyon-stil-katalogu/tree/main/stiller/bauhaus),
  no licence: the ideas only): the 12-column grid drawn as hairlines, three primitives each with an
  ink accent, headlines rising through a mask, numbered labels with a stepping marker, expo
  easing, a circle that swallows the frame, paper columns rising over it.

**Use it for** satire and fables, rules and steps (01 02 03), a moral with a twist. **Not for** warmth or texture-rich worlds (brushFrame), or fast data.

## The three-second read

Paper with a faint grid, a huge black serif word top-left, letter-spaced Jost beside it, a thick
ink baseline with shapes standing on it in a row, numbered labels under them, a red square
somewhere as the only bright accent.

## What it is not

- **Not Swiss motion graphics**: the grid and the type are Swiss, but shapes act out a story with
  a protagonist; nothing is there only to look designed.
- **Not a corporate explainer**: no gradients, drop shadows, rounded icons or friendly UI colour;
  the irony needs the hard, flat poster.
- **Not constructivist propaganda**: no shouting diagonals or red-on-black slogans; the baseline
  stays level and the moral is dry.
- **Not print**: flat fills, no dots or misregistration (that is `print.ts`); the only texture is
  the paper sheet.

## Colour

| Token | Hex | Role |
|---|---|---|
| `paper` / `cream` | `#EDE3CC` / `#F6F0E2` | the page; light fills, text on red |
| `ink` | `#1E1E1E` | type, rules, legs, eyes, accents |
| `red` | `#C7432F` | the protagonist, stamps, rings, the marker, the moral's field |
| `navy` | `#2C3172` | order, authority, the crowd |
| `mustard` | `#E3A72F` | a highlight, the wedge, a lip of the column wipe |
| `sage`, `grey`, `floor`, `sky` | | secondary characters and sets |

One bright accent per frame. Stamps and rings multiply into the paper (never on navy).

## Type

| Use | Font | Size |
|---|---|---|
| Headline, moral | Noto Serif SC 900 | 150–300 px, tight |
| Labels, attribution, bubbles | Noto Sans SC 700/900 | 30–76 px, spaced 4+ |
| Latin, numerals (01, SQUARE & CIRCLE) | Jost 600 | 24–40 px, spaced 3–12 |

## Composition

- Grid: 96 margin, 12 columns, 24 gutter (`columns()`); headline from column 0, notes right-aligned
  to the margin, the baseline across all twelve columns.
- Side elevation on one ground line; characters in a row a few columns apart, labels under them
  (`01` in Jost over the word in Sans), a red marker under the label in focus.
- Leave paper: the frame is a poster, not a set.

## Characters

`figure()`: circle, square or triangle, ~220 px, legs ≈ 0.22 × size, stroke eyes (`open`, `line`,
`wide`, `dot`, `squint`, `wink`), paper flecks fixed to the body. Poses are parameters: `spin`
(rolling), `legs` (0 retracts them), `morph` (a circle squares itself, or a square rounds),
`squash`. Round things **roll** (spin = distance / radius; land after whole turns so the face is
upright), square things **hop**.

## Motion

- Arrivals ease out expo; landings `settle` (back, overshoot 0.9): things land, they do not bounce.
- Mechanical things move in **steps** (`stepped`): hops, the marker, counters, turns of an accent;
  put the steps on the bed's eighth notes so picture and music tick together.
- Headlines `rise` glyph by glyph through a mask at the baseline (stagger 0.06–0.25). Sung or
  narrated lines use `riseAt`: each glyph on its own time (from lyrics.json or words.json), an
  accent colour from a glyph on with a pop, and out upward through the mask at a given time.
- Stamps slam (×1.35 → 1 in 0.12 s) with a small flinch of whoever is stamped; rings draw on in
  0.45 s and overshoot their start.
- Transitions: a circle (a small anticipation, then expo in from a character, so the character
  becomes the next field), columns with coloured lips (rising, or `down` as blinds) and a bar
  stepped across on the beat. Each wipe either covers (`circleWipe`, `columnWipe`: a colour over
  the outgoing set) or reveals (`circleReveal`, `columnReveal`, `barReveal`: build the incoming set
  in the wipe's `g` and it shows through the shape, which carries the eye across the cut). The kit
  marks wipes `data-cf-audit="wipe"` and stamp frames `allow-overlap`.
- The sheet (`kits/paper.ts` `sheet`) over everything: grain, light mottling, vignette.

## Camera grammar

The camera is mostly a poster on a wall: it moves rarely, and each move means something.

| Move | Expresses | Can serve |
|---|---|---|
| Locked side elevation | order, the rules of the world | most of the fable |
| Column or circle wipe (cover) | the next step, a rule changing | 01 → 02 → 03, a new chapter |
| Circle reveal from a shape | an arrival, a point of view | the outsider entering, a close look |
| Slow truck along the baseline | a procession, time passing | a queue, a production line, bureaucracy |
| Push-in on one shape | pressure, the test | a figure squeezed into the mould |
| Headline rising through a mask | the narrator's verdict | a title, the moral |

## Story shape

Poster title → the fable on the baseline (order, an outsider, a test, a squeeze, a twist) → the
moral on the protagonist's colour, with an attribution that turns it (—— 方 说) → end card with
the three primitives and the series title.

## Sound

The fables' dry bossa (100 BPM; upright, Rhodes, brushes) under the fable, stopping as the
circle swells; woodblocks on every step and hop, the rubber stamp, the pencil; held Rhodes chords
under the moral, a rising harp for the columns, a chime per primitive.

## Kit

| Function | Gives |
|---|---|
| `BH`, `TYPE`, `GRID`, `columns` | palette, fonts, the grid's geometry |
| `outExpo`, `inExpo`, `inOutExpo`, `settle`, `stepped` | the easing and stepped mechanics |
| `grid`, `rule`, `rise`, `riseAt` | hairline grid, growing rules, masked headline, the same timed per glyph |
| `paperShape`, `rect`, `poly` | printed paper shapes (kits/materials `paper`) |
| `primitive` (disc, block, wedge) | the poster shapes with ink accents |
| `figure`, `eyePair`, `superellipse` | fable characters |
| `stamp`, `stampPose`, `ring`, `bubble` | marks |
| `circleWipe`, `columnWipe` | transitions that cover |
| `circleReveal`, `columnReveal`, `barReveal`, `circleRadius` | transitions that reveal the next set; the circle's radius |
