// Object texture for SVG/DOM art: a material (edge, surface layers, ink line, cast shadow) applied to
// any outline. Everything is geometry made once at mount from a seed, in the shape's own units, so
// moving or scaling a shape only transforms it. Nothing evaluates noise per frame, and nothing uses an
// SVG <pattern> or a canvas: both made pixels depend on render order in phase 6b.
// Design: cueframe/docs/design/materials.md. Presets: materials.ts.

import { seeded, type MountContext } from '@cueframe/core'

export interface Pt { x: number; y: number }
export type Outline =
  | string
  | { rect: { x: number; y: number; w: number; h: number } }
  | { circle: { cx: number; cy: number; r: number } }
  | { ellipse: { cx: number; cy: number; rx: number; ry: number } }
  | { polygon: readonly Pt[] }
export interface Rough { amp: number; wavelength: number; seed: number | string }
export interface Bounds { x: number; y: number; w: number; h: number }

export class TextureError extends Error {
  constructor(message: string) { super(message); this.name = 'TextureError' }
}

const NS = 'http://www.w3.org/2000/svg'
const f2 = (n: number) => (Math.round(n * 100) / 100).toString()
/** Writes shape-unit coordinates for material `unit`: two decimals at unit ≥ 1, finer below, so
 * rounding stays ≤ 0.005 material units. */
function writer(unit: number): (n: number) => string {
  if (unit >= 1) return f2
  const k = 10 ** (2 + Math.ceil(-Math.log10(unit)))
  return (n) => (Math.round(n * k) / k).toString()
}
function el<K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  parent.append(e)
  return e
}

// ── Work budget and validation ───────────────────────────────────────────────────────────────
/** Work charged before each expansion; the first charge over the limit throws. */
class Work {
  n = 0
  constructor(readonly layer: string, readonly max: number) {}
  charge(k: number, stage: string, knob: string) {
    if (!(k >= 0 && Number.isFinite(k))) throw new TextureError(`texture: layer "${this.layer}" has a non-finite amount of work at ${stage} (${k}); check ${knob}`)
    this.n += k
    if (this.n > this.max) throw new TextureError(`texture: layer "${this.layer}" needs more than ${this.max} units of work at ${stage} (${this.n} so far); change ${knob}, or raise maxWork`)
  }
}
const FREE = new Work('', Infinity)

type Domain = 'pos' | 'nonneg' | 'unit' | 'any'
function check(v: unknown, name: string, domain: Domain): number {
  const ok = typeof v === 'number' && Number.isFinite(v) &&
    (domain === 'pos' ? v > 0 : domain === 'nonneg' ? v >= 0 : domain === 'unit' ? v >= 0 && v <= 1 : true)
  if (!ok) throw new TextureError(`texture: ${name} must be ${{ pos: 'a finite number > 0', nonneg: 'a finite number ≥ 0', unit: 'a finite number in [0, 1]', any: 'a finite number' }[domain]}, got ${String(v)}`)
  return v as number
}
function only(o: object, allowed: readonly string[], where: string) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) throw new TextureError(`texture: ${where} does not take "${k}" (it takes ${allowed.join(', ')})`)
}
function maxWorkOf(v: number | undefined): number {
  if (v === undefined) return 4_000_000
  if (v === Infinity || (Number.isInteger(v) && v > 0)) return v
  throw new TextureError(`texture: maxWork must be an integer > 0, got ${v}`)
}

// ── Outlines → closed polylines ──────────────────────────────────────────────────────────────
/** Closed subpaths of an outline as polylines; curves flattened so no chord exceeds `step`.
 * `charge` is told how many points each curve or arc will produce, before they are produced. */
export function polylines(shape: Outline, step: number, charge: (n: number) => void = () => {}): Pt[][] {
  if (typeof shape !== 'string') {
    if ('rect' in shape) { const { x, y, w, h } = shape.rect; charge(4); return [[{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]] }
    // A polygon of fewer than three points has no inside, as a path subpath of fewer than three.
    if ('polygon' in shape) { charge(shape.polygon.length); return shape.polygon.length > 2 ? [shape.polygon.map((p) => ({ ...p }))] : [] }
    const { cx, cy } = 'circle' in shape ? shape.circle : shape.ellipse
    const rx = 'circle' in shape ? shape.circle.r : shape.ellipse.rx, ry = 'circle' in shape ? shape.circle.r : shape.ellipse.ry
    const n = Math.max(12, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / step))
    charge(n)
    return [Array.from({ length: n }, (_, i) => ({ x: cx + rx * Math.cos((2 * Math.PI * i) / n), y: cy + ry * Math.sin((2 * Math.PI * i) / n) }))]
  }
  // A scanner over the SVG path grammar: commands, numbers (with exponents, no separator needed
  // before a sign or a second dot), and arc flags as single 0/1 characters.
  let at = 0
  const sep = () => { while (at < shape.length && /[\s,]/.test(shape[at]!)) at++ }
  const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y
  const num = () => {
    sep()
    NUM.lastIndex = at
    const m = NUM.exec(shape)
    if (!m) throw new Error(`texture: expected a number at ${at} in path "${shape}"`)
    at = NUM.lastIndex
    const v = Number(m[0])
    if (!Number.isFinite(v)) throw new Error(`texture: number ${m[0]} is not finite in path "${shape}"`)
    return v
  }
  const flag = () => {
    sep()
    const c = shape[at]
    if (c !== '0' && c !== '1') throw new Error(`texture: expected an arc flag (0 or 1) at ${at} in path "${shape}"`)
    at++
    return c === '1'
  }
  const more = () => { sep(); return at < shape.length && /[-+.\d]/.test(shape[at]!) }
  const out: Pt[][] = []
  let cur: Pt[] = [], p: Pt = { x: 0, y: 0 }, start: Pt = { x: 0, y: 0 }, cmd = ''
  const close = () => { if (cur.length > 2) out.push(cur); cur = [] }
  const curve = (pts: Pt[]) => {
    // Bezier of any order by de Casteljau, segments sized by the control polygon.
    const len = pts.slice(1).reduce((n, q, k) => n + Math.hypot(q.x - pts[k]!.x, q.y - pts[k]!.y), 0)
    const n = Math.max(2, Math.ceil(len / step))
    charge(n)
    for (let k = 1; k <= n; k++) {
      let ps = pts
      const u = k / n
      while (ps.length > 1) ps = ps.slice(1).map((q, j) => ({ x: ps[j]!.x + (q.x - ps[j]!.x) * u, y: ps[j]!.y + (q.y - ps[j]!.y) * u }))
      cur.push(ps[0]!)
    }
  }
  for (sep(); at < shape.length; sep()) {
    if (/[A-Za-z]/.test(shape[at]!)) cmd = shape[at++]!
    else if (!cmd || !more()) throw new Error(`texture: unexpected "${shape[at]}" at ${at} in path "${shape}"`)
    const rel = cmd === cmd.toLowerCase(), o = rel ? p : { x: 0, y: 0 }
    switch (cmd.toUpperCase()) {
      case 'M': close(); p = { x: o.x + num(), y: o.y + num() }; start = p; charge(1); cur.push(p); cmd = rel ? 'l' : 'L'; break
      case 'L': p = { x: o.x + num(), y: o.y + num() }; charge(1); cur.push(p); break
      case 'H': p = { x: (rel ? p.x : 0) + num(), y: p.y }; charge(1); cur.push(p); break
      case 'V': p = { x: p.x, y: (rel ? p.y : 0) + num() }; charge(1); cur.push(p); break
      case 'C': { const a = { x: o.x + num(), y: o.y + num() }, b = { x: o.x + num(), y: o.y + num() }, e = { x: o.x + num(), y: o.y + num() }; curve([p, a, b, e]); p = e; break }
      case 'Q': { const a = { x: o.x + num(), y: o.y + num() }, e = { x: o.x + num(), y: o.y + num() }; curve([p, a, e]); p = e; break }
      case 'A': { const rx = num(), ry = num(), rot = num(), large = flag(), sweep = flag(), e = { x: o.x + num(), y: o.y + num() }; arc(cur, p, e, rx, ry, rot, large, sweep, step, charge); p = e; break }
      case 'Z': close(); p = start; cmd = ''; break
      default: throw new Error(`texture: path command "${cmd}" is not supported (M L H V C Q A Z)`)
    }
  }
  close()
  // A closing point equal to the start is not a separate vertex.
  for (const poly of out) { const a = poly[0]!, b = poly[poly.length - 1]!; if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-9) poly.pop() }
  return out
}

/** SVG elliptical arc (endpoint form) appended as points (SVG spec F.6.5). */
function arc(out: Pt[], a: Pt, b: Pt, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, step: number, charge: (n: number) => void) {
  // Coincident endpoints draw nothing (SVG F.6.2); a zero radius is a straight line.
  if (a.x === b.x && a.y === b.y) return
  if (rx === 0 || ry === 0) { charge(1); out.push(b); return }
  rx = Math.abs(rx); ry = Math.abs(ry)
  const phi = (rotDeg * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi)
  const dx = (a.x - b.x) / 2, dy = (a.y - b.y) / 2
  const x1 = c * dx + s * dy, y1 = -s * dx + c * dy
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam) }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (rx * rx * y1 * y1 + ry * ry * x1 * x1)))
  const cx1 = (k * rx * y1) / ry, cy1 = (-k * ry * x1) / rx
  const cx = c * cx1 - s * cy1 + (a.x + b.x) / 2, cy = s * cx1 + c * cy1 + (a.y + b.y) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
  if (!sweep && dt > 0) dt -= 2 * Math.PI
  if (sweep && dt < 0) dt += 2 * Math.PI
  const n = Math.max(2, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / step))
  charge(n)
  for (let j = 1; j <= n; j++) {
    const t = t1 + (dt * j) / n
    out.push(j === n ? b : { x: cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, y: cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c })
  }
}

/** Path data of an outline, exact for the shape descriptors. */
export function toPath(shape: Outline): string {
  if (typeof shape === 'string') return shape
  if ('rect' in shape) { const { x, y, w, h } = shape.rect; return `M${x} ${y}H${x + w}V${y + h}H${x}Z` }
  if ('polygon' in shape) return shape.polygon.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('') + 'Z'
  const { cx, cy } = 'circle' in shape ? shape.circle : shape.ellipse
  const rx = 'circle' in shape ? shape.circle.r : shape.ellipse.rx, ry = 'circle' in shape ? shape.circle.r : shape.ellipse.ry
  return `M${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}Z`
}

function boundsOf(polys: readonly (readonly Pt[])[]): Bounds {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const poly of polys) for (const p of poly) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// ── Rough edges ──────────────────────────────────────────────────────────────────────────────
/** Periodic 1D value noise in [−1, 1] over [0, 1): `m` lattice values, smoothstep between them. */
function loopNoise(rnd: () => number, m: number): (u: number) => number {
  const v = Array.from({ length: m }, () => rnd() * 2 - 1)
  return (u) => {
    const x = (((u % 1) + 1) % 1) * m, k = Math.floor(x), t = x - k, sm = t * t * (3 - 2 * t)
    return v[k % m]! + (v[(k + 1) % m]! - v[k % m]!) * sm
  }
}

/** Roughened outlines by arguments, with the work they took: a hit charges the same work, so a
 * budget decides the same whether the cache is warm or cold. */
const roughCache = new Map<string, { d: string; cost: number }>()

/**
 * Path data of a rough version of an outline: each closed subpath resampled every wavelength/4 and
 * displaced along its normal by seeded noise that is periodic around the subpath (no seam). Corners
 * turning more than 60° stay sample points. Units are the shape's own.
 */
export function roughen(shape: Outline, o: Rough): string { return roughenWith(shape, o, FREE) }
/** `fmt` writes coordinates (two decimals by default; finer for small units). */
function roughenWith(shape: Outline, o: Rough, outer: Work, fmt: (n: number) => string = f2): string {
  if (!(o.amp >= 0 && Number.isFinite(o.amp))) throw new Error(`roughen: amp must be a finite number ≥ 0, got ${o.amp}`)
  if (!(o.wavelength > 0 && Number.isFinite(o.wavelength))) throw new Error(`roughen: wavelength must be above 0, got ${o.wavelength}`)
  const key = JSON.stringify([shape, o.amp, o.wavelength, o.seed, fmt === f2 ? 2 : fmt(1 / 3)])
  const hit = roughCache.get(key)
  if (hit !== undefined) { outer.charge(hit.cost, 'roughening the edge', 'the edge wavelength'); return hit.d }
  let cost = 0
  const work = { charge: (k: number, stage: string, knob: string) => { outer.charge(k, stage, knob); cost += k } }
  const step = o.wavelength / 4
  const parts = polylines(shape, o.wavelength / 8, (n) => work.charge(n, 'flattening the edge', 'the edge wavelength')).map((poly, pi) => {
    const n = poly.length
    // Resample between corners so sharp corners keep their vertex.
    const turn = (i: number) => {
      const a = poly[(i - 1 + n) % n]!, b = poly[i]!, c = poly[(i + 1) % n]!
      const u = Math.atan2(b.y - a.y, b.x - a.x), w = Math.atan2(c.y - b.y, c.x - b.x)
      return Math.abs(Math.atan2(Math.sin(w - u), Math.cos(w - u)))
    }
    const corners = poly.map((_, i) => i).filter((i) => turn(i) > Math.PI / 3)
    const anchors = corners.length ? corners : [0]
    const pts: Pt[] = []
    anchors.forEach((ia, k) => {
      const ib = anchors[(k + 1) % anchors.length]!
      const run: Pt[] = [poly[ia]!]
      for (let j = (ia + 1) % n; ; j = (j + 1) % n) { run.push(poly[j]!); if (j === ib) break }
      const lens = [0]
      for (let j = 1; j < run.length; j++) lens.push(lens[j - 1]! + Math.hypot(run[j]!.x - run[j - 1]!.x, run[j]!.y - run[j - 1]!.y))
      const L = lens[lens.length - 1]!
      const m = Math.max(1, Math.round(L / step))
      work.charge(m, 'roughening the edge', 'the edge wavelength')
      let seg = 1
      for (let q = 0; q < m; q++) {
        const s = (L * q) / m
        while (seg < run.length - 1 && lens[seg]! < s) seg++
        const a = run[seg - 1]!, b = run[seg]!, f = lens[seg]! > lens[seg - 1]! ? (s - lens[seg - 1]!) / (lens[seg]! - lens[seg - 1]!) : 0
        pts.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
      }
    })
    const N = pts.length
    const lens = [0]
    for (let j = 1; j <= N; j++) lens.push(lens[j - 1]! + Math.hypot(pts[j % N]!.x - pts[j - 1]!.x, pts[j % N]!.y - pts[j - 1]!.y))
    const per = lens[N]!
    const rnd = seeded(`${o.seed}:${pi}`)
    const m1 = Math.max(3, Math.round(per / o.wavelength))
    const n1 = loopNoise(rnd, m1), n2 = loopNoise(rnd, m1 * 2)
    return pts.map((q, j) => {
      const a = pts[(j - 1 + N) % N]!, b = pts[(j + 1) % N]!
      const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1
      const u = lens[j]! / per
      const d = o.amp * (0.75 * n1(u) + 0.25 * n2(u))
      return `${j ? 'L' : 'M'}${fmt(q.x - (ty / tl) * d)} ${fmt(q.y + (tx / tl) * d)}`
    }).join('') + 'Z'
  })
  const d = parts.join('')
  roughCache.set(key, { d, cost })
  return d
}

/** Outlines precomputed for intentional, stepped boil: n roughenings with consecutive seeds. */
export function boilSet(shape: Outline, o: Rough & { n: number }): string[] {
  if (typeof o.seed !== 'number') throw new TextureError('boilSet: seed must be a number (seeds seed·1000 + k)')
  return Array.from({ length: o.n }, (_, k) => roughen(shape, { ...o, seed: (o.seed as number) * 1000 + k }))
}
/** Which of `outlines` shows at t, stepping `fps` times per second (a pure function of t). */
export const boil = (outlines: readonly string[], t: number, o: { fps: number }) =>
  outlines[(((Math.floor(t * o.fps) % outlines.length) + outlines.length) % outlines.length)]!

/** The offset, in a shape's own space, that keeps a fixed screen-space offset while the shape is rotated by `rotDeg`. */
export function shadowOffset(rotDeg: number, dx: number, dy: number): { dx: number; dy: number } {
  const r = (-rotDeg * Math.PI) / 180
  return { dx: dx * Math.cos(r) - dy * Math.sin(r), dy: dx * Math.sin(r) + dy * Math.cos(r) }
}

// ── Spatial index over an outline's edges ────────────────────────────────────────────────────
interface Edge { a: Pt; b: Pt }   // a = previous vertex, b = this one

/** Point–segment distance (the formula phase 6b's fiber used, so its decisions are reproduced). */
function segDist(e: Edge, p: Pt): number {
  const { a, b } = e, vx = b.x - a.x, vy = b.y - a.y, vv = vx * vx + vy * vy
  const k = vv > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / vv)) : 0
  return Math.hypot(a.x + vx * k - p.x, a.y + vy * k - p.y)
}
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx
function segsMeet(p: Pt, q: Pt, a: Pt, b: Pt): boolean {
  const d1 = cross(q.x - p.x, q.y - p.y, a.x - p.x, a.y - p.y), d2 = cross(q.x - p.x, q.y - p.y, b.x - p.x, b.y - p.y)
  const d3 = cross(b.x - a.x, b.y - a.y, p.x - a.x, p.y - a.y), d4 = cross(b.x - a.x, b.y - a.y, q.x - a.x, q.y - a.y)
  return ((d1 > 0) !== (d2 > 0) || d1 === 0 || d2 === 0) && ((d3 > 0) !== (d4 > 0) || d3 === 0 || d4 === 0)
}
/** Exact segment–segment distance (0 when they meet). */
function segSeg(p: Pt, q: Pt, e: Edge): number {
  if (segsMeet(p, q, e.a, e.b)) {
    // Collinear pairs pass the sign test without overlapping; measure them by endpoints instead.
    const d1 = cross(q.x - p.x, q.y - p.y, e.a.x - p.x, e.a.y - p.y), d2 = cross(q.x - p.x, q.y - p.y, e.b.x - p.x, e.b.y - p.y)
    if (!(d1 === 0 && d2 === 0)) return 0
  }
  const pq = { a: p, b: q }
  return Math.min(segDist(e, p), segDist(e, q), segDist(pq, e.a), segDist(pq, e.b))
}

/** Edges bucketed on a grid by their bounds, and by rows for the even–odd test. */
class Index {
  readonly edges: Edge[] = []
  readonly verts: Pt[] = []
  private grid = new Map<number | string, number[]>()
  private rows = new Map<number, number[]>()
  private vgrid = new Map<number | string, number[]>()
  private stamp: Int32Array
  private tick = 0
  readonly cell: number
  constructor(readonly polys: readonly Pt[][], readonly work: Work, readonly knob: string) {
    const b = boundsOf(polys)
    this.cell = Math.max(1, Math.hypot(b.w, b.h) / 256)
    const c = this.cell
    for (const poly of polys) {
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[j]!, bb = poly[i]!, id = this.edges.length
        this.edges.push({ a, b: bb })
        const gx0 = Math.floor(Math.min(a.x, bb.x) / c), gx1 = Math.floor(Math.max(a.x, bb.x) / c)
        const gy0 = Math.floor(Math.min(a.y, bb.y) / c), gy1 = Math.floor(Math.max(a.y, bb.y) / c)
        work.charge((gx1 - gx0 + 1) * (gy1 - gy0 + 1) + (gy1 - gy0 + 1), 'indexing the outline', "the outline's complexity")
        for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) push(this.grid, cellKey(gx, gy), id)
        for (let gy = gy0; gy <= gy1; gy++) push(this.rows, gy, id)
        this.verts.push(bb)
        push(this.vgrid, cellKey(Math.floor(bb.x / c), Math.floor(bb.y / c)), this.verts.length - 1)
      }
    }
    this.stamp = new Int32Array(this.edges.length)
  }
  /** Even–odd: is p inside the outline? */
  inside(p: Pt): boolean {
    const row = this.rows.get(Math.floor(p.y / this.cell)) ?? []
    this.work.charge(row.length, 'testing inside', this.knob)
    let c = false
    for (const id of row) {
      const { a: b, b: a } = this.edges[id]!
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c
    }
    return c
  }
  /** Edge ids in the cells a box touches, each once. */
  private near(x0: number, y0: number, x1: number, y1: number, stage: string): number[] {
    const c = this.cell, out: number[] = []
    const t = ++this.tick
    const gx0 = Math.floor(x0 / c), gx1 = Math.floor(x1 / c), gy0 = Math.floor(y0 / c), gy1 = Math.floor(y1 / c)
    this.work.charge((gx1 - gx0 + 1) * (gy1 - gy0 + 1), stage, this.knob)
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
      for (const id of this.grid.get(cellKey(gx, gy)) ?? []) if (this.stamp[id] !== t) { this.stamp[id] = t; out.push(id) }
    }
    this.work.charge(out.length, stage, this.knob)
    return out
  }
  /** Edge ids in the cells segment pq passes through (a grid walk; at an exact corner both side
   * cells are visited too), each once. */
  private along(p: Pt, q: Pt, stage: string): number[] {
    const c = this.cell, out: number[] = []
    const t = ++this.tick
    let gx = Math.floor(p.x / c), gy = Math.floor(p.y / c)
    const ex = Math.floor(q.x / c), ey = Math.floor(q.y / c)
    const dx = q.x - p.x, dy = q.y - p.y
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1
    const tdx = dx !== 0 ? Math.abs(c / dx) : Infinity, tdy = dy !== 0 ? Math.abs(c / dy) : Infinity
    let tx = dx !== 0 ? ((dx > 0 ? (gx + 1) * c : gx * c) - p.x) / dx : Infinity
    let ty = dy !== 0 ? ((dy > 0 ? (gy + 1) * c : gy * c) - p.y) / dy : Infinity
    const visit = (x: number, y: number) => {
      this.work.charge(1, stage, this.knob)
      for (const id of this.grid.get(cellKey(x, y)) ?? []) if (this.stamp[id] !== t) { this.stamp[id] = t; out.push(id) }
    }
    visit(gx, gy)
    for (let n = Math.abs(ex - gx) + Math.abs(ey - gy); n > 0 && (gx !== ex || gy !== ey); ) {
      if (tx < ty) { gx += sx; tx += tdx; n-- }
      else if (ty < tx) { gy += sy; ty += tdy; n-- }
      else { visit(gx + sx, gy); visit(gx, gy + sy); gx += sx; gy += sy; tx += tdx; ty += tdy; n -= 2 }
      visit(gx, gy)
    }
    this.work.charge(out.length, stage, this.knob)
    return out
  }
  /** Is p at least `need` from every edge? */
  clear(p: Pt, need: number): boolean {
    for (const id of this.near(p.x - need, p.y - need, p.x + need, p.y + need, 'edge distance')) if (segDist(this.edges[id]!, p) < need) return false
    return true
  }
  /** Is segment pq at least `need` from every edge? */
  segClear(p: Pt, q: Pt, need: number): boolean {
    for (const id of this.near(Math.min(p.x, q.x) - need, Math.min(p.y, q.y) - need, Math.max(p.x, q.x) + need, Math.max(p.y, q.y) + need, 'edge distance')) {
      if (segSeg(p, q, this.edges[id]!) < need) return false
    }
    return true
  }
  /** Does any outline vertex lie inside polygon `poly` (even–odd)? */
  vertexIn(poly: readonly Pt[]): boolean {
    const b = boundsOf([poly]), c = this.cell
    for (let gx = Math.floor(b.x / c); gx <= Math.floor((b.x + b.w) / c); gx++) for (let gy = Math.floor(b.y / c); gy <= Math.floor((b.y + b.h) / c); gy++) {
      const ids = this.vgrid.get(cellKey(gx, gy)) ?? []
      this.work.charge(1 + ids.length * poly.length, 'testing holes under a mark', this.knob)
      for (const id of ids) if (pip(poly, this.verts[id]!)) return true
    }
    return false
  }
  /** Crossings of segment pq with the edges, as parameters u in [0, 1), and the stretches where an
   * edge lies along it (design: hatch degeneracies). */
  crossings(p: Pt, q: Pt): { cuts: number[]; along: [number, number][] } {
    const cuts: number[] = [], along: [number, number][] = []
    const dx = q.x - p.x, dy = q.y - p.y, ll = dx * dx + dy * dy
    if (ll === 0) return { cuts, along }
    for (const id of this.along(p, q, 'hatch crossings')) {
      const { a, b } = this.edges[id]!
      const sa = cross(dx, dy, a.x - p.x, a.y - p.y), sb = cross(dx, dy, b.x - p.x, b.y - p.y)
      if (sa === 0 && sb === 0) {
        const ua = ((a.x - p.x) * dx + (a.y - p.y) * dy) / ll, ub = ((b.x - p.x) * dx + (b.y - p.y) * dy) / ll
        const u0 = Math.max(0, Math.min(ua, ub)), u1 = Math.min(1, Math.max(ua, ub))
        if (u1 > u0) along.push([u0, u1])
        continue
      }
      if ((sa > 0) === (sb > 0)) continue
      const t = sa / (sa - sb)
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t
      const u = ((x - p.x) * dx + (y - p.y) * dy) / ll
      if (u >= 0 && u < 1) cuts.push(u)
    }
    return { cuts, along }
  }
}
/** A grid cell's key: an exact number for cells within ±2²⁵ on each axis (the product stays below
 * 2⁵³), a string beyond; the two never collide. */
const R25 = 2 ** 25
export const cellKey = (gx: number, gy: number): number | string =>
  Math.abs(gx) < R25 && Math.abs(gy) < R25 ? (gx + R25) * 2 ** 26 + (gy + R25) : `${gx},${gy}`
function push<K>(m: Map<K, number[]>, k: K, v: number) { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]) }
function pip(poly: readonly Pt[], p: Pt): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c
  }
  return c
}

/** An outline's polylines in material units (÷ unit), flattened at `step` material units, charged. */
function materialPolys(outline: Outline, step: number, unit: number, work: Work): Pt[][] {
  const polys = polylines(outline, step * unit, (n) => work.charge(n, 'flattening the outline', "the outline's curves"))
  const out = unit === 1 ? polys : polys.map((poly) => poly.map((p) => ({ x: p.x / unit, y: p.y / unit })))
  const b = boundsOf(out)
  if (!(b.w > 0 && b.h > 0)) throw new TextureError(`texture: the outline has no area (bounds ${f2(b.w)} × ${f2(b.h)})`)
  return out
}

// ── Fields ───────────────────────────────────────────────────────────────────────────────────
export type FieldSpec =
  | { ramp: { deg: number; lo: number; hi: number } }
  | { light: { lo: number; hi: number } }
  | { radial: { cx: number; cy: number; r: number; lo: number; hi: number } }
  | { noise: { seed: number | string; scale: number; lo: number; hi: number } }
/** A value over the shape: constant, declarative, or a pure function of a point and the outline's
 * bounds, both in material units. Resolved once, at mount: a `{ light }` field bakes the light's
 * direction into the layer, which then turns with the shape (only shade and shadow follow `light()`). */
export type Field = number | FieldSpec | ((p: Pt, b: Bounds) => number)

/** Smooth 2D value noise in [−1, 1], lattice values hashed from the seed. */
function noise2(seed: number | string): (x: number, y: number) => number {
  const s = seeded(seed)
  const h0 = Math.floor(s() * 0x7fffffff)
  const v = (i: number, j: number) => {
    let h = Math.imul(h0 ^ Math.imul(i, 0x27d4eb2d), 0x165667b1) ^ Math.imul(j, 0x9e3779b1)
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16
    return ((h >>> 0) / 0xffffffff) * 2 - 1
  }
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), u = x - i, w = y - j
    const su = u * u * (3 - 2 * u), sw = w * w * (3 - 2 * w)
    const a = v(i, j) + (v(i + 1, j) - v(i, j)) * su, b = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * su
    return a + (b - a) * sw
  }
}

const clampTo = (v: number, lo: number, hi: number) => Math.min(Math.max(lo, hi), Math.max(Math.min(lo, hi), v))
function rampAlong(b: Bounds, deg: number, lo: number, hi: number): (p: Pt) => number {
  const ux = Math.cos((deg * Math.PI) / 180), uy = Math.sin((deg * Math.PI) / 180)
  const proj = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => x! * ux + y! * uy)
  const p0 = Math.min(...proj), p1 = Math.max(...proj)
  return (p) => clampTo(lo + ((p.x * ux + p.y * uy - p0) / (p1 - p0)) * (hi - lo), lo, hi)
}

/** Resolves a field against material-space bounds; every value is checked against `domain`. */
function field(f: Field, b: Bounds, light: number | undefined, name: string, domain: Domain): (p: Pt) => number {
  let fn: (p: Pt) => number
  const ends = (lo: number, hi: number) => { check(lo, `${name}.lo`, domain); check(hi, `${name}.hi`, domain) }
  if (typeof f === 'number') { check(f, name, domain); return () => f }
  if (typeof f === 'function') fn = (p) => f(p, b)
  else if ('ramp' in f) { only(f.ramp, ['deg', 'lo', 'hi'], `${name}.ramp`); ends(f.ramp.lo, f.ramp.hi); fn = rampAlong(b, check(f.ramp.deg, `${name}.ramp.deg`, 'any'), f.ramp.lo, f.ramp.hi) }
  else if ('light' in f) {
    only(f.light, ['lo', 'hi'], `${name}.light`); ends(f.light.lo, f.light.hi)
    if (light === undefined) throw new TextureError(`texture: ${name} uses { light } but the material has no light`)
    // lo on the lit side: the ramp runs away from the light.
    fn = rampAlong(b, light + 180, f.light.lo, f.light.hi)
  } else if ('radial' in f) {
    const r = f.radial
    only(r, ['cx', 'cy', 'r', 'lo', 'hi'], `${name}.radial`); ends(r.lo, r.hi)
    const cx = b.x + check(r.cx, `${name}.radial.cx`, 'any') * b.w, cy = b.y + check(r.cy, `${name}.radial.cy`, 'any') * b.h
    const R = check(r.r, `${name}.radial.r`, 'pos') * Math.max(b.w, b.h)
    fn = (p) => clampTo(r.lo + (Math.hypot(p.x - cx, p.y - cy) / R) * (r.hi - r.lo), r.lo, r.hi)
  } else if ('noise' in f) {
    const n = f.noise
    only(n, ['seed', 'scale', 'lo', 'hi'], `${name}.noise`); ends(n.lo, n.hi)
    const s = check(n.scale, `${name}.noise.scale`, 'pos'), nz = noise2(n.seed)
    fn = (p) => n.lo + ((nz(p.x / s, p.y / s) + 1) / 2) * (n.hi - n.lo)
  } else throw new TextureError(`texture: ${name} is not a field (number, function, ramp, light, radial or noise)`)
  return (p) => check(fn(p), `${name} at (${f2(p.x)}, ${f2(p.y)})`, domain)
}

// ── Scatter ──────────────────────────────────────────────────────────────────────────────────
export type Paint = 'fill' | 'stroke'
export type MarkKind = 'dot' | 'disc' | 'blotch' | 'fibre' | 'dash' | 'tick'
/** A custom mark: `make` returns path data in relative commands (drawn after `M anchor`), already
 * sized and rotated, and a hull — relative polylines (stroke) or polygons (fill) — that the engine
 * keeps inside the outline. The hull is trusted to enclose `d` (plus half the stroke width). */
export interface CustomMark {
  paint: Paint
  width?: number
  make(rnd: () => number, size: number, angleDeg: number): { d: string; hull: Pt[][] }
}
export type Layout = 'random' | 'even' | { grid: { spacing: number; angle?: number } }
export interface ScatterOpts {
  seed: number | string
  /** Default 'dot'. Fill: dot (radius 0.3–1.2 × size), disc (radius = size), blotch. Stroke: fibre, dash, tick. */
  mark?: MarkKind | CustomMark
  /** Default 'random'. */
  layout?: Layout
  /** Marks per 96 × 96 material units (random and even layouts). */
  density?: number
  size?: Field
  /** Degrees, or 'random' (the default). */
  angle?: Field | 'random'
  /** Probability that a candidate is kept, drawn from its own stream. */
  keep?: Field
  /** Stroke width of stroke marks; default 0.6. */
  width?: number
  /** Shape units per material unit; default 1. */
  unit?: number
  maxWork?: number
  /** The material's light direction in degrees, for `{ light }` fields. */
  light?: number
  /** A name for errors. */
  id?: string
}
export interface Scattered { d: string; paint: Paint; width?: number; count: number }

const STROKE_MARKS: readonly MarkKind[] = ['fibre', 'dash', 'tick']
const RAD = Math.PI / 180

/**
 * Marks scattered over an outline as one path's data, each mark inside it (design: containment):
 * built-in marks exactly, custom marks as far as their hull is trusted. Units: material units in,
 * shape units out (× unit).
 */
export function scatter(outline: Outline, o: ScatterOpts): Scattered {
  const id = o.id ?? 'scatter'
  const mark = o.mark ?? 'dot', layout = o.layout ?? 'random'
  const custom = typeof mark === 'object'
  if (!custom && !['dot', 'disc', 'blotch', 'fibre', 'dash', 'tick'].includes(mark)) throw new TextureError(`texture: unknown mark "${String(mark)}"`)
  const paint: Paint = custom ? mark.paint : STROKE_MARKS.includes(mark) ? 'stroke' : 'fill'
  const grid = typeof layout === 'object'
  only(o, ['seed', 'mark', 'layout', 'size', 'angle', 'keep', 'unit', 'maxWork', 'light', 'id',
    ...(grid ? [] : ['density']), ...(paint === 'stroke' && !custom ? ['width'] : [])], `scatter "${id}" (${custom ? 'custom' : mark} marks, ${grid ? 'grid' : layout} layout)`)
  if (custom && paint === 'stroke' && mark.width !== undefined) check(mark.width, `scatter "${id}" mark width`, 'pos')
  const unit = check(o.unit ?? 1, 'unit', 'pos')
  const width = paint === 'stroke' ? check((custom ? mark.width : o.width) ?? 0.6, 'width', 'pos') : undefined
  const work = new Work(id, maxWorkOf(o.maxWork))
  const polys = materialPolys(outline, 2, unit, work)
  const idx = new Index(polys, work, 'density or mark size')
  const b = boundsOf(polys)
  const size = field(o.size ?? 1, b, o.light, 'size', 'pos')
  const angle = o.angle === undefined || o.angle === 'random' ? undefined : field(o.angle, b, o.light, 'angle', 'any')
  const keep = o.keep === undefined ? undefined : field(o.keep, b, o.light, 'keep', 'unit')
  const rnd = seeded(o.seed), keepRnd = seeded(`${o.seed}:keep`)
  const w = writer(unit), F = unit === 1 ? f2 : (v: number) => w(v * unit)

  // Candidates, in a fixed order.
  const cands: Pt[] = []
  let draw: () => Pt
  let total: number
  if (grid) {
    only(layout.grid, ['spacing', 'angle'], `scatter "${id}" grid`)
    const s = check(layout.grid.spacing, 'grid spacing', 'pos'), a = check(layout.grid.angle ?? 0, 'grid angle', 'any') * RAD
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, N = Math.ceil(Math.hypot(b.w, b.h) / 2 / s)
    total = (2 * N + 1) ** 2
    work.charge(total, 'grid candidates', 'grid spacing')
    for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) cands.push({ x: cx + i * s * Math.cos(a) - j * s * Math.sin(a), y: cy + i * s * Math.sin(a) + j * s * Math.cos(a) })
    let k = 0
    draw = () => cands[k++]!
  } else {
    const density = check(o.density, `scatter "${id}" density`, 'pos')
    if (layout === 'random') {
      total = Math.round((density * b.w * b.h) / (96 * 96))
      work.charge(total, 'random candidates', 'density')
      draw = () => ({ x: b.x + rnd() * b.w, y: b.y + rnd() * b.h })
    } else if (layout === 'even') {
      const c = 96 / Math.sqrt(density), cols = Math.ceil(b.w / c), rows = Math.ceil(b.h / c)
      total = cols * rows
      work.charge(total, 'even candidates', 'density')
      let k = 0
      draw = () => {
        const i = k % cols, j = Math.floor(k / cols)
        k++
        return { x: b.x + (i + 0.5 + (rnd() - 0.5) * 0.8) * c, y: b.y + (j + 0.5 + (rnd() - 0.5) * 0.8) * c }
      }
    } else throw new TextureError(`texture: unknown layout "${String(layout)}"`)
  }

  // A stroke skeleton fits when samples ≤ 0.35 apart are inside and ≥ half width + 0.25 from the edges.
  const need = (width ?? 0) / 2 + 0.25
  // A stroke mark whose every point lies within `reach` of its anchor fits at once when the anchor is
  // inside and at least reach + the stroke's need from every edge; otherwise its samples decide.
  const clearOf = (reach: number) => idx.inside(p0) && idx.clear(p0, reach + need)
  let p0: Pt = { x: 0, y: 0 }
  const fitsStroke = (pts: Pt[]) => {
    work.charge(pts.length, 'testing stroke marks', 'mark size or density')
    for (const q of pts) if (!idx.inside(q) || !idx.clear(q, need)) return false
    return true
  }
  const fitsFill = (poly: Pt[]) => {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (!idx.segClear(poly[j]!, poly[i]!, 0.02)) return false
    return idx.inside(poly[0]!) && !idx.vertexIn(poly)
  }
  const line = (p: Pt, q: Pt, max: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / max))
    work.charge(n + 1, 'sampling marks', 'mark size')
    return Array.from({ length: n + 1 }, (_, k) => ({ x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n }))
  }

  let d = '', count = 0
  for (let k = 0; k < total; k++) {
    const { x, y } = draw()
    const p = { x, y }
    const s = size(p), a = angle?.(p)
    let out: string | null = null
    if (custom) {
      const deg = a ?? rnd() * 360
      const m = mark.make(rnd, s, deg)
      work.charge(m.d.length + m.hull.reduce((n, h) => n + h.length, 0), 'custom mark output', 'the custom mark')
      if (/[MLHVCSQTA]/.test(m.d)) throw new TextureError(`texture: custom mark path data must use relative commands only, got "${m.d.slice(0, 40)}"`)
      const hull = m.hull.map((h) => h.map((q) => ({ x: x + q.x, y: y + q.y })))
      if (paint === 'stroke') work.charge(hull.reduce((n, h) => n + h.slice(1).reduce((m2, q, i) => m2 + Math.ceil(Math.hypot(q.x - h[i]!.x, q.y - h[i]!.y) / 0.25) + 1, 0), 0), 'sampling marks', 'the custom mark')
      const ok = paint === 'stroke'
        ? hull.every((h) => fitsStroke(h.length === 1 ? h : h.slice(1).flatMap((q, i) => line(h[i]!, q, 0.25))))
        : hull.every((h) => fitsFill(h))
      if (ok) out = `M${F(x)} ${F(y)}${unit === 1 ? m.d : scaleRelative(m.d, unit, w)}`
    } else if (mark === 'dot' || mark === 'disc') {
      const r = mark === 'dot' ? (0.3 + rnd() * 0.9) * s : s
      if (idx.inside(p) && idx.clear(p, r + 0.02)) out = `M${F(x - r)} ${F(y)}a${F(r)} ${F(r)} 0 1 0 ${F(2 * r)} 0a${F(r)} ${F(r)} 0 1 0 ${F(-2 * r)} 0`
    } else if (mark === 'fibre') {
      const t = a === undefined ? rnd() * Math.PI : a * RAD, L = (3 + rnd() * 9) * s, bend = (rnd() - 0.5) * 4 * s
      const ex = Math.cos(t) * L, ey = Math.sin(t) * L
      const cx = x + ex / 2 - (ey * bend) / L, cy = y + ey / 2 + (ex * bend) / L
      // Samples of the quadratic ≤ 0.35 apart (its speed is at most L + 2|bend|).
      const steps = Math.ceil((L + Math.abs(bend)) / 0.25)
      p0 = p
      if (clearOf(L + Math.abs(bend))) out = `M${F(x)} ${F(y)}q${F(ex / 2 - (ey * bend) / L)} ${F(ey / 2 + (ex * bend) / L)} ${F(ex)} ${F(ey)}`
      else {
      work.charge(steps + 1, 'sampling marks', 'mark size')
      const pts = Array.from({ length: steps + 1 }, (_, i) => { const u = i / steps; return { x: (1 - u) ** 2 * x + 2 * u * (1 - u) * cx + u * u * (x + ex), y: (1 - u) ** 2 * y + 2 * u * (1 - u) * cy + u * u * (y + ey) } })
      if (fitsStroke(pts)) out = `M${F(x)} ${F(y)}q${F(ex / 2 - (ey * bend) / L)} ${F(ey / 2 + (ex * bend) / L)} ${F(ex)} ${F(ey)}`
      }
    } else if (mark === 'dash') {
      const t = a === undefined ? rnd() * Math.PI : a * RAD, L = (2 + rnd() * 4) * s
      const ex = Math.cos(t) * L, ey = Math.sin(t) * L
      p0 = p
      if (clearOf(L) || fitsStroke(line(p, { x: x + ex, y: y + ey }, 0.25))) out = `M${F(x)} ${F(y)}l${F(ex)} ${F(ey)}`
    } else if (mark === 'tick') {
      const t = a === undefined ? rnd() * 2 * Math.PI : a * RAD, L = (1.5 + rnd() * 2) * s
      const m1 = { x: x + Math.cos(t + 2.2) * L * 0.5, y: y + Math.sin(t + 2.2) * L * 0.5 }, e = { x: x + Math.cos(t) * L, y: y + Math.sin(t) * L }
      p0 = p
      if (clearOf(L) || fitsStroke([...line(m1, p, 0.25), ...line(p, e, 0.25)])) out = `M${F(m1.x)} ${F(m1.y)}L${F(x)} ${F(y)}L${F(e.x)} ${F(e.y)}`
    } else {
      const R = (1.5 + rnd() * 3) * s, rot = a === undefined ? rnd() * 2 * Math.PI : a * RAD, n = 9
      const poly = Array.from({ length: n }, (_, i) => { const r = R * (0.7 + 0.3 * rnd()), t = rot + (2 * Math.PI * i) / n; return { x: x + r * Math.cos(t), y: y + r * Math.sin(t) } })
      if (fitsFill(poly)) out = poly.map((q, i) => `${i ? 'L' : 'M'}${F(q.x)} ${F(q.y)}`).join('') + 'Z'
    }
    // The keep draw comes from its own stream, one per candidate, so `keep` does not move the marks.
    const kept = keep === undefined || keepRnd() < keep(p)
    if (out !== null && kept) {
      work.charge(out.length / 8, 'writing marks', 'density')
      d += out
      count++
    }
  }
  return { d, paint, ...(width !== undefined ? { width } : {}), count }
}

/** Relative path data scaled by k (arc rotations and flags kept). */
function scaleRelative(d: string, k: number, fmt: (n: number) => string): string {
  const out: string[] = []
  let at = 0, cmd = '', arg = 0
  const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y
  while (at < d.length) {
    const c = d[at]!
    if (/[\s,]/.test(c)) { at++; continue }
    if (/[a-zA-Z]/.test(c)) { cmd = c; arg = 0; out.push(c); at++; continue }
    if (cmd.toLowerCase() === 'a' && (arg % 7 === 3 || arg % 7 === 4)) { out.push(` ${c}`); at++; arg++; continue }
    NUM.lastIndex = at
    const m = NUM.exec(d)
    if (!m) throw new TextureError(`texture: cannot read custom mark path data at ${at}: "${d}"`)
    at = NUM.lastIndex
    const v = Number(m[0])
    const keepV = cmd.toLowerCase() === 'a' && arg % 7 === 2
    out.push(` ${keepV ? v : fmt(v * k)}`)
    arg++
  }
  return out.join('')
}

// ── Hatch ────────────────────────────────────────────────────────────────────────────────────
export interface HatchOpts {
  seed: number | string
  /** Line direction in degrees; default 45. */
  angle?: number
  spacing: number
  /** Per-line offset, up to ± jitter. */
  jitter?: number
  wobble?: { amp: number; wavelength: number }
  warp?: { amp: number; scale: number }
  dash?: readonly [number, number]
  keep?: { field: Field; above: number }
  /** Field sampling step along a run; default spacing / 2. */
  fieldStep?: number
  /** Stroke width the lines are drawn with; default 0.6 (used by `material`). */
  width?: number
  unit?: number
  maxWork?: number
  light?: number
  id?: string
}

/**
 * Line families over an outline as one stroked path's data. Runs end on the outline, so half the
 * stroke overhangs it: clip the result to the outline (`material` does).
 */
export function hatch(outline: Outline, o: HatchOpts): { d: string; count: number } {
  const id = o.id ?? 'hatch'
  only(o, ['seed', 'angle', 'spacing', 'jitter', 'wobble', 'warp', 'dash', 'keep', 'fieldStep', 'width', 'unit', 'maxWork', 'light', 'id'], `hatch "${id}"`)
  const unit = check(o.unit ?? 1, 'unit', 'pos')
  const spacing = check(o.spacing, `hatch "${id}" spacing`, 'pos'), jitter = check(o.jitter ?? 0, 'jitter', 'nonneg')
  if (o.width !== undefined) check(o.width, 'width', 'pos')
  const deg = check(o.angle ?? 45, 'angle', 'any')
  if (o.wobble) { only(o.wobble, ['amp', 'wavelength'], 'wobble'); check(o.wobble.amp, 'wobble.amp', 'nonneg'); check(o.wobble.wavelength, 'wobble.wavelength', 'pos') }
  if (o.warp) { only(o.warp, ['amp', 'scale'], 'warp'); check(o.warp.amp, 'warp.amp', 'nonneg'); check(o.warp.scale, 'warp.scale', 'pos') }
  if (o.dash) { if (o.dash.length !== 2) throw new TextureError('texture: dash is [on, off]'); check(o.dash[0], 'dash on', 'pos'); check(o.dash[1], 'dash off', 'pos') }
  const work = new Work(id, maxWorkOf(o.maxWork))
  const polys = materialPolys(outline, 2, unit, work)
  const idx = new Index(polys, work, 'spacing')
  const b = boundsOf(polys)
  let keep: ((p: Pt) => number) | undefined, above = 0
  if (o.keep) { only(o.keep, ['field', 'above'], 'keep'); above = check(o.keep.above, 'keep.above', 'any'); keep = field(o.keep.field, b, o.light, 'keep.field', 'any') }
  const fieldStep = check(o.fieldStep ?? spacing / 2, 'fieldStep', 'pos')
  const w = writer(unit), F = unit === 1 ? f2 : (v: number) => w(v * unit)

  const ux = Math.cos(deg * RAD), uy = Math.sin(deg * RAD), vx = -uy, vy = ux
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const half = Math.hypot(b.w, b.h) / 2
  const pad = jitter + (o.wobble?.amp ?? 0) + (o.warp?.amp ?? 0) + spacing
  const reach = half + pad
  const K = Math.ceil(reach / spacing)
  const bent = !!(o.wobble?.amp || o.warp?.amp)
  const step = Math.min(spacing / 4, o.wobble ? o.wobble.wavelength / 4 : Infinity, o.warp ? o.warp.scale / 4 : Infinity)
  const warp = o.warp?.amp ? noise2(`${o.seed}:warp`) : undefined
  work.charge(2 * K + 1, 'hatch lines', 'spacing')

  let d = '', count = 0
  for (let k = -K; k <= K; k++) {
    const rl = seeded(`${o.seed}:line:${k}`)
    const off = k * spacing + (rl() * 2 - 1) * jitter
    const phase = rl()
    // The stretch of the line whose base points lie within the bounds padded by `pad` (beyond it no
    // displacement can bring the line back inside), from outside to outside.
    let t0 = -reach, t1 = reach
    const ox = cx + vx * off, oy = cy + vy * off
    for (const [o0, du, lo, hi] of [[ox, ux, b.x - pad, b.x + b.w + pad], [oy, uy, b.y - pad, b.y + b.h + pad]] as const) {
      if (Math.abs(du) < 1e-12) { if (o0 < lo || o0 > hi) t1 = t0 - 1; continue }
      const a1 = (lo - o0) / du, a2 = (hi - o0) / du
      t0 = Math.max(t0, Math.min(a1, a2)); t1 = Math.min(t1, Math.max(a1, a2))
    }
    if (!(t1 > t0)) continue
    const samples = bent ? Math.ceil((t1 - t0) / step) + 1 : 2
    const lattice = o.wobble?.amp ? Math.ceil((2 * reach) / o.wobble.wavelength) + 3 : 0
    work.charge(samples + lattice, 'hatch line samples', bent ? 'spacing or wobble/warp sampling' : 'spacing')
    const wob = o.wobble?.amp ? (() => { const v = Array.from({ length: lattice }, () => rl() * 2 - 1); return (t: number) => { const x = (t + reach) / o.wobble!.wavelength, i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return o.wobble!.amp * (v[i]! + (v[i + 1]! - v[i]!) * s) } })() : undefined
    const pts: Pt[] = []
    for (let i = 0; i < samples; i++) {
      const t = t0 + ((t1 - t0) * i) / (samples - 1)
      const bx = cx + ux * t + vx * off, by = cy + uy * t + vy * off
      const dv = (wob ? wob(t) : 0) + (warp ? o.warp!.amp * warp(bx / o.warp!.scale, by / o.warp!.scale) : 0)
      pts.push({ x: bx + vx * dv, y: by + vy * dv })
    }
    const cum = [0]
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y))
    const total = cum[cum.length - 1]!
    // Positions along the line by a sweep over its joints: callers ask in increasing order, except
    // bisection, which steps back only within its bracket.
    let seg = 1
    const at = (s: number): Pt => {
      while (seg > 1 && cum[seg - 1]! > s) { seg--; work.charge(1, 'locating along a line', 'spacing') }
      while (seg < cum.length - 1 && cum[seg]! < s) { seg++; work.charge(1, 'locating along a line', 'spacing') }
      const lo = seg - 1, hi = seg
      const f = cum[hi]! > cum[lo]! ? (s - cum[lo]!) / (cum[hi]! - cum[lo]!) : 0
      return { x: pts[lo]!.x + (pts[hi]!.x - pts[lo]!.x) * f, y: pts[lo]!.y + (pts[hi]!.y - pts[lo]!.y) * f }
    }
    // Cuts at every crossing's distance along the whole line, and at both ends of every stretch that
    // runs along an edge; those stretches are boundary and never drawn.
    const cuts: number[] = [0], along: [number, number][] = []
    for (let i = 1; i < pts.length; i++) {
      const c = idx.crossings(pts[i - 1]!, pts[i]!), len = cum[i]! - cum[i - 1]!
      for (const u of c.cuts) cuts.push(cum[i - 1]! + u * len)
      for (const [u0, u1] of c.along) { const s0 = cum[i - 1]! + u0 * len, s1 = cum[i - 1]! + u1 * len; cuts.push(s0, s1); along.push([s0, s1]) }
    }
    cuts.push(total)
    work.charge(cuts.length * Math.ceil(Math.log2(cuts.length + 1)) + along.length * Math.ceil(Math.log2(along.length + 1)), 'sorting hatch crossings', 'spacing')
    cuts.sort((p, q) => p - q)
    along.sort((p, q) => p[0] - q[0])
    const merged: [number, number][] = []
    for (const [a0, a1] of along) { const last = merged[merged.length - 1]; if (last && a0 <= last[1]) last[1] = Math.max(last[1], a1); else merged.push([a0, a1]) }
    let runs: [number, number][] = []
    let bi = 0
    for (let i = 1; i < cuts.length; i++) {
      const s0 = cuts[i - 1]!, s1 = cuts[i]!
      if (!(s1 - s0 > 1e-9)) continue
      const sm = (s0 + s1) / 2
      while (bi < merged.length && merged[bi]![1] <= sm) bi++
      if (bi < merged.length && sm > merged[bi]![0]) continue
      const mid = at(sm)
      if (idx.inside(mid) && idx.clear(mid, 1e-6)) runs.push([s0, s1])
    }
    if (keep) {
      const next: [number, number][] = []
      const on = (s: number) => keep!(at(s)) > above
      for (const [s0, s1] of runs) {
        const n = Math.max(1, Math.ceil((s1 - s0) / fieldStep))
        work.charge(n + 1, 'hatch field samples', 'fieldStep')
        let prev = s0, state = on(s0), start = state ? s0 : NaN
        for (let i = 1; i <= n; i++) {
          const s = i === n ? s1 : s0 + ((s1 - s0) * i) / n, st = on(s)
          if (st !== state) {
            work.charge(Math.max(0, Math.ceil(Math.log2((s - prev) / 0.05))), 'hatch field bisection', 'fieldStep')
            let lo = prev, hi = s
            while (hi - lo > 0.05) { const m = (lo + hi) / 2; if (on(m) === state) lo = m; else hi = m }
            const edge = (lo + hi) / 2
            if (state) next.push([start, edge]); else start = edge
            state = st
          }
          prev = s
        }
        if (state && s1 - start > 1e-9) next.push([start, s1])
      }
      runs = next
    }
    if (o.dash) {
      const [a, g] = o.dash, P = a + g, ph = phase * P, next: [number, number][] = []
      for (const [s0, s1] of runs) {
        const first = Math.floor((s0 + ph) / P), last = Math.floor((s1 + ph) / P)
        work.charge(last - first + 1, 'hatch dashes', 'dash')
        for (let q = first; q <= last; q++) {
          const d0 = Math.max(s0, q * P - ph), d1 = Math.min(s1, q * P - ph + a)
          if (d1 - d0 > 1e-9) next.push([d0, d1])
        }
      }
      runs = next
    }
    let j = 0
    for (const [s0, s1] of runs) {
      const piece = [at(s0)]
      while (j < cum.length && cum[j]! <= s0) j++
      for (; j < cum.length && cum[j]! < s1; j++) piece.push(pts[j]!)
      piece.push(at(s1))
      work.charge(piece.length, 'writing hatch', 'spacing')
      d += piece.map((q, i) => `${i ? 'L' : 'M'}${F(q.x)} ${F(q.y)}`).join('')
      count++
    }
  }
  return { d, count }
}

// ── Material ─────────────────────────────────────────────────────────────────────────────────
export interface Shadow { dx: number; dy: number; blur?: number; color?: string; opacity?: number }
type LayerBase = { id: string; tone?: string; opacity?: number; seed?: number | string }
type Own<T> = Omit<T, 'seed' | 'unit' | 'maxWork' | 'light' | 'id'>
/** A gradient over the shape, in its own space (it turns with it). Linear: across the outline's
 * bounds along `deg`, or away from the material's light ('light', lit end at offset 0). Radial: centre
 * and radius as fractions of the bounds (radius of the larger side). Stops: [offset, colour, opacity],
 * offsets strictly increasing (no hard stops). */
export interface GradientOpts {
  kind?: 'linear' | 'radial'
  deg?: number | 'light'
  cx?: number
  cy?: number
  r?: number
  stops: readonly (readonly [number, string, number?])[]
}
export type Layer = LayerBase & ({ scatter: Own<ScatterOpts> } | { hatch: Own<HatchOpts> } | { shade: { depth: number } } | { gradient: GradientOpts })
export interface Material {
  /** Rough edge in material units; null or absent = the true outline. */
  edge?: { amp: number; wavelength: number; seed?: number | string } | null
  /** Where the light comes from, screen degrees (0 = +x, 90 = +y, down). */
  light?: { deg: number }
  /** Bottom to top, over the fill. */
  layers?: readonly Layer[]
  ink?: { tone: string; width: number; passes?: number; amp?: number; wavelength?: number; opacity?: number; seed?: number | string }
  shadow?: Shadow
}
export interface Dressed {
  g: SVGGElement
  shape: SVGPathElement
  layers: Record<string, SVGPathElement>
  ink: SVGPathElement[]
  shadow?: SVGPathElement
  /** Keeps the light (and shadow) screen-fixed while the caller rotates `g` by rotDeg (absolute). */
  light(rotDeg: number): void
}

/** A material resolved against an outline: all geometry and attributes, before any DOM. Pure. */
export interface Plan {
  /** The outline as drawn (the material's edge applied), shape units. */
  drawn: string
  shadow?: { d: string; region: Bounds; blur: number; color: string; opacity: number; dx: number; dy: number }
  layers: {
    id: string; kind: 'scatter' | 'hatch' | 'shade' | 'gradient'; d: string; attrs: Record<string, string>; count: number; depth?: number
    /** Gradient layers: the gradient element, in shape units; the layer is filled with it. */
    gradient?: { tag: 'linearGradient' | 'radialGradient'; attrs: Record<string, string>; stops: { offset: string; color: string; opacity: string }[] }
  }[]
  ink: { d: string; attrs: Record<string, string> }[]
  /** Unit vector the light comes from (screen), or none. */
  light?: { x: number; y: number }
}

/** Resolves a material against an outline (design: Material). `unit` maps material units onto the
 * shape's (lengths ×, densities ÷ unit²). */
export function dress(outline: Outline, fill: string, m: Material, o: { seed: number | string; unit?: number; maxWork?: number }): Plan {
  only(m, ['edge', 'light', 'layers', 'ink', 'shadow'], 'material')
  const unit = check(o.unit ?? 1, 'unit', 'pos'), max = maxWorkOf(o.maxWork), fmt = writer(unit)
  const lightDeg = m.light ? (only(m.light, ['deg'], 'light'), check(m.light.deg, 'light.deg', 'any')) : undefined
  const prep = new Work('material', max)
  if (typeof outline === 'object' && 'polygon' in outline) prep.charge(outline.polygon.length, 'writing the outline', "the outline's complexity")
  let drawn = toPath(outline)
  if (m.edge) {
    only(m.edge, ['amp', 'wavelength', 'seed'], 'edge')
    drawn = roughenWith(outline, { amp: check(m.edge.amp, 'edge.amp', 'nonneg') * unit, wavelength: check(m.edge.wavelength, 'edge.wavelength', 'pos') * unit, seed: m.edge.seed ?? `${o.seed}:edge` }, new Work('edge', max), fmt)
  }
  const box = boundsOf(polylines(drawn, 4 * unit, (n) => prep.charge(n, 'flattening the outline', "the outline's curves")))
  const plan: Plan = { drawn, layers: [], ink: [], ...(lightDeg !== undefined ? { light: { x: Math.cos(lightDeg * RAD), y: Math.sin(lightDeg * RAD) } } : {}) }
  if (m.shadow) {
    const sh = m.shadow
    only(sh, ['dx', 'dy', 'blur', 'color', 'opacity'], 'shadow')
    const blur = check(sh.blur ?? 2, 'shadow.blur', 'nonneg') * unit, pad = 3 * blur
    const x0 = Math.floor(box.x - pad), y0 = Math.floor(box.y - pad)
    plan.shadow = {
      d: drawn, blur, color: sh.color ?? '#1F1C1B', opacity: check(sh.opacity ?? 0.28, 'shadow.opacity', 'unit'),
      dx: check(sh.dx, 'shadow.dx', 'any') * unit, dy: check(sh.dy, 'shadow.dy', 'any') * unit,
      region: { x: x0, y: y0, w: Math.ceil(box.x + box.w + pad) - x0, h: Math.ceil(box.y + box.h + pad) - y0 },
    }
  }
  const ids = new Set<string>()
  for (const L of m.layers ?? []) {
    if (typeof L.id !== 'string' || !L.id) throw new TextureError('texture: every layer needs an id')
    if (ids.has(L.id)) throw new TextureError(`texture: two layers have the id "${L.id}"`)
    ids.add(L.id)
    const kinds = (['scatter', 'hatch', 'shade', 'gradient'] as const).filter((k) => k in L)
    if (kinds.length !== 1) throw new TextureError(`texture: layer "${L.id}" needs exactly one of scatter, hatch, shade, gradient`)
    const kind = kinds[0]!
    only(L, ['id', 'opacity', ...(kind === 'gradient' ? [] : ['tone', 'seed']), kind], `layer "${L.id}"`)
    const seed = L.seed ?? `${o.seed}:layer:${L.id}`
    const common = { unit, id: L.id, ...(o.maxWork !== undefined ? { maxWork: o.maxWork } : {}), ...(lightDeg !== undefined ? { light: lightDeg } : {}) }
    const opacity = String(check(L.opacity ?? (kind === 'shade' ? 0.18 : kind === 'gradient' ? 1 : 0.2), `layer "${L.id}" opacity`, 'unit'))
    const stroke = (tone: string, w: number) => ({ fill: 'none', stroke: tone, 'stroke-width': fmt(w * unit), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    if ('scatter' in L) {
      const r = scatter(drawn, { ...L.scatter, seed, ...common })
      const tone = L.tone ?? inkFor(fill)
      plan.layers.push({ id: L.id, kind, d: r.d, count: r.count, attrs: { ...(r.paint === 'fill' ? { fill: tone } : stroke(tone, r.width!)), opacity } })
    } else if ('hatch' in L) {
      const r = hatch(drawn, { ...L.hatch, seed, ...common })
      plan.layers.push({ id: L.id, kind, d: r.d, count: r.count, attrs: { ...stroke(L.tone ?? inkFor(fill), L.hatch.width ?? 0.6), opacity } })
    } else if ('gradient' in L) {
      plan.layers.push({ id: L.id, kind, d: drawn, count: 1, attrs: { 'fill-rule': 'evenodd', opacity }, gradient: gradientOf(L.id, L.gradient, box, lightDeg, fmt) })
    } else {
      only(L.shade, ['depth'], `layer "${L.id}" shade`)
      const depth = check(L.shade.depth, `layer "${L.id}" shade.depth`, 'pos') * unit
      if (lightDeg === undefined) throw new TextureError(`texture: layer "${L.id}" is a shade, which needs the material's light`)
      // The band: the bounds (padded) minus the outline, shifted toward the light, inside the clip.
      const p = depth + 1
      plan.layers.push({ id: L.id, kind, depth, count: 1, d: `M${fmt(box.x - p)} ${fmt(box.y - p)}H${fmt(box.x + box.w + p)}V${fmt(box.y + box.h + p)}H${fmt(box.x - p)}Z${drawn}`, attrs: { 'fill-rule': 'evenodd', fill: L.tone ?? '#1F1C1B', opacity } })
    }
  }
  if (m.ink) {
    const k = m.ink
    only(k, ['tone', 'width', 'passes', 'amp', 'wavelength', 'opacity', 'seed'], 'ink')
    const passes = k.passes ?? 1
    if (!(Number.isInteger(passes) && passes >= 1)) throw new TextureError(`texture: ink.passes must be an integer ≥ 1, got ${passes}`)
    const w = new Work('ink', max)
    const amp = check(k.amp ?? m.edge?.amp ?? 0.5, 'ink.amp', 'nonneg') * unit, wavelength = check(k.wavelength ?? m.edge?.wavelength ?? 12, 'ink.wavelength', 'pos') * unit
    const attrs = { fill: 'none', stroke: k.tone, 'stroke-width': fmt(check(k.width, 'ink.width', 'pos') * unit), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: String(check(k.opacity ?? 1, 'ink.opacity', 'unit')) }
    for (let i = 0; i < passes; i++) plan.ink.push({ d: roughenWith(outline, { amp, wavelength, seed: k.seed !== undefined ? `${k.seed}:${i}` : `${o.seed}:ink:${i}` }, w, fmt), attrs })
  }
  return plan
}

/** A gradient layer's element, resolved against the drawn outline's bounds (shape units). */
function gradientOf(id: string, g: GradientOpts, box: Bounds, light: number | undefined, fmt: (n: number) => string): NonNullable<Plan['layers'][number]['gradient']> {
  const where = `layer "${id}" gradient`
  const kind = g.kind ?? 'linear'
  if (kind !== 'linear' && kind !== 'radial') throw new TextureError(`texture: ${where} kind must be 'linear' or 'radial', got ${String(kind)}`)
  only(g, ['kind', 'stops', ...(kind === 'linear' ? ['deg'] : ['cx', 'cy', 'r'])], `${where} (${kind})`)
  if (!Array.isArray(g.stops) || g.stops.length < 2) throw new TextureError(`texture: ${where} needs at least two stops`)
  let last = 0
  const stops = g.stops.map(([offset, color, opacity = 1], i) => {
    check(offset, `${where} stop ${i} offset`, 'unit')
    // Hard stops (two at one offset) alias and crawl under motion in Chromium's SVG raster (measured,
    // texture-stability.test.ts); a hard line is a hatch.
    if (i > 0 && !(offset > last)) throw new TextureError(`texture: ${where} stop offsets must increase (stop ${i}: ${offset} after ${last}); hard stops crawl under motion, draw hard lines with hatch`)
    last = offset
    if (typeof color !== 'string' || !color) throw new TextureError(`texture: ${where} stop ${i} needs a colour`)
    return { offset: String(offset), color, opacity: String(check(opacity, `${where} stop ${i} opacity`, 'unit')) }
  })
  if (kind === 'radial') {
    const cx = box.x + check(g.cx ?? 0.5, `${where} cx`, 'any') * box.w, cy = box.y + check(g.cy ?? 0.5, `${where} cy`, 'any') * box.h
    const r = check(g.r ?? 0.5, `${where} r`, 'pos') * Math.max(box.w, box.h)
    return { tag: 'radialGradient', attrs: { gradientUnits: 'userSpaceOnUse', cx: fmt(cx), cy: fmt(cy), r: fmt(r) }, stops }
  }
  let deg: number
  if (g.deg === 'light') {
    if (light === undefined) throw new TextureError(`texture: ${where} runs from the light, but the material has no light`)
    deg = light + 180
  } else deg = check(g.deg ?? 90, `${where} deg`, 'any')
  // From the side `deg` points away from to the side it points to, through the bounds' centre.
  const ux = Math.cos(deg * RAD), uy = Math.sin(deg * RAD), cx = box.x + box.w / 2, cy = box.y + box.h / 2
  const half = (Math.abs(ux) * box.w + Math.abs(uy) * box.h) / 2
  return { tag: 'linearGradient', attrs: { gradientUnits: 'userSpaceOnUse', x1: fmt(cx - ux * half), y1: fmt(cy - uy * half), x2: fmt(cx + ux * half), y2: fmt(cy + uy * half) }, stops }
}

let clips = 0, shadows = 0, gradients = 0
function defsOf(parent: Element): Element {
  const svg = parent instanceof SVGSVGElement ? parent : parent.closest('svg')
  if (!svg) throw new TextureError('texture: parent is not inside an <svg>')
  return svg.querySelector(':scope > defs') ?? el(svg, 'defs')
}
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) }
/** Ink for texture over a fill: cream on dark fills, near-black on light ones. */
export const inkFor = (fill: string) => (/^#[0-9a-f]{6}$/i.test(fill) && lum(fill) < 120 ? '#F3EEE2' : '#1F1C1B')

/**
 * A shape printed in a material, in `parent`: a group (the caller transforms it) holding the cast
 * shadow, the shape (the material's edge applied), the layers clipped to it, and the ink line.
 * Scatter and hatch layers are marked `data-cf-audit="texture"`.
 */
export function material(ctx: Pick<MountContext, 'id'>, parent: Element, outline: Outline, fill: string, m: Material,
  o: { seed: number | string; unit?: number; maxWork?: number }): Dressed {
  const plan = dress(outline, fill, m, o)
  const g = el(parent, 'g')
  let shadow: SVGPathElement | undefined
  if (plan.shadow) {
    const sh = plan.shadow, r = sh.region
    const f = el(defsOf(parent), 'filter', { id: ctx.id(`texture-shadow-${++shadows}`), filterUnits: 'userSpaceOnUse', x: r.x, y: r.y, width: r.w, height: r.h })
    el(f, 'feGaussianBlur', { stdDeviation: sh.blur })
    shadow = el(g, 'path', { d: sh.d, 'fill-rule': 'evenodd', fill: sh.color, opacity: sh.opacity, filter: `url(#${f.id})` })
  }
  const shape = el(g, 'path', { d: plan.drawn, fill, 'fill-rule': 'evenodd' })
  const layers: Record<string, SVGPathElement> = {}
  const shades: { el: SVGPathElement; depth: number }[] = []
  if (plan.layers.length) {
    const clip = el(defsOf(parent), 'clipPath', { id: ctx.id(`texture-clip-${++clips}`), clipPathUnits: 'userSpaceOnUse' })
    el(clip, 'path', { d: plan.drawn, 'clip-rule': 'evenodd' })
    const lg = el(g, 'g', { 'clip-path': `url(#${clip.id})` })
    for (const L of plan.layers) {
      const e = el(lg, 'path', { d: L.d, ...L.attrs })
      if (L.gradient) {
        const gr = el(defsOf(parent), L.gradient.tag, { id: ctx.id(`texture-gradient-${++gradients}`), ...L.gradient.attrs })
        for (const st of L.gradient.stops) el(gr, 'stop', { offset: st.offset, 'stop-color': st.color, 'stop-opacity': st.opacity })
        e.setAttribute('fill', `url(#${gr.id})`)
      }
      if (L.kind === 'shade') shades.push({ el: e, depth: L.depth! })
      else if (L.kind !== 'gradient') e.dataset.cfAudit = 'texture'
      layers[L.id] = e
    }
  }
  const ink = plan.ink.map((k) => el(g, 'path', { d: k.d, ...k.attrs }))
  const lx = plan.light?.x ?? 0, ly = plan.light?.y ?? 0, fw = writer(o.unit ?? 1)
  const light = (rotDeg: number) => {
    check(rotDeg, 'light rotDeg', 'any')
    for (const s of shades) { const q = shadowOffset(rotDeg, lx * s.depth, ly * s.depth); s.el.setAttribute('transform', `translate(${fw(q.dx)} ${fw(q.dy)})`) }
    if (shadow) { const q = shadowOffset(rotDeg, plan.shadow!.dx, plan.shadow!.dy); shadow.setAttribute('transform', `translate(${fw(q.dx)} ${fw(q.dy)})`) }
  }
  light(0)
  return { g, shape, layers, ink, ...(shadow ? { shadow } : {}), light }
}
