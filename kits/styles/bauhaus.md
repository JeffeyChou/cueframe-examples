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
- Headlines `rise` glyph by glyph through a mask at the baseline (stagger 0.06–0.25).
- Stamps slam (×1.35 → 1 in 0.12 s) with a small flinch of whoever is stamped; rings draw on in
  0.45 s and overshoot their start.
- Transitions: `circleWipe` (a small anticipation, then expo in from a character, so the character
  becomes the next field) and `columnWipe` (four paper columns with coloured lips).
- The sheet (`kits/paper.ts` `sheet`) over everything: grain, light mottling, vignette.

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
| `grid`, `rule`, `rise` | hairline grid, growing rules, masked headline |
| `paperShape`, `rect`, `poly` | printed paper shapes (kits/materials `paper`) |
| `primitive` (disc, block, wedge) | the poster shapes with ink accents |
| `figure`, `eyePair`, `superellipse` | fable characters |
| `stamp`, `stampPose`, `ring`, `bubble` | marks |
| `circleWipe`, `columnWipe` | transitions |
