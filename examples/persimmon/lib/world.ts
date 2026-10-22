// The orchard at dusk: a watercolour background plate painted once, and the live props drawn over it each frame
// (the persimmon, drifting leaves). World px: 1920 × 1080 at zoom 1.
import type { BrushFrame } from '@brushframe/core'
import { hash, lerp } from '@cueframe/recipes/motion.js'
import { PAL, ellPts, inkLine, shape, starPts, type P } from './dou.js'

export const SKY = ['#3B3F7C', '#5F5590', '#8C6FA6', '#C9889A', '#E8A07A', '#F3BE8E']
export const GROUND_Y = 900
/** The branch the persimmon hangs from, and its rest position. */
export const STEM: P = [1000, 506]
export const FRUIT: P = [1000, 562]
export const FRUIT_R = 30

export interface Camera { cx: number; cy: number; zoom: number }
export const toScreen = (c: Camera, [x, y]: P, w = 1920, h = 1080): P => [(x - c.cx) * c.zoom + w / 2, (y - c.cy) * c.zoom + h / 2]
export function camera(b: BrushFrame, c: Camera, w = 1920, h = 1080) {
  b.translate(w / 2, h / 2)
  b.scale(c.zoom)
  b.translate(-c.cx, -c.cy)
}

const wave = (x0: number, x1: number, y: number, amp: number, seed: number, n = 24): P[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n
    return [x, y + amp * (Math.sin(x * 0.004 + seed) + 0.5 * Math.sin(x * 0.011 + seed * 2.3))] as P
  })

/** A tapered band along a path, w0 wide at the start and w1 at the end: one outline, left side then right. */
function ribbon(path: P[], w0: number, w1: number): P[] {
  const n = path.length, dense: P[] = []
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
    const a = path[i]!, c = path[i + 1]!, u = k / 4
    dense.push([lerp(a[0], c[0], u), lerp(a[1], c[1], u)])
  }
  dense.push(path[n - 1]!)
  const side = (s: number) => dense.map(([x, y], i) => {
    const j = Math.min(i, dense.length - 2), [x0, y0] = dense[j]!, [x1, y1] = dense[j + 1]!
    const len = Math.hypot(x1 - x0, y1 - y0) || 1, w = lerp(w0, w1, i / (dense.length - 1)) / 2
    return [x - (s * (y1 - y0) * w) / len, y + (s * (x1 - x0) * w) / len] as P
  })
  return [...side(1), ...side(-1).reverse()]
}

function wc(b: BrushFrame, pts: P[], color: string, o: { op?: number; bleed?: number; tex?: number } = {}) {
  b.noStroke()
  b.fill(color, o.op ?? 255)
  b.fillBleed(o.bleed ?? 0.12)
  b.fillTexture(o.tex ?? 0.4, 0.5)
  b.polygon(pts)
  b.noFill()
}

/** The background plate (painted once, in world px): every framing is a camera over the same paint. */
export const PLATE = { x: -20, y: -20, width: 1960, height: 1120 }
export function background(b: BrushFrame) {
  const L = -200, R = 2120
  // flat washes give the colour; low watercolour blobs on top give the paper its texture
  const band = (y0: number, y1: number, col: string, seed: number) => {
    const pts = [...wave(L, R, y0, 18, seed), ...wave(L, R, y1, 18, seed + 1).reverse()]
    b.noStroke(); b.wash(col, 255); b.polygon(pts); b.noWash()
    wc(b, pts, col, { op: 140, bleed: 0.2, tex: 0.5 })
  }
  // a graded dusk: many close washes, each a little wetter than a hard band
  const stops = SKY.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
  const N = 10
  for (let i = 0; i < N; i++) {
    const k = (i / (N - 1)) * (stops.length - 1), j = Math.min(stops.length - 2, Math.floor(k)), u = k - j
    const c = stops[j]!.map((v, q) => Math.round(lerp(v, stops[j + 1]![q]!, u)))
    const hex = '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
    const y0 = i === 0 ? -300 : 60 + i * 78
    band(y0, 60 + (i + 1) * 78 + 60, hex, i * 1.37)
  }
  wc(b, ellPts(560, 770, 110, 110, 28), '#F7D9A8', { bleed: 0.06, tex: 0.2 })
  const hill = (y: number, amp: number, seed: number, col: string, tex: string) => {
    const pts: P[] = [...wave(L, R, y, amp, seed), [R, 1300], [L, 1300]]
    b.noStroke(); b.wash(col, 255); b.polygon(pts); b.noWash()
    wc(b, pts, tex, { op: 90, bleed: 0.04, tex: 0.6 })
  }
  hill(748, 26, 1.3, '#7B6A9A', '#9A86B4')
  hill(816, 14, 4.1, '#5B5683', '#6F6894')
  hill(866, 10, 2.2, '#A9824E', '#C29A5E')
  hill(955, 8, 5.7, '#94703F', '#7E5D33')

  // the tree: a trunk wash, branches dragged in charcoal, an ink line over both
  b.noStroke()
  b.wash('#4A3540', 255)
  b.polygon([[1268, 915], [1290, 700], [1300, 560], [1318, 430], [1350, 330], [1372, 330], [1352, 450], [1344, 600], [1350, 760], [1372, 915]])
  b.noWash()
  wc(b, [[1336, 905], [1336, 700], [1332, 560], [1344, 440], [1362, 345], [1348, 450], [1340, 600], [1344, 760], [1360, 905]], '#2E2030', { op: 120, bleed: 0.01, tex: 0.3 })
  b.set('pen', PAL.ink, 1.8)
  b.spline([[1268, 915], [1290, 700], [1300, 560], [1318, 430], [1350, 330]], 0.6)
  b.spline([[1372, 915], [1350, 760], [1344, 600], [1352, 450], [1372, 330]], 0.6)
  const branches: P[][] = [
    [[1300, 545], [1200, 520], [1100, 502], [990, 500], [930, 486]],
    [[1330, 440], [1420, 380], [1500, 350], [1560, 300]],
    [[1350, 360], [1300, 270], [1250, 220]],
    [[1340, 620], [1450, 590], [1530, 600]],
    [[1150, 512], [1110, 460], [1090, 420]],
  ]
  for (const [i, br] of branches.entries()) {
    const w0 = i === 0 ? 11 : 8
    const rib = ribbon(br, w0, 2)
    b.noStroke(); b.wash('#4A3540', 255); b.polygon(rib); b.noWash()
    b.set('pen', PAL.ink, 1.3)
    b.spline(rib.slice(0, br.length * 4), 0.5)
    b.spline(rib.slice(br.length * 4), 0.5)
  }
  for (const [x, y, a] of [[1500, 352, -0.6], [1240, 226, 0.4], [1530, 598, 0.9]] as const) {
    b.noStroke(); b.wash('#C98A3A', 255)
    b.polygon(ellPts(x, y + 16, 9, 18, 12, a))
    b.noWash()
  }
  // grass tufts along the near ground
  for (let i = 0; i < 26; i++) {
    const x = 60 + i * 74 + hash(i, 3) * 40, y = 905 + hash(i, 5) * 60
    b.set('pen', '#5A6A38', 1.2)
    b.spline([[x, y], [x - 6, y - 16 - hash(i, 7) * 10]], 0)
    b.spline([[x + 5, y], [x + 9, y - 12 - hash(i, 9) * 8]], 0)
  }
}

/** The persimmon at (x, y), turned by `rot`, with its stem up to `stem` when it still hangs. */
export function persimmon(b: BrushFrame, x: number, y: number, o: { rot?: number; stem?: P | null; key: string; bf: number; r?: number; sw?: number }) {
  const r = o.r ?? FRUIT_R, sw = o.sw ?? 1.6
  b.push()
  b.translate(x, y)
  b.rotate(o.rot ?? 0)
  if (o.stem) {
    const sx = (o.stem[0] - x) * Math.cos(-(o.rot ?? 0)) - (o.stem[1] - y) * Math.sin(-(o.rot ?? 0))
    const sy = (o.stem[0] - x) * Math.sin(-(o.rot ?? 0)) + (o.stem[1] - y) * Math.cos(-(o.rot ?? 0))
    inkLine(b, [[0, -r * 0.9], [sx * 0.5, (sy - r) * 0.55], [sx, sy]], { key: `${o.key}/stem`, bf: o.bf, sw: sw * 1.3, ink: '#3A2A33' })
  }
  const body: P[] = ellPts(0, 0, r * 1.08, r * 0.95, 24).map(([px, py]) => [px, py + (py < 0 ? 0.1 * py : 0)] as P)
  shape(b, body, { key: `${o.key}/body`, bf: o.bf, wash: PAL.persimmon, sw })
  shape(b, ellPts(r * 0.3, r * 0.25, r * 0.6, r * 0.5, 16), { key: `${o.key}/shade`, bf: o.bf, wash: PAL.persimmonDk, op: 120, ink: null, boil: 0.5 })
  shape(b, ellPts(-r * 0.4, -r * 0.35, r * 0.2, r * 0.14, 10, -0.5), { key: `${o.key}/hl`, bf: o.bf, wash: PAL.cream, op: 220, ink: null, boil: 0.3 })
  shape(b, starPts(0, -r * 0.92, r * 0.48, 0.35, 4, 0.3), { key: `${o.key}/calyx`, bf: o.bf, wash: PAL.sapDk, sw: sw * 0.8 })
  b.pop()
}

/** Leaves blown across from the right, from `at`: each a pure path of time. */
export function leaves(b: BrushFrame, t: number, at: number, o: { n: number; bf: number; key: string; sw?: number }) {
  for (let i = 0; i < o.n; i++) {
    const t0 = at + hash(i, 11) * 1.4, age = t - t0
    if (age < 0 || age > 3) continue
    const x = 2050 - age * (520 + 220 * hash(i, 13)), y = 380 + hash(i, 17) * 420 + 60 * Math.sin(age * 3 + i) + age * 40
    const a = age * (3 + hash(i, 19) * 3)
    shape(b, ellPts(x, y, 15, 7, 12, a), { key: `${o.key}/${i}`, bf: o.bf, wash: i % 2 ? '#C98A3A' : '#D9A04A', sw: (o.sw ?? 1.6) * 0.7 })
  }
}

/** An iris overlay (DOM): radius r in screen px around (x, y); r ≥ the stage diagonal shows everything. */
export function iris(el: HTMLElement, x: number, y: number, r: number) {
  const full = r >= 2300
  el.style.display = full ? 'none' : 'block'
  if (!full) el.style.maskImage = `radial-gradient(circle at ${x.toFixed(1)}px ${y.toFixed(1)}px, transparent ${Math.max(0, r).toFixed(1)}px, #000 ${(Math.max(0, r) + 1.5).toFixed(1)}px)`
}
