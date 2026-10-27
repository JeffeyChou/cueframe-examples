// Newspaper comic (报纸漫画): newsprint, Ben-Day dots in three process colours printed slightly off
// register under a black key plate, panels inked on, balloons, caption boxes, lettered sound
// effects, bursts and speed lines. Style bible: kits/styles/comic.md.
// Everything is SVG geometry made once in mount (no <pattern>: Chromium caches a pattern's tile
// across frames under a changing scale); render only moves, scales and reveals it.

import type { MountContext } from '@cueframe/core'
import { clamp01, outBack, outCubic } from '@cueframe/recipes/motion.js'
import { fiber } from './paper.js'
import { bbox, clipUrl, defsOf, el, ellipseD, f2, mulberry, place, rectD, type Box, type Pose } from './svg.js'

export const COMIC = {
  ink: '#1B1716', paper: '#EFE2C0', white: '#FBF6E6', cyan: '#2F9FD8', magenta: '#E0393E', yellow: '#F5C928', desk: '#2E2622',
}
/** Hand lettering for balloons and captions, block letters for sound effects, Latin sound effects. */
export const FONTS = { letter: '"ZCOOL KuaiLe", sans-serif', sfx: '"ZCOOL QingKe HuangYou", sans-serif', latin: 'Bangers, sans-serif' }
/** How far the colour plates sit off the key plate (print misregistration), in page units. */
export const MIS = { x: 5, y: -4 }
/** Screen angles per plate, as in four-colour printing (yellow at 0 hides the moiré). */
const ANGLE: Record<string, number> = { [COMIC.cyan]: 15, [COMIC.magenta]: 75, [COMIC.yellow]: 0, [COMIC.ink]: 45 }

/** Strong overshoot: balloons and letters land like a slap. */
export const slap = (k: number) => (k <= 0 ? 0 : outBack(k, 2.4))

// ── Plates ───────────────────────────────────────────────────────────────────────────────────
export type Radius = number | ((x: number, y: number) => number)
/**
 * Ben-Day dots over a box as path data: one lattice per plate, anchored at the page origin, `cell`
 * apart and turned by `angle`°, so neighbouring shapes in one colour share the screen. `r` is a
 * radius or a function of the page point (a halftone ramp); dots under 0.5 are left out.
 */
export function dotField(box: Box, o: { cell?: number; r: Radius; angle?: number }): string {
  const cell = o.cell ?? 18, a = ((o.angle ?? 15) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a)
  const corners = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]] as const
  const us = corners.map(([x, y]) => x * ca + y * sa), vs = corners.map(([x, y]) => -x * sa + y * ca)
  const i0 = Math.floor(Math.min(...us) / cell) - 1, i1 = Math.ceil(Math.max(...us) / cell) + 1
  const j0 = Math.floor(Math.min(...vs) / cell) - 1, j1 = Math.ceil(Math.max(...vs) / cell) + 1
  let d = ''
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const u = i * cell, v = j * cell, x = u * ca - v * sa, y = u * sa + v * ca
    if (x < box.x - cell || x > box.x + box.w + cell || y < box.y - cell || y > box.y + box.h + cell) continue
    const r = typeof o.r === 'number' ? o.r : o.r(x, y)
    if (!(r >= 0.5)) continue
    d += `M${f2(x - r)} ${f2(y)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0`
  }
  return d
}

/** A halftone ramp: no dots inside `r0` of (cx, cy), growing to `max` at `r1` and beyond. */
export const radial = (cx: number, cy: number, r0: number, r1: number, max: number, sy = 1) =>
  (x: number, y: number) => max * clamp01((Math.hypot(x - cx, (y - cy) * sy) - r0) / (r1 - r0))

/** A colour: Ben-Day dots (`r` 0.25–0.45 × cell reads as a tint, larger as a solid) or a flat tint. */
export type Plate = { dots: string; r: Radius; cell?: number; angle?: number } | { flat: string; opacity?: number }

/**
 * Colour plates over a shape (path data), offset by MIS and multiplied, so overlapping plates mix
 * (yellow over magenta prints red) and the colour slips off the ink line like cheap newsprint.
 */
export function plates(ctx: Pick<MountContext, 'id'>, parent: Element, d: string, fills: readonly Plate[], box?: Box): SVGGElement {
  const g = el(parent, 'g', { transform: `translate(${MIS.x} ${MIS.y})` })
  g.style.mixBlendMode = 'multiply'
  const b = box ?? bbox(parent, d)
  g.setAttribute('clip-path', clipUrl(ctx, parent, d).url)
  for (const p of fills) {
    if ('flat' in p) el(g, 'path', { d, fill: p.flat, opacity: p.opacity ?? 1 })
    else el(g, 'path', { d: dotField(b, { cell: p.cell ?? 18, r: p.r, angle: p.angle ?? ANGLE[p.dots] ?? 15 }), fill: p.dots, 'data-cf-audit': 'texture' })
  }
  return g
}

/**
 * Halftone shading on the key plate (not offset): ink dots over a shape whose radius follows `r`,
 * multiplied over the colours below — a vignette toward a panel's edges, a shadow, a spotlight.
 */
export function shade(ctx: Pick<MountContext, 'id'>, parent: Element, d: string, r: Radius, o: { cell?: number; angle?: number; color?: string; box?: Box } = {}): SVGGElement {
  const g = el(parent, 'g', { 'clip-path': clipUrl(ctx, parent, d).url })
  g.style.mixBlendMode = 'multiply'
  el(g, 'path', { d: dotField(o.box ?? bbox(parent, d), { cell: o.cell ?? 16, r, angle: o.angle ?? 45 }), fill: o.color ?? COMIC.ink, 'data-cf-audit': 'texture' })
  return g
}

/** The key plate's line: round joins, the ink colour. */
export const inkAttrs = (w: number) => ({ fill: 'none', stroke: COMIC.ink, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })

/**
 * A printed shape: the paper knocked out white under it, its colour plates, its ink outline (`line`
 * 0 for none). The workhorse of every drawing.
 */
export function printed(ctx: Pick<MountContext, 'id'>, parent: Element, d: string, o: { fill?: readonly Plate[]; line?: number; white?: string | false; box?: Box } = {}): SVGGElement {
  const g = el(parent, 'g')
  if (o.white !== false) el(g, 'path', { d, fill: o.white ?? COMIC.white })
  if (o.fill?.length) plates(ctx, g, d, o.fill, o.box)
  if ((o.line ?? 8) > 0) el(g, 'path', { d, ...inkAttrs(o.line ?? 8) })
  return g
}

/** Solid ink (black areas of the key plate). */
export const solid = (parent: Element, d: string) => el(parent, 'path', { d, fill: COMIC.ink })

// ── Page and panels ──────────────────────────────────────────────────────────────────────────
/**
 * A newspaper page lying on a desk: a soft shadow, newsprint with sparse fibres and edges yellowed
 * toward the corners. Fixed to the page, so it moves with the camera; the screen-fixed grain is
 * `sheet()` from paper.ts over the stage.
 */
export function newsprint(ctx: Pick<MountContext, 'id'>, parent: Element, page: Box, seed = 7): SVGGElement {
  const g = el(parent, 'g')
  for (const [k, o] of [[40, 0.12], [24, 0.18], [10, 0.3]] as const) el(g, 'rect', { x: page.x + k * 0.4, y: page.y + k, width: page.w, height: page.h, fill: '#000', opacity: o })
  el(g, 'rect', { x: page.x, y: page.y, width: page.w, height: page.h, fill: COMIC.paper })
  const grad = el(defsOf(g), 'radialGradient', { id: ctx.id(`comic-page-${seed}`), cx: '50%', cy: '50%', r: '72%' })
  el(grad, 'stop', { offset: '45%', 'stop-color': '#B08A4A', 'stop-opacity': 0 })
  el(grad, 'stop', { offset: '100%', 'stop-color': '#B08A4A', 'stop-opacity': 0.34 })
  el(g, 'rect', { x: page.x, y: page.y, width: page.w, height: page.h, fill: `url(#${grad.id})` })
  const fibres = el(g, 'path', { d: fiber({ rect: page }, { seed, kind: 'fibre', density: 0.05 }), fill: 'none', stroke: '#8C6E3E', 'stroke-width': 1.2, opacity: 0.22 })
  fibres.dataset.cfAudit = 'texture'
  return g
}

export interface Panel { box: Box; g: SVGGElement; set(k: number): void }
/**
 * A panel: its content group (clipped to the box, revealed left to right) on knocked-out paper, and
 * the border inked on clockwise from the top left. `set(k)` 0..1 draws both; 1 is the finished panel.
 */
export function panel(ctx: Pick<MountContext, 'id'>, parent: Element, box: Box, o: { line?: number; bg?: readonly Plate[] } = {}): Panel {
  const wrap = el(parent, 'g')
  const clip = clipUrl(ctx, parent, rectD(box))
  const g = el(wrap, 'g', { 'clip-path': clip.url })
  el(g, 'rect', { x: box.x, y: box.y, width: box.w, height: box.h, fill: COMIC.white })
  if (o.bg?.length) plates(ctx, g, rectD(box), o.bg, box)
  const per = 2 * (box.w + box.h)
  const frame = el(wrap, 'path', { d: rectD(box), ...inkAttrs(o.line ?? 10), 'stroke-dasharray': `${f2(per)} ${f2(per)}` })
  return {
    box, g,
    set(k) {
      const u = outCubic(clamp01(k))
      frame.setAttribute('stroke-dashoffset', f2(per * (1 - u)))
      frame.style.display = u > 0 ? '' : 'none'
      clip.path.setAttribute('d', rectD({ x: box.x, y: box.y, w: box.w * clamp01(u * 1.6), h: box.h }))
    },
  }
}

// ── Lettering ────────────────────────────────────────────────────────────────────────────────
function lines(parent: Element, rows: readonly string[], size: number, font: string, weight: number | string = 400): { g: SVGGElement; w: number; h: number } {
  const g = el(parent, 'g')
  let w = 0
  rows.forEach((r, i) => {
    const t = el(g, 'text', { x: 0, y: (i - (rows.length - 1) / 2) * size * 1.12, 'font-size': size, 'font-family': font, 'font-weight': weight, fill: COMIC.ink, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'white-space: pre' }, r)
    w = Math.max(w, t.getComputedTextLength())
  })
  return { g, w, h: rows.length * size * 1.12 }
}

export interface Balloon { g: SVGGElement; rx: number; ry: number; set(p: Pose & { k: number }): void }
/**
 * A balloon sized to its lines; local origin is its centre, `tail` the tip relative to it.
 * speech: an ellipse with a curved tail in one outline; thought: a cloud with bubbles toward the
 * tail; shout: a spiky burst. `set({ k })` pops it in with `slap`.
 */
export function balloon(parent: Element, rows: readonly string[], o: { size: number; font?: string; tail?: [number, number]; kind?: 'speech' | 'thought' | 'shout'; line?: number; seed?: number }): Balloon {
  const g = el(parent, 'g')
  const kind = o.kind ?? 'speech', line = o.line ?? 7
  const shape = el(g, 'g')
  const body = lines(g, rows, o.size, o.font ?? FONTS.letter)
  const rx = body.w / 2 * 1.32 + o.size * 0.55, ry = body.h / 2 * 1.38 + o.size * 0.45
  const [tx, ty] = o.tail ?? [0, 0]
  const P = (a: number, k = 1) => [Math.cos(a) * rx * k, Math.sin(a) * ry * k] as const
  if (kind === 'speech') {
    let d = ellipseD(0, 0, rx, ry)
    if (o.tail) {
      const at = Math.atan2(ty / ry, tx / rx), span = 0.32
      const [ax, ay] = P(at - span), [bx, by] = P(at + span)
      const bend = (tx * 0.25 + ty * 0.25) * 0.4
      d = `M${f2(bx)} ${f2(by)}A${f2(rx)} ${f2(ry)} 0 1 1 ${f2(ax)} ${f2(ay)}Q${f2((ax + tx) / 2 - bend * 0.2)} ${f2((ay + ty) / 2 + bend * 0.2)} ${f2(tx)} ${f2(ty)}Q${f2((bx + tx) / 2)} ${f2((by + ty) / 2)} ${f2(bx)} ${f2(by)}Z`
    }
    el(shape, 'path', { d, ...inkAttrs(line), fill: COMIC.white })
  } else if (kind === 'thought') {
    const n = 11
    let d = ''
    for (let i = 0; i <= n; i++) {
      const [x, y] = P((i / n) * Math.PI * 2, 1.02)
      d += i ? `A${f2(rx * 0.3)} ${f2(ry * 0.36)} 0 0 1 ${f2(x)} ${f2(y)}` : `M${f2(x)} ${f2(y)}`
    }
    el(shape, 'path', { d: d + 'Z', ...inkAttrs(line), fill: COMIC.white })
    if (o.tail) [0.62, 0.8, 0.93].forEach((u, i) => {
      const [ex, ey] = P(Math.atan2(ty / ry, tx / rx), 1.12)
      const r = o.size * (0.32 - i * 0.09)
      el(shape, 'path', { d: ellipseD(ex + (tx - ex) * u, ey + (ty - ey) * u, r * 1.2, r), ...inkAttrs(line * 0.7), fill: COMIC.white })
    })
  } else {
    el(shape, 'path', { d: burstPath(Math.max(rx, ry) * 1.15, 14, o.seed ?? 3, { inner: 0.78, stretch: rx / ry }), ...inkAttrs(line), fill: COMIC.white })
  }
  return { g, rx, ry, set(p) { const s = slap(p.k); place(g, { ...p, s: (p.s ?? 1) * Math.max(0.001, s), o: p.k > 0 ? (p.o ?? 1) : 0 }) } }
}

/**
 * A caption box (the narrator's voice): yellow Ben-Day over paper, an ink border, hand lettering
 * from the left. Local origin: its top-left corner. `set({ k })` unfolds it downward.
 */
export function caption(ctx: Pick<MountContext, 'id'>, parent: Element, str: string, o: { size: number; font?: string; w?: number }): { g: SVGGElement; w: number; h: number; set(p: Pose & { k: number }): void } {
  const g = el(parent, 'g')
  const box = el(g, 'g')
  const t = el(g, 'text', { x: o.size * 0.6, y: o.size * 0.62 + o.size * 0.5, 'font-size': o.size, 'font-family': o.font ?? FONTS.letter, fill: COMIC.ink, 'dominant-baseline': 'central', style: 'white-space: pre' }, str)
  const w = o.w ?? t.getComputedTextLength() + o.size * 1.2, h = o.size * 2.24
  printed(ctx, box, rectD({ x: 0, y: 0, w, h }), { fill: [{ flat: COMIC.yellow, opacity: 0.35 }, { dots: COMIC.yellow, r: 7, cell: 15 }], line: 6, box: { x: 0, y: 0, w, h } })
  return { g, w, h, set(p) { place(g, { ...p, sy: (p.sy ?? 1) * Math.max(0.001, outCubic(clamp01(p.k))), o: p.k > 0 ? (p.o ?? 1) : 0 }) } }
}

export interface Sfx { g: SVGGElement; w: number; set(p: Pose & { k: number }): void }
/**
 * A lettered sound effect: each glyph on its own, with an ink block shadow extruded down-right, a
 * thick ink outline and a colour fill. Local origin: the word's centre. `set({ k })` pops the
 * glyphs in one after another with `slap`, alternately tilted and nudged off the baseline.
 */
export function sfx(parent: Element, word: string, o: { size: number; font?: string; fill?: string; depth?: number; spacing?: number; outline?: number }): Sfx {
  const g = el(parent, 'g')
  const font = o.font ?? FONTS.sfx, depth = o.depth ?? o.size * 0.08, sw = o.outline ?? o.size * 0.1
  const glyphs = [...word]
  const probe = el(g, 'text', { 'font-size': o.size, 'font-family': font })
  const widths = glyphs.map((c) => { probe.textContent = c; return probe.getComputedTextLength() })
  probe.remove()
  const gap = o.spacing ?? o.size * 0.02
  const total = widths.reduce((a, b) => a + b, 0) + gap * (glyphs.length - 1)
  let x = -total / 2
  const parts = glyphs.map((c, i) => {
    const cx = x + widths[i]! / 2
    x += widths[i]! + gap
    const pg = el(g, 'g')
    const attrs = { 'font-size': o.size, 'font-family': font, 'text-anchor': 'middle', 'dominant-baseline': 'central' }
    // The block shadow is decoration, not text to read.
    for (let k = depth; k >= 1; k -= Math.max(1, depth / 6)) el(pg, 'text', { ...attrs, x: k, y: k, fill: COMIC.ink, stroke: COMIC.ink, 'stroke-width': sw, 'stroke-linejoin': 'round', 'data-cf-audit': 'allow-contrast' }, c)
    el(pg, 'text', { ...attrs, fill: o.fill ?? COMIC.yellow, stroke: COMIC.ink, 'stroke-width': sw, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }, c)
    return { pg, cx }
  })
  const n = parts.length, st = 0.18
  return {
    g, w: total,
    set(p) {
      place(g, { ...p, o: p.k > 0 ? (p.o ?? 1) : 0 })
      parts.forEach(({ pg, cx }, i) => {
        const u = clamp01(p.k * (1 + (n - 1) * st) - i * st)
        const s = Math.max(0.001, slap(u))
        pg.setAttribute('transform', `translate(${f2(cx)} ${f2((i % 2 ? -1 : 1) * o.size * 0.04)}) rotate(${i % 2 ? 3.5 : -3}) scale(${s.toFixed(4)})`)
      })
    },
  }
}

// ── Effects ──────────────────────────────────────────────────────────────────────────────────
/** A starburst outline about (0, 0): `n` points, valleys at `inner` × R, `stretch` widens it. */
export function burstPath(R: number, n: number, seed: number, o: { inner?: number; stretch?: number; jitter?: number } = {}): string {
  const rnd = mulberry(seed), inner = o.inner ?? 0.64, st = o.stretch ?? 1.25, j = o.jitter ?? 0
  let d = ''
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + (rnd() - 0.5) * 0.12
    const r = (i % 2 ? R * (inner + rnd() * 0.08) : R * (0.95 + rnd() * 0.2)) + j * (rnd() - 0.5)
    d += `${i ? 'L' : 'M'}${f2(Math.cos(a) * r * st)} ${f2(Math.sin(a) * r)}`
  }
  return d + 'Z'
}

/**
 * An impact: a yellow starburst over a smaller magenta one with yellow dots, inked. Local origin:
 * its centre. `set({ k })` slaps it in; `jitter` (0..1) shivers the points for the first frames.
 */
export function burst(ctx: Pick<MountContext, 'id'>, parent: Element, R: number, o: { seed?: number; n?: number } = {}) {
  const g = el(parent, 'g')
  const seed = o.seed ?? 5, n = o.n ?? 13
  const outer = burstPath(R, n, seed), inner = burstPath(R * 0.7, n - 2, seed + 4)
  printed(ctx, g, outer, { fill: [{ flat: COMIC.yellow }], line: R * 0.035, box: { x: -R * 1.6, y: -R * 1.3, w: R * 3.2, h: R * 2.6 } })
  printed(ctx, g, inner, { fill: [{ flat: COMIC.magenta }, { dots: COMIC.yellow, r: 4.5, cell: 14 }], line: R * 0.024, box: { x: -R * 1.2, y: -R, w: R * 2.4, h: R * 2 } })
  return { g, set(p: Pose & { k: number }) { place(g, { ...p, s: (p.s ?? 1) * Math.max(0.001, slap(p.k)), o: p.k > 0 ? 1 : 0 }) } }
}

/**
 * Speed lines (集中线) toward (cx, cy): `n` thin ink wedges from radius r0 (jittered) out past the
 * box. Draw them inside a panel's content group, which clips them.
 */
export function speedLines(box: Box, cx: number, cy: number, r0: number, n: number, seed: number): string {
  const rnd = mulberry(seed), far = Math.hypot(box.w, box.h) * 1.5
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.05, w = 0.008 + rnd() * 0.012, r = r0 + rnd() * r0 * 0.3
    d += `M${f2(cx + Math.cos(a) * r)} ${f2(cy + Math.sin(a) * r)}L${f2(cx + Math.cos(a - w) * far)} ${f2(cy + Math.sin(a - w) * far)}L${f2(cx + Math.cos(a + w) * far)} ${f2(cy + Math.sin(a + w) * far)}Z`
  }
  return d
}

/** Motion lines trailing an object that moves along `angle`°: `n` strokes behind (0, 0), spread
 * across `spread`, each `len` long (stroke them with `inkAttrs`). */
export function motionLines(angle: number, n: number, len: number, spread: number, seed: number): string {
  const rnd = mulberry(seed), a = (angle * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a)
  let d = ''
  for (let i = 0; i < n; i++) {
    const off = (i / (n - 1) - 0.5) * spread, back = 20 + rnd() * len * 0.3, l = len * (0.55 + rnd() * 0.45)
    const x0 = -ux * back - uy * off, y0 = -uy * back + ux * off
    d += `M${f2(x0)} ${f2(y0)}l${f2(-ux * l)} ${f2(-uy * l)}`
  }
  return d
}

/** Shake marks: pairs of short curved strokes beside an object of half-width `rx`, half-height `ry`. */
export function shakeMarks(rx: number, ry: number, n = 3): string {
  let d = ''
  for (const sd of [-1, 1]) for (let k = 0; k < n; k++) {
    const x = sd * (rx + 18 + k * 20), y = -ry * 0.5 + k * ry * 0.32
    d += `M${f2(x)} ${f2(y)}q${f2(sd * 12)} ${f2(ry * 0.12)} 0 ${f2(ry * 0.24)}`
  }
  return d
}

/** A star (five points by default) about (0, 0). */
export function starPath(r: number, n = 5, inner = 0.45): string {
  let d = ''
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, k = i % 2 ? r * inner : r
    d += `${i ? 'L' : 'M'}${f2(Math.cos(a) * k)} ${f2(Math.sin(a) * k)}`
  }
  return d + 'Z'
}

/** A decaying shiver for impacts: offset in px at `since` seconds after the hit. */
export const shiver = (since: number, amp: number, dur = 0.16, freq = 90) =>
  since < 0 || since > dur ? 0 : Math.sin(since * freq) * amp * (1 - since / dur)
