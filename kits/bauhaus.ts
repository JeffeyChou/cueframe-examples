// Bauhaus fable (包豪斯寓言): the printed-paper fable of utc8-customs and editing-village (warm paper,
// muted primaries, flat shape characters on thin ink legs, stamps and pencil rings) with the Swiss
// poster grammar (a 12-column grid, primitives with an ink accent, headlines rising through a
// mask, stepped mechanical motion, circle and column wipes). Style bible: kits/styles/bauhaus.md.

import type { MountContext } from '@cueframe/core'
import { clamp01, outCubic, outExpo } from '@cueframe/recipes/motion.js'
import { fiber } from './paper.js'
import { paper } from './materials.js'
import { dress, inkFor, material, type Material, type Outline } from './texture.js'
import { clipUrl, el, f2, mulberry, place, text, type Box, type Pose, type TextOpts } from './svg.js'

export const BH = {
  paper: '#EDE3CC', cream: '#F6F0E2', ink: '#1E1E1E', red: '#C7432F', navy: '#2C3172', mustard: '#E3A72F',
  sage: '#7A8B6F', grey: '#8E8A84', floor: '#D9CBAA', sky: '#F3DDA8',
}
/** Headlines in the serif's black weight, labels in the sans, Latin and numerals in Jost. */
export const TYPE = { serif: '"Noto Serif SC", serif', sans: '"Noto Sans SC", sans-serif', latin: '"Jost", "Noto Sans SC", sans-serif' }

// ── Motion ───────────────────────────────────────────────────────────────────────────────────
export { outExpo }
export const inExpo = (x: number) => (x <= 0 ? 0 : 2 ** (10 * clamp01(x) - 10))
export const inOutExpo = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2)
/** Restrained overshoot (back, s = 0.9): things land, they do not bounce. */
export const settle = (x: number) => { const k = clamp01(x) - 1; return 1 + k * k * (1.9 * k + 0.9) }
/**
 * Stepped mechanics: one step per time in `times`, each `dur` long and eased; returns the steps
 * taken so far (fractional during a step). Indicators, counters and hops move by this, never glide.
 */
export function stepped(t: number, times: readonly number[], dur = 0.18, ease = inOutExpo): number {
  let v = 0
  for (const s of times) v += t >= s + dur ? 1 : t > s ? ease((t - s) / dur) : 0
  return v
}

// ── Grid ─────────────────────────────────────────────────────────────────────────────────────
export const GRID = { margin: 96, cols: 12, gutter: 24 }
/** Column geometry for a stage width: `x(i)` the left edge of column i, `span(i, n)` the width of n columns. */
export function columns(w: number, g = GRID) {
  const cw = (w - 2 * g.margin - (g.cols - 1) * g.gutter) / g.cols
  return { cw, x: (i: number) => g.margin + i * (cw + g.gutter), span: (n: number) => n * cw + (n - 1) * g.gutter, mid: (i: number, n = 1) => g.margin + i * (cw + g.gutter) + (n * cw + (n - 1) * g.gutter) / 2 }
}

/** The grid as hairlines: column edges grow down and the `rows` grow right, staggered; `set(k)` 0..1. */
export function grid(parent: Element, stage: { w: number; h: number }, rows: readonly number[], o: { tone?: string; opacity?: number } = {}) {
  const g = el(parent, 'g', { stroke: o.tone ?? BH.ink, 'stroke-width': 1.5, opacity: o.opacity ?? 0.12 })
  const c = columns(stage.w)
  const xs = [...Array.from({ length: GRID.cols }, (_, i) => [c.x(i), c.x(i) + c.cw]).flat()]
  const v = xs.map((x) => el(g, 'line', { x1: x, x2: x, y1: 0, y2: 0 }))
  const h = rows.map((y) => el(g, 'line', { x1: 0, x2: 0, y1: y, y2: y }))
  return {
    set(k: number) {
      v.forEach((l, i) => l.setAttribute('y2', f2(stage.h * outExpo(clamp01(k * 1.6 - (i / v.length) * 0.6)))))
      h.forEach((l, i) => l.setAttribute('x2', f2(stage.w * outExpo(clamp01(k * 1.6 - 0.2 - i * 0.1)))))
    },
  }
}

/** A rule (a bar of ink) growing from its left end; `set(k)`. */
export function rule(parent: Element, x: number, y: number, w: number, h: number, fill: string = BH.ink) {
  const r = el(parent, 'rect', { x, y, width: 0, height: h, fill })
  return { el: r, set(k: number) { r.setAttribute('width', f2(w * outExpo(clamp01(k)))) } }
}

// ── Type ─────────────────────────────────────────────────────────────────────────────────────
/**
 * A headline whose glyphs rise one by one through a mask at the baseline (expo out, staggered).
 * Returns its width; `set(k)` 0..1 over the whole line, `set(k, -1)` lets the glyphs sink back out.
 */
export function rise(ctx: Pick<MountContext, 'id'>, parent: Element, x: number, y: number, str: string, o: TextOpts & { stagger?: number }) {
  const g = el(parent, 'g')
  const band = clipUrl(ctx, parent, `M-4000 ${f2(y - o.size * 1.02)}H6000V${f2(y + o.size * 0.3)}H-4000Z`)
  g.setAttribute('clip-path', band.url)
  const glyphs = [...str]
  const probe = text(g, 0, 0, '', { ...o, anchor: 'start' })
  const widths = glyphs.map((c) => { probe.textContent = c; return probe.getComputedTextLength() })
  probe.remove()
  const total = widths.reduce((a, b) => a + b, 0)
  let cx = o.anchor === 'middle' ? x - total / 2 : o.anchor === 'end' ? x - total : x
  const parts = glyphs.map((c, i) => { const t = text(g, cx, y, c, { ...o, anchor: 'start' }); cx += widths[i]!; return t })
  const st = o.stagger ?? 0.06, n = parts.length
  return {
    w: total,
    set(k: number, dir: 1 | -1 = 1) {
      parts.forEach((p, i) => {
        const u = clamp01(k * (1 + (n - 1) * st) - i * st)
        const off = dir > 0 ? (1 - outExpo(u)) * o.size * 1.15 : -inExpo(u) * o.size * 1.15
        p.setAttribute('transform', `translate(0 ${f2(off)})`)
        // Parked below the mask (or gone above it) a glyph is hidden, so checks do not see it.
        p.style.visibility = (dir > 0 ? u > 0 : u < 1) ? 'visible' : 'hidden'
      })
    },
  }
}

// ── Paper ────────────────────────────────────────────────────────────────────────────────────
const hash = (x: string) => { let h = 2166136261; for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619); return h >>> 0 }
const sizeOf = (o: Outline): number => typeof o === 'string' ? 100
  : 'rect' in o ? Math.max(o.rect.w, o.rect.h) : 'circle' in o ? 2 * o.circle.r : 'ellipse' in o ? 2 * Math.max(o.ellipse.rx, o.ellipse.ry)
  : Math.max(...o.polygon.map((p) => p.x)) - Math.min(...o.polygon.map((p) => p.x))
/** A flat shape printed on paper (kits/materials.ts `paper`: an edge slightly off true, flecks over the fill). */
export function paperShape(ctx: Pick<MountContext, 'id'> | null, parent: Element, outline: Outline, fill: string, o: { edge?: 'print' | 'cut'; stock?: 'speckle' | 'fibre'; material?: Material } = {}): SVGGElement {
  const g = el(parent, 'g')
  const seed = hash(JSON.stringify(outline)) % 997
  const m = o.material ?? paper(fill, { stock: o.stock ?? 'speckle', edge: o.edge ?? 'print', size: sizeOf(outline), seed })
  if (ctx) material(ctx, g, outline, fill, m, { seed })
  else {
    const plan = dress(outline, fill, m, { seed })
    el(g, 'path', { d: plan.drawn, fill })
    for (const l of plan.layers) el(g, 'path', { d: l.d, ...l.attrs, 'data-cf-audit': 'texture' })
  }
  return g
}
export const rect = (x: number, y: number, w: number, h: number): Outline => ({ rect: { x, y, w, h } })
export const poly = (...pts: number[]): Outline => ({ polygon: pts.flatMap((v, i) => (i % 2 ? [] : [{ x: v, y: pts[i + 1]! }])) })

// ── Primitives ───────────────────────────────────────────────────────────────────────────────
/**
 * The three primitives of the poster, each with its ink accent, centred on (0, 0):
 * a disc with an ink quarter (`set({ turn })` turns the quarter, degrees), a block with a dot in
 * its corner, a wedge (equilateral triangle, `size` its side) with its right half in ink.
 */
export function primitive(ctx: Pick<MountContext, 'id'>, parent: Element, kind: 'disc' | 'block' | 'wedge', size: number, fill: string, accent: string = BH.ink) {
  const g = el(parent, 'g')
  const acc = el(g, 'g')
  if (kind === 'disc') {
    paperShape(ctx, g, { circle: { cx: 0, cy: 0, r: size / 2 } }, fill)
    const r = size / 2
    el(acc, 'path', { d: `M0 0L${f2(r)} 0A${f2(r)} ${f2(r)} 0 0 1 0 ${f2(r)}Z`, fill: accent })
    g.append(acc)
  } else if (kind === 'block') {
    paperShape(ctx, g, rect(-size / 2, -size / 2, size, size), fill)
    el(g, 'circle', { cx: -size * 0.22, cy: -size * 0.22, r: size * 0.16, fill: accent })
  } else {
    const h = (size * Math.sqrt(3)) / 2
    paperShape(ctx, g, poly(0, (-h * 2) / 3, size / 2, h / 3, -size / 2, h / 3), fill)
    el(g, 'path', { d: `M0 ${f2((-h * 2) / 3)}L${f2(size / 2)} ${f2(h / 3)}L0 ${f2(h / 3)}Z`, fill: accent })
  }
  return {
    g,
    set(p: Pose & { turn?: number }) {
      place(g, p)
      if (kind === 'disc') acc.setAttribute('transform', `rotate(${(p.turn ?? 0).toFixed(2)})`)
    },
  }
}

// ── Characters ───────────────────────────────────────────────────────────────────────────────
export type Eyes = 'open' | 'line' | 'wide' | 'dot' | 'squint' | 'wink'
/** Two stroke eyes; returns a setter (centre, half gap, face size, blink 0..1). */
export function eyePair(parent: Element, color: string = BH.ink) {
  const pp = [0, 1].map(() => el(parent, 'path', { fill: 'none', 'stroke-linecap': 'round', stroke: color }))
  return (eyes: Eyes, cx: number, cy: number, gap: number, size: number, blinkK = 0) => pp.forEach((p, i) => {
    const x = cx + (i ? gap : -gap)
    const h = size * 0.2 * (1 - 0.85 * blinkK)
    let d = `M${f2(x)} ${f2(cy - h / 2)}V${f2(cy + h / 2)}`, sw = size * 0.07
    if (eyes === 'line' || blinkK > 0.6 || (eyes === 'wink' && i === 1)) d = `M${f2(x - size * 0.07)} ${f2(cy)}H${f2(x + size * 0.07)}`
    else if (eyes === 'wide') { d = `M${f2(x)} ${f2(cy - h * 0.7)}V${f2(cy + h * 0.7)}`; sw *= 1.3 }
    else if (eyes === 'dot') { d = `M${f2(x)} ${f2(cy)}v0.01`; sw *= 2 }
    else if (eyes === 'squint') d = `M${f2(x - size * 0.07)} ${f2(cy - size * 0.04 * (i ? -1 : 1))}L${f2(x + size * 0.07)} ${f2(cy + size * 0.04 * (i ? -1 : 1))}`
    p.setAttribute('d', d)
    p.setAttribute('stroke-width', sw.toFixed(2))
  })
}

/** A superellipse outline of half-size a: n = 2 is a circle, n ≥ 12 reads as a square. */
export function superellipse(a: number, n: number, steps = 96): string {
  let d = ''
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t)
    const x = a * Math.sign(c) * Math.abs(c) ** (2 / n), y = a * Math.sign(s) * Math.abs(s) ** (2 / n)
    d += `${i ? 'L' : 'M'}${f2(x)} ${f2(y)}`
  }
  return d + 'Z'
}

export type Body = 'circle' | 'square' | 'triangle'
/**
 * A fable character: a flat body (circle, square or triangle, `size` across) on two thin ink legs,
 * paper flecks fixed to the body, stroke eyes. Origin: between the feet on the ground.
 * set(): `spin` turns body and face about the body's centre (rolling), `legs` 0..1 retracts the legs
 * (a rolling circle has none), `morph` 0..1 squares a circle (or rounds a square), `squash` > 0
 * flattens, < 0 stretches, keeping the feet on the ground.
 */
export function figure(ctx: Pick<MountContext, 'id'>, parent: Element, kind: Body, size: number, fill: string, o: { leg?: number; seed?: number } = {}) {
  const g = el(parent, 'g')
  const L = o.leg ?? size * 0.22, a = size / 2
  const legs = el(g, 'g', { stroke: BH.ink, 'stroke-width': Math.max(3, size * 0.03), 'stroke-linecap': 'round' })
  const legL = el(legs, 'line'), legR = el(legs, 'line')
  const body = el(g, 'g')
  const shape = el(body, 'path', { fill })
  const clip = clipUrl(ctx, body, '')
  const fleck = el(el(body, 'g', { 'clip-path': clip.url }), 'path', {
    d: fiber({ rect: { x: -a * 1.2, y: -a * 1.2, w: a * 2.4, h: a * 2.4 } }, { seed: o.seed ?? 11, kind: 'speckle', density: 0.9 }), fill: inkFor(fill), opacity: 0.14,
  })
  fleck.dataset.cfAudit = 'texture'
  const face = el(body, 'g')
  const eyes = eyePair(face)
  const tri = (k: number) => { const h = a * 2 * k; return `M0 ${f2(-h * 0.62)}L${f2(a * 1.05)} ${f2(h * 0.38)}L${f2(-a * 1.05)} ${f2(h * 0.38)}Z` }
  return {
    g, size,
    set(p: Pose & { eyes?: Eyes; look?: number; blink?: number; spin?: number; legs?: number; morph?: number; squash?: number }) {
      place(g, p)
      const lk = clamp01(p.legs ?? 1), q = p.squash ?? 0
      const sy = 1 - q, sx = 1 + q * 0.6, lift = L * lk
      const cy = -lift - a * sy
      const n = kind === 'circle' ? 2 + 16 * clamp01(p.morph ?? 0) ** 1.5 : kind === 'square' ? 40 - 38 * clamp01(p.morph ?? 0) : 0
      const d = kind === 'triangle' ? tri(1) : superellipse(a, n)
      shape.setAttribute('d', d)
      clip.path.setAttribute('d', d)
      body.setAttribute('transform', `translate(0 ${f2(cy)}) rotate(${(p.spin ?? 0).toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`)
      const spread = a * (kind === 'square' ? 0.42 : 0.32)
      legL.setAttribute('x1', f2(-spread)); legL.setAttribute('x2', f2(-spread)); legL.setAttribute('y1', '0'); legL.setAttribute('y2', f2(-lift - 2))
      legR.setAttribute('x1', f2(spread)); legR.setAttribute('x2', f2(spread)); legR.setAttribute('y1', '0'); legR.setAttribute('y2', f2(-lift - 2))
      legs.style.display = lk > 0.02 ? '' : 'none'
      const fy = kind === 'triangle' ? a * 0.05 : -a * 0.12
      eyes(p.eyes ?? 'open', (p.look ?? 0) * a * 0.18, fy, a * 0.22, size * 0.9, p.blink ?? 0)
    },
  }
}

// ── Marks ────────────────────────────────────────────────────────────────────────────────────
/** A rubber-stamp mark: a double-ruled box around `label`, worn by paper flecks, centred on (0, 0). */
export function stamp(parent: Element, label: string, o: { size?: number; color?: string; ground?: string; font?: string; seed?: number } = {}) {
  const g = el(parent, 'g')
  const size = o.size ?? 84, color = o.color ?? BH.red
  const t = text(g, 0, size * 0.36, label, { size, font: o.font ?? TYPE.serif, weight: 900, fill: color, anchor: 'middle', spacing: size * 0.08 })
  const w = t.getComputedTextLength() + size * 0.9, h = size * 1.45
  el(g, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: size * 0.12, fill: 'none', stroke: color, 'stroke-width': size * 0.11 })
  el(g, 'rect', { x: -w / 2 + size * 0.17, y: -h / 2 + size * 0.17, width: w - size * 0.34, height: h - size * 0.34, rx: size * 0.06, fill: 'none', stroke: color, 'stroke-width': size * 0.035 })
  el(g, 'path', { d: fiber(rect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12), { seed: o.seed ?? 3, kind: 'speckle', density: 2.4 }), fill: o.ground ?? BH.cream, opacity: 0.85, 'data-cf-audit': 'texture' })
  g.style.mixBlendMode = 'multiply'
  return { g, w, h, set(p: Pose) { place(g, p) } }
}

/** The stamp's landing: scale from 1.35 to 1 in 0.12 s with a small rotation kick; before `at`, hidden. */
export const stampPose = (t: number, at: number, base: Pose): Pose => {
  const k = clamp01((t - at) / 0.12)
  return { ...base, s: (base.s ?? 1) * (1 + 0.35 * (1 - outCubic(k))), o: t >= at ? 1 : 0 }
}

/** The red pencil ring around a box, drawn on from `set(k)` 0..1 and overshooting its start like a hand. */
export function ring(parent: Element, box: Box, seed: number, o: { pad?: number; width?: number; color?: string } = {}) {
  const pad = o.pad ?? 14
  const rx = box.w / 2 + pad * 1.4, ry = box.h / 2 + pad * (1 + Math.min(0.6, box.w / box.h / 6))
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  const rnd = mulberry(seed)
  const turns = 1.12, n = 96, tilt = (rnd() - 0.5) * 0.25 * Math.min(1, (2 * ry) / rx)
  let d = ''
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI * 0.6 + (i / n) * turns * Math.PI * 2
    const grow = 1 + 0.06 * Math.sin(i * 0.37 + seed) + 0.05 * (i / n)
    const x = cx + Math.cos(a) * rx * grow, y = cy + Math.sin(a) * ry * grow
    d += `${i ? 'L' : 'M'}${f2(cx + (x - cx) * Math.cos(tilt) - (y - cy) * Math.sin(tilt))} ${f2(cy + (x - cx) * Math.sin(tilt) + (y - cy) * Math.cos(tilt))}`
  }
  const p = el(parent, 'path', { d, fill: 'none', stroke: o.color ?? BH.red, 'stroke-width': o.width ?? 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  const len = p.getTotalLength()
  p.setAttribute('stroke-dasharray', `${f2(len)} ${f2(len)}`)
  return { el: p, set(k: number) { p.setAttribute('stroke-dashoffset', f2(len * (1 - clamp01(k)))); p.style.opacity = k > 0 ? '1' : '0' } }
}

/** A speech bubble sized to its text; local origin is the tail tip (`dir` -1 puts the box to the left). */
export function bubble(parent: Element, str: string, o: { size?: number; font?: string; dir?: 1 | -1 } = {}) {
  const g = el(parent, 'g')
  const size = o.size ?? 48
  const t = text(g, 0, 0, str, { size, font: o.font ?? TYPE.sans, weight: 700, fill: BH.ink })
  const w = t.getComputedTextLength() + size * 1.2, h = size * 1.9
  const dir = o.dir ?? 1
  const bx = dir > 0 ? -w * 0.18 : -w * 0.82, by = -h - 46
  t.setAttribute('x', f2(bx + size * 0.6))
  t.setAttribute('y', f2(by + h * 0.66))
  const shape = el(g, 'path', { d: `M${bx + 16} ${by} H${bx + w - 16} Q${bx + w} ${by} ${bx + w} ${by + 16} V${by + h - 16} Q${bx + w} ${by + h} ${bx + w - 16} ${by + h} H${dir > 0 ? 34 : 22} L0 0 L${dir > 0 ? -2 : -34} ${by + h} H${bx + 16} Q${bx} ${by + h} ${bx} ${by + h - 16} V${by + 16} Q${bx} ${by} ${bx + 16} ${by} Z`, fill: BH.cream, stroke: BH.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' })
  g.insertBefore(shape, t)
  return { g, set(p: Pose) { place(g, p) } }
}

// ── Transitions ──────────────────────────────────────────────────────────────────────────────
/**
 * The circle wipe: a disc that first draws in a little (anticipation), then swallows the frame
 * (expo in). `set(k, cx, cy, r0)`: at k = 0 the disc has radius r0 at (cx, cy); at 1 it covers the stage.
 */
export function circleWipe(parent: Element, stage: { w: number; h: number }, fill: string) {
  const c = el(parent, 'circle', { r: 0, fill })
  const far = Math.hypot(stage.w, stage.h)
  return {
    set(k: number, cx: number, cy: number, r0: number) {
      const ant = k < 0.15 ? 1 - Math.sin((k / 0.15) * Math.PI) * 0.06 : 1
      const r = k <= 0 ? 0 : r0 * ant + inExpo(clamp01((k - 0.15) / 0.85)) * far
      c.setAttribute('cx', f2(cx)); c.setAttribute('cy', f2(cy)); c.setAttribute('r', f2(r))
    },
  }
}

/** The column wipe: `n` paper columns rise in turn, each led by a coloured lip; `set(k)` 0..1. */
export function columnWipe(parent: Element, stage: { w: number; h: number }, lips: readonly string[], fill: string = BH.paper) {
  const g = el(parent, 'g')
  const n = lips.length, cw = stage.w / n
  const cols = lips.map((lip) => ({ body: el(g, 'rect', { width: cw + 1, height: 0, fill }), lip: el(g, 'rect', { width: cw + 1, height: 0, fill: lip }) }))
  return {
    set(k: number) {
      cols.forEach((c, i) => {
        const p = inOutExpo(clamp01(k * 1.4 - i * 0.12))
        const y = stage.h * (1 - p), lipH = 16 * (1 - p)
        c.body.setAttribute('x', f2(i * cw)); c.body.setAttribute('y', f2(y)); c.body.setAttribute('height', f2(stage.h - y))
        c.lip.setAttribute('x', f2(i * cw)); c.lip.setAttribute('y', f2(y - lipH)); c.lip.setAttribute('height', f2(p > 0 ? lipH : 0))
      })
    },
  }
}
