# Newspaper comic (报纸漫画)

A daily strip printed on cheap newsprint: three process colours in Ben-Day dots under a black key
plate, slightly off register, read panel by panel by a camera that moves over the page.
Kit: [`kits/comic.ts`](../comic.ts). Demo: [`examples/style-comic`](../../examples/style-comic)
(周一, 17 s). Abstracted from the *Çizgi roman* clip of
[animasyon-stil-katalogu](https://github.com/yasinozmeen/animasyon-stil-katalogu/tree/main/stiller/cizgi-roman)
(no licence: the ideas only, the code is our own) and set for Chinese lettering.

**Use it for** a gag, a dialogue, tension and release, a 四格 (起承转合) told in 15–25 s; a
"to be continued" episode opener. **Not for** dense explanation: every panel carries one beat.

## The three-second read

1. A newspaper page on a dark desk, masthead lettered, panels inked on.
2. Colour made of dots: cyan walls, magenta curtains, yellow light; yellow over magenta prints red.
3. The colour slips a few units off the ink line (misregistration).
4. Lettering that slaps in: balloons, a yellow caption box, sound effects in block letters with an
   ink shadow, a starburst on the hit, speed lines toward it.

## Page and panels

- Page 3200 × 2200 units, masthead band to y ≈ 300 (title as a sound effect, issue and date in
  hand lettering, a thick and a thin rule), footer line at the bottom.
- 2 × 2 panels of 1440 × 810 (16:9, so a panel fills the frame when the camera is on it), 80–100
  gutters. For a portrait film stack four panels vertically (the traditional 四格).
- Each panel has an acting window; before it a panel holds its first state, after it its last, so
  the opening page shows the setup and the closing page reads as the finished strip. Keep the
  last panel's payoff out of its first state (the clock in 合 drops in when the panel starts).

## Colour

| Token | Hex | Role |
|---|---|---|
| `ink` | `#1B1716` | key plate: lines, solids, lettering |
| `paper` | `#EFE2C0` | newsprint, yellowed toward the edges |
| `white` | `#FBF6E6` | knocked-out shapes, balloons |
| `cyan` | `#2F9FD8` | walls, sky, cool calm |
| `magenta` | `#E0393E` | fabric, heat; flat under yellow dots = printed red |
| `yellow` | `#F5C928` | light, captions, sound-effect fills, bursts |
| `desk` | `#2E2622` | around the page |

- Plates: cyan at 15°, magenta 75°, yellow 0°, ink 45°; cell 12–18 units. Dot radius 0.25–0.45 ×
  the cell reads as a tint; a flat tint under dots of another plate makes a deeper colour (RED,
  WOOD in the demo's `lib/props.ts`).
- Misregistration `MIS = (5, −4)`: colour plates only, never the key plate.
- Halftone ramps (`radial`) for light and drama: a magenta ramp out from the action (承), a key
  plate `shade` toward the panel edges in the calm panels (keep its max dot ≤ 6 or it turns dirty).

## Type

| Use | Font | Size (page units) |
|---|---|---|
| Balloons, captions, masthead lines | ZCOOL KuaiLe 站酷快乐体 | 46–76 |
| Sound effects, masthead title | ZCOOL QingKe HuangYou 站酷庆科黄油体 | 84–240 |
| Latin sound effects, Zzz | Bangers | 60–120 |

Sound effects: per glyph, an ink outline about a tenth of the size, a block shadow extruded
down-right, fills in yellow, cyan or white (never on the same colour as the ground behind).

## Motion

- `slap` (back, overshoot 2.4) for everything lettered: balloons, letters (staggered 0.18 per
  glyph, alternately tilted), bursts, stars. Captions unfold downward.
- Borders ink on clockwise from the top left (0.5 s), the content wipes in left to right with them.
- The camera reads in order: full page → each panel (frameRect with a 28 px pad) → full page.
  Moves 0.55–0.85 s eased in-out with motion blur (`blur.when` on the move windows); holds drift
  ×1.035.
- Impacts: one punch-in of the camera (+5 %, settling), squash and stretch on the struck thing, a
  white flash disc that opens the new background (yellow dots, magenta ramp, speed lines).

**Flashes.** CueFrame's `measure` takes the camera's pan and zoom out before judging flashes, so
the dot screen and the panel borders sliding past during a move are a `warn`, not a failure. What
still fails is flicker that is not camera motion: a shake back and forth, a big dotted object
jittering, a strobe. So: a one-way punch instead of a shake, oscillations ≤ 2.5 Hz and small (the
ringing clock hops 18 units and rocks 3°; its hammer swings at 2 Hz). Check every film with
`measure`.
- Rhythm of a strip: page in (≈ 2 s) → 起 3 s → 承 3 s → 转 3 s → 合 3.5 s → page (≈ 2 s) → ink.
- End on ink black (0.6 s), never a hard cut.

## Sound

A small bouncy bed (plucked strum, 120 BPM) from the first panel that **stops dead on the hit**;
foley for every action (paper taps for the inks, ticks, a bell trill, a whoosh for a throw, a heavy
soft slap, a thud, a pop for the balloon), a slow glockenspiel tag for the last panel. No whoosh on
camera moves. Mix to −14 LUFS.

## Kit

| Function | Gives |
|---|---|
| `COMIC`, `FONTS`, `MIS`, `slap` | palette, fonts, misregistration, the lettering ease |
| `dotField`, `radial` | Ben-Day dots as path data (one lattice per plate), halftone ramps |
| `plates`, `printed`, `shade`, `solid`, `inkAttrs` | colour plates over a shape; a printed shape (white, plates, ink line); key-plate shading |
| `newsprint`, `panel` | the page on the desk; a panel with its inked border and reveal |
| `balloon` (speech, thought, shout), `caption`, `sfx` | lettering |
| `burst`, `burstPath`, `speedLines`, `motionLines`, `shakeMarks`, `starPath`, `shiver` | effects |

Everything is SVG geometry made in mount; no `<pattern>` (Chromium caches its tile across frames
under a changing scale and breaks determinism). `kits/paper.ts` `sheet` adds the screen grain.
