import { seeded } from '@cueframe/core'
import film from './data/film.json'

export { film }

/** One bar of the 90 BPM grid; every scene time below is a bar or beat position. */
export const BAR = (film.beatsPerBar * 60) / film.bpm
export const BEAT = 60 / film.bpm
export const DUR = film.bars * BAR
/** Film time of a narrative (subtitle) time. */
export const narr = (t: number) => film.narrativeOffset + t

export const T = {
  q1: 0.12 * BAR,
  e1: 0.32 * BAR,
  q2: 1.0 * BAR,
  e2: 1.2 * BAR,
  qOut: 1.65 * BAR,
  neb: 1.85 * BAR,
  flyIn: 2.0 * BAR,
  swell: 3.5 * BAR,
  burst: 4.0 * BAR,
  titleOn: 4.4 * BAR,
  ring: 4.5 * BAR,
  en: 4.875 * BAR,
  tag: 5.125 * BAR,
  reform: 5.75 * BAR,
} as const

export const C = { x: 960, y: 520 }
export const TITLE_Y = 592
export const FLAKE_R = 330

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t) }
export const outCubic = (x: number) => 1 - (1 - clamp01(x)) ** 3
export const seg = (t: number, a: number, b: number, e = smooth) => e(clamp01((t - a) / (b - a)))
/** Fade in over [a, a+i], out over [b-o, b]. */
export const win = (t: number, a: number, b: number, i = 0.6, o = 0.6) => seg(t, a, a + i) * (1 - seg(t, b - o, b))

/** Slow camera push for the whole piece plus a small punch at the burst. */
export const zoom = (t: number) => 1 + 0.055 * smooth(t / DUR) + 0.02 * smooth((t - T.flyIn) / (T.burst - T.flyIn)) - 0.025 * Math.exp(-Math.max(0, t - T.burst) * 2.2) * (t >= T.burst ? 1 : 0)

export const flakeRot = (t: number) => 0.16 * (t - T.flyIn) - 0.35
export const flake2Rot = (t: number) => 0.6 - 0.12 * (t - T.reform)

/**
 * Six-fold snowflake: spines, paired side branches with twigs, two hexagons and a tip diamond,
 * sampled as n points (local px, centre at 0,0, radius r). Deterministic.
 */
export function snowflake(n: number, r: number, seed: string): Float32Array {
  type S = [number, number, number, number, number]
  const segs: S[] = []
  const add = (x0: number, y0: number, x1: number, y1: number, w: number) => segs.push([x0, y0, x1, y1, w])
  const ray = (a: number, r0: number, r1: number) => [Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1] as const
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI / 2
    const [x0, y0, x1, y1] = ray(a, 0.12 * r, r)
    add(x0, y0, x1, y1, 4.5)
    const branches: [number, number][] = [[0.3, 0.28], [0.5, 0.34], [0.68, 0.25], [0.84, 0.13]]
    for (const [at, len] of branches) {
      const bx = Math.cos(a) * at * r, by = Math.sin(a) * at * r
      for (const s of [-1, 1]) {
        const b = a + (s * Math.PI) / 3
        const ex = bx + Math.cos(b) * len * r, ey = by + Math.sin(b) * len * r
        add(bx, by, ex, ey, 3)
        const mx = bx + Math.cos(b) * len * r * 0.55, my = by + Math.sin(b) * len * r * 0.55
        const tw = a
        add(mx, my, mx + Math.cos(tw) * len * r * 0.32, my + Math.sin(tw) * len * r * 0.32, 2)
      }
    }
    // tip diamond
    const tx = Math.cos(a) * r, ty = Math.sin(a) * r, d = 0.05 * r
    for (const s of [-1, 1]) {
      const b = a + (s * Math.PI) / 2
      add(tx, ty, tx - Math.cos(a) * d + Math.cos(b) * d * 0.7, ty - Math.sin(a) * d + Math.sin(b) * d * 0.7, 2)
    }
    // hexagons
    for (const hr of [0.12, 0.22]) {
      const a0 = a, a1 = a + Math.PI / 3
      add(Math.cos(a0) * hr * r, Math.sin(a0) * hr * r, Math.cos(a1) * hr * r, Math.sin(a1) * hr * r, hr < 0.15 ? 2.5 : 2)
    }
    // inner spokes
    const a2 = a + Math.PI / 6
    const [sx0, sy0, sx1, sy1] = ray(a2, 0.12 * r * 0.87, 0.22 * r * 0.87)
    add(sx0, sy0, sx1, sy1, 1.5)
  }
  const len = segs.map(([x0, y0, x1, y1, w]) => Math.hypot(x1 - x0, y1 - y0) * (0.5 + w / 4))
  const total = len.reduce((a, b) => a + b, 0)
  const rnd = seeded(seed)
  const out = new Float32Array(n * 2)
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5
  const haze = Math.floor(n * 0.06)
  let i = 0
  segs.forEach(([x0, y0, x1, y1, w], k) => {
    const m = k === segs.length - 1 ? n - haze - i : Math.round(((n - haze) * len[k]!) / total)
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1
    for (let j = 0; j < m && i < n - haze; j++, i++) {
      const u = rnd(), o = gauss() * w
      out[i * 2] = x0 + dx * u - (dy / l) * o
      out[i * 2 + 1] = y0 + dy * u + (dx / l) * o
    }
  })
  for (; i < n; i++) {
    const a = rnd() * Math.PI * 2, rr = r * Math.sqrt(rnd()) * 1.05
    out[i * 2] = Math.cos(a) * rr
    out[i * 2 + 1] = Math.sin(a) * rr
  }
  return out
}
