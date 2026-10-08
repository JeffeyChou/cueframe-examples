import { C, RAMP_GREEN, fx, ramp, slopeChar, smooth } from '../lib.js'
import type { Vis } from './types.js'

const TAN_COLS = [51, 87, 123, 159, 213, 207, 201, 219, 226, 220, 214, 208]

const sine: Vis = {
  title: 'Sine(ω=1).scroll()',
  draw(g, V, u, m) {
    const [, c1, c2, end] = m
    const cy = V.y + Math.floor(V.h / 2) - 1
    const A = 10 // rows
    const lam = 44 // cols per period
    const kx = (Math.PI * 2) / lam
    const ph = u * 3.4 + u * u * 0.6
    const reveal = smooth(0, 0.7, u)
    const many = smooth(c2, c2 + 0.3, u)
    const sit = smooth(c1, c1 + 0.25, u)
    const X = (c: number) => (c - V.x) * kx - ph
    const Y = (c: number) => cy - A * Math.sin(X(c))
    const slope = (c: number) => -A * kx * Math.cos(X(c)) // rows per col
    const rd: [string, string, number?][] = []

    // axes and grid
    g.line(V.x, cy, V.x + V.w - 1, cy, C.frame, '─')
    for (let c = V.x; c < V.x + V.w; c++) {
      const x = X(c) + ph
      if (Math.abs(((x / Math.PI) % 1)) < kx / Math.PI / 1.001) {
        g.put(c, cy, '┼', C.mid)
        g.text(c - 1, cy + 1, Math.round(x / Math.PI) === 0 ? '0' : `${Math.round(x / Math.PI)}π`, C.dim)
      }
    }
    g.text(V.x + V.w - 6, cy - 1, 'x →', C.mid)
    g.put(V.x + 1, cy - A, '┤', C.dim); g.text(V.x + 2, cy - A, '+1', C.dim)
    g.put(V.x + 1, cy + A, '┤', C.dim); g.text(V.x + 2, cy + A, '-1', C.dim)

    // derivative ghost once the tangents arrive
    if (sit > 0) for (let c = V.x; c < V.x + V.w; c += 2) g.put(c, cy - A * Math.cos(X(c)) * 0.999, '·', many > 0 ? C.violet : 237)

    const last = V.x + Math.floor(V.w * reveal)
    for (let c = V.x; c < last; c++) {
      const y0 = Y(c), y1 = Y(c + 1)
      const lo = Math.round(Math.min(y0, y1)), hi = Math.round(Math.max(y0, y1))
      const ch = slopeChar(1, y1 - y0)
      for (let y = lo; y <= hi; y++) g.put(c, y, ch, ramp(RAMP_GREEN, 0.45 + 0.55 * ((cy - y) / A + 1) / 2))
    }
    if (reveal < 1) g.put(last, Y(last), '█', C.white)

    const tangent = (c: number, len: number, col: number) => {
      const y = Y(c), s = slope(c)
      g.line(c - len, y - s * len, c + len, y + s * len, col)
      g.put(c, y, '◆', C.white)
    }
    if (many > 0) {
      const n = 18
      for (let i = 0; i < n; i++) {
        const c = V.x + 3 + ((i * V.w) / n + u * 9) % (V.w - 6)
        tangent(Math.round(c), 3 + 9 * many, TAN_COLS[(i + Math.floor(u * 10)) % TAN_COLS.length])
      }
    }
    // the riding tangent(s)
    const riders = sit > 0 ? 3 : 1
    for (let i = 0; i < riders; i++) {
      const c = Math.round(V.x + V.w * (i === 0 ? 0.5 : i === 1 ? 0.22 : 0.78))
      if (c >= last) continue
      tangent(c, 16 - i * 4, i === 0 ? C.amber : C.orange)
      if (sit > 0 && many < 1) {
        const y = Math.round(Y(c))
        g.text(c - 1, y - 3, ' o ', C.white)
        g.text(c - 1, y - 2, '/|\\', C.white)
        g.text(c - 1, y - 1, '/ \\', C.white)
      }
    }
    const c0 = Math.round(V.x + V.w * 0.5)
    const s0 = Math.sin(X(c0)), d0 = Math.cos(X(c0))
    g.text(c0 + 3, Math.round(Y(c0)) + 2, `m=${d0.toFixed(3)}`, C.amber)
    rd.push(['class', 'Sine'], ['ω', '1.0000'], ['phase', fx(ph % (Math.PI * 2), 5, 3)], ['x', fx(X(c0) % (Math.PI * 2), 5, 3)],
      ['sin x', fx(s0, 5, 4), C.green], ["sin' x", fx(d0, 5, 4), C.amber], ['tangents', many > 0 ? '18' : String(riders), many > 0 ? C.magenta : C.text],
      ['angle', `${((Math.atan(d0) * 180) / Math.PI).toFixed(2)}°`], ['reveal', `${Math.round(reveal * 100)}%`], ['t.end', `${(end - u).toFixed(3)}s`])
    return rd
  },
  log(st) {
    const t = st.lines.map((l) => l.t0)
    return [
      [t[0], '> w = new Sine(ω=1, A=1)', C.text],
      [t[0] + 0.35, '  scroll: dφ/dt = 3.4', C.mid],
      [t[1], '> w.tangent(x).sit(you)', C.text],
      [t[1] + 0.6, "  y' = cos(x)  [3 riders]", C.mid],
      [t[2], '! TANGENTS[18] spawned', C.amber],
      [t[2] + 0.3, '  warn: seat count exceeded', C.orange],
    ]
  },
}
export default sine
