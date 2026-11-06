# Risograph (孔版印刷)

A picture printed in two or three spot inks on warm uncoated paper: grainy translucent colour,
dots in the tints, a new colour wherever two inks overlap, plates a few pixels off register. Kit:
[`kits/print.ts`](../print.ts). Demo: [`examples/style-riso`](../../examples/style-riso)
(雨停了, 17.5 s). The same press prints silkscreen, woodcut and halftone (below).

Source: the risograph style of [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar)
(`styles/risograph`, MIT): density per channel, overprint by adding, one print pass, registration
fixed per shot. The demo's story and drawing are ours.

**Use it for** quiet stories, zines, posters that move, small-press warmth, a city at a human
scale. **Not for** photographic detail, glossy product, or fast data (dots eat small text).

## The three-second read

Warm off-white paper; flat shapes in teal, yellow and fluorescent pink with no outlines; tints
that break into visible dots; a green or orange where two inks cross; one plate a few px off so a
cream sliver shows along every edge; a soft grain that never sits still.

## What it is not

- **Not CMYK pop art**: no black key plate, no Ben-Day comic dots on every surface, no process
  colours. Two or three named drum inks, and the overlaps are the extra colours.
- **Not silkscreen**: riso inks are translucent and grainy, never opaque or glossy; tints are
  dots, not flat.
- **Not a filter on a picture**: every shape is drawn as ink on a named plate. A photo or 3D render
  pushed through a halftone looks like a filter, not a print.
- **Not jitter**: plates do not shake every frame. Registration is fixed for a shot.

## Colour

Pick two or three drum inks (`RISO`) and the paper (`PAPERS.riso` `#F4EEE2`).

| Set | Inks | Feel |
|---|---|---|
| rain, dusk (the demo) | teal `#00838A`, yellow `#FFE800`, fluo pink `#FF48B0` | cool day that warms |
| zine | blue `#0078BF`, fluo pink `#FF48B0` | loud, two-colour |
| harvest | federal blue `#3D5588`, sunflower `#FFB511`, red `#FF665E` | warm, bookish |

- Tints in steps (20, 40, 60, 100 %), not gradients: a ramp prints as dots that grow, which is
  fine once, not everywhere.
- **Overprint** (`over(g, fn)`) adds ink to what is under it: teal + yellow = green, yellow +
  pink = orange, pink over teal = deep plum. Draw the sky's pink over the teal set on purpose.
- **Knockout** (plain `source-over`) replaces: a yellow window knocks the teal wall out, so only
  yellow prints there. `PAPER` knocks everything out (paper-white puddles, highlights).
- Skin is a light tint of the palest ink; never a fourth colour.

## Type

Heavy sans (Noto Sans SC 900) for the title on one plate at 75 %, a letter-spaced geometric sans
(Jost 500) for the small line. Stamp a title twice, the second hit 2–4 px off: the press printed
it twice. Keep the smallest text ≥ 40 px at 1080p and on a 100 % plate; dots eat thin strokes.

## Composition

Posters, not illustrations: a ground line, big flat masses, one figure, air. Light (windows,
lamps, the sun) is the yellow plate; shadow and night are the teal at 60–100 %. Put a
paper-white trap around the figure (`sep.halo`), so misregistered plates fringe it instead of
muddying it. The last shot can pull back to the sheet: crop marks and a registration target show
it was printed.

## Motion

- **Registration** (`registration`): fixed per shot (± 2 px), changes on cuts only. On an accent
  the plates kick apart (8–14 px) and settle in ~0.25 s. A held, uneasy moment lets them drift
  (up to 24 px); the release snaps them back on a downbeat.
- **Plates arrive** (`inking`): a plate is off until its moment, then a roller lays it down left
  to right in ~0.6 s. Bring the inks in one by one: the film builds its palette.
- **On twos**: characters and rain step at 12 fps (`onTwos`), the camera moves on ones, the
  boiling part of the grain changes 12 times a second (`printSeed`). The sheet's own grain,
  streaks and blots change only on cuts.
- Easing: smoothstep for moves; nothing elastic.

## Camera grammar

| Move | Expresses | Can serve |
|---|---|---|
| Slow truck along a street (parallax rows at 0.5×) | going somewhere, routine | an opening, a commute, rain |
| Locked-off medium shot | attention, a pause | a decision, a stop, a turn of weather |
| Plates drifting in a held shot | unease, something about to change | the moment before the release |
| Snap back to register on a downbeat | relief, things fall into place | the turn, the reveal |
| Pull back to the printed sheet | it was made by hand; the end | the last shot, credits |
| Cut on a drum thunk | the press turning over | between shots |

Avoid fast whip pans and zooms into dots: the screen period is fixed to the page, so zooming
makes the dots swim.

## Story shape

Plate by plate: one ink sets the world (teal: rain, the street) → the second brings warmth or
light (yellow windows) → a held moment where the plates drift → the downbeat snaps them back and
the last ink arrives (pink sky) → title stamped twice → pull back to the sheet.

## Sound

Small acoustic band on sampled instruments, one per plate as it lands: pizzicato bass, soft
vibraphone, nylon guitar (`cueframe-py instruments fetch vcsl karoryfer`; all CC0). 90–100 BPM,
major sevenths and ninths. Press foley: the roller's swish under each plate, a dull drum thunk
on cuts, a stamp per title hit. Thin the band to one instrument for the held moment.

## Other looks of the press

| Preset | Inks | Look |
|---|---|---|
| `riso(colors)` | translucent, dots at 15/75/0° | this bible |
| `silkscreen(colors)` | opaque flat (0.85), pooled edges (`rim`), little grain, poster paper | gig posters; no tints: densities under 50 % print nothing |
| `woodcut(colors)` | flat colour blocks + last ink a key block with wood grain and bitten edges | folk tales, protest prints; the key block carries the drawing |
| `halftone(colors)` | coarse 12 px dots at 15/75/0/45°, four inks (needs `key`) | newsprint, a cheap colour supplement |

## Kit

| Function | Gives |
|---|---|
| `RISO`, `PAPERS` | drum inks and papers |
| `press(ctx, o)` → `{ sep, key, pass, print(f, p) }` | the separations and the print pass |
| `riso`, `silkscreen`, `woodcut`, `halftone` | `PressOptions` presets |
| `separation`, `sep.draw(fn, base)`, `sep.halo(fn, px)` | a plate canvas; draw densities; a figure with a paper trap |
| `ink(a, b, c)`, `PAPER`, `over(g, fn)` | density fill styles; knockout; overprint |
| `registration`, `inking` | plate offsets per shot, kicks, drift; the roller |
| `printSeed`, `onTwos` | grain and character timing on twos |
