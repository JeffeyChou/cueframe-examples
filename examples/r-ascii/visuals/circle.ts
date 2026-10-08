import { C, CH, CW, RAMP_AMBER, big, ramp, slopeChar, smooth, type Grid, type Rect } from '../lib.js'
import type { Vis } from './types.js'

const TAU = Math.PI * 2
const K = 200 // px per unit

function arc(g: Grid, cx: number, cy: number, R: number, a0: number, a1: number, col: (a: number) => number, ch?: string) {
  const n = Math.ceil(Math.abs(a1 - a0) * R * K / 5) + 1
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    const x = cx + (Math.cos(a) * R * K) / CW, y = cy - (Math.sin(a) * R * K) / CH
    g.put(x, y, ch ?? slopeChar(-Math.sin(a), -Math.cos(a)), col(a))
  }
}

const circle: Vis = {
  title: 'Circle(r).trace()',
  draw(g, V: Rect, u, m) {
    const [, b1, b2, end] = m
    const ox = V.x + V.w / 2, oy = V.y + V.h / 2 - 1
    const trace = smooth(0.05, b1 - 0.05, u)
    const move = smooth(b1, b1 + 0.3, u)
    const phi = TAU * smooth(b1 + 0.25, b2 - 0.05, u)
    const fin = smooth(b2, b2 + 0.2, u)
    const R = 1 - 0.34 * move
    const baseY = V.y + V.h - 12
    const x0 = -Math.PI * 0.66 // start of the roll in world units
    // centre in cells
    const cxw = x0 * move + R * phi
    const cx = ox + (cxw * K) / CW
    const cy = oy * (1 - move) + (baseY - (R * K) / CH) * move
    const rd: [string, string, number?][] = []

    // guide circle and centre
    arc(g, cx, cy, R, 0, TAU, () => (move < 0.5 ? 239 : 242), move < 0.5 ? '·' : undefined)
    g.put(cx, cy, '┼', C.mid)
    if (move < 0.5) {
      const th = TAU * trace
      arc(g, cx, cy, R, 0, th, (a) => ramp(RAMP_AMBER, 0.55 + 0.45 * (a / TAU)))
      arc(g, cx, cy, R * 0.95, 0, th, () => C.orange)
      const tx = cx + (Math.cos(th) * R * K) / CW, ty = cy - (Math.sin(th) * R * K) / CH
      g.line(cx, cy, tx, ty, C.cyan, '·')
      g.put(tx, ty, '◉', C.white)
      g.text((cx + tx) / 2 + 1, (cy + ty) / 2 - 1, 'r', C.cyan)
      arc(g, cx, cy, 0.18, 0, th, () => C.pink, '·')
      g.text(cx + 3, cy + 1, `θ=${((th * 180) / Math.PI).toFixed(1)}°`, C.pink)
      rd.push(['θ', `${th.toFixed(4)} rad`, C.pink], ['s=rθ', (R * th).toFixed(4), C.amber], ['x', Math.cos(th).toFixed(4)], ['y', Math.sin(th).toFixed(4)])
    } else {
      // rolling: the circle lays its circumference onto the baseline; spokes show the spin
      for (let q = 0; q < 6; q++) {
        const a = -Math.PI / 2 - phi + (q * Math.PI) / 3
        g.line(cx, cy, cx + (Math.cos(a) * R * 0.9 * K) / CW, cy - (Math.sin(a) * R * 0.9 * K) / CH, q === 0 ? C.cyan : 241)
      }
      arc(g, cx, cy, R, -Math.PI / 2 - phi, -Math.PI / 2 - TAU, (a) => ramp(RAMP_AMBER, 0.75 + 0.25 * Math.sin(a * 3 + u * 6)))
      arc(g, cx, cy, R * 0.94, -Math.PI / 2 - phi, -Math.PI / 2 - TAU, () => C.orange)
      const l0 = ox + (x0 * K) / CW, l1 = ox + ((x0 + R * phi) * K) / CW
      g.line(l0, baseY, l1, baseY, fin > 0 ? (Math.floor(u * 15) % 2 ? C.yellow : C.amber) : C.amber, '═')
      // ticks every pi/2
      for (let q = 0; q <= 4; q++) {
        const x = ox + ((x0 + (R * q * Math.PI) / 2) * K) / CW
        g.put(x, baseY + 1, '┴', C.mid)
        const lab = ['0', 'π/2', 'π', '3π/2', '2π'][q]
        g.text(x - Math.floor(lab.length / 2), baseY + 2, lab, q * Math.PI / 2 <= phi + 1e-6 ? C.text : C.dim)
      }
      // a marked rim point traces the cycloid
      for (let j = 0; j <= 60; j++) {
        const p = (phi * j) / 60
        const wx = x0 + R * p - R * Math.sin(p), wy = R - R * Math.cos(p)
        g.put(ox + (wx * K) / CW, baseY - (wy * K) / CH, j === 60 ? '●' : '∙', j === 60 ? C.white : C.orange)
      }
      const a = -Math.PI / 2 - phi
      const tx = cx + (Math.cos(a) * R * K) / CW, ty = cy - (Math.sin(a) * R * K) / CH
      g.line(cx, cy, tx, ty, C.cyan, '·')
      rd.push(['φ', `${phi.toFixed(4)} rad`, C.pink], ['laid', (R * phi).toFixed(4), C.amber], ['cx', cxw.toFixed(4)], ['cycloid', 'x=r(φ-sinφ)'])
    }
    const Cv = TAU * R
    if (fin > 0) {
      const l0 = Math.round(ox + (x0 * K) / CW), l1 = Math.round(ox + ((x0 + TAU * R) * K) / CW)
      const y = baseY + 3
      g.put(l0, y, '├', C.yellow)
      g.put(l1, y, '┤', C.yellow)
      g.line(l0 + 1, y, l1 - 1, y, C.yellow, '─')
      const lab = ` C = 2πr = ${Cv.toFixed(5)} `
      g.text(Math.round((l0 + l1) / 2 - lab.length / 2), y, lab, 16, C.yellow)
      arc(g, cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * fin, (a) => (Math.floor(a * 4 + u * 20) % 2 ? C.yellow : C.white))
      arc(g, cx, cy, R * 0.94, -Math.PI / 2, -Math.PI / 2 + TAU * fin, () => C.amber)
      // spokes burst from the finished circle
      for (let s = 0; s < 16; s++) {
        const a = (s / 16) * TAU + u
        const r0 = R * 1.15, r1 = R * (1.15 + 0.5 * fin)
        g.line(cx + (Math.cos(a) * r0 * K) / CW, cy - (Math.sin(a) * r0 * K) / CH,
          cx + (Math.cos(a) * r1 * K) / CW, cy - (Math.sin(a) * r1 * K) / CH, s % 2 ? C.magenta : C.amber)
      }
      big(g, V.x + 2, V.y + 1, (TAU * fin).toFixed(3), () => C.amber, (x, y) => ((x * 3 + y + Math.floor(u * 20)) % 7 ? '█' : '▓'))
      g.text(V.x + 2, V.y + 7, 'C / r = 2π', C.yellow)
    } else {
      big(g, V.x + 2, V.y + 1, (move < 0.5 ? TAU * trace : phi).toFixed(3), () => C.frame, () => '▒')
      g.text(V.x + 2, V.y + 7, move < 0.5 ? 'θ (rad)' : 'φ (rad)', C.mid)
    }
    // pi digits ticker
    const PI = '3.14159265358979323846264338327950288419716939937510582097494459230781640628620899'
    const nd = Math.floor(smooth(0, end, u) * PI.length)
    g.text(V.x + 2, V.y + V.h - 1, ('π ≈ ' + PI.slice(0, Math.max(3, nd))).slice(0, V.w - 4), C.dim)
    rd.unshift(['class', 'Circle'], ['r', R.toFixed(4)], ['C=2πr', Cv.toFixed(5), fin > 0 ? C.yellow : C.text], ['A=πr²', (Math.PI * R * R).toFixed(5)])
    rd.push(['t.end', `${(end - u).toFixed(3)}s`])
    return rd
  },
  log(st) {
    const t = st.lines.map((l) => l.t0)
    return [
      [t[0], '> c = new Circle(r=1.0000)', C.text],
      [t[0] + 0.3, '  trace θ: 0 -> 2π', C.mid],
      [t[1], '> c.unroll(baseline)', C.text],
      [t[1] + 0.5, '  cycloid sampler: 61 pts', C.mid],
      [t[1] + 1.1, '  warn: float drift 1e-7', C.orange],
      [t[2], '! CIRCUMFERENCE = 2πr', C.amber],
      [t[2] + 0.25, '  emit C -> you', C.mid],
    ]
  },
}
export default circle
