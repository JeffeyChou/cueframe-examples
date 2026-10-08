import { C, RAMP_CYAN, RAMP_MAG, CW, CH, fx, project, ramp, rot, smooth, type V3 } from '../lib.js'
import type { Vis } from './types.js'

const TAU = Math.PI * 2
const SHADE = ' .·:∙•oO0@'
// Lemniscate of Bernoulli with a twist in z.
const lem = (s: number, a: number): V3 => {
  const d = 1 + Math.sin(s) ** 2
  return { x: (a * Math.cos(s)) / d, y: (a * Math.sin(s) * Math.cos(s)) / d, z: 0.22 * a * Math.sin(s) }
}

const infinity: Vis = {
  title: 'Limit(n→∞).approach()',
  draw(g, V, u, m) {
    const [, d1, d2, end] = m
    const lift = smooth(d1, d1 + 0.35, u)
    const lim = smooth(d2, d2 + 0.2, u)
    const zoomRate = 0.8 + 1.6 * lift + 2.5 * lim
    const zoomPh = u * zoomRate
    const z = 0.6 ** -(zoomPh % 1)
    const k = 300 * (1 - 0.3 * lift)
    const VV = { ...V, y: V.y - Math.round(7 * lift) }
    const ax = 0.35 + 0.2 * Math.sin(u * 1.3), ay = 0.3 * Math.sin(u * 0.9)
    const zb = new Float32Array(V.w * V.h).fill(-99)
    const rd: [string, string, number?][] = []
    const plot = (p: V3, ch: string, col: number) => {
      const s = project(p, VV, k, 7)
      const cx = Math.round(s.x), cy = Math.round(s.y)
      if (cx < V.x || cy < V.y || cx >= V.x + V.w || cy >= V.y + V.h) return
      const zi = (cy - V.y) * V.w + (cx - V.x)
      if (p.z <= zb[zi]) return
      zb[zi] = p.z
      g.put(cx, cy, ch, col)
    }
    // nested copies: endless zoom through infinity
    for (let lvl = -1; lvl < 5; lvl++) {
      const a = 1.1 * z * 0.6 ** lvl
      if (a > 2.4) continue
      const bright = Math.max(0, Math.min(1, 1.1 - Math.abs(Math.log(a / 1.0)) * 0.7))
      const n = Math.round(240 * Math.max(0.3, Math.min(1, a)))
      const ring = a > 0.5 ? 5 : 1
            for (let i = 0; i < n; i++) {
        const s = (i / n) * TAU
        const c = lem(s, a)
        for (let j = 0; j < ring; j++) {
          const w = (j / ring) * TAU + u * 3
          const tube = 0.07 * a
          const p = rot({ x: c.x, y: c.y + Math.cos(w) * tube, z: c.z + Math.sin(w) * tube }, ax, ay + lvl * 0.06)
          const d = Math.max(0, Math.min(1, (p.z / a + 0.6) / 1.2))
          const lev = bright * (0.35 + 0.65 * d)
          plot(p, SHADE[Math.max(1, Math.round(lev * (SHADE.length - 1)))], ramp(Math.cos(s + u * 1.5) > 0 ? RAMP_MAG : RAMP_CYAN, lev))
        }
      }
    }
    // a runner that keeps accelerating along the outer loop
    const a0 = 1.1 * z
    const sp = u * (2.2 + u * 2.4)
    const trail = '█▓▒░··'
    for (let j = trail.length - 1; j >= 0; j--) {
      const p = rot(lem(sp - j * 0.07 * (1 + u), Math.min(a0, 1.5)), ax, ay)
      plot({ ...p, z: p.z + 5 }, trail[j], j === 0 ? C.white : ramp([231, 159, 123, 87, 51, 45], j / 5))
    }
    const n = Math.floor(10 ** (0.6 + u * 1.9))
    // convergence plot
    if (lift > 0) {
      const top = V.y + V.h - 14, bot = V.y + V.h - 2
      const L = Math.round((top + bot) / 2)
      const eps = 5 * (1 - lim * 0.85)
      g.line(V.x + 4, bot, V.x + V.w - 2, bot, C.frame, '─')
      g.line(V.x + 4, top, V.x + 4, bot, C.frame, '│')
      g.put(V.x + 4, bot, '└', C.frame)
      for (let c = V.x + 5; c < V.x + V.w - 2; c += 2) g.put(c, L, '╌', C.amber)
      g.text(V.x + V.w - 14, L - 1, 'L = lim aₙ', C.amber)
      if (lim > 0) {
        for (let c = V.x + 5; c < V.x + V.w - 2; c++) {
          g.put(c, Math.round(L - eps), '▔', C.red)
          g.put(c, Math.round(L + eps), '▁', C.red)
        }
        g.text(V.x + V.w - 14, Math.round(L + eps) + 1, `ε=${(eps / 5).toFixed(4)}`, C.red)
      }
      const cols = V.w - 10
      const shown = Math.floor(cols * smooth(d1, d2 - 0.1, u) * 1.0)
      for (let i = 0; i < shown; i++) {
        const nn = i + 1
        const y = L + (bot - 1 - L) * Math.cos(nn * 0.9) / (1 + nn * 0.15)
        g.put(V.x + 6 + i, Math.round(y), i === shown - 1 ? '●' : 'o', i === shown - 1 ? C.white : ramp([24, 30, 37, 44, 51, 87, 123], i / cols))
      }
      g.text(V.x + V.w - 9, bot + 1, 'n → ∞', C.text)
      g.text(V.x + 6, top - 1, `aₙ = L + cos(.9n)/(1+.15n)`, C.mid)
    }
    // closing walls: the limit
    if (lim > 0) {
      const ww = Math.round(lim * V.w * 0.12 + smooth(d2 + 0.2, end, u) * V.w * 0.12)
      for (let y = V.y; y < V.y + V.h; y++) {
        const col = (y + Math.floor(u * 20)) % 4 === 0 ? C.magenta : C.red
        for (let i = 0; i < ww; i++) {
          const b = '░▒▓█'[Math.min(3, Math.floor(((ww - i) / ww) * 4))]
          g.put(V.x + i, y, b, col)
          g.put(V.x + V.w - 1 - i, y, b, col)
        }
      }
      g.text(V.x + ww + 1, V.y + 1, '▶│ BOUND', C.red)
      g.text(V.x + V.w - ww - 9, V.y + 1, 'BOUND │◀', C.red)
    }
    g.text(V.x + 2, V.y + (lim > 0 ? 3 : 1), `n = ${String(n).padStart(6, '0')}`, C.text)
    g.text(V.x + 2, V.y + (lim > 0 ? 4 : 2), `1/n = ${(1 / n).toExponential(3)}`, C.mid)
    rd.push(['class', 'Limit'], ['n', String(n), C.text], ['1/n', (1 / n).toExponential(4)], ['zoom', `${(0.6 ** -zoomPh).toExponential(3)}x`, C.pink],
      ['speed', fx(2.2 + u * 4.8, 5, 3)], ['lemn.a', a0.toFixed(4)], ['ε', lim > 0 ? (1 - lim * 0.85).toFixed(4) : '--', lim > 0 ? C.red : C.mid],
      ['bound', lim > 0 ? 'CLAMPED' : 'open', lim > 0 ? C.red : C.mid], ['cell', `${CW}x${CH}`], ['t.end', `${(end - u).toFixed(3)}s`])
    return rd
  },
  log(st) {
    const t = st.lines.map((l) => l.t0)
    return [
      [t[0], '> for (n=1; ; n++) approach()', C.text],
      [t[0] + 0.4, '  zoom stack depth: 6', C.mid],
      [t[0] + 1.0, '  warn: n overflow soon', C.orange],
      [t[1], '> L = lim_{n→∞} a(n)', C.text],
      [t[1] + 0.5, '  |aₙ - L| < ε  ...', C.mid],
      [t[2], '! LIMITATIONS: ε -> 0', C.red],
      [t[2] + 0.3, '  ERR bound exceeded', C.red],
      [t[2] + 0.6, '  core dumped (0x0000∞)', C.red],
    ]
  },
}
export default infinity
