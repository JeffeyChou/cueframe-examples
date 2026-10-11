// Drawing primitives over Cells: 3D projection, shaded fields, rings, polylines, SDF shading.
import { Cells, type Rect, grad, mix, mul } from './cells.ts'

export type V3 = [number, number, number]
export const TAU = Math.PI * 2
export const RAMP = ' .:-=+*#%@'
export const FINE = " .'`^,:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@"
export const rampCh = (v: number, r = RAMP) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length)))]!

export function rotY(p: V3, a: number): V3 { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c] }
export function rotX(p: V3, a: number): V3 { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c] }
export function rotZ(p: V3, a: number): V3 { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]] }
export const len3 = (p: V3) => Math.hypot(p[0], p[1], p[2])
export const norm3 = (p: V3): V3 => { const l = len3(p) || 1; return [p[0] / l, p[1] / l, p[2] / l] }
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** A camera mapping world units onto a rect: unit = half the rect height in rows. */
export class Cam {
  cx: number; cy: number; s: number; d: number; aspect: number
  constructor(r: Rect, aspect: number, zoom = 1, d = 3.2) {
    this.cx = r.x + r.w / 2; this.cy = r.y + r.h / 2; this.s = (r.h / 2) * zoom; this.d = d; this.aspect = aspect
  }
  /** → [x, y, depth-scale, z] in cells; null behind the camera. */
  p(v: V3): [number, number, number, number] | null {
    const z = v[2] + this.d
    if (z < 0.05) return null
    const k = this.d / z
    return [this.cx + v[0] * k * this.s * this.aspect, this.cy + v[1] * k * this.s, k, v[2]]
  }
}

export function seg3(c: Cells, cam: Cam, a: V3, b: V3, col: number, ch?: string) {
  const p = cam.p(a), q = cam.p(b)
  if (p && q) c.line(p[0], p[1], q[0], q[1], col, ch)
}

/** Iterates every cell of r with normalised coords: x in [-ar, ar], y in [-1, 1] (aspect-correct). */
export function field(c: Cells, r: Rect, fn: (x: number, y: number, cx: number, cy: number) => void) {
  const hh = r.h / 2
  for (let cy = r.y; cy < r.y + r.h; cy++) {
    const y = (cy + 0.5 - r.y - hh) / hh
    for (let cx = r.x; cx < r.x + r.w; cx++) {
      if (!c.inside(cx, cy)) continue
      fn((cx + 0.5 - r.x - r.w / 2) / (hh * c.aspect), y, cx, cy)
    }
  }
}

/** Ellipse-correct ring of glyphs centred at (cx, cy) with radius r rows. */
export function ring(c: Cells, cx: number, cy: number, r: number, col: (a: number) => number, a0 = 0, a1 = TAU, ch?: string | ((a: number) => string)) {
  const n = Math.max(8, Math.ceil((a1 - a0) * r * c.aspect * 1.3))
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n
    const g = typeof ch === 'function' ? ch(a) : ch ?? c.slope(-Math.sin(a) * c.aspect, Math.cos(a))
    c.put(cx + Math.cos(a) * r * c.aspect, cy + Math.sin(a) * r, g, col(a))
  }
}

export function poly(c: Cells, pts: [number, number][], col: number, closed = false, ch?: string) {
  for (let i = 0; i + 1 < pts.length; i++) c.line(pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], col, ch)
  if (closed && pts.length > 2) c.line(pts[pts.length - 1]![0], pts[pts.length - 1]![1], pts[0]![0], pts[0]![1], col, ch)
}

/** Raymarches an SDF inside r and shades it with a glyph ramp. `sdf` returns distance; `color` maps (shade, p, n). */
export function raymarch(c: Cells, r: Rect, o: {
  sdf: (p: V3) => number
  color: (shade: number, p: V3, n: V3) => number
  zoom?: number; dist?: number; light?: V3; ramp?: string; steps?: number; bg?: (x: number, y: number, cx: number, cy: number) => void
}) {
  const D = o.dist ?? 3.2, L = norm3(o.light ?? [-0.5, -0.7, -0.6]), ramp = o.ramp ?? FINE, steps = o.steps ?? 48
  const zoom = o.zoom ?? 1
  field(c, r, (x, y, cx, cy) => {
    const rd = norm3([x / zoom, y / zoom, 1.6])
    const ro: V3 = [0, 0, -D]
    let t = 0.4, hit = false
    for (let i = 0; i < steps; i++) {
      const p: V3 = [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t]
      const d = o.sdf(p)
      if (d < 0.004) { hit = true; break }
      t += d * 0.9
      if (t > D + 3) break
    }
    if (!hit) { o.bg?.(x, y, cx, cy); return }
    const p: V3 = [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t]
    const e = 0.004
    const n = norm3([
      o.sdf([p[0] + e, p[1], p[2]]) - o.sdf([p[0] - e, p[1], p[2]]),
      o.sdf([p[0], p[1] + e, p[2]]) - o.sdf([p[0], p[1] - e, p[2]]),
      o.sdf([p[0], p[1], p[2] + e]) - o.sdf([p[0], p[1], p[2] - e]),
    ])
    const dif = Math.max(0, dot3(n, L))
    const h = norm3([L[0] - rd[0], L[1] - rd[1], L[2] - rd[2]])
    const spec = Math.max(0, dot3(n, h)) ** 24
    const rim = (1 + dot3(n, rd)) ** 2 * 0.0 + Math.max(0, 1 - Math.abs(dot3(n, rd))) ** 3 * 0.35
    const s = Math.min(1, 0.08 + 0.72 * dif + 0.6 * spec + rim)
    c.put(cx, cy, rampCh(s, ramp), o.color(s, p, n))
  })
}

/** Starfield / warp streaks towards the viewer from the rect centre. */
export function warp(c: Cells, r: Rect, t: number, speed: number, n: number, col: (z: number, i: number) => number, seed = 1) {
  const cam = new Cam(r, c.aspect, 1, 1)
  for (let i = 0; i < n; i++) {
    const h1 = Math.sin(i * 12.9898 + seed) * 43758.5453, h2 = Math.sin(i * 78.233 + seed) * 12345.678
    const a = (h1 - Math.floor(h1)) * TAU, rr = 0.15 + (h2 - Math.floor(h2)) * 2.4
    const z = 4 - ((t * speed + i * 0.37) % 4)
    const p: V3 = [Math.cos(a) * rr, Math.sin(a) * rr * 0.9, z]
    const q: V3 = [p[0], p[1], z + 0.12 * speed]
    const A = cam.p(p), Bq = cam.p(q)
    if (!A || !Bq) continue
    const k = 1 - z / 4
    if (speed > 2) c.line(Bq[0], Bq[1], A[0], A[1], mul(col(z, i), 0.6 + 0.4 * k))
    c.put(A[0], A[1], k > 0.75 ? '✦' : k > 0.5 ? '*' : k > 0.25 ? '+' : '·', col(z, i))
  }
}

/** Phosphor palette helpers. */
export const PAL = {
  green: [0x020a04, 0x0a3a18, 0x16803a, 0x39ff88, 0xd4ffe4],
  cyan: [0x02080c, 0x08354a, 0x1290b8, 0x2ee6ff, 0xe0fbff],
  amber: [0x0c0602, 0x4a2608, 0xb86812, 0xffb02e, 0xfff0d0],
  magenta: [0x0a020a, 0x46104a, 0xb01cb8, 0xff3df0, 0xffe0fc],
  red: [0x0c0202, 0x4a0808, 0xb81212, 0xff3030, 0xffe0e0],
  pink: [0x0c0206, 0x4a0a26, 0xc0205a, 0xff4f8b, 0xffe4ee],
  violet: [0x06020c, 0x26104a, 0x6a2cc0, 0xb06cff, 0xf0e4ff],
  ice: [0x04060a, 0x1a2a3a, 0x4a6a8a, 0x9ab8d8, 0xf0f8ff],
  blue: [0x02040c, 0x0a1c4a, 0x1a50c0, 0x4fa8ff, 0xe0f0ff],
}
export const pal = (p: readonly number[], v: number) => grad(p, v)
export { mix, mul }
