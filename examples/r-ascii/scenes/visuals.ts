// One character-drawn visual per section, drawn into the viewport in pixel units around its centre.
import { seeded } from '@cueframe/core'
import { ramp } from '../ascii-grid.js'
import { type Section, View, fmt, hex } from '../lib.js'
import { clamp01, flash, hash, inOutCubic, lerp, noise1, outCubic, outExpo, seg } from '../motion.js'

export interface Visual {
  draw(v: View, t: number, s: Section): void
  readouts(t: number, s: Section): [string, string][]
  log(k: number, s: Section): string
}

const DEPTH = '·:+*o●'
const TAU = Math.PI * 2

// ── points / DIMENSION ──────────────────────────────────────────────────────────────────────────

const rnd = seeded(42)
const N = 360
const CLOUD = Array.from({ length: N }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * 2.39996323
  return { s: [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1], e: [Math.cos(a) * r, y, Math.sin(a) * r], d: rnd() * 0.5 }
})
const TAGS = [7, 61, 133, 190]
const HYPER = Array.from({ length: 16 }, (_, i) => [0, 1, 2, 3].map((b) => ((i >> b) & 1 ? 1 : -1)))
const EDGES: [number, number][] = []
for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) if (!(i & (1 << b))) EDGES.push([i, i | (1 << b)])

function rot3(p: number[], ay: number, ax: number) {
  const [x, y, z] = p as [number, number, number]
  const x1 = x * Math.cos(ay) + z * Math.sin(ay), z1 = -x * Math.sin(ay) + z * Math.cos(ay)
  return [x1, y * Math.cos(ax) - z1 * Math.sin(ax), y * Math.sin(ax) + z1 * Math.cos(ax)] as [number, number, number]
}
const proj = (p: [number, number, number], R: number, d = 3.4) => {
  const k = d / (d + p[2])
  return { x: p[0] * R * k, y: p[1] * R * k, z: p[2], k }
}

export const points: Visual = {
  draw(v, t, s) {
    const lt = t - s.t0
    const ay = lt * 0.85 + 0.4, ax = -0.42 + 0.12 * Math.sin(lt * 1.3)
    const hit = t >= s.hit
    const R = 270
    const oy = hit ? 60 : 20
    // floor grid
    const fy = 1.15
    const grid = outCubic(seg(t, s.t0 + 0.3, s.mid + 0.4)) * (hit ? 0.5 : 1)
    if (grid > 0) for (let k = -4; k <= 4; k++) {
      const a = proj(rot3([-1.6, fy, k * 0.4], ay, ax), R), b = proj(rot3([1.6, fy, k * 0.4], ay, ax), R)
      const c = proj(rot3([k * 0.4, fy, -1.6], ay, ax), R), d = proj(rot3([k * 0.4, fy, 1.6], ay, ax), R)
      v.dash(a.x, a.y + oy, lerp(a.x, b.x, grid), lerp(a.y, b.y, grid) + oy, 236)
      v.dash(c.x, c.y + oy, lerp(c.x, d.x, grid), lerp(c.y, d.y, grid) + oy, 236)
    }
    // axes
    const ax3 = outExpo(seg(t, s.mid, s.mid + 0.6))
    if (ax3 > 0 && !hit) {
      const o = proj(rot3([0, 0, 0], ay, ax), R)
      ;(['x', 'y', 'z'] as const).forEach((n, i) => {
        const e = [0, 0, 0]; e[i] = (i === 1 ? -1.45 : 1.45) * ax3
        const p = proj(rot3(e, ay, ax), R)
        v.line(o.x, o.y + oy, p.x, p.y + oy, [196, 46, 33][i]!)
        v.text(p.x + 8, p.y + oy, n.toUpperCase(), [203, 120, 75][i]!)
      })
    }
    // the point set: scatter → sphere, explodes away on the hit
    const form = outCubic(seg(t, s.t0, s.t0 + 1.1))
    const boom = seg(t, s.hit, s.hit + 0.35, outCubic)
    if (boom < 1) {
      const pts = CLOUD.map((c, i) => {
        const k = clamp01((form - c.d * 0.6) / 0.7)
        const p = [0, 1, 2].map((j) => lerp(c.s[j]! * 1.9, c.e[j]!, inOutCubic(k)) * (1 + boom * 2.2) + 0.03 * noise1(lt * 2 + i, j))
        return { ...proj(rot3(p, ay, ax), R), i }
      }).sort((a, b) => b.z - a.z)
      for (const p of pts) {
        const dz = clamp01((1.3 - p.z) / 2.6)
        v.put(p.x, p.y + oy, DEPTH[Math.min(5, Math.floor(dz * 6))]!, ramp(s.ramp, dz * (1 - boom)))
      }
      // labelled points with leader lines
      const tag = seg(t, s.mid + 0.2, s.mid + 0.5)
      if (tag > 0) for (const [j, i] of TAGS.entries()) {
        if (tag < j * 0.25) continue
        const p = pts.find((q) => q.i === i)!
        const c = CLOUD[i]!.e
        const lx = p.x + (p.x > 0 ? 70 : -250), ly = p.y + oy - 42
        v.line(p.x, p.y + oy, lx + (p.x > 0 ? 0 : 180), ly, 240)
        v.put(p.x, p.y + oy, '◆', 231)
        v.text(lx, ly, `p${String(i).padStart(3, '0')}(${c.map((x) => x.toFixed(2)).join(',')})`, 255, 235)
      }
    }
    // DIMENSION: a rotating tesseract slams in
    if (hit) {
      const k = outExpo(seg(t, s.hit, s.hit + 0.3))
      const a = (t - s.hit) * 2.2, b = (t - s.hit) * 1.3
      const P = HYPER.map(([x, y, z, w]) => {
        const x1 = x! * Math.cos(a) - w! * Math.sin(a), w1 = x! * Math.sin(a) + w! * Math.cos(a)
        const z1 = z! * Math.cos(b) - w1 * Math.sin(b), w2 = z! * Math.sin(b) + w1 * Math.cos(b)
        const q = 2.2 / (2.9 - w2)
        return { ...proj(rot3([x1 * q * 0.62, y! * q * 0.62, z1 * q * 0.62], ay, ax), R * (0.4 + 0.6 * k)), w: w2 }
      })
      for (const [i, j] of EDGES) {
        const p = P[i]!, q = P[j]!
        const inner = (p.w + q.w) / 2
        v.line(p.x, p.y + oy, q.x, q.y + oy, inner > 0 ? s.accent : ramp(s.ramp, 0.55))
      }
      P.forEach((p, i) => { v.put(p.x, p.y + oy, p.w > 0 ? '@' : 'o', 231); if (i % 5 === 0) v.text(p.x + 12, p.y + oy - 12, `v${hex(i, 1)}`, 245) })
      v.text(-v.pw / 2 + 22, v.ph / 2 - 60, ` dim(S) = ${t - s.hit < 0.25 ? '3' : '4'}   R^4 → R^3 → R^2 `, 231, 53)
    }
    // corner HUD
    v.text(-v.pw / 2 + 22, -v.ph / 2 + 30, `N=${String(Math.round(N * form)).padStart(3, '0')}  ROT.Y ${fmt(ay % TAU, 2, 6)}  ROT.X ${fmt(ax, 2, 6)}`, 244)
  },
  readouts(t, s) {
    const lt = t - s.t0
    return [
      ['object', 'PointSet<R^3>'], ['count', String(Math.round(N * outCubic(seg(t, s.t0, s.t0 + 1.1))))],
      ['centroid', `${fmt(0.01 * noise1(lt, 1), 3)}`], ['bbox', '[-1,1]^3'], ['rot.y', fmt((lt * 0.85 + 0.4) % TAU, 3)],
      ['proj', 'persp d=3.40'], ['dim', t >= s.hit ? (t - s.hit < 0.25 ? '3 -> 4' : '4') : '3'],
      ['edges', t >= s.hit ? '32' : '0'], ['vertices', t >= s.hit ? '16' : String(N)],
    ]
  },
  log(k) {
    const r = seeded(k * 13 + 1)
    const p = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1].map((x) => fmt(x, 3, 6)).join(',')
    return r() < 0.75 ? `vtx[0x${hex(k * 7, 3)}] <- (${p})` : `push_dim(${1 + (k % 4)}) ok`
  },
}

// ── circle / CIRCUMFERENCE ──────────────────────────────────────────────────────────────────────

const CR = 120
const CY = 40
const X0 = -CR * Math.PI

function ring(v: View, cx: number, cy: number, r: number, a0: number, a1: number, col: (a: number) => number, c?: string) {
  const n = Math.max(2, Math.ceil(((a1 - a0) * r) / 7))
  for (let k = 0; k <= n; k++) {
    const a = lerp(a0, a1, k / n)
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
    v.put(x, y, c ?? v.g.slope(-Math.sin(a) * v.g.rh, Math.cos(a) * v.g.cw), col(a))
  }
}

/** A thick ring of half-block cells between angles a0..a1 (screen angles, y down). */
function band(v: View, cx: number, cy: number, r: number, a0: number, a1: number, col: (a: number) => number, th = 8) {
  const { cw, rh } = v.g
  const inside = (x: number, y: number) => {
    const d = Math.hypot(x - cx, y - cy)
    if (Math.abs(d - r) > th) return false
    const k = (((Math.atan2(y - cy, x - cx) - a0) % TAU) + TAU) % TAU
    return k <= a1 - a0 + 1e-6
  }
  const c0 = Math.floor(v.cx(cx - r - th)), c1 = Math.ceil(v.cx(cx + r + th))
  const r0 = Math.floor(v.cy(cy - r - th)), r1 = Math.ceil(v.cy(cy + r + th))
  for (let row = r0; row <= r1; row++) for (let c = c0; c <= c1; c++) {
    const x = (c - v.x - v.w / 2 + 0.5) * cw, y = (row - v.y - v.h / 2) * rh
    const top = inside(x, y + rh * 0.25), bot = inside(x, y + rh * 0.75)
    if (!top && !bot) continue
    v.g.put(c, row, top && bot ? '█' : top ? '▀' : '▄', col(Math.atan2(y + rh / 2 - cy, x - cx)))
  }
}

export const circle: Visual = {
  draw(v, t, s) {
    const roll = seg(t, s.mid, s.hit - 0.08, inOutCubic) * TAU
    const trace = seg(t, s.t0 + 0.08, s.mid - 0.08, inOutCubic) * TAU
    const cx = X0 + CR * roll
    const base = CY + CR
    // polar guide and baseline ruler
    ring(v, cx, CY, CR + 26, 0, TAU, () => 236, '·')
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU - roll
      v.put(cx + (CR + 14) * Math.cos(a), CY + (CR + 14) * Math.sin(a), k % 3 ? '·' : '+', k % 3 ? 240 : 248)
    }
    v.line(-v.pw / 2 + 20, base, v.pw / 2 - 20, base, 238, '─')
    for (let k = 0; k <= 8; k++) {
      const x = X0 + (k / 8) * TAU * CR
      v.put(x, base, '┴', 244)
      if (k % 2 === 0) v.text(x - 10, base + 22, ['0', 'π/2', 'π', '3π/2', '2π'][k / 2]!, 245)
    }
    // the circle: traced arc in phase A, wrapped remainder while rolling
    if (t < s.mid) {
      ring(v, cx, CY, CR, 0, TAU, () => 240, "·")
      band(v, cx, CY, CR, -Math.PI / 2, -Math.PI / 2 + trace, (a) => ramp(s.ramp, 0.4 + 0.6 * ((((a + Math.PI / 2) % TAU) + TAU) % TAU) / TAU))
      const a = -Math.PI / 2 + trace
      v.line(cx, CY, cx + CR * Math.cos(a), CY + CR * Math.sin(a), 250)
      v.put(cx + CR * Math.cos(a), CY + CR * Math.sin(a), '◆', 231)
      v.text(cx + (CR / 2) * Math.cos(a) + 8, CY + (CR / 2) * Math.sin(a) - 14, 'r', 229)
      ring(v, cx, CY, 28, -Math.PI / 2, a, () => 229, '·')
      v.text(cx + CR * Math.cos(a) + 16, CY + CR * Math.sin(a) - 10, `θ=${trace.toFixed(3)}`, 231, 236)
    } else if (t >= s.hit) {
      band(v, cx, CY, CR, 0, TAU, (a) => ramp(s.ramp, 0.35 + 0.65 * Math.sin(a * 2 - t * 9) ** 2))
      v.line(cx, CY, cx, base, 238, '┊')
      v.line(X0, base, cx, base, s.accent, '━')
      v.text(cx - 2 * v.g.cw, CY - 10, '2πr', 231)
    } else {
      band(v, cx, CY, CR, Math.PI / 2 + roll, Math.PI / 2 + TAU, (a) => ramp(s.ramp, 0.5 + 0.5 * Math.sin(a * 3 + t * 6) ** 2))
      ring(v, cx, CY, CR, Math.PI / 2, Math.PI / 2 + roll, () => 240, "·")
      const a = Math.PI / 2 + roll
      v.line(cx, CY, cx + CR * Math.cos(a), CY + CR * Math.sin(a), 244)
      v.line(cx, CY, cx, base, 238, '┊')
      // unrolled arc on the floor
      v.line(X0, base, cx, base, s.accent, '━')
      v.put(cx + CR * Math.cos(a), CY + CR * Math.sin(a), '◆', 231)
      v.put(cx, base, '▲', 231)
      v.text(cx + 14, base - 22, `s=${(CR * roll).toFixed(1)}`, 231, 236)
    }
    v.put(cx, CY, '+', 231)
    // CIRCUMFERENCE: dimension line and π streaming along the unrolled length
    if (t >= s.hit) {
      const k = outExpo(seg(t, s.hit, s.hit + 0.25))
      const y = base + 64
      const x1 = X0 + TAU * CR * k
      v.line(X0, y, x1, y, s.accent, '═')
      v.put(X0, y, '╞', s.accent); v.put(x1, y, '╡', s.accent)
      const label = ` C = 2πr = ${(TAU * CR).toFixed(3)} `
      v.text((X0 + x1) / 2 - label.length * 5.4, y, label, 16, s.accent)
      const pi = '3.14159265358979323846264338327950288419716939937510582097494459230781640628620899'
      const off = Math.floor((t - s.hit) * 40)
      v.text(X0, y + 28, pi.slice(off % 20, off % 20 + Math.floor(((x1 - X0) / v.g.cw))), ramp(s.ramp, 0.5))
    }
    // side formula block
    const fx = 120, fy = -v.ph / 2 + 70
    if (t < s.hit) {
      const rows = [`r      = ${CR.toFixed(3)}`, `θ      = ${(t < s.mid ? trace : roll).toFixed(3)} rad`, `s = rθ = ${(CR * (t < s.mid ? trace : roll)).toFixed(3)}`,
        `x(θ)   = r·cos θ  ${fmt(Math.cos(t < s.mid ? trace - Math.PI / 2 : roll), 3)}`, `y(θ)   = r·sin θ  ${fmt(Math.sin(t < s.mid ? trace - Math.PI / 2 : roll), 3)}`]
      rows.forEach((r, i) => v.text(fx, fy + i * v.g.rh, r, i === 2 ? s.accent : 250))
      v.g.bar(Math.round(v.cx(fx)), Math.round(v.cy(fy + 5.5 * v.g.rh)), 30, (t < s.mid ? trace : roll) / TAU, s.accent)
    }
  },
  readouts(t, s) {
    const th = t < s.mid ? seg(t, s.t0 + 0.08, s.mid - 0.08, inOutCubic) * TAU : seg(t, s.mid, s.hit - 0.08, inOutCubic) * TAU
    return [
      ['object', 'Circle<R^2>'], ['radius', CR.toFixed(3)], ['theta', th.toFixed(4)], ['arc s', (CR * th).toFixed(3)],
      ['mode', t < s.mid ? 'TRACE' : t < s.hit ? 'ROLL' : 'MEASURE'], ['pi', Math.PI.toFixed(8)],
      ['C', t >= s.hit ? (TAU * CR).toFixed(3) : '…'], ['area', (Math.PI * CR * CR).toFixed(1)], ['k', (1 / CR).toFixed(5)],
    ]
  },
  log(k) {
    const a = (k * 0.173) % TAU
    return k % 5 === 4 ? `assert |C - 2πr| < 1e-9  ok` : `arc[${String(k).padStart(3, '0')}] θ=${a.toFixed(3)} s=${(a * CR).toFixed(2)}`
  },
}

// ── sine / TANGENTS ─────────────────────────────────────────────────────────────────────────────

const SA = 150
const SK = TAU / 640
const SY = 30

/** y = fn(x) as a half-block plot, one cell column at a time, gap-free on steep parts. */
function plot(v: View, fn: (x: number) => number, xa: number, xb: number, col: (x: number, y: number) => number) {
  const { cw, rh } = v.g
  for (let c = Math.ceil(v.cx(xa)); c <= Math.floor(v.cx(xb)); c++) {
    const x = (c - v.x - v.w / 2 + 0.5) * cw
    const ya = fn(x - cw / 2), yb = fn(x + cw / 2)
    const lo = Math.min(ya, yb) - 3, hi = Math.max(ya, yb) + 3
    for (let row = Math.floor(v.cy(lo)); row <= Math.floor(v.cy(hi)); row++) {
      const top = (row - v.y - v.h / 2) * rh
      const a = lo < top + rh / 2 && hi > top, b = lo < top + rh && hi > top + rh / 2
      if (a || b) v.g.put(c, row, a && b ? '█' : a ? '▀' : '▄', col(x, fn(x)))
    }
  }
}

export const sine: Visual = {
  draw(v, t, s) {
    const ph = (t - s.t0) * 4.2
    const y = (x: number) => SY - SA * Math.sin(SK * x - ph)
    const dy = (x: number) => -SA * SK * Math.cos(SK * x - ph)
    const W2 = v.pw / 2 - 20
    const rev = -W2 + 2 * W2 * outCubic(seg(t, s.t0, s.t0 + 0.7))
    // axes, period ticks scrolling with the wave
    v.line(-W2, SY, W2, SY, 238, '─')
    v.line(-W2 + 10, SY - SA - 40, -W2 + 10, SY + SA + 40, 238, '│')
    for (let n = Math.ceil((-SK * W2 - ph) / Math.PI); n <= Math.floor((SK * W2 - ph) / Math.PI); n++) {
      const x = (n * Math.PI + ph) / SK
      v.put(x, SY, '┼', 244)
      v.text(x - 6, SY + 22, `${n}π`, 241)
    }
    // derivative trace on the hit
    const hit = t >= s.hit
    if (hit) for (let x = -W2; x <= rev; x += v.g.cw) v.put(x, SY - SA * Math.cos(SK * x - ph), '·', 97)
    // the wave, with a shade column down to the axis
    for (let x = -W2; x <= rev; x += v.g.cw) {
      const yy = y(x)
      const h = (SY - yy) / SA
      if (Math.round(x / v.g.cw) % 2 === 0) for (let q = 1; q < Math.abs(SY - yy) / v.g.rh - 0.5; q++) v.put(x, yy + Math.sign(SY - yy) * q * v.g.rh, '░', h > 0 ? 23 : 52)
    }
    plot(v, y, -W2, rev, (_, yy) => ramp(s.ramp, 0.55 + 0.45 * Math.abs((SY - yy) / SA)))
    // tangents: one rider, then a few, then all of them
    const riders = t < s.mid ? [0] : t < s.hit ? [-360, -180, 0, 180, 360].filter((_, i) => t >= s.mid + i * 0.12) : []
    const tan = (x: number, len: number, col: number) => {
      const m = dy(x), n = Math.hypot(1, m)
      v.line(x - len / n, y(x) - (len * m) / n, x + len / n, y(x) + (len * m) / n, col)
    }
    if (hit) {
      const k = outExpo(seg(t, s.hit, s.hit + 0.3))
      for (let x = -W2 + 30; x <= W2 - 30; x += 48) tan(x, 40 + 110 * k, ramp(s.ramp, 0.25 + 0.5 * hash(Math.round(x), Math.floor(t * 10))))
      for (let x = -W2 + 30; x <= W2 - 30; x += 48) v.put(x, y(x), '◆', 231)
    }
    for (const x of riders) {
      if (x > rev) continue
      const m = dy(x)
      tan(x, 200, 229)
      v.put(x, y(x), '●', 16, 231)
      v.text(x + 18, y(x) - 2.2 * v.g.rh, ` m=${fmt(-m, 2, 5)} `, 16, 229)
      v.line(x, y(x) + v.g.rh, x, SY, 240, '┊')
    }
    v.text(-W2 + 30, -v.ph / 2 + 30, `y = A·sin(kx − ωt)   A=${SA}  k=${SK.toFixed(4)}  ω=4.20  t=${(t - s.t0).toFixed(3)}`, 244)
    if (hit) v.text(-W2 + 30, v.ph / 2 - 40, `dy/dx = A·k·cos(kx − ωt)   ∀x: tangent(x) defined`, 97)
  },
  readouts(t, s) {
    const ph = (t - s.t0) * 4.2
    return [
      ['object', 'Wave<sin>'], ['A', String(SA)], ['k', SK.toFixed(5)], ['phase', (ph % TAU).toFixed(4)],
      ['y(0)', fmt(-Math.sin(-ph), 4)], ["y'(0)", fmt(Math.cos(-ph), 4)], ['angle', `${((Math.atan(Math.cos(-ph) * SA * SK) * 180) / Math.PI).toFixed(2)}°`],
      ['riders', t < s.mid ? '1' : t < s.hit ? '5' : '∞'], ['period', `${(TAU / SK).toFixed(1)} px`],
    ]
  },
  log(k) {
    const x = ((k * 0.37) % 6.28) - 3.14
    return `tan@x=${fmt(x, 2, 5)}  m=cos(x)=${fmt(Math.cos(x), 3, 6)}`
  },
}

// ── infinity / LIMITATIONS ──────────────────────────────────────────────────────────────────────

const lem = (u: number, a: number) => {
  const d = 1 + Math.sin(u) ** 2
  return [(a * Math.cos(u)) / d, (a * Math.sin(u) * Math.cos(u)) / d * 1.45] as const
}

/** One half-block dot; merges with a half already in the cell. */
function dot(v: View, x: number, y: number, col: number) {
  const g = v.g
  const c = Math.round(v.cx(x)), fy = v.cy(y), row = Math.round(fy), top = fy - row < 0
  if (c < 0 || row < 0 || c >= g.cols || row >= g.rows) return
  const cur = g.ch[row * g.cols + c]
  g.put(c, row, cur === '█' || (cur === '▀' && !top) || (cur === '▄' && top) ? '█' : top ? '▀' : '▄', col)
}

export const limit: Visual = {
  draw(v, t, s) {
    const lt = t - s.t0
    const hit = t >= s.hit
    const W2 = v.pw / 2 - 10, H2 = v.ph / 2 - 10
    // the tunnel: nested frames flying outward forever
    const NF = 9
    for (let k = 0; k < NF; k++) {
      const z = (((k / NF + lt * 0.55) % 1) + 1) % 1
      const sc = Math.exp(Math.log(0.04) * (1 - z))
      const w = W2 * sc, h = H2 * sc
      const col = ramp([234, 235, 236, 237, 238, 239, 54, 90, 91], z)
      const c = z > 0.45 ? undefined : '·'
      v.line(-w, -h, w, -h, col, c); v.line(-w, h, w, h, col, c)
      v.line(-w, -h, -w, h, col, c); v.line(w, -h, w, h, col, c)
      if (z > 0.45) for (const [a, b] of [[-w, -h], [w, -h], [-w, h], [w, h]] as const) v.put(a, b, '+', col)
    }
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) v.dash(sx * W2, sy * H2, sx * W2 * 0.04, sy * H2 * 0.04, 236)
    // ∞: a lemniscate traced with a long fading trail; nested copies shrink toward the centre
    const nest = t < s.mid ? 1 : 1 + Math.floor(seg(t, s.mid, s.hit) * 4.999)
    const breathe = 1 + 0.05 * Math.sin(lt * 5)
    for (let j = 0; j < nest; j++) {
      const a = 430 * breathe * 0.5 ** j
      const sp = 3.4 * (1 + j * 0.6)
      const u0 = lt * sp + j
      const len = Math.min(TAU * 0.92, 1.2 + lt * 6)
      for (let q = 0; q < 160; q++) v.put(...lem((q / 160) * TAU, a), '·', j ? 238 : 241)
      const n = 420
      for (let q = n; q >= 0; q--) {
        const u = u0 - (q / n) * len
        const [x, y] = lem(u, a)
        const age = q / n
        if (age > 0.7 && q % 2) continue
        dot(v, x, y, ramp(s.ramp, (1 - age) ** 1.4 * (1 - j * 0.12)))
      }
      const [hx, hy] = lem(u0, a)
      v.put(hx, hy, '@', 231)
      if (j === 0) v.text(hx + 14, hy - 18, `u=${(u0 % TAU).toFixed(2)}`, 225)
    }
    // limit plot: a_n = 1 - 1/n marching toward the asymptote
    const px0 = -W2 + 40, py0 = H2 - 20, pw = 300, ph = 190
    const np = Math.max(1, Math.round(40 * seg(t, s.t0, s.mid - 0.2)))
    v.text(px0, py0 - ph - 30, 'a(n) = 1 − 1/n   log n', 244)
    v.dash(px0, py0 - ph, px0 + pw, py0 - ph, 201, '─')
    v.text(px0 + pw + 12, py0 - ph, 'L=1', 207)
    v.line(px0, py0, px0 + pw, py0, 240, '─')
    v.line(px0, py0, px0, py0 - ph - 10, 240, '│')
    for (let n = 1; n <= np; n++) v.put(px0 + (pw * Math.log(n)) / Math.log(40), py0 - ph * (1 - 1 / n), n === np ? '@' : '●', ramp(s.ramp, 0.4 + 0.6 * (n / 40)))
    // n counter racing to infinity, then the walls close in
    const e = t < s.mid ? lt * 2.2 : 3.6 + (t - s.mid) * 9
    const nv = hit ? '∞' : `10^${e.toFixed(1)}`
    const bx = W2 - 340, by = H2 - 110
    const rows = [`n        = ${nv}`, `1/n      = ${hit ? '0' : (10 ** -e).toExponential(3)}`, `|a(n)−L| < ε   ε=${hit ? '0' : '1e-' + Math.floor(e)}`, `lim  a(n) = 1`, `n→∞`]
    rows.forEach((r, i) => v.text(bx, by + i * v.g.rh, r, i === 3 ? 231 : 250, i === 3 ? 90 : undefined))
    if (hit) {
      const k = outExpo(seg(t, s.hit, s.hit + 0.4))
      const w = W2 * (1.05 - 0.5 * k), h = H2 * (1.05 - 0.45 * k)
      const col = Math.floor((t - s.hit) * 12) % 2 ? 196 : 201
      v.line(-w, -h, w, -h, col, '█'); v.line(-w, h, w, h, col, '█'); v.line(-w, -h, -w, h, col, '█'); v.line(w, -h, w, h, col, '█')
      const msg = ' ERR 0x7FF0  LIMIT REACHED  x→∞ CLAMPED '
      v.text(-msg.length * v.g.cw / 2, -h + v.g.rh, msg, 231, 160)
      const r = seeded(Math.floor(t * 15))
      const nb = Math.floor(10 + 60 * seg(t, s.hit, s.t1))
      for (let q = 0; q < nb; q++) v.put(r.range(-w, w), r.range(-h, h), r.pick(['█', '▓', '▒', '░', '∞']), r.pick([196, 201, 207, 231, 51]))
      v.g.text(Math.round(v.cx(-80)), Math.round(v.cy(0)), ' lim ∞ ', 16, flash(t, s.hit, 0.2) > 0.3 ? 231 : 201)
    }
  },
  readouts(t, s) {
    const lt = t - s.t0
    const e = t < s.mid ? lt * 2.2 : 3.6 + (t - s.mid) * 9
    return [
      ['object', 'Seq<a(n)>'], ['n', t >= s.hit ? 'INF' : `1e${e.toFixed(2)}`], ['L', '1.000000'],
      ['err', t >= s.hit ? '0' : (10 ** -e).toExponential(2)], ['nest', String(t < s.mid ? 1 : 1 + Math.floor(seg(t, s.mid, s.hit) * 4.999))],
      ['bound', t >= s.hit ? 'CLAMPED' : 'open'], ['heap', `0x${hex(0x7ff0 * clamp01(lt / 3.6) + 0x1000)}`], ['stack', t >= s.hit ? 'OVERFLOW' : 'ok'], ['ε', t >= s.hit ? '0' : `1e-${Math.floor(e)}`],
    ]
  },
  log(k) {
    return k % 6 === 5 ? `WARN: approaching bound (k=${k})` : `n=2^${(k % 48) + 4}  1/n=${(2 ** -((k % 48) + 4)).toExponential(3)}`
  },
}

export const VISUALS = { points, circle, sine, limit }
