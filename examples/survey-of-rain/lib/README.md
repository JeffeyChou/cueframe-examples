# survey-of-rain lib

`schematic.ts` is the overlay this piece is built on, moved out of CueFrame's recipes: a live
"vision analysis" drawn in Canvas2D over footage. It reimplements the overlay rules of
[ComfyUI-Schematic](https://github.com/jeremieLouvaert/ComfyUI-Schematic) (MIT, © 2026 Jeremie
Louvaert): score-ordered placement with seeded jitter, the combined block score, the circle chain,
the label collision resolver, the weight classes and the palettes; no source file is copied. The
cut under it is `kits/beatcut.ts` ([`kits/README.md`](../../../kits/README.md)); hits, footage and
grids come from `cueframe-py` (cueframe `docs/guide/rhythm.md`). Design: cueframe
`docs/design/rhythm-footage-schematic.md`.

## The overlay

The overlay should read as a vision algorithm analysing the picture live, not as decoration: nodes
on a block grid (so they share columns and rows), dense straight lines between them, boxes around
clusters holding float data, short optical-flow trails, "x,y" labels on a stable budget, white ink
with a few red and blue glitch accents, and at most one or two faint construction circles.

`analysis` draws the whole stack in one call, in the order it needs: a pixel zone on the top
cluster, a crosshair on the centre, a faint chain in some shots, a kick wave, the lattice, flow
trails, boxes with live data, dots, a snare scanline and telemetry. It returns the labels, so you
add your own (the slate) and place them all at once:

```ts
const grid = await BlockGrid.load('build/plates/rain')                     // mount: grid.json + grid.u8
const st = style(f.stage, { palette: 'whiteOnDark', font: MONO })           // accents red #ff2a3a, blue #2ad4ff
const fit = s.rain.draw(g, k, area)                                         // plate px → canvas px
const a = analysis(g, st, {
  grid, k, k0: shotFrame, fit, area, density: 0.8, shot: shot.i,
  tracks: { ids: s.rain.tracks(), at: (id, j) => { const q = s.rain.track(id, j, fit); return q.visible ? q : null } },
  music: { low: f.env('low'), high: f.env('high'), kick, kickSince, snare, snareSince },
})
labels(g, [...a.labels, ...slate(st, { tl: 'SCHEMATIC', tr: '01.15' })], st, { audit: f.audit, budget: 10, avoid: title })
```

- **Input.** The grid, its frame `k` and the shot's first frame `k0` (nodes age from it, tracks before
  it are ignored), the plate's `fit` and `area`, `density` 0..1, the shot index, optional `tracks`
  (`ids` move the nodes, `flow` ids draw trails, default all), the `music` (levels and pulses 0..1,
  seconds since the last kick and snare; absent: no hit), the `readout` corner kept clear of nodes
  (default bottom left; the telemetry goes there), the zone's `tag` and an id `prefix`.
- **Options,** one per layer, each `false` to leave it out: `nodes`, `clusters`, `zone`, `crosshair`,
  `chain`, `wave`, `lattice`, `flow`, `boxes`, `dots`, `scan`, `telemetry`. The defaults follow the
  music: threshold 0.24 − 0.1·low (the lattice breathes with the bass), at most 16 + 44·density
  nodes 2 cells apart, lines up to (240 + 170·low) px × zoom, trails brighter with the high band,
  boxes split on a snare; two boxes, three above density 0.7; a zone from 0.7, inside the area and `inset` margins (2.2) from the
  frame's edges (larger than that room, it shrinks to it; with less than a cell, none); labels and telemetry
  from 0.25; a chain in every fourth shot (`chain: { every, phase }`). `telemetry.lines(stats,
  defaults)` rewrites the readout.
- **What it returns:** `labels`, `nodes`, `clusters` (boxable, best first) and `boxed`, `centre`,
  `edges`, `flows`, `stats`. `analyse(st, input, opts)` is the same plan without a canvas (pure; test
  it, or draw your own grammar from it); `gridCentroid(grid, k, fit)` is the score-weighted centre.

The drawers underneath are exported for a grammar of your own:

```ts
const nodes = grid.nodes(k, { smooth: 3, threshold: 0.25, max: 30, spacing: 3, fit, age: 12, from: shotFrame })
const items = [...pixelZone(g, x, y, 168, 144, 24, st, { tag: 'REGION_01', label: false })]
crosshair(g, cx, cy, st, { alpha: 0.35 })
items.push(...lattice(g, nodes, st, { dist: 330, max: 5, accent: 0.08, lengths: 2 }))
vectors(g, ids.map((id) => ({ id, pts: trail(k, 12, (j) => (j >= 0 ? s.rain.track(id, j, fit) : null)) })), st, { gain: 5, accent: 0.15 })
items.push(...boxes(g, clusters(nodes, 3, { min: 3 }), st, { accent: 0.3, split: 7 * pulse(since, 0.1), label: (c) => `${c.id}  ${c.score.toFixed(4)}` }))
items.push(...dots(g, nodes, st, { accent: 0.1 }), ...slate(st, { tl: 'SCHEMATIC', tr: '01.15' }))
labels(g, items, st, { audit: f.audit, budget: 10 })
```

- **The grid.** `BlockGrid` holds a clip's block scores (`cueframe-py footage --grid 32`, or
  `BlockGrid.synth(meta, (k, col, row) => score)` from your own analysis). `nodes(k, o)` takes the
  cells above `threshold` after a box average over ±`smooth` frames, best first, `spacing` cells
  apart, up to `max`, as `{ id: 'c<col>_<row>', x, y, score, col, row }` through `fit` (the one the
  plate's `draw` returns: the grid is in the plate's px). It is pure
  (it reads frames k − smooth … k + smooth) and memoised. Smoothing makes the set change slowly, so
  the lattice flows from frame to frame; `age` counts how long each node has lived (from `from`, a
  shot's first frame), and the drawers grow new nodes in.
- **The lattice.** `lattice` joins nodes closer than `dist`, at most `max` lines each, shortest
  first: lines along a column or row in the construct weight, diagonals in fine. Each half of a line
  is drawn from its own node by that node's age, so a new node reaches into the lattice. `lengths`
  labels the longest column/row lines with their length.
- **Clusters and boxes.** `clusters(nodes, link)` groups nodes at most `link` cells apart; a group's
  id is its first node's, so it holds while that node lives. `boxes` draws a rectangle, corner
  ticks, a marker square and a text marker per group; put live data in it (mean score, its change
  over a few frames, the node count). Box a few compact groups, not every group: a box around half
  the frame says nothing.
- **Nodes that move with the picture.** Grid cells are fixed, so a gull or a rain streak slides
  under them. `advect(nodes, trackIds, k, (id, j) => source.track(id, j, fit))` moves each node by
  the nearby tracks' displacement since its birth (needs `age` in `nodes`), so the lattice glides with
  the subject and hands over when the cell's score drops. A track counts only when it is usable at
  both the node's birth and now.
- **Flow.** `trail(k, len, at)` collects a track's last positions back to the latest missing one;
  `vectors` draws them as short fading polylines with a tick across the head (`gain` stretches slow
  motion).
- Both take what `source.track` returns as is: a sample that is null, not finite or `visible: false`
  (before the track's birth, after its death, out of frame, occluded) is missing, so a trail starts
  after an occlusion and is empty while the point is hidden.
- **Labels.** Drawers return their labels; `labels` places them all at once, dropping any it cannot
  set clear of the others and of the safe margin, and declares the drawn ones with `f.audit.text`.
  With `budget`, labels that carry an `id` (node "x,y" labels) are chosen by the id's hash, then
  score, so the same nodes stay labelled from frame to frame instead of flickering between
  neighbours. Call `pixelZone` before the other marks: it pixelates what is already drawn.
- **Accents.** `accentOf(id, share)` gives a stable red or blue to a small share of ids; `lattice`,
  `dots`, `boxes` and `vectors` take an `accent` share, labels a `tone`. `rgbSplit(g, draw, dx)`
  draws a mark three times (red −dx, blue +dx, the tone on top): drive dx from a decaying pulse, as
  `boxes({ split })` does, with `chroma` on the picture underneath.
- **Circles are rare.** One faint construction chain at most (`chain(g, x, y, st, { n: 2, alpha:
  0.4, centres: false })`), and not in every shot. `detections` (circles with "x,y") remains for
  sparse tracked points.
- Every mark has a weight class (`datum`, `construct`, `fine`, per 1000 px of the short side). Pick
  a palette (`whiteOnDark`, `blackOnLight`, `goldOnDark`, `greenOnDark`) or pass `{ bg, ink }`;
  grade the footage near-mono so the ink and the two accents carry the colour.
- The older scan-driven apparatus is still there: `pickPoints` + `scanSelect` + `follow` for a
  selection that changes a little on each accent, `rays`, `scanline`, `telemetry`, `glide`,
  `flowAngle`, `density`.

