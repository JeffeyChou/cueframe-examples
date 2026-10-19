// Shared look of 东八区海关: palette and type, SVG helpers, printed-paper shapes, the characters
// (Claude the officer and the disguised travelers, small rigs driven by a pose per frame), the
// booth set and the marks (red ring, UTC+8 stamp, cards, bubbles). Times come from build/cues.json.
import cueTable from './build/cues.json'
export { seg, win, lerp, clamp01, outCubic, inCubic, inOutCubic, outBack, spring, noise1, bump } from '@cueframe/recipes/motion.js'
export { camPath, type Cam } from '@cueframe/recipes/camera.js'
export { pose, blink, envelope, hop, nod, flinch, type Layer } from '@cueframe/recipes/acting.js'
import type { MountContext } from '@cueframe/core'
import { camSvg, type Cam } from '@cueframe/recipes/camera.js'
import { fiber } from '@cueframe/recipes/paper.js'
import { paper } from '@cueframe/recipes/materials.js'
import { dress, material, roughen, type Material, type Outline } from '@cueframe/recipes/texture.js'
import { clamp01, lerp } from '@cueframe/recipes/motion.js'

export const CUES: Record<string, number> = cueTable
export const start = (id: string) => CUES[`scene.${id}.start`]!
export const end = (id: string) => CUES[`scene.${id}.end`]!

export const W = 1920
export const H = 1080
export const C = {
  paper: '#EDE3CC', cream: '#F6F0E2', ink: '#1E1E1E', red: '#C7432F', navy: '#2C3172', mustard: '#E3A72F',
  claude: '#D97757', sage: '#7A8B6F', floor: '#D9CBAA', screen: '#1D2246', grey: '#8E8A84', sky: '#F3DDA8',
}
export const SANS = '"Noto Sans SC", sans-serif'
export const SERIF = '"Noto Serif SC", serif'
export const JOST = '"Jost", "Noto Sans SC", sans-serif'
export const MONO = '"IBM Plex Mono", "Noto Sans SC", monospace'
export const GROUND = 860

// ---------- SVG ----------
const NS = 'http://www.w3.org/2000/svg'
type Attrs = Record<string, string | number>
export function s<K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Attrs = {}, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (text !== undefined) e.textContent = text
  parent.append(e)
  return e
}
const kits = new WeakMap<SVGSVGElement, Pick<MountContext, 'id'>>()
/** A full-stage SVG in logical px; shapes drawn into it with `paperShape` are printed paper. */
export function stageSvg(ctx: Pick<MountContext, 'root' | 'id'>, bg?: string): SVGSVGElement {
  const svg = s(ctx.root as unknown as Element, 'svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H }) as SVGSVGElement
  Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', overflow: 'hidden' })
  kits.set(svg, ctx)
  if (bg) s(svg, 'rect', { width: W, height: H, fill: bg })
  return svg
}
export const camera = (g: SVGGElement, c: Cam) => g.setAttribute('transform', camSvg(c, { w: W, h: H }))

const hash = (x: string) => { let h = 2166136261; for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619); return h >>> 0 }
const sizeOf = (o: Outline): number => typeof o === 'string' ? 100
  : 'rect' in o ? Math.max(o.rect.w, o.rect.h) : 'circle' in o ? 2 * o.circle.r : 'ellipse' in o ? 2 * Math.max(o.ellipse.rx, o.ellipse.ry)
  : Math.max(...o.polygon.map((p) => p.x)) - Math.min(...o.polygon.map((p) => p.x))
/** A flat shape printed on paper (the `paper` material: an edge slightly off true, speckle over the fill). */
export function paperShape(parent: Element, outline: Outline, fill: string, o: { edge?: 'print' | 'cut'; stock?: 'speckle' | 'fibre'; material?: Material } = {}): SVGGElement {
  const g = s(parent, 'g')
  const seed = hash(JSON.stringify(outline)) % 997
  const m = o.material ?? paper(fill, { stock: o.stock ?? 'speckle', edge: o.edge ?? 'print', size: sizeOf(outline), seed })
  const svg = parent.closest('svg'), kit = svg && kits.get(svg)
  if (kit) material(kit, g, outline, fill, m, { seed })
  else {
    const plan = dress(outline, fill, m, { seed })
    s(g, 'path', { d: plan.drawn, fill })
    for (const l of plan.layers) s(g, 'path', { d: l.d, ...l.attrs, 'data-cf-audit': 'texture' })
  }
  return g
}
const rect = (x: number, y: number, w: number, h: number): Outline => ({ rect: { x, y, w, h } })
const poly = (...pts: number[]): Outline => ({ polygon: pts.flatMap((v, i) => i % 2 ? [] : [{ x: v, y: pts[i + 1]! }]) })

export interface Pose { x: number; y: number; s?: number; sx?: number; sy?: number; rot?: number; o?: number }
/** Places a group whose local origin is its pivot (characters: the middle of their feet). */
export function place(g: SVGGElement, p: Pose) {
  g.dataset.cfAudit = 'allow-motion'
  const k = p.s ?? 1
  g.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${(p.rot ?? 0).toFixed(3)}) scale(${(k * (p.sx ?? 1)).toFixed(4)} ${(k * (p.sy ?? 1)).toFixed(4)})`)
  g.style.opacity = String(p.o ?? 1)
}
export const BODY = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, o: 1, look: 0, blink: 0 }
/** The film's acting style: short anticipation, a firm overshoot (stamps land hard). */
export const STYLE = { anticipate: 0.1, antic: 0.2, overshoot: 2 }

export function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- text ----------
export interface TextOpts { size: number; font?: string; weight?: number | string; fill?: string; anchor?: 'start' | 'middle' | 'end'; spacing?: number }
export function text(parent: Element, x: number, y: number, str: string, o: TextOpts): SVGTextElement {
  return s(parent, 'text', {
    x, y, 'font-size': o.size, 'font-family': o.font ?? SANS, 'font-weight': o.weight ?? 700, fill: o.fill ?? C.ink,
    'text-anchor': o.anchor ?? 'start', style: 'white-space: pre', ...(o.spacing ? { 'letter-spacing': o.spacing } : {}),
  }, str)
}
/**
 * One line of text in pieces, laid out left to right from (x, y); returns each piece's box so a ring
 * can find it. Pieces are separate <text> nodes measured after the fonts load (mount).
 */
export function pieces(parent: Element, x: number, y: number, parts: readonly string[], o: TextOpts) {
  let cx = x
  return parts.map((p) => {
    const t = text(parent, cx, y, p, { ...o, anchor: 'start' })
    const w = t.getComputedTextLength()
    const box = { x: cx, y: y - o.size * 0.82, w, h: o.size * 1.05, el: t }
    cx += w
    return box
  })
}

// ---------- marks ----------
/**
 * The red pencil ring around a clue: a rough ellipse drawn on from `k` 0..1, overshooting its start
 * like a hand would. The box is the clue's bounds; `pad` grows it.
 */
export function ring(parent: Element, box: { x: number; y: number; w: number; h: number }, seed: number, o: { pad?: number; width?: number } = {}) {
  const pad = o.pad ?? 14
  // A wide clue gets a rounder ring and almost no tilt, so the ring clears the text above and below.
  const rx = box.w / 2 + pad * 1.4, ry = box.h / 2 + pad * (1 + Math.min(0.6, box.w / box.h / 6))
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  const rnd = mulberry(seed)
  const turns = 1.12, n = 96, tilt = (rnd() - 0.5) * 0.25 * Math.min(1, (2 * ry) / rx)
  let d = ''
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI * 0.6 + (i / n) * turns * Math.PI * 2
    const grow = 1 + 0.06 * Math.sin(i * 0.37 + seed) + 0.05 * (i / n)
    const x = cx + Math.cos(a) * rx * grow, y = cy + Math.sin(a) * ry * grow
    const xr = cx + (x - cx) * Math.cos(tilt) - (y - cy) * Math.sin(tilt), yr = cy + (x - cx) * Math.sin(tilt) + (y - cy) * Math.cos(tilt)
    d += `${i ? 'L' : 'M'}${xr.toFixed(1)} ${yr.toFixed(1)}`
  }
  const p = s(parent, 'path', { d, fill: 'none', stroke: C.red, 'stroke-width': o.width ?? 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  const len = p.getTotalLength()
  p.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${len.toFixed(1)}`)
  return { el: p, set(k: number) { p.setAttribute('stroke-dashoffset', (len * (1 - clamp01(k))).toFixed(1)); p.style.opacity = k > 0 ? '1' : '0' } }
}

/** The UTC+8 stamp mark: a double-ruled red box, worn by paper flecks, centred on (0, 0). */
export function stampMark(parent: Element, scale = 1, seed = 3, ground: string = C.cream) {
  const g = s(parent, 'g')
  const inner = s(g, 'g', { transform: `scale(${scale})` })
  const w = 300, h = 120
  s(inner, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 10, fill: 'none', stroke: C.red, 'stroke-width': 9 })
  s(inner, 'rect', { x: -w / 2 + 14, y: -h / 2 + 14, width: w - 28, height: h - 28, rx: 5, fill: 'none', stroke: C.red, 'stroke-width': 3 })
  text(inner, 0, 30, 'UTC+8', { size: 84, font: JOST, weight: 700, fill: C.red, anchor: 'middle', spacing: 2 })
  s(inner, 'path', { d: fiber(rect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12), { seed, kind: 'speckle', density: 2.4 }), fill: ground, opacity: 0.85, 'data-cf-audit': 'texture' })
  // On paper the ink multiplies into the page; on a dark ground it is printed as is.
  if (ground === C.cream) g.style.mixBlendMode = 'multiply'
  return { g, set(p: Pose) { place(g, p) } }
}

/** A cream card with a title, slightly cut-edged; local origin is its centre. */
export function card(parent: Element, label: string, o: { w?: number; h?: number; size?: number; fill?: string; font?: string } = {}) {
  const g = s(parent, 'g')
  const w = o.w ?? 300, h = o.h ?? 190
  s(g, 'rect', { x: -w / 2 + 8, y: -h / 2 + 10, width: w, height: h, fill: C.ink, opacity: 0.18 })
  paperShape(g, rect(-w / 2, -h / 2, w, h), o.fill ?? C.cream, { edge: 'cut', stock: 'fibre' })
  for (let i = 0; i < 3; i++) s(g, 'line', { x1: -w / 2 + 34, x2: w / 2 - 34 - i * 40, y1: 22 + i * 26, y2: 22 + i * 26, stroke: C.grey, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.55 })
  const t = text(g, 0, -h / 2 + 64, label, { size: o.size ?? 44, font: o.font ?? SERIF, weight: 900, anchor: 'middle' })
  return { g, label: t, w, h, set(p: Pose) { place(g, p) } }
}

/** A speech bubble with its tail toward (tx, ty), sized to its text; local origin is the tail tip. */
export function bubble(parent: Element, str: string, o: { size?: number; font?: string; dir?: 1 | -1 } = {}) {
  const g = s(parent, 'g')
  const size = o.size ?? 48
  const t = text(g, 0, 0, str, { size, font: o.font ?? SANS, weight: 700 })
  const w = t.getComputedTextLength() + size * 1.2, h = size * 1.9
  const dir = o.dir ?? 1
  const bx = dir > 0 ? -w * 0.18 : -w * 0.82, by = -h - 46
  t.setAttribute('x', String(bx + size * 0.6))
  t.setAttribute('y', String(by + h * 0.66))
  const shape = s(g, 'path', { d: `M${bx + 16} ${by} H${bx + w - 16} Q${bx + w} ${by} ${bx + w} ${by + 16} V${by + h - 16} Q${bx + w} ${by + h} ${bx + w - 16} ${by + h} H${dir > 0 ? 34 : 22} L0 0 L${dir > 0 ? -2 : -34} ${by + h} H${bx + 16} Q${bx} ${by + h} ${bx} ${by + h - 16} V${by + 16} Q${bx} ${by} ${bx + 16} ${by} Z`, fill: C.cream, stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' })
  g.insertBefore(shape, t)
  return { g, set(p: Pose) { place(g, p) } }
}

/** The magnifying glass: lens centre at the origin, handle down-right. */
export function lens(parent: Element, r = 120) {
  const g = s(parent, 'g')
  s(g, 'line', { x1: r * 0.72, y1: r * 0.72, x2: r * 1.7, y2: r * 1.7, stroke: C.ink, 'stroke-width': r * 0.2, 'stroke-linecap': 'round' })
  s(g, 'circle', { r, fill: C.cream, opacity: 0.22 })
  s(g, 'circle', { r, fill: 'none', stroke: C.ink, 'stroke-width': r * 0.11 })
  s(g, 'path', { d: `M${-r * 0.55} ${-r * 0.3} A${r * 0.65} ${r * 0.65} 0 0 1 ${-r * 0.2} ${-r * 0.62}`, fill: 'none', stroke: C.cream, 'stroke-width': r * 0.07, 'stroke-linecap': 'round' })
  return { g, set(p: Pose) { place(g, p) } }
}

// ---------- characters ----------
export type Eyes = 'open' | 'line' | 'wide' | 'dot'
function eyePair(parent: Element, color: string) {
  const pp = [0, 1].map(() => s(parent, 'path', { fill: 'none', 'stroke-linecap': 'round', stroke: color }))
  return (eyes: Eyes, cx: number, cy: number, gap: number, size: number, blinkK: number) => pp.forEach((p, i) => {
    const x = cx + (i ? gap : -gap)
    const h = size * 0.2 * (1 - 0.85 * blinkK)
    let d = `M${x} ${cy - h / 2} V${cy + h / 2}`, sw = size * 0.07
    if (eyes === 'line' || blinkK > 0.6) d = `M${x - size * 0.07} ${cy} H${x + size * 0.07}`
    else if (eyes === 'wide') { d = `M${x} ${cy - h * 0.7} V${cy + h * 0.7}`; sw *= 1.3 }
    else if (eyes === 'dot') { d = `M${x} ${cy} v0.01`; sw *= 2 }
    p.setAttribute('d', d)
    p.setAttribute('stroke-width', sw.toFixed(2))
  })
}

/**
 * Claude the officer: the salmon square with its asterisk, a navy peaked cap with a mustard badge.
 * Local origin: the middle of the square's bottom edge (it sits behind the counter).
 */
export function officer(parent: Element, a: number) {
  const g = s(parent, 'g')
  paperShape(g, rect(-a / 2, -a, a, a), C.claude)
  const star = s(g, 'g', { transform: `translate(${a * 0.28} ${-a * 0.42})`, stroke: C.cream, 'stroke-width': a * 0.04, 'stroke-linecap': 'round' })
  for (let k = 0; k < 4; k++) s(star, 'line', { x1: 0, y1: -a * 0.08, x2: 0, y2: a * 0.08, transform: `rotate(${k * 45})` })
  const face = s(g, 'g')
  face.append(star)
  const eyes = eyePair(face, C.ink)
  const cap = s(g, 'g')
  paperShape(cap, poly(-a * 0.56, -a * 0.98, -a * 0.44, -a * 1.32, a * 0.5, -a * 1.32, a * 0.6, -a * 0.98), C.navy)
  s(cap, 'rect', { x: -a * 0.62, y: -a * 1.02, width: a * 1.24, height: a * 0.09, fill: C.ink })
  s(cap, 'path', { d: `M${-a * 0.62} ${-a * 0.94} Q${-a * 0.85} ${-a * 0.9} ${-a * 0.9} ${-a * 0.84} H${-a * 0.55} Z`, fill: C.ink })
  s(cap, 'circle', { cx: 0, cy: -a * 1.17, r: a * 0.08, fill: C.mustard })
  return {
    g,
    /** `back`: seen from behind (no face, the visor turned away). */
    set(p: Pose & { eyes?: Eyes; look?: number; blink?: number; cap?: number; back?: boolean }) {
      place(g, p)
      face.style.display = p.back ? 'none' : ''
      cap.setAttribute('transform', `rotate(${(p.cap ?? 0).toFixed(2)} 0 ${-a})`)
      eyes(p.eyes ?? 'open', (p.look ?? 0) * a * 0.1 - a * 0.08, -a * 0.7, a * 0.15, a, p.blink ?? 0)
    },
  }
}

/** Two thin legs under a body bottom at -lift. */
function legs(g: Element, h: number, spread: number, lift: number) {
  const l = s(g, 'g', { stroke: C.ink, 'stroke-width': Math.max(3, h * 0.016), 'stroke-linecap': 'round' })
  s(l, 'line', { x1: -spread, y1: 0, x2: -spread, y2: -lift })
  s(l, 'line', { x1: spread, y1: 0, x2: spread, y2: -lift })
}

export type Disguise = 'kevin' | 'tanaka' | 'lim' | 'dev' | 'mike'
/**
 * A traveler: a body shape in a disguise. kevin: red triangle, cowboy hat, sunglasses. tanaka: navy
 * square in a kimono with a red obi. lim: mustard circle in a Merlion cap. dev: grey square in a
 * hoodie. mike: sage circle in a navy NY cap. `h` is the height without the hat; origin at the feet.
 * `hat` 0..1 knocks the hat askew (the stamp's jolt).
 */
export function traveler(parent: Element, kind: Disguise, h: number) {
  const g = s(parent, 'g')
  const lift = h * 0.08
  const body = h - lift
  let face = { x: 0, y: -h * 0.6, size: h * 0.55 }
  const hatG = s(g, 'g')
  let hatPivot = { x: 0, y: -h }
  const ink = C.ink
  if (kind === 'kevin') {
    const b = h * 0.62
    legs(g, h, b * 0.16, lift)
    paperShape(g, poly(-b / 2, -lift, 0, -h, b / 2, -lift), C.red)
    face = { x: 0, y: -h * 0.52, size: h * 0.4 }
    hatPivot = { x: 0, y: -h * 0.86 }
    paperShape(hatG, { ellipse: { cx: 0, cy: -h * 0.86, rx: b * 0.55, ry: h * 0.035 } }, C.mustard)
    paperShape(hatG, poly(-b * 0.24, -h * 0.87, -b * 0.2, -h * 1.06, -b * 0.04, -h * 1.02, 0, -h * 1.05, b * 0.04, -h * 1.02, b * 0.2, -h * 1.06, b * 0.24, -h * 0.87), C.mustard)
    s(hatG, 'rect', { x: -b * 0.235, y: -h * 0.915, width: b * 0.47, height: h * 0.03, fill: C.ink })
  } else if (kind === 'tanaka' || kind === 'dev') {
    const a = body
    const w = a * 0.62
    legs(g, h, w * 0.22, lift)
    paperShape(g, rect(-w / 2, -h, w, a), kind === 'tanaka' ? C.navy : C.grey)
    face = { x: 0, y: -h * 0.8, size: w * 0.55 }
    if (kind === 'tanaka') {
      // kimono: cream collar crossing left over right, a red obi
      s(g, 'path', { d: `M${-w * 0.28} ${-h * 0.62} L${w * 0.1} ${-h * 0.32} L${w * 0.2} ${-h * 0.32} L${-w * 0.16} ${-h * 0.62} Z`, fill: C.cream })
      s(g, 'path', { d: `M${w * 0.28} ${-h * 0.62} L${w * 0.02} ${-h * 0.42} L${w * 0.08} ${-h * 0.38} L${w * 0.16} ${-h * 0.62} Z`, fill: C.cream })
      paperShape(g, rect(-w / 2, -h * 0.36, w, h * 0.09), C.red)
      s(g, 'rect', { x: -w * 0.04, y: -h * 0.36, width: w * 0.08, height: h * 0.09, fill: C.mustard })
    } else {
      // hoodie: a darker hood ring around the face and two strings
      s(g, 'path', { d: `M${-w * 0.42} ${-h * 0.55} Q${-w * 0.46} ${-h * 0.98} 0 ${-h * 0.99} Q${w * 0.46} ${-h * 0.98} ${w * 0.42} ${-h * 0.55}`, fill: 'none', stroke: '#5E5A55', 'stroke-width': w * 0.1 })
      s(g, 'line', { x1: -w * 0.1, x2: -w * 0.12, y1: -h * 0.56, y2: -h * 0.4, stroke: C.cream, 'stroke-width': 4 })
      s(g, 'line', { x1: w * 0.1, x2: w * 0.12, y1: -h * 0.56, y2: -h * 0.4, stroke: C.cream, 'stroke-width': 4 })
    }
  } else {
    const r = body / 2
    legs(g, h, r * 0.3, lift)
    paperShape(g, { circle: { cx: 0, cy: -lift - r, r } }, kind === 'lim' ? C.mustard : C.sage)
    face = { x: 0, y: -lift - r * 1.05, size: r * 1.1 }
    hatPivot = { x: 0, y: -lift - r * 1.7 }
    if (kind === 'lim') {
      // Merlion cap: a cream lion dome with a mane fringe and a blue fish tail curling up behind
      s(hatG, 'path', { d: `M${r * 0.55} ${-lift - r * 1.72} Q${r * 1.05} ${-lift - r * 1.9} ${r * 0.98} ${-lift - r * 2.32} Q${r * 0.86} ${-lift - r * 2.05} ${r * 0.62} ${-lift - r * 2.02} Z`, fill: C.navy })
      paperShape(hatG, { ellipse: { cx: 0, cy: -lift - r * 1.66, rx: r * 0.78, ry: r * 0.42 } }, C.cream)
      for (let i = 0; i < 7; i++) s(hatG, 'circle', { cx: -r * 0.72 + i * r * 0.24, cy: -lift - r * 1.32, r: r * 0.11, fill: C.cream })
      s(hatG, 'circle', { cx: -r * 0.3, cy: -lift - r * 1.78, r: r * 0.05, fill: ink })
      s(hatG, 'circle', { cx: r * 0.1, cy: -lift - r * 1.78, r: r * 0.05, fill: ink })
    } else {
      // NY cap: navy dome, a visor to the front, two letters
      paperShape(hatG, { ellipse: { cx: 0, cy: -lift - r * 1.66, rx: r * 0.74, ry: r * 0.42 } }, C.navy)
      s(hatG, 'rect', { x: -r * 0.8, y: -lift - r * 1.7, width: r * 1.6, height: r * 0.4, fill: C.sage })
      s(hatG, 'path', { d: `M${-r * 0.2} ${-lift - r * 1.32} H${-r * 1.15} Q${-r * 1.1} ${-lift - r * 1.2} ${-r * 0.7} ${-lift - r * 1.24} Z`, fill: C.navy })
      text(hatG, 0, -lift - r * 1.5, 'NY', { size: r * 0.32, font: JOST, weight: 700, fill: C.cream, anchor: 'middle' })
    }
  }
  const eyes = eyePair(g, kind === 'tanaka' ? C.cream : ink)
  const shades = kind === 'kevin' ? s(g, 'g') : null
  if (shades) {
    const u = face.size
    s(shades, 'rect', { x: -u * 0.38, y: face.y - u * 0.12, width: u * 0.34, height: u * 0.2, rx: u * 0.06, fill: ink })
    s(shades, 'rect', { x: u * 0.04, y: face.y - u * 0.12, width: u * 0.34, height: u * 0.2, rx: u * 0.06, fill: ink })
    s(shades, 'rect', { x: -u * 0.06, y: face.y - u * 0.08, width: u * 0.12, height: u * 0.04, fill: ink })
  }
  g.append(hatG)
  return {
    g,
    set(p: Pose & { eyes?: Eyes; look?: number; blink?: number; hat?: number; bow?: number }) {
      place(g, { ...p, rot: (p.rot ?? 0) + (p.bow ?? 0) * 28 })
      const k = p.hat ?? 0
      hatG.setAttribute('transform', `translate(${(k * h * 0.08).toFixed(2)} ${(k * h * 0.02).toFixed(2)}) rotate(${(k * 22).toFixed(2)} ${hatPivot.x} ${hatPivot.y})`)
      const lx = (p.look ?? 0) * face.size * 0.12
      if (shades) shades.setAttribute('transform', `translate(${lx.toFixed(2)} 0)`)
      eyes(shades ? 'line' : p.eyes ?? 'open', face.x + lx, face.y, face.size * 0.17, face.size, shades ? 1 : p.blink ?? 0)
      if (shades) eyes('line', 0, -9999, 0, 0, 1)
    },
  }
}

/** A passport on its side: a coloured cover with the country in Jost; centre origin. */
export function passport(parent: Element, country: string, fill = C.navy, w = 150) {
  const g = s(parent, 'g')
  const h = w * 1.36
  paperShape(g, rect(-w / 2, -h / 2, w, h), fill, { edge: 'cut' })
  s(g, 'circle', { cx: 0, cy: -h * 0.06, r: w * 0.2, fill: 'none', stroke: C.mustard, 'stroke-width': 4 })
  text(g, 0, -h * 0.3, 'PASSPORT', { size: w * 0.12, font: JOST, weight: 600, fill: C.mustard, anchor: 'middle', spacing: 2 })
  text(g, 0, h * 0.34, country, { size: w * 0.16, font: JOST, weight: 700, fill: C.mustard, anchor: 'middle', spacing: 1 })
  return { g, set(p: Pose) { place(g, p) } }
}

// ---------- the booth set (side elevation) ----------
export const BOOTH = { x0: 1180, x1: 1640, top: 410, win: [470, 700] as const, counter: 700 }
/**
 * The booth: a navy cabin with a window, a red roof slab and a mustard counter jutting toward the
 * traveler; Claude sits in the window, its body hidden below the counter. Returns the layers so a
 * scene can put Claude between back wall and counter front.
 */
export function booth(parent: Element) {
  const back = s(parent, 'g')
  const { x0, x1, top, win, counter } = BOOTH
  paperShape(back, rect(x0, top, x1 - x0, GROUND - top), C.navy)
  paperShape(back, rect(x0 + 40, win[0], x1 - x0 - 80, win[1] - win[0]), '#E5D6B6')
  paperShape(back, rect(x0 - 40, top - 34, x1 - x0 + 80, 40), C.red)
  const mid = s(parent, 'g')
  const front = s(parent, 'g')
  paperShape(front, rect(x0, counter, x1 - x0, GROUND - counter), C.navy)
  paperShape(front, rect(x0 - 150, counter - 10, x1 - x0 + 190, 30), C.mustard, { edge: 'cut' })
  s(front, 'rect', { x: x0 + 40, y: counter + 60, width: x1 - x0 - 80, height: 8, fill: C.ink, opacity: 0.35 })
  return { back, mid, front }
}

/** The room: wall, floor band, the floor line. */
export function room(parent: Element) {
  s(parent, 'rect', { x: -2000, y: GROUND, width: 6000, height: 1000, fill: C.floor })
  s(parent, 'line', { x1: -2000, x2: 4000, y1: GROUND, y2: GROUND, stroke: C.ink, 'stroke-width': 5 })
}

/** A queue post with its red belt to the next post at x2 (or none). */
export function stanchion(parent: Element, x: number, x2?: number) {
  const g = s(parent, 'g')
  if (x2 !== undefined) s(g, 'path', { d: `M${x} ${GROUND - 150} Q${(x + x2) / 2} ${GROUND - 120} ${x2} ${GROUND - 150}`, fill: 'none', stroke: C.red, 'stroke-width': 14 })
  s(g, 'rect', { x: x - 7, y: GROUND - 170, width: 14, height: 170, fill: C.ink })
  s(g, 'ellipse', { cx: x, cy: GROUND - 2, rx: 36, ry: 9, fill: C.ink })
  s(g, 'circle', { cx: x, cy: GROUND - 172, r: 13, fill: C.ink })
  return g
}

/** The ring box of a full-width punctuation mark: its ink sits in the left half of the em box. */
export const punct = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w * 0.04, y: b.y + b.h * 0.1, w: b.w * 0.5, h: b.h * 0.85 })

/** A wall clock showing hh:mm with a city label below; `taped` crosses it out with two strips. */
export function wallClock(parent: Element, x: number, y: number, r: number, city: string, hh: number, mm: number, taped = false) {
  const g = s(parent, 'g')
  paperShape(g, { circle: { cx: x, cy: y, r } }, C.cream)
  s(g, 'circle', { cx: x, cy: y, r, fill: 'none', stroke: C.ink, 'stroke-width': 8 })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    s(g, 'line', { x1: x + Math.sin(a) * r * 0.8, y1: y - Math.cos(a) * r * 0.8, x2: x + Math.sin(a) * r * 0.9, y2: y - Math.cos(a) * r * 0.9, stroke: C.ink, 'stroke-width': i % 3 ? 3 : 6 })
  }
  const ha = ((hh % 12) + mm / 60) / 12 * Math.PI * 2, ma = (mm / 60) * Math.PI * 2
  s(g, 'line', { x1: x, y1: y, x2: x + Math.sin(ha) * r * 0.5, y2: y - Math.cos(ha) * r * 0.5, stroke: C.ink, 'stroke-width': 9, 'stroke-linecap': 'round' })
  s(g, 'line', { x1: x, y1: y, x2: x + Math.sin(ma) * r * 0.75, y2: y - Math.cos(ma) * r * 0.75, stroke: C.red, 'stroke-width': 5, 'stroke-linecap': 'round' })
  s(g, 'circle', { cx: x, cy: y, r: 8, fill: C.ink })
  text(g, x, y + r + 46, city, { size: 30, font: JOST, weight: 600, anchor: 'middle', spacing: 3 })
  if (taped) {
    paperShape(g, poly(x - r * 1.25, y - r * 0.95, x - r * 1.05, y - r * 1.2, x + r * 1.25, y + r * 0.95, x + r * 1.05, y + r * 1.2), C.mustard, { edge: 'cut' })
    paperShape(g, poly(x + r * 1.05, y - r * 1.2, x + r * 1.25, y - r * 0.95, x - r * 1.05, y + r * 1.2, x - r * 1.25, y + r * 0.95), C.mustard, { edge: 'cut' })
  }
  return g
}

/** The rubber stamp in Claude's hand: red rubber, wooden handle; origin at the rubber's face. */
export function stamp(parent: Element, a = 1) {
  const g = s(parent, 'g')
  paperShape(g, { ellipse: { cx: 0, cy: -150 * a, rx: 38 * a, ry: 34 * a } }, '#8A5A34')
  paperShape(g, rect(-14 * a, -124 * a, 28 * a, 70 * a), '#8A5A34')
  paperShape(g, rect(-62 * a, -58 * a, 124 * a, 40 * a), C.ink)
  paperShape(g, rect(-56 * a, -20 * a, 112 * a, 20 * a), C.red)
  return { g, set(p: Pose) { place(g, p) } }
}

/** Ease helper: 0 before a, 1 after b, `lerp` of x between. */
export const mixAt = (t: number, a: number, b: number, x0: number, x1: number) => lerp(x0, x1, clamp01((t - a) / (b - a)))
export { roughen }
