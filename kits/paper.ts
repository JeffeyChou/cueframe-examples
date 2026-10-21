// Paper treatments for SVG/DOM art: the sheet the film is printed on (fixed to the screen) and cut
// paper (rough outlines, fibre fills and cast shadows, fixed to the shape).
// No edge boil by construction: roughness and texture are both geometry in the shape's own units,
// made once at mount from a seed; moving or scaling a shape only transforms them.
// Nothing on a moving shape evaluates noise per frame. Design: cueframe/docs/design/paths-paper-music.md (6b).
// The general engine is texture.ts (any material); paper is one preset of it in materials.ts.

import type { MountContext } from '@cueframe/core'
import { polylines, scatter, type Outline, type Shadow } from './texture.js'

export { boil, boilSet, polylines, roughen, shadowOffset, type Outline, type Pt, type Rough, type Shadow } from './texture.js'

const NS = 'http://www.w3.org/2000/svg'
const f2 = (n: number) => (Math.round(n * 100) / 100).toString()
function el<K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  parent.append(e)
  return e
}

// ── Fibre fills ──────────────────────────────────────────────────────────────────────────────
export interface Fiber { seed: number; kind?: 'fibre' | 'speckle'; density?: number }
const FIBRE_W = 0.6

/**
 * Print texture as path data: short fibres or speckles scattered over an outline, each mark wholly
 * inside it (a speckle's disc, a fibre's curve with its half stroke width), in the outline's own
 * units, made once from a seed. Pass the outline the shape is drawn with (a roughened one too). Draw it as `<path d fill|stroke>` over the shape: it
 * moves and scales with the shape's transform. Geometry, not an SVG `<pattern>`: Chromium caches a
 * pattern's raster tile across frames, so under a changing scale its pixels depend on which frames
 * were drawn before (a determinism failure in the editing-village slice).
 * Same output as `scatter` with mark 'dot' (speckle) or 'fibre', random layout.
 */
export function fiber(outline: Outline, o: Fiber): string {
  const kind = o.kind ?? 'speckle', density = o.density ?? 1
  const base = (kind === 'fibre' ? 60 : 140) * density
  if (!(base > 0)) return ''
  return scatter(outline, { seed: `${kind}:${o.seed}`, mark: kind === 'fibre' ? 'fibre' : 'dot', density: base, ...(kind === 'fibre' ? { width: FIBRE_W } : {}), maxWork: Infinity }).d
}

/** A texture path element for `fiber` marks: speckles are filled, fibres stroked; marked
 * `data-cf-audit="texture"`. */
export function fiberPath(parent: Element, outline: Outline, o: Fiber & { tone: string; opacity?: number }): SVGPathElement {
  const fibre = (o.kind ?? 'speckle') === 'fibre'
  const e = el(parent, 'path', { d: fiber(outline, o), ...(fibre ? { fill: 'none', stroke: o.tone, 'stroke-width': FIBRE_W, 'stroke-linecap': 'round' } : { fill: o.tone }), opacity: o.opacity ?? 0.2 })
  e.dataset.cfAudit = 'texture'
  return e
}

// ── Cut paper ────────────────────────────────────────────────────────────────────────────────
let shadows = 0, clips = 0
function defsOf(parent: Element): Element {
  const svg = parent instanceof SVGSVGElement ? parent : parent.closest('svg')
  if (!svg) throw new Error('cut: parent is not inside an <svg>')
  return svg.querySelector(':scope > defs') ?? el(svg, 'defs')
}
export interface Cut { g: SVGGElement; shape: SVGPathElement; shadow?: SVGPathElement; texture?: SVGPathElement }

/**
 * A cut-paper shape in `parent`: a group (the caller transforms it) holding the cast shadow (the same
 * outline offset by (dx, dy) in the group's space and blurred over a fixed user-space region), the
 * shape, and the texture clipped to it. The shadow therefore turns with the shape; for a fixed light
 * set `shadowOffset()` per frame with `cut.shadow.setAttribute('transform', …)`. A texture is `fiber` marks
 * inside the outline.
 */
export function cut(ctx: Pick<MountContext, 'id'>, parent: Element, outline: string, o: { fill: string; texture?: Fiber & { tone: string; opacity?: number }; shadow?: Shadow }): Cut {
  const g = el(parent, 'g')
  let shadow: SVGPathElement | undefined, texture: SVGPathElement | undefined
  if (o.shadow) {
    const sh = o.shadow, blur = sh.blur ?? 2
    const defs = defsOf(parent)
    const id = ctx.id(`paper-shadow-${++shadows}`)
    const box = bounds(outline)
    const pad = 3 * blur
    // The region is in the shadow path's own space (before its offset), widened by 3σ and rounded outward.
    const x0 = Math.floor(box.x - pad), y0 = Math.floor(box.y - pad)
    const f = el(defs, 'filter', { id, filterUnits: 'userSpaceOnUse', x: x0, y: y0, width: Math.ceil(box.x + box.w + pad) - x0, height: Math.ceil(box.y + box.h + pad) - y0 })
    el(f, 'feGaussianBlur', { stdDeviation: blur })
    shadow = el(g, 'path', { d: outline, 'fill-rule': 'evenodd', fill: sh.color ?? '#1F1C1B', opacity: sh.opacity ?? 0.28, transform: `translate(${f2(sh.dx)} ${f2(sh.dy)})`, filter: `url(#${id})` })
  }
  const shape = el(g, 'path', { d: outline, fill: o.fill, 'fill-rule': 'evenodd' })
  if (o.texture) {
    // Marks are made inside the outline; the clip makes that exact for the drawn shape.
    const clip = el(defsOf(parent), 'clipPath', { id: ctx.id(`paper-clip-${++clips}`), clipPathUnits: 'userSpaceOnUse' })
    el(clip, 'path', { d: outline, 'clip-rule': 'evenodd' })
    texture = fiberPath(el(g, 'g', { 'clip-path': `url(#${clip.id})` }), outline, o.texture)
  }
  return { g, shape, ...(shadow ? { shadow } : {}), ...(texture ? { texture } : {}) }
}

function bounds(d: string): { x: number; y: number; w: number; h: number } {
  const pts = polylines(d, 4).flat()
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

// ── The sheet ────────────────────────────────────────────────────────────────────────────────
export interface Sheet { seed?: number; tone?: string; grain?: number; mottle?: number; vignette?: string }

/**
 * The printed page over the whole stage: fine grain and slow mottling (seeded SVG turbulence in the
 * tone) and a vignette, multiplied over everything below. The page is fixed to the screen and never
 * changes, so its filters are static. (Drawing it into a canvas instead was measured worse in the
 * editing-village slice: a blended full-stage <canvas> made frames depend on render order, and an
 * <img> of the same page doubled the export time.) The blend is set on the scene root: scene roots
 * isolate, so `mix-blend-mode` on an element inside one blends with nothing.
 */
export function sheet(ctx: Pick<MountContext, 'root' | 'stage' | 'id'>, o: Sheet = {}): SVGSVGElement {
  const { w, h } = ctx.stage
  const seed = o.seed ?? 1
  const n = parseInt((o.tone ?? '#8C7A5A').slice(1), 16)
  const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(3))
  ctx.root.style.mixBlendMode = 'multiply'
  const svg = el(ctx.root, 'svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h })
  Object.assign(svg.style, { position: 'absolute', left: '0', top: '0' })
  const defs = el(svg, 'defs')
  const noise = (name: string, freq: number, octaves: number, alpha: string) => {
    const f = el(defs, 'filter', { id: ctx.id(`paper-${name}`), x: 0, y: 0, width: '100%', height: '100%' })
    el(f, 'feTurbulence', { type: 'fractalNoise', baseFrequency: freq, numOctaves: octaves, seed })
    el(f, 'feColorMatrix', { type: 'matrix', values: `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${alpha}` })
    return f.id
  }
  el(svg, 'rect', { width: w, height: h, filter: `url(#${noise('grain', 0.85, 2, '0 0 0 0.9 -0.25')})`, opacity: o.grain ?? 0.3 })
  el(svg, 'rect', { width: w, height: h, filter: `url(#${noise('mottle', 0.0035, 4, '0 0 0 1.4 -0.55')})`, opacity: o.mottle ?? 0.45 })
  const vg = el(defs, 'radialGradient', { id: ctx.id('paper-vignette'), cx: '50%', cy: '48%', r: '75%' })
  el(vg, 'stop', { offset: '55%', 'stop-color': '#fff' })
  el(vg, 'stop', { offset: '100%', 'stop-color': o.vignette ?? '#b9ab90' })
  el(svg, 'rect', { width: w, height: h, fill: `url(#${vg.id})` })
  return svg
}
