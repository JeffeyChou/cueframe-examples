// Shared look of the slice: palette, SVG helpers, the characters (small rigs driven by a pose per
// frame), the card strip whose animation the story is about, and a 2D camera. Times come from the
// narration (cues, words).
import cueTable from './build/cues.json'
export { said } from '@cueframe/recipes/subtitles.js'
export { seg, win, lerp, clamp01, outCubic, inCubic, inOutCubic, outBack, spring, noise1, shake, bump } from '@cueframe/recipes/motion.js'
export { camPath, compRect, parallax, type Cam } from '@cueframe/recipes/camera.js'
export { pose, blink, envelope, look, hop, flinch, nod, squash as squashed, type Layer, type Style } from '@cueframe/recipes/acting.js'
import type { MountContext } from '@cueframe/core'
import { camSvg, type Cam } from '@cueframe/recipes/camera.js'
import { fiber, fiberPath, roughen, type Outline } from '@cueframe/recipes/paper.js'
import { clamp01, inOutCubic, lerp, noise1 } from '@cueframe/recipes/motion.js'

export const CUES: Record<string, number> = cueTable
export const start = (id: string) => CUES[`scene.${id}.start`]!
export const end = (id: string) => CUES[`scene.${id}.end`]!

export const W = 1440
export const H = 1080
export const C = {
  paper: '#E6DAC0', ink: '#1F1C1B', red: '#C7432F', navy: '#2C3172', cobalt: '#5B7FC4', sky: '#8CA8D8',
  mustard: '#DBAE47', salmon: '#D06B55', purple: '#7B57A9', lavender: '#A993DD', orange: '#D7782D',
  night: '#1E2440', cream: '#F3EEE2',
}
export const SANS = '"Noto Sans SC", sans-serif'
export const SERIF = '"Noto Serif SC", serif'

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
/** A full-stage SVG in logical px; shapes drawn into it with `paperShape` are printed paper. */
export function stageSvg(ctx: Pick<MountContext, 'root' | 'id'>, bg?: string): SVGSVGElement {
  const svg = s(ctx.root as unknown as Element, 'svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H }) as SVGSVGElement
  Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', overflow: 'hidden' })
  kits.set(svg, ctx)
  if (bg) s(svg, 'rect', { width: W, height: H, fill: bg })
  return svg
}

// ---------- printed paper ----------
const kits = new WeakMap<SVGSVGElement, Pick<MountContext, 'id'>>()
const dark = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 120 }
const hash = (x: string) => { let h = 2166136261; for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619); return h >>> 0 }
const sizeOf = (o: Outline): number => typeof o === 'string' ? 100
  : 'rect' in o ? Math.max(o.rect.w, o.rect.h) : 'circle' in o ? 2 * o.circle.r : 'ellipse' in o ? 2 * Math.max(o.ellipse.rx, o.ellipse.ry)
  : Math.max(...o.polygon.map((p) => p.x)) - Math.min(...o.polygon.map((p) => p.x))
/**
 * A flat shape printed on paper, as in the reference: an edge slightly off true (roughness in the
 * shape's own units, made once) and a speckle of ink or paper over its fill (a pattern in its own
 * space). Both move with the rig, so nothing boils.
 */
export function paperShape(parent: Element, outline: Outline, fill: string, attrs: Attrs = {}): SVGGElement {
  const g = s(parent, 'g', attrs)
  const size = sizeOf(outline)
  const seed = hash(JSON.stringify(outline)) % 997
  const d = roughen(outline, { amp: Math.min(1.6, Math.max(0.35, size * 0.004)), wavelength: Math.min(18, Math.max(6, size * 0.05)), seed })
  s(g, 'path', { d, fill })
  fiberPath(g, outline, { seed, kind: 'speckle', density: 0.9, ...ink(fill) })
  return g
}
const ink = (fill: string) => (dark(fill) ? { tone: C.cream, opacity: 0.16 } : { tone: C.ink, opacity: 0.1 })
export interface Pose { x: number; y: number; s?: number; sx?: number; sy?: number; rot?: number; o?: number }
/** Places a group whose local origin is its pivot (characters: the middle of their feet). */
export function place(g: SVGGElement, p: Pose) {
  g.dataset.cfAudit = 'allow-motion'   // blinks, chuckles and idles repeat on purpose
  const k = p.s ?? 1
  g.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${(p.rot ?? 0).toFixed(3)}) scale(${(k * (p.sx ?? 1)).toFixed(4)} ${(k * (p.sy ?? 1)).toFixed(4)})`)
  g.style.opacity = String(p.o ?? 1)
}

/** The channels every rig's set() reads (acting layers write these; rigs add their own). */
export const BODY = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, o: 1, look: 0, lookY: 0, blink: 0 }
/** The slice's acting style: a short anticipation and an outBack overshoot. */
export const VILLAGE = { anticipate: 0.12, antic: 0.15, overshoot: 1.7 }

// ---------- characters ----------
let uid = 0
export type Eyes = 'open' | 'line' | 'happy' | 'dot' | 'wide'

/** The narrator: a cream ball with a dark crescent; `dark` 0..1 turns it into its shadow side. */
export function ball(parent: Element, r: number) {
  const g = s(parent, 'g')
  const disc = { circle: { cx: 0, cy: -r, r } }
  const rim = s(g, 'path', { d: roughen(disc, { amp: Math.max(0.35, r * 0.008), wavelength: Math.max(6, r * 0.1), seed: 11 }), fill: C.ink })
  paperShape(g, disc, C.cream)
  const clip = s(s(g, 'defs'), 'clipPath', { id: `ball-clip-${++uid}` })
  s(clip, 'circle', { cx: 0, cy: -r, r })
  const shade = s(s(g, 'g', { 'clip-path': `url(#${clip.id})` }), 'circle', { cx: 0, cy: -r, r: r * 1.02, fill: C.ink })
  const eyes = s(g, 'g')
  const L = s(eyes, 'path', { fill: 'none', 'stroke-linecap': 'round' })
  const R = s(eyes, 'path', { fill: 'none', 'stroke-linecap': 'round' })
  return {
    g,
    set(p: Pose & { eyes?: Eyes; look?: number; lookY?: number; blink?: number; dark?: number }) {
      place(g, p)
      const d = clamp01(p.dark ?? 0)
      shade.setAttribute('cx', (lerp(2.1, 0, inOutCubic(d)) * r).toFixed(2))
      rim.setAttribute('transform', `translate(${(lerp(0.16, -0.14, d) * r).toFixed(2)} 0)`)
      rim.setAttribute('fill', d > 0.5 ? C.cream : C.ink)
      const ink = d > 0.55 ? C.cream : C.ink
      const lx = (p.look ?? 0) * r * 0.22
      const ly = -r * 1.05 + (p.lookY ?? 0) * r * 0.2
      eyePaths([L, R], p.eyes ?? 'open', lx, ly, r * 0.2, r, p.blink ?? 0, ink)
    },
  }
}

function eyePaths(pp: SVGPathElement[], eyes: Eyes, cx: number, cy: number, gap: number, size: number, blinkK: number, color: string) {
  const h = size * 0.22 * (1 - 0.85 * blinkK)
  const w = size * 0.075
  pp.forEach((p, i) => {
    const x = cx + (i ? gap : -gap)
    let d = ''
    let sw = w
    if (eyes === 'open' && blinkK < 0.6) d = `M${x} ${cy - h / 2} V${cy + h / 2}`
    else if (eyes === 'wide') { d = `M${x} ${cy - h * 0.7} V${cy + h * 0.7}`; sw = w * 1.3 }
    else if (eyes === 'dot') { d = `M${x} ${cy} v0.01`; sw = w * 2 }
    else if (eyes === 'happy') { const u = size * 0.09; d = `M${x - u} ${cy + u * 0.5} L${x} ${cy - u * 0.5} L${x + u} ${cy + u * 0.5}`; sw = w * 0.8 }
    else d = `M${x - size * 0.08} ${cy} H${x + size * 0.08}`
    p.setAttribute('d', d)
    p.setAttribute('stroke', color)
    p.setAttribute('stroke-width', sw.toFixed(2))
  })
}

/** Claude: a salmon square, dark hair block behind its top-left corner, a white asterisk. */
export function claude(parent: Element, a: number) {
  const g = s(parent, 'g')
  paperShape(g, { rect: { x: -a * 0.62, y: -a * 1.18, w: a * 0.62, h: a * 0.5 } }, C.ink)
  s(g, 'rect', { x: -a * 0.62, y: -a * 1.12 + a * 0.06, width: a * 0.2, height: a * 0.035, fill: C.mustard })
  paperShape(g, { rect: { x: -a / 2, y: -a, w: a, h: a } }, C.salmon)
  const eyes = [0, 1].map(() => s(g, 'path', { fill: 'none', 'stroke-linecap': 'butt' }))
  const star = s(g, 'g', { transform: `translate(${a * 0.32} ${-a * 0.2})`, stroke: C.cream, 'stroke-width': a * 0.035, 'stroke-linecap': 'round' })
  for (let k = 0; k < 4; k++) s(star, 'line', { x1: 0, y1: -a * 0.07, x2: 0, y2: a * 0.07, transform: `rotate(${k * 45})` })
  return {
    g,
    set(p: Pose & { eyes?: Eyes; look?: number; blink?: number }) {
      place(g, p)
      eyePaths(eyes, p.eyes ?? 'line', (p.look ?? 0) * a * 0.1, -a * 0.7, a * 0.17, a, p.blink ?? 0, C.ink)
    },
  }
}

/** The AE elder: a navy square, ^ ^ eyes, a triangle mouth and a red diamond hat. */
export function elder(parent: Element, a: number) {
  const g = s(parent, 'g')
  const hat = paperShape(g, { rect: { x: -a * 0.17, y: -a * 0.17, w: a * 0.34, h: a * 0.34 } }, C.red)
  paperShape(g, { rect: { x: -a / 2, y: -a, w: a, h: a } }, C.navy)
  const eyes = [0, 1].map(() => s(g, 'path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
  const mouth = s(g, 'path', { fill: C.lavender })
  return {
    g,
    /** `hat` turns the diamond (degrees past its 45° rest); `open` opens the mouth. */
    set(p: Pose & { eyes?: 'happy' | 'one' | 'flat'; look?: number; hat?: number; open?: number; blink?: number }) {
      place(g, p)
      hat.setAttribute('transform', `translate(${a * 0.4} ${-a * 0.98}) rotate(${45 + (p.hat ?? 0)})`)
      const lx = (p.look ?? 0) * a * 0.08
      const u = a * 0.09
      const k = 1 - 0.8 * (p.blink ?? 0)
      eyes.forEach((e, i) => {
        const x = lx + (i ? a * 0.17 : -a * 0.17)
        const y = -a * 0.66
        let d = `M${x - u} ${y + u * 0.6 * k} L${x} ${y - u * 0.6 * k} L${x + u} ${y + u * 0.6 * k}`
        if (p.eyes === 'one' && i === 1) { e.setAttribute('d', `M${x} ${y} m-${u * 0.7} 0 a${u * 0.7} ${u * 0.7 * k} 0 1 0 ${u * 1.4} 0 a${u * 0.7} ${u * 0.7 * k} 0 1 0 -${u * 1.4} 0`); e.setAttribute('stroke', C.lavender); e.setAttribute('stroke-width', String(a * 0.04)); return }
        if (p.eyes === 'flat') d = `M${x - u} ${y} H${x + u}`
        e.setAttribute('d', d)
        e.setAttribute('stroke', C.lavender)
        e.setAttribute('stroke-width', String(a * 0.045))
      })
      const o = p.open ?? 0
      mouth.setAttribute('d', `M${lx - a * 0.14} ${-a * 0.42} H${lx + a * 0.14} L${lx} ${-a * (0.24 - 0.06 * o)} Z`)
    },
  }
}

/** A villager: a triangle with one eye and a brow, on two thin legs. */
export function villager(parent: Element, h: number, fill: string) {
  const g = s(parent, 'g')
  const b = h * 0.62
  const legs = s(g, 'g', { stroke: C.ink, 'stroke-width': Math.max(2, h * 0.018) })
  s(legs, 'line', { x1: -b * 0.16, y1: 0, x2: -b * 0.16, y2: -h * 0.09 })
  s(legs, 'line', { x1: b * 0.16, y1: 0, x2: b * 0.16, y2: -h * 0.09 })
  paperShape(g, { polygon: [{ x: -b / 2, y: -h * 0.08 }, { x: 0, y: -h }, { x: b / 2, y: -h * 0.08 }] }, fill)
  const face = s(g, 'g')
  const ink = fill === C.ink ? C.cream : C.ink
  const eye = s(face, 'circle', { r: h * 0.022, fill: ink })
  const brow = s(face, 'line', { stroke: ink, 'stroke-width': h * 0.016, 'stroke-linecap': 'round' })
  return {
    g,
    set(p: Pose & { look?: number; up?: number; brow?: number; blink?: number }) {
      place(g, p)
      const lk = p.look ?? 0
      const x = lk * b * 0.16
      const y = -h * (0.58 + 0.08 * (p.up ?? 0))
      eye.setAttribute('cx', x.toFixed(2))
      eye.setAttribute('cy', y.toFixed(2))
      eye.setAttribute('r', (h * 0.022 * (1 - 0.8 * (p.blink ?? 0))).toFixed(2))
      const tilt = (p.brow ?? 0) * h * 0.02
      brow.setAttribute('x1', (x - h * 0.04).toFixed(2))
      brow.setAttribute('x2', (x + h * 0.04).toFixed(2))
      brow.setAttribute('y1', (y - h * 0.055 - tilt).toFixed(2))
      brow.setAttribute('y2', (y - h * 0.055 + tilt).toFixed(2))
    },
  }
}

/** A seeded crowd of villagers in a band; returns them back to front for posing. */
export function crowd(parent: Element, n: number, o: { x0: number; x1: number; y: number; h: [number, number]; seed: number; colors?: string[]; spread?: number }) {
  const colors = o.colors ?? [C.cobalt, C.sky, C.ink, C.cobalt, C.navy]
  const rnd = mulberry(o.seed)
  const list = Array.from({ length: n }, (_, i) => {
    const depth = rnd()
    return { x: lerp(o.x0, o.x1, (i + 0.5 + (rnd() - 0.5) * 0.8) / n), y: o.y + depth * (o.spread ?? 0), h: lerp(o.h[0], o.h[1], depth), c: colors[Math.floor(rnd() * colors.length)]!, seed: rnd() * 100, face: rnd() < 0.5 ? -1 : 1 }
  }).sort((a, b) => a.y - b.y)
  return list.map((v) => ({ ...v, v: villager(parent, v.h, v.c) }))
}

/** Opus: a black cube in two-point-ish projection; `slit` colours its mouth, `glow` lights it. */
export function cube(parent: Element, a: number) {
  const g = s(parent, 'g')
  const shadow = s(g, 'path', { fill: '#FFFFFF', opacity: 0.18 })
  const top = s(g, 'path', { fill: '#2E2A28' })
  const side = s(g, 'path', { fill: '#171413' })
  // The faces change shape with depth; their print texture is a pattern in the rig's space, so it
  // stays put while the outline moves.
  const svg = parent.closest('svg'), kit = svg && kits.get(svg)
  const faces = kit ? [0, 1].map((k) => {
    const clip = s(s(g, 'defs'), 'clipPath', { id: kit.id(`cube-face-${++uid}`) })
    s(s(g, 'g', { 'clip-path': `url(#${clip.id})` }), 'path', { d: fiber({ rect: { x: -a / 2, y: -a * 1.6, w: a * 1.6, h: a * 1.6 } }, { seed: 20 + k, density: 0.9 }), fill: C.cream, opacity: 0.16 })
    return s(clip, 'path')
  }) : []
  paperShape(g, { rect: { x: -a / 2, y: -a, w: a, h: a } }, '#232020')
  const slit = s(g, 'rect', { x: -a * 0.22, y: -a * 0.42, width: a * 0.44, height: a * 0.045, fill: C.cream })
  const glow = s(g, 'rect', { x: -a * 0.3, y: -a * 0.46, width: a * 0.6, height: a * 0.13, fill: C.mustard, opacity: 0, filter: 'url(#soft)' })
  return {
    g,
    set(p: Pose & { depth?: number; slit?: string; glow?: number }) {
      place(g, p)
      const d = (p.depth ?? 0.22) * a
      top.setAttribute('d', `M${-a / 2} ${-a} L${-a / 2 + d} ${-a - d * 0.75} L${a / 2 + d} ${-a - d * 0.75} L${a / 2} ${-a} Z`)
      side.setAttribute('d', `M${a / 2} ${-a} L${a / 2 + d} ${-a - d * 0.75} L${a / 2 + d} ${-d * 0.75} L${a / 2} 0 Z`)
      faces.forEach((f, i) => f.setAttribute('d', (i ? side : top).getAttribute('d')!))
      shadow.setAttribute('d', `M${-a * 0.62} ${a * 0.0} L${a * 0.62 + d} ${a * 0.0} L${a * 0.78 + d} ${a * 0.12} L${-a * 0.78} ${a * 0.12} Z`)
      slit.setAttribute('fill', p.slit ?? C.cream)
      glow.setAttribute('opacity', String(p.glow ?? 0))
    },
  }
}

/** Shared filters (soft glow) for one SVG. */
export function defs(svg: SVGSVGElement) {
  const d = s(svg, 'defs')
  const f = s(d, 'filter', { id: 'soft', x: '-50%', y: '-50%', width: '200%', height: '200%' })
  s(f, 'feGaussianBlur', { stdDeviation: 10 })
  return d
}

/** A wobbly paper-cut blob (the "energy balls"): outline of radius r breathing with time. */
export function blobPath(r: number, t: number, seed: number, wob = 0.07) {
  const n = 36
  let d = ''
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2
    const k = 1 + wob * (noise1(Math.cos(th) * 1.6 + t * 0.9, seed) + 0.6 * noise1(Math.sin(th) * 2.3 - t * 0.7, seed + 7))
    d += `${i ? 'L' : 'M'}${(Math.cos(th) * r * k).toFixed(1)} ${(Math.sin(th) * r * k).toFixed(1)}`
  }
  return d + 'Z'
}

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

// ---------- camera ----------
export const STAGE = { w: W, h: H }
/** Points a stage-size SVG group at world point (x, y) with the given zoom (recipes/camera.ts). */
export const camera = (g: SVGGElement, c: Cam) => g.setAttribute('transform', camSvg(c, STAGE))
