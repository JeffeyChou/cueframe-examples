# r-chipdesign lib

The explainer kit this piece is built on, moved out of CueFrame's recipes. Copy the folder into a
project that wants the same look.

| File | What it gives you |
|---|---|
| `explainer.ts` | the chrome from `script.json`: progress line, chapter tags, headlines with eyebrows and coloured keywords, chapter cards with a road map, subtitles; `chromeText` for the font subset, `scriptChapters` for `timeline({ chapters })` |
| `hud.ts` | instruments built in mount and drawn by `set()` in render: panels, tags, counters, meters, donut, Gantt, grid, typed code, timing diagrams |
| `theme.ts` | the theme and colour roles both share, and `parseTitle` for `**keyword**{role}` markup |
| `blocking.ts` | where each element stands in each layout, as a table, for `ctx.layouts` (cueframe `docs/guide/continuity.md`) |

Designs: cueframe `docs/design/explainer.md` and `docs/design/hud.md`.

## Explainer chrome

A narrated explainer wears one chrome for its whole length:
- a progress line;
- a chapter tag and an episode tag;
- a headline with an eyebrow and coloured keywords;
- subtitles;
- a chapter card with a road map before each chapter.

`explainer.ts` builds all of it from `script.json`. Headlines change when the narration does, and
follow it when lines are re-recorded.

### Script

```jsonc
{
  "show": "CUEFRAME · EP.02",
  "chapters": [
    { "from": "c1", "n": "02", "title": "没法一个个画", "en": "FROM TRANSISTORS TO CODE", "short": "往上抽象", "code": "ABSTRACT" },
    { "from": "h1", "n": "03", "title": "代码描述电路", "short": "描述电路", "code": "RTL", "card": 3 }
  ],
  "lines": [
    { "id": "c1", "eyebrow": "ABSTRACTION · 往上抽象", "title": "有了规格书，下一步：**变成电路**", "say": "…" },
    { "id": "c2", "title": "上千亿个晶体管：**不可能**{alert}一个个画", "say": "…" },
    { "id": "c3", "say": "…" },
    { "id": "c7", "pad": 3.5, "say": "…" },
    { "id": "h1", "eyebrow": "HARDWARE DESCRIPTION", "title": "不再画晶体管，而是**描述电路**", "say": "…" }
  ]
}
```

**Titles and eyebrows**
- `title` is the headline from that line on. Leave it out to keep the previous one, or set it to
  `""` for none.
- In a title, `**word**` is a keyword in the accent colour. `**word**{warm}` picks `accent`,
  `warm`, `alert`, `good` or a `#hex` colour.
- `eyebrow` is the small line above the headline. It is inherited the same way.

**Chapters**
- `from` names the line a chapter starts at.
- The card shows for `card` seconds (default 3.5; `0` for none) in the silence before that line.
  Give the line before it a `pad` long enough, and the kit warns with the pad that fits.
- A chapter that starts at the first line has no card.
- The road map lists every chapter: `short` above each node, and `n` with `code` below it.
- `scriptChapters(script, cues)` gives `timeline({ chapters })` (cueframe `docs/guide/long-form.md`).
  Each chapter starts at its card, so a chapter's export opens on its card.

### Scene

```ts
import { explainer, chromeText } from './lib/explainer.js'
import { glyphsOf } from '@cueframe/recipes/subtitles.js'

export const chrome = explainer({ script, cues, theme: { accent: '#38d6e8', sans: SANS, mono: MONO },
  subtitles: { y: 972, size: 38 } })
timeline({ cues, words, scenes: [bg, ...content, chrome],
  fonts: [{ family: 'Noto Sans SC', src, glyphs: glyphsOf(words, chromeText(script)) }] })
```

| Option | Default | |
|---|---|---|
| `lead` | 0.25 | seconds before its line that a headline starts to change |
| `swap` | 0.25 | the old text fades out in `swap`, then the new one fades in for as long |
| `card` | 3.5 | default card seconds |
| `theme` | dark, cyan | `text`, `dim`, `faint`, `accent`, `warm`, `alert`, `good`, `shade` (behind cards), `sans`, `mono` (CSS stacks) |
| `subtitles` | on | `subtitles.ts` options, or `false` |
| `show` | `script.show` | episode tag |

- List the chrome scene last, so it draws over the content.
- Its keys are named `<id>-…` (`chrome-head-0`), so they never pair with your content's keys.
- `regions(stage, o)` gives the boxes the chrome uses (`top`, `head`, `subtitles`, `card`), so
  content can keep clear of them.

At mount the kit warns about:
- a headline too short to show (under `swap`) or to finish arriving (under `2 × swap`);
- a card over the previous line's voice, naming the `pad` that fits;
- a card shorter than its road-map move (`2 × swap + 1` s);
- a line that starts after `total`.

## HUD instruments

An explainer speaks one visual language: panels, gauges, counters, Gantt bars, donuts, cell grids,
typed code and timing diagrams, in a few colours with fixed meanings. `hud.ts` builds them in
`mount`. `set(...)` draws them in `render` from plain values.

```ts
import { cjk, hud, inside } from './lib/hud.js'
const ui = hud({ sans: SANS, mono: MONO })                     // a Partial<Theme>

// mount
const ring = ui.meter(ctx.root, { shape: 'ring', max: 100, unit: '%', label: '良率',
  zones: [{ from: -Infinity, to: 0.3, role: 'alert' }] })
ctx.key(b.set(ring.el, { yield: ui.box(ring, 260, 250, 440), plan: ui.box(ring, 1560, 150, 260) }), 'ring')

// render
ring.set(92 * seg(f.t, T.yield, T.yield + 2.6, outCubic))
```

### Colours by role

The theme (`theme.ts`, shared with the explainer chrome) sets the colours. Instruments name a
role, never a hue:

| Role | Means |
|---|---|
| `accent` | the subject: the data or part being explained |
| `warm` | the other side of a comparison (software, cost, time spent), and code keywords |
| `alert` | failure, a limit crossed, risk |
| `good` | success, a pass, a saving |
| `dim` | context: axes, labels, units |
| `text` | plain text |

- Keep to these meanings across a piece, so red always means the same thing.
- `hud()` needs the role colours and `faint` as `#rgb` or `#rrggbb`.
- Keyword markup (`**word**{warm}`) takes the same roles in tags and in the explainer's headlines.

### Instruments

| | Natural size | `set(...)` |
|---|---|---|
| `panel(parent, { eyebrow, title, role, pad, box })` | its box | `{ focus = 0, role }` |
| `tag(parent, text, { role, solid, box })` | its text | `{ role, solid }` |
| `counter(parent, { label, unit, digits, format, align, max, zones, role, box })` | 360 × 120 | `value` |
| `meter(parent, { shape: 'ring' \| 'bar', max = 1, label, unit, digits, format, zones, role, box })` | 240 × 240, 480 × 72 | `value` |
| `donut(parent, { parts, hole, legend, box })` | 240 or 560 × 240 | `{ sweep = 1, focus = -1 }` |
| `gantt(parent, { rows, range, ticks, box })` | 1200 × lanes | `{ upto, cursor }` |
| `grid(parent, { cols, rows, cell, gap, labels, role, box })` | from cells | `{ levels = 0, roles }` |
| `code(parent, { lines, keywords, idents, comment, size, cols, numbers, role, box })` | from columns | `{ typed = Infinity, caret, lit }` |
| `wave(parent, { signals, cycles, box })` | 1000 × lanes | `{ phase = 0, cursor }` |

- **`set` states everything.** An option you leave out goes back to its default; it does not keep
  the last value. Set an instrument on every frame it changes, or a backward seek shows a stale
  state.
- **Values come from your timing.** Derive them from `said()`, cues and `seg()`; the kit has no
  clock. `cjk(v)` formats 1.2e11 as `1200亿`.
- **Zones** recolour a counter or meter by value: `{ from, to, role }`, fractions of `max`,
  half-open, `±Infinity` allowed, and no overlaps. An over-range value stays in its zone.

### Placing and moving

- Frames (`panel`, `tag`) are HTML. A panel fills the box you give it. Put other instruments in its
  `body`, with boxes relative to it.
- Dials (the rest) are SVG with a `viewBox`. They scale with their box and keep their aspect.
  `ui.box(inst, x, y, w)` gives a box of the right aspect. Use it for every box a dial takes, so a
  move between layouts does not distort it.
- An instrument's `el` can be a continuity key. The kit never touches its transform or opacity.
- A code dial inside a panel keeps its size when the panel resizes; the panel clips it. Give two
  code dials that swap in one panel the same `size` and `cols`.

**Pointing at a token of code** (a leader line that follows the panel as it moves):

```ts
const spot = b.spot(panel.el, lay.id(f))                   // the panel's box in the layout in force
const r = ui.at(code, code.token(1, 2, 5), inside(panel.bodyIn(spot), code.box))
const drawn = lay.map('code', f, r)                        // where it is drawn now, moving with the key
```

- `token(row, col, n)` is the cells of `n` columns from `col`. Columns count from the first text
  column, and a CJK character takes two.
- Code is typed one character at a time, counting one per line break. `caret: caret(f.t)` blinks
  it.

**Timing diagrams.** The window shows cycles `[phase, phase + cycles)`. Cycle `i` spans `[i, i + 1)`.
The clock rises at each integer.
- For a register, `data(i)` is its value during cycle `i`. A counter that reads 1 from `T.tick`
  is `data = (i) => Math.max(0, i + 1)`, with `now = (f.t − T.tick) / P`.
- `set({ phase: now − 2, cursor: now })` keeps "now" two cycles from the left.

### Fonts

- Values use digits, `. , + − - % ×` and `万亿`: add `HUD_GLYPHS` to the font subset.
- Labels, units and code come from your source. Text you compute (a custom format, bus values) is
  yours to add.
- `audit` reports what is missing.

`audit` treats a counter's or meter's value as a glimpse while it counts (`allow-brief`), and a
`wave`'s scrolling as intended motion (`allow-motion`).
