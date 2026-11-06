# Silent film (默片)

Real archival footage projected as a worn print: a 4:3 gate in black, sepia toning, a picture that
weaves and breathes, dust and hairs that are never in the same place twice, title cards between
shots, an iris to end a scene. The photograph can turn into an ink drawing of itself. Kit:
[`kits/film.ts`](../film.ts). Demo: [`examples/style-silent`](../../examples/style-silent)
(市场街 1906, 24 s). The same kit has a CRT for tape and broadcast looks (below).

Source: the silent-film style of [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar)
(`styles/silent-film`, `core/post/crt.js`, MIT): footage redrawn as lines and hatching, film
damage in one pass. The demo's story and cards are ours; the footage is from the Library of
Congress (public domain).

**Use it for** history told with real footage, "what happened next" stories, a memory, an
archive pulled from a drawer. **Not for** reconstructions passed off as archive (never age new
footage to look like evidence), or anything that needs fine detail to read.

## The three-second read

A 4:3 picture pillarboxed in black; brown-black shadows and cream whites; the frame drifts a
pixel or two and the light flickers; a white speck, a hair, a scratch down the side; a black card
with a double rule and serif type between shots.

## What it is not

- **Not a filter preset on modern video**: the footage is from the period, found and credited
  (the `sourcing` skill). A modern clip with grain on it reads as a costume.
- **Not constant damage**: dust and scratches are sparse and change with each projected frame;
  a hair stays for half a second. Full-strength damage everywhere looks like a broken export.
- **Not jitter**: weave is slow and small (1–2 px), with a rare jump of a perforation.
- **Not CRT**: no scanlines, no colour bleed. Tape and TV are the `crt` pass, another era.

## Colour

Monochrome toned in one dye: `sepia` 0.4–0.6 for the past, 0 for a cold silver print. A dyed
print tints the whites too: `tint` amber `#E9B35A` for lamplight and interiors, blue `#6F8FC8`
for night, red `#E0866A` for fire and danger, one per sequence and never mixed in a shot. The
print's black is a brown-black (`black` 0.055), its white a cream (`white` 0.93): nothing is pure.

## Type

Title cards: black field, a double rule with corner diamonds, a serif (Noto Serif SC 500–700)
in cream, centred. One idea per card, two lines at most, ≥ 50 px for the small line at 1080p.
Hold a card for 2.5–4 s: the audience reads it once and then looks at the dust. The card is
filmed too, so it weaves, flickers and burns like the footage.

## Composition

The frame is the 4:3 gate (`gateRect`): put footage in it with `cover`, never stretch it. Choose
shots with a vanishing point or one subject; the period lenses were wide and the camera mostly
still or on a vehicle. Mark the place and the date on the first card; let the footage carry the
rest.

## Motion

- **Projection speed**: weave, flicker and damage step at `fps` 16–18, while the picture plays at
  24. A hand-cranked transfer runs slow: check the archive's notes ("8:23 at about 15 fps") and
  set the clip's `speed` so people walk at a natural pace (here 1.15).
- **Redraw** (`redraw`): the photograph turning into ink spreads in patches over 1–2 s (`amount`
  0 → 1); lines boil every 2 frames. Use it once, for the turn of the story.
- **Iris**: closes on what the scene is about (a face, the clock) in 1–1.5 s; the next card
  starts on black.
- **Burn**: the print catches in the gate and burns through to white light in ~1.5 s. It ends a
  film or cuts off a story; once per film.
- **Camera**: slow push-ins on footage (≤ 20 %), held so the top or bottom edge of the frame never
  shows. No whip pans, no digital shake.

## Camera grammar

| Move | Expresses | Can serve |
|---|---|---|
| Phantom ride (camera on a vehicle) | being there, the ordinary day | the opening, a city before the event |
| Slow push-in on footage | attention, this matters | the moment before a turn |
| Photograph turning to ink | memory, the past becoming history | the turn of the story |
| Iris closing on a subject | the end of a scene, a last look | the last shot before a card |
| Title card | the narrator speaks | place and date, "four days later", the outcome |
| Print burning in the gate | catastrophe, the story cut off | the event itself, without showing it |

## Story shape

Card (place, date) → footage of the ordinary day → push in on one thing → it turns to ink → iris
→ card with what happened → the print burns → black → credits card. The footage stays ordinary;
the cards carry the turn.

## Sound

A cinema upright (`upright`, `cueframe-py instruments fetch vsco2ce`, CC0) playing a parlour waltz
or rag in major, with the projector's clatter under it at the projection rate. The turn goes to
the relative minor: a left-hand tremolo, a diminished chord, a low cluster as the print burns,
then silence in the black. The credits get the opening phrase again, slow, left to ring.

## Sources

Footage comes from public archives with a recorded licence: the Library of Congress, Wikimedia
Commons, archive.org (see the `sourcing` skill). Every clip has an entry in `data/sources.json`
with the source seconds it uses and where they land in the film; `cueframe-py credits` writes
SOURCES.md and fails on a missing or unknown licence. Put the archive on the credits card even
when the licence asks for nothing.

## Tape and TV: `crt`

The same kit's `crt` pass shows the frame on a tube fed by a worn tape: luma soft and chroma
smeared and late (`bleed`, `shift`), line tearing and a rolling band (`tracking`), the
head-switching tear at the bottom, scanlines, an aperture grille, glow, dark corners. `on` 0 → 1
powers it up: a line opening sideways, then vertically. For VHS memories, broadcast archive,
found tapes; `bleed: 0, shift: 0, tracking: 0` for a clean studio monitor.

## Kit

| Function | Gives |
|---|---|
| `gateRect(stage, aspect)` | the 4:3 picture area in the stage |
| `frameCanvas(ctx, id)` → `{ canvas, g, texture, draw(fn) }` | a stage-size canvas to draw footage frames or cards into |
| `redraw(ctx, o)` → `{ draw(f, src, { amount }) }` | the frame as an ink drawing: lines, posterised wash, hatching; `amount` spreads it in |
| `film(ctx, o)` → `{ apply(f, comp, p) }` | the print: weave, flicker, halation, dust, hairs, scratches, toning, tint, iris, burn, fade |
| `crt(ctx, o)` → `{ apply(f, comp, p) }` | the tube: tape tracking, chroma bleed, scanlines, mask, power on |
| `crank(t, fps)` | scene time on a hand-cranked camera |
