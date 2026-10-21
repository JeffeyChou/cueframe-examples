// Dark-mode hand-drawn board (Excalidraw-like): rough strokes drawn on in order, opt-in line boil,
// stick figures, marker fills and a camera over an infinite canvas. Everything is SVG built in
// mount; render(f) only sets attributes, so it stays a pure function of f.
import { seeded, type Frame, type Rng } from '@cueframe/core'

export const INK = {
  bg: '#18181B', chalk: '#EDEDED', dim: '#8E8E99', faint: '#4A4A55',
  yellow: '#FACC15', amber: '#FB923C', blue: '#38BDF8', mint: '#34D399', coral: '#FB7185',
}

export type Pt = readonly [number, number]
type At = number | 'with'

export interface DrawOpts {
  /** Board seconds when drawing starts; omitted = after the previous item, 'with' = with it. */
  at?: At
  /** Seconds to draw; default from stroke length (0.3–1.4 s). */
  dur?: number
  color?: string
  width?: number
  /** Jitter scale, 0 = clean; default 1.6. */
  rough?: number
  /** Overlapping passes per stroke (Excalidraw draws two); default 2 for shapes, 1 for marks. */
  passes?: number
  /** Keep re-jittering after it is drawn (line boil), for marks that should feel alive; default off.
   * Marked `data-cf-audit="allow-motion"` so `audit` does not report it as jitter. */
  boil?: boolean
  opacity?: number
  parent?: SVGGElement
}

/** One stroke: a path per pass, each with a `d` per boil variant; passes draw together. */
interface Stroke { els: SVGPathElement[]; d: string[][]; len: number }
export interface Item {
  at: number; dur: number; end: number
  g: SVGGElement
  strokes: Stroke[]
  boil?: boolean
  text?: { clip: SVGRectElement; x: number; w: number }
  /** World-space bounds at mount, for culling items outside the camera view. */
  box?: [number, number, number, number]
}

export interface CamKey { x: number; y: number; z: number }
/** `out` pulls the zoom back by that share at the middle of the move (zoom out, travel, push in). */
export interface CamMove extends CamKey { at: number; dur: number; out?: number }

const NS = 'http://www.w3.org/2000/svg'
const VARIANTS = 3
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  parent?.append(e)
  return e
}

/** Catmull-Rom through the points as cubic Béziers. */
function smooth(p: Pt[]): string {
  const f = (v: number) => v.toFixed(1)
  if (p.length < 3) return `M${p.map((q) => `${f(q[0])},${f(q[1])}`).join('L')}`
  let d = `M${f(p[0]![0])},${f(p[0]![1])}`
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)]!, b = p[i]!, c = p[i + 1]!, e = p[Math.min(p.length - 1, i + 2)]!
    d += `C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])},${f(c[1])}`
  }
  return d
}

/** Straight segments, for marker zigzags. */
function sharp(p: Pt[]): string {
  return `M${p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('L')}`
}

/** Splits long segments so Catmull-Rom does not overshoot next to dense corners. */
function resample(p: Pt[], step = 40): Pt[] {
  const out: Pt[] = []
  p.forEach((q, i) => {
    if (i) {
      const a = p[i - 1]!, n = Math.floor(dist(a, q) / step)
      for (let j = 1; j < n; j++) out.push([a[0] + ((q[0] - a[0]) * j) / n, a[1] + ((q[1] - a[1]) * j) / n])
    }
    out.push(q)
  })
  return out
}

const polyLen = (p: Pt[]) => p.reduce((s, q, i) => (i ? s + dist(p[i - 1]!, q) : 0), 0)

/** A hand line: jittered ends with a little overshoot, a slight bow, a few mid wobbles. */
function roughLine(r: Rng, a: Pt, b: Pt, k: number, over = true): Pt[] {
  const len = dist(a, b) || 1
  const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len
  const nx = -uy, ny = ux
  const j = (s: number) => r.range(-s, s) * k
  const o0 = over ? r.range(-1, 4) * k : 0, o1 = over ? r.range(-1, 5) * k : 0
  const bow = j(Math.min(len * 0.012, 7))
  const n = Math.max(2, Math.min(6, Math.round(len / 120)))
  const pts: Pt[] = [[a[0] - ux * o0 + j(1.2), a[1] - uy * o0 + j(1.2)]]
  for (let i = 1; i < n; i++) {
    const s = i / n, w = bow * 4 * s * (1 - s) + j(0.9)
    pts.push([a[0] + (b[0] - a[0]) * s + nx * w, a[1] + (b[1] - a[1]) * s + ny * w])
  }
  pts.push([b[0] + ux * o1 + j(1.2), b[1] + uy * o1 + j(1.2)])
  return pts
}

function jitterPath(r: Rng, p: Pt[], k: number): Pt[] {
  return resample(p).map((q) => [q[0] + r.range(-1, 1) * k, q[1] + r.range(-1, 1) * k] as Pt)
}

function ellipsePts(r: Rng, cx: number, cy: number, rx: number, ry: number, k: number, turns = 1, open = 0.1): Pt[] {
  const a0 = r.range(0, Math.PI * 2)
  const sweep = Math.PI * 2 * turns + r.range(0.05, open + 0.15) * Math.PI * 2 * (k > 0 ? 1 : 0)
  const n = Math.max(10, Math.round(14 * turns * Math.sqrt(Math.max(rx, ry) / 60)))
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const s = i / n, a = a0 + sweep * s
    const grow = 1 + (turns > 1 ? (s - 0.5) * 0.12 : 0) + r.range(-0.025, 0.025) * k
    out.push([cx + Math.cos(a) * rx * grow, cy + Math.sin(a) * ry * grow])
  }
  return out
}

function quadPts(a: Pt, b: Pt, bend: number, n = 14): Pt[] {
  const len = dist(a, b)
  const mx = (a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * bend * len
  const my = (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * bend * len
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const s = i / n, u = 1 - s
    out.push([u * u * a[0] + 2 * u * s * mx + s * s * b[0], u * u * a[1] + 2 * u * s * my + s * s * b[1]])
  }
  return out
}

export type Pose = 'stand' | 'wave' | 'shrug' | 'carry' | 'point' | 'wand'
export type Mood = 'sweat' | 'angry' | 'puzzled' | 'glasses' | 'happy'

export interface Board {
  svg: SVGSVGElement
  world: SVGGElement
  /** Board time after the last item; items without `at` start here. */
  cursor: number
  goto(t: number): void
  wait(s: number): void
  /** `motion`: you animate it in render (shake, drift), so `audit` does not report it as jitter. */
  group(parent?: SVGGElement, o?: { motion?: boolean }): SVGGElement
  /** Items created inside fn go into g. */
  inside<T>(g: SVGGElement, fn: () => T): T
  path(pts: Pt[], o?: DrawOpts & { closed?: boolean }): Item
  line(a: Pt, b: Pt, o?: DrawOpts): Item
  rect(x: number, y: number, w: number, h: number, o?: DrawOpts): Item
  ellipse(cx: number, cy: number, rx: number, ry: number, o?: DrawOpts): Item
  /** Highlighter circle: overlapping loops, 2 turns by default. */
  loop(cx: number, cy: number, rx: number, ry: number, o?: DrawOpts & { turns?: number }): Item
  arrow(a: Pt, b: Pt, o?: DrawOpts & { bend?: number; head?: number }): Item
  dashed(a: Pt, b: Pt, o?: DrawOpts & { dash?: number; gap?: number }): Item
  underline(x0: number, x1: number, y: number, o?: DrawOpts & { passes?: number }): Item
  cross(x: number, y: number, w: number, h: number, o?: DrawOpts): Item
  /** Marker fill: a zigzag scribble inside the box. */
  hatch(x: number, y: number, w: number, h: number, o?: DrawOpts & { gap?: number }): Item
  burst(cx: number, cy: number, r0: number, r1: number, o?: DrawOpts & { n?: number; from?: number; to?: number }): Item
  bubble(x: number, y: number, w: number, h: number, tail: Pt, o?: DrawOpts): Item
  text(x: number, y: number, s: string, o?: DrawOpts & { size?: number; anchor?: 'start' | 'middle' | 'end'; mono?: boolean; rotate?: number; weight?: number }): Item
  figure(x: number, y: number, o?: DrawOpts & { scale?: number; pose?: Pose; mood?: Mood[] }): Item
  /** Camera moves; before the first one the camera sits at `start`. */
  camera(start: CamKey, moves: CamMove[]): void
  cam(t: number): CamKey
  render(f: Frame): void
}

export interface BoardOpts {
  seed?: number | string
  font: string
  mono: string
  /** World rectangle covered by the dot grid. */
  bounds?: [number, number, number, number]
  /** Line boil swaps per second for items drawn with `boil: true`; default 8. */
  boil?: number
  /** Below this camera zoom the board allows small text in `audit` (overview shots). */
  overviewZoom?: number
  /** World px kept around the view before an item is culled (covers groups you move); default 300. */
  cullMargin?: number
}

export function board(root: HTMLElement, stage: { w: number; h: number }, opts: BoardOpts): Board {
  const rng = seeded(opts.seed ?? 'doodle')
  const svg = el('svg', { width: stage.w, height: stage.h, viewBox: `0 0 ${stage.w} ${stage.h}` })
  Object.assign(svg.style, { position: 'absolute', inset: '0', background: INK.bg })
  root.append(svg)
  const defs = el('defs', {}, svg)
  const dots = el('pattern', { id: 'cf-dots', width: 32, height: 32, patternUnits: 'userSpaceOnUse' }, defs)
  el('circle', { cx: 16, cy: 16, r: 1.6, fill: '#ffffff', opacity: 0.07 }, dots)
  // Text outside the camera view is just elsewhere on the canvas, not lost off stage.
  const world = el('g', { 'data-cf-audit': 'world' }, svg)
  const [bx, by, bw, bh] = opts.bounds ?? [-4000, -4000, 12000, 10000]
  el('rect', { x: bx, y: by, width: bw, height: bh, fill: 'url(#cf-dots)' }, world)
  const shade = el('radialGradient', { id: 'cf-vig', cx: '50%', cy: '50%', r: '75%' }, defs)
  el('stop', { offset: '60%', 'stop-color': '#000', 'stop-opacity': 0 }, shade)
  el('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0.45 }, shade)
  el('rect', { width: stage.w, height: stage.h, fill: 'url(#cf-vig)', 'pointer-events': 'none' }, svg)

  const items: Item[] = []
  let parent: SVGGElement = world
  let last: Item | null = null
  let clips = 0
  let start: CamKey = { x: stage.w / 2, y: stage.h / 2, z: 1 }
  let moves: CamMove[] = []

  const b: Board = {
    svg, world, cursor: 0,
    goto(t) { b.cursor = t },
    wait(s) { b.cursor += s },
    group(p, o) { return el('g', o?.motion ? { 'data-cf-audit': 'allow-motion' } : {}, p ?? parent) },
    inside(g, fn) {
      const prev = parent
      parent = g
      try { return fn() } finally { parent = prev }
    },
    path: (pts, o = {}) => make(o, (r, k) => [o.closed ? jitterPath(r, [...pts, pts[0]!, pts[1] ?? pts[0]!], k) : jitterPath(r, pts, k)]),
    line: (a, c, o = {}) => make(o, (r, k) => [roughLine(r, a, c, k)]),
    rect: (x, y, w, h, o = {}) => make(o, (r, k) => [
      roughLine(r, [x, y], [x + w, y], k), roughLine(r, [x + w, y], [x + w, y + h], k),
      roughLine(r, [x + w, y + h], [x, y + h], k), roughLine(r, [x, y + h], [x, y], k),
    ]),
    ellipse: (cx, cy, rx, ry, o = {}) => make(o, (r, k) => [ellipsePts(r, cx, cy, rx, ry, k)]),
    loop: (cx, cy, rx, ry, o = {}) => make({ width: 4, ...o }, (r, k) => [ellipsePts(r, cx, cy, rx, ry, Math.max(k, 1), o.turns ?? 2, 0.2)], undefined, 1),
    arrow(a, c, o = {}) {
      const head = o.head ?? 20
      return make(o, (r, k) => {
        const shaft = jitterPath(r, quadPts(a, c, (o.bend ?? 0.12) + r.range(-0.02, 0.02) * k), k * 0.8)
        const e = shaft[shaft.length - 1]!, q = shaft[shaft.length - 3]!
        const ang = Math.atan2(e[1] - q[1], e[0] - q[0])
        const wing = (s: number): Pt[] => {
          const t = ang + Math.PI + s * (0.5 + r.range(-0.08, 0.08) * k)
          return roughLine(r, e, [e[0] + Math.cos(t) * head, e[1] + Math.sin(t) * head], k * 0.5, false)
        }
        return [shaft, wing(1), wing(-1)]
      })
    },
    dashed(a, c, o = {}) {
      const len = dist(a, c), dash = o.dash ?? 18, gap = o.gap ?? 14
      return make(o, (r, k) => {
        const out: Pt[][] = []
        for (let s = 0; s < len; s += dash + gap) {
          const s1 = Math.min(len, s + dash)
          const p = (v: number): Pt => [a[0] + ((c[0] - a[0]) * v) / len, a[1] + ((c[1] - a[1]) * v) / len]
          out.push(roughLine(r, p(s), p(s1), k * 0.6, false))
        }
        return out
      }, undefined, 1)
    },
    underline(x0, x1, y, o = {}) {
      return make({ width: 4, ...o }, (r, k) => {
        const pts: Pt[] = []
        const n = o.passes ?? 2
        for (let i = 0; i < n; i++) {
          const fwd = i % 2 === 0
          for (let s = 0; s <= 4; s++) {
            const u = fwd ? s / 4 : 1 - s / 4
            pts.push([x0 + (x1 - x0) * u + r.range(-4, 4) * k, y + i * 7 + r.range(-2, 2) * k])
          }
        }
        return [pts]
      }, undefined, 1)
    },
    cross: (x, y, w, h, o = {}) => make(o, (r, k) => [roughLine(r, [x, y], [x + w, y + h], k), roughLine(r, [x + w, y], [x, y + h], k)]),
    hatch(x, y, w, h, o = {}) {
      const gap = o.gap ?? 12
      const width = o.width ?? gap * 1.25
      return make({ opacity: 0.6, ...o, width, straight: true }, (r, k) => {
        // Diagonal back-and-forth strokes, like a marker filling a box.
        const i = width / 2, pts: Pt[] = []
        const x0 = x + i, x1 = x + w - i, y0 = y + i, y1 = y + h - i
        const slant = Math.min(gap * 2, (x1 - x0) / 3)
        for (let s = 0, top = true; s <= x1 - x0 - slant + gap * 0.5; s += gap / 2, top = !top) {
          const xs = Math.min(x1 - slant, x0 + s)
          pts.push(top ? [xs + slant + r.range(-2, 2) * k, y0 + r.range(-3, 3) * k] : [xs + r.range(-2, 2) * k, y1 + r.range(-3, 3) * k])
        }
        return [pts]
      }, undefined, 1)
    },
    burst(cx, cy, r0, r1, o = {}) {
      const n = o.n ?? 4, a0 = o.from ?? -150, a1 = o.to ?? -30
      return make({ width: 3.5, ...o }, (r, k) => Array.from({ length: n }, (_, i) => {
        const a = ((a0 + ((a1 - a0) * i) / Math.max(1, n - 1)) * Math.PI) / 180 + r.range(-0.08, 0.08) * k
        return roughLine(r, [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], k * 0.5, false)
      }), undefined, 1)
    },
    bubble(x, y, w, h, tail, o = {}) {
      const rr = Math.min(28, h / 3)
      const pts: Pt[] = []
      const corner = (cx: number, cy: number, a: number) => {
        for (let s = 0; s <= 3; s++) {
          const t = ((a + (s / 3) * 90) * Math.PI) / 180
          pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr])
        }
      }
      corner(x + rr, y + rr, 180); corner(x + w - rr, y + rr, 270); corner(x + w - rr, y + h - rr, 0)
      const tx = Math.min(Math.max(tail[0], x + rr + 30), x + w - rr - 30)
      pts.push([tx + 26, y + h], tail, [tx - 10, y + h])
      corner(x + rr, y + h - rr, 90)
      pts.push(pts[0]!, [pts[1]![0] + 6, pts[1]![1] - 3])
      return make(o, (r, k) => [jitterPath(r, pts, k)])
    },
    text(x, y, s, o = {}) {
      const at = start0(o.at)
      const g = el('g', {}, o.parent ?? parent)
      const id = `cf-tc${clips++}`
      const cp = el('clipPath', { id }, defs)
      const size = o.size ?? 36
      const t = el('text', {
        x, y, fill: o.color ?? INK.chalk, 'font-family': o.mono ? opts.mono : opts.font, 'font-size': size,
        'text-anchor': o.anchor ?? 'start', 'clip-path': `url(#${id})`, ...(o.weight ? { 'font-weight': o.weight } : {}),
        ...(o.rotate ? { transform: `rotate(${o.rotate} ${x} ${y})` } : {}),
      }, g)
      t.textContent = s
      if (o.opacity !== undefined) g.setAttribute('opacity', String(o.opacity))
      const w = t.getComputedTextLength() || s.length * size * 0.55
      const x0 = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x
      const clip = el('rect', { x: x0 - size * 0.3, y: y - size * 1.4, width: 0, height: size * 2.2 }, cp)
      if (o.rotate) clip.setAttribute('transform', `rotate(${o.rotate} ${x} ${y})`)
      const dur = o.dur ?? Math.min(1.6, Math.max(0.3, s.length * 0.045))
      return push({ at, dur, end: at + dur, g, strokes: [], text: { clip, x: x0 - size * 0.3, w: w + size * 0.6 } }, o.at === 'with')
    },
    figure(x, y, o = {}) {
      const s = o.scale ?? 1, pose = o.pose ?? 'stand', mood = o.mood ?? []
      const P = (px: number, py: number): Pt => [x + px * s, y + py * s]
      const arms: Record<Pose, Pt[][]> = {
        stand: [[P(0, -125), P(-22, -100), P(-34, -78)], [P(0, -125), P(22, -100), P(34, -78)]],
        wave: [[P(0, -125), P(-22, -100), P(-34, -78)], [P(0, -125), P(30, -150), P(44, -186)]],
        shrug: [[P(0, -125), P(-34, -112), P(-52, -146)], [P(0, -125), P(34, -112), P(52, -146)]],
        carry: [[P(0, -125), P(22, -108), P(46, -104)], [P(0, -122), P(18, -98), P(46, -94)]],
        point: [[P(0, -125), P(-22, -100), P(-34, -78)], [P(0, -125), P(34, -132), P(70, -140)]],
        wand: [[P(0, -125), P(-22, -100), P(-34, -78)], [P(0, -125), P(28, -118), P(48, -132)]],
      }
      return make(o, (r, k) => {
        const parts: Pt[][] = [
          ellipsePts(r, x, y - 160 * s, 21 * s, 22 * s, k * 0.6),
          roughLine(r, P(0, -138), P(0, -68), k * 0.6, false),
          ...arms[pose].map((a) => jitterPath(r, a, k * 0.6)),
          [P(0, -68), P(-14, -34), P(-24, 0)].map((q) => [q[0] + r.range(-1, 1) * k, q[1]] as Pt),
          [P(0, -68), P(14, -34), P(24, 0)].map((q) => [q[0] + r.range(-1, 1) * k, q[1]] as Pt),
        ]
        const eye = (ex: number): Pt[] => [P(ex, -164), P(ex + 1, -158)]
        parts.push(eye(-8), eye(8))
        if (mood.includes('happy')) parts.push([P(-9, -150), P(0, -145), P(9, -150)])
        else if (mood.includes('angry') || mood.includes('sweat')) parts.push([P(-8, -147), P(0, -150), P(8, -147)])
        else parts.push([P(-6, -149), P(6, -149)])
        return parts
      }, (it) => {
        const add = (c: string, pts: Pt[][], w = 3) => {
          for (const p of pts) {
            const d = Array.from({ length: o.boil ? VARIANTS : 1 }, () => smooth(jitterPath(rng, p, 0.8)))
            it.strokes.push(strokeEl(it.g, [d], polyLen(p), c, w))
          }
        }
        if (mood.includes('glasses')) {
          add(INK.blue, [ellipsePts(rng, x - 9 * s, y - 161 * s, 8 * s, 7 * s, 0.3, 1, 0), ellipsePts(rng, x + 9 * s, y - 161 * s, 8 * s, 7 * s, 0.3, 1, 0)], 2.5)
        }
        if (mood.includes('sweat')) add(INK.blue, [[P(28, -178), P(34, -166), P(30, -160), P(25, -166), P(28, -178)], [P(-30, -170), P(-26, -160), P(-30, -155), P(-34, -160), P(-30, -170)]])
        if (mood.includes('angry')) add(INK.coral, [[P(18, -196), P(26, -176)], [P(28, -198), P(36, -178)], [P(14, -190), P(38, -194)], [P(16, -181), P(40, -185)]], 3.5)
        if (mood.includes('puzzled')) {
          add(INK.yellow, [[P(-10, -214), P(-6, -228), P(8, -230), P(14, -218), P(2, -206), P(1, -196)], [P(1, -186), P(2, -182)]], 4)
        }
      }, 1)
    },
    camera(s, m) {
      start = s
      moves = m.map((x) => ({ ...x })).sort((p, q) => p.at - q.at)
    },
    cam(t) {
      let c = start
      for (const m of moves) {
        if (t <= m.at) break
        const k = ease(clamp01((t - m.at) / m.dur))
        const dip = 1 - (m.out ?? 0) * Math.sin(Math.PI * k)
        c = { x: c.x + (m.x - c.x) * k, y: c.y + (m.y - c.y) * k, z: c.z * (m.z / c.z) ** k * dip }
        if (k < 1) break
      }
      return c
    },
    render(f) {
      if (!measured) measure()
      const t = f.t
      const v = Math.floor((f.t + f.idle) * (opts.boil ?? 8)) % VARIANTS
      const c = b.cam(t)
      world.setAttribute('transform', `translate(${stage.w / 2} ${stage.h / 2}) scale(${c.z}) translate(${-c.x} ${-c.y})`)
      if (c.z < (opts.overviewZoom ?? 0)) svg.dataset.cfAudit = 'allow-small'
      else delete svg.dataset.cfAudit
      const m = opts.cullMargin ?? 300
      const vx0 = c.x - stage.w / 2 / c.z - m, vx1 = c.x + stage.w / 2 / c.z + m
      const vy0 = c.y - stage.h / 2 / c.z - m, vy1 = c.y + stage.h / 2 / c.z + m
      for (const it of items) {
        const k = clamp01((t - it.at) / it.dur)
        const bx = it.box
        const inView = !bx || (bx[2] > vx0 && bx[0] < vx1 && bx[3] > vy0 && bx[1] < vy1)
        it.g.style.visibility = k > 0 && inView ? 'visible' : 'hidden'
        if (it.text) {
          it.text.clip.setAttribute('width', (it.text.w * k).toFixed(1))
          continue
        }
        let acc = 0
        const total = it.strokes.reduce((s, x) => s + x.len, 0) || 1
        for (const s of it.strokes) {
          const local = clamp01((k * total - acc) / (s.len || 1))
          acc += s.len
          s.els.forEach((e, i) => {
            if (it.boil) e.setAttribute('d', s.d[i]![v]!)
            e.style.strokeDashoffset = String(1 - local)
            e.style.visibility = local > 0 ? 'visible' : 'hidden'
          })
        }
      }
    },
  }

  // Bounds need layout, so they are taken on the first render (the same for every frame).
  let measured = false
  function measure() {
    measured = true
    const inv = world.getCTM()?.inverse()
    for (const it of items) {
      const m = it.g.getCTM()
      if (!inv || !m) continue
      const bb = it.g.getBBox()
      const tm = inv.multiply(m)
      const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]]
        .map(([x, y]) => new DOMPoint(x, y).matrixTransform(tm))
      it.box = [Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))]
    }
  }

  function start0(at: At | undefined): number {
    if (at === 'with') return last?.at ?? b.cursor
    return at ?? b.cursor
  }

  function strokeEl(g: SVGGElement, d: string[][], len: number, color: string, width: number): Stroke {
    const els = d.map((dd, i) => el('path', {
      d: dd[0]!, fill: 'none', stroke: color, 'stroke-width': i ? width * 0.8 : width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      pathLength: 1, 'stroke-dasharray': '1 2',
    }, g))
    return { els, d, len }
  }

  function make(o: DrawOpts & { straight?: boolean }, gen: (r: Rng, k: number) => Pt[][], extra?: (it: Item) => void, passes1 = 2): Item {
    const at = start0(o.at)
    const g = el('g', o.boil ? { 'data-cf-audit': 'allow-motion' } : {}, o.parent ?? parent)
    if (o.opacity !== undefined) g.setAttribute('opacity', String(o.opacity))
    const k = o.rough ?? 1.6
    const passes = o.passes ?? passes1
    // vars[pass][variant][stroke]
    const vars = Array.from({ length: passes }, () => Array.from({ length: o.boil ? VARIANTS : 1 }, () => gen(rng, k)))
    const color = o.color ?? INK.chalk, width = o.width ?? 3
    const it: Item = { at, dur: 0, end: 0, g, strokes: [], boil: !!o.boil }
    const out = o.straight ? sharp : smooth
    vars[0]![0]!.forEach((p, i) => {
      it.strokes.push(strokeEl(g, vars.map((pv) => pv.map((vv) => out(vv[i] ?? p))), polyLen(p), color, width))
    })
    extra?.(it)
    const total = it.strokes.reduce((s, x) => s + x.len, 0)
    it.dur = o.dur ?? Math.min(1.4, Math.max(0.3, 0.25 + total / 2500))
    it.end = at + it.dur
    return push(it, o.at === 'with')
  }

  function push(it: Item, together: boolean): Item {
    items.push(it)
    last = it
    b.cursor = together ? Math.max(b.cursor, it.end) : it.end
    return it
  }

  return b
}

/**
 * How long each shot draws, from a dry run on a detached board. Pass the options and shot order of
 * the real board: default durations follow the seeded jitter, so the seed and order must match.
 * Lets a scene derive its holds and duration from the drawing instead of hard-coded seconds.
 */
export function timings(stage: { w: number; h: number }, opts: BoardOpts, shots: readonly ((b: Board) => unknown)[]): number[] {
  const b = board(document.createElement('div'), stage, opts)
  return shots.map((draw) => {
    b.goto(0)
    b.inside(b.group(), () => draw(b))
    return b.cursor
  })
}
