import { scene, seeded } from '@cueframe/core'
import { boxText, C, clamp01, clear, dotCells, fileIcon, ft, Glitch, hash, inCubic, lerp, mono, outCubic, outExpo, seg, W } from '../lib.js'

const START = ft(29.9)
const END = ft(33.35)
const TYPE = ft(31.4)
const COLLAPSE = ft(32.6)
const WORD = 'OVERLOADED'
const PITCH = 28
const COLS = WORD.length * 6 - 1
const X0 = (W - COLS * PITCH) / 2
const Y0 = 300
const P: [number, number] = [W / 2, 760]
const HEX = '0123456789ABCDEF'
const LINE = 'the grid shutdown'

export default scene({
  id: 'overloaded',
  at: START,
  end: END,
  mount(ctx) {
    const g = ctx.canvas('overloaded')
    const rnd = seeded(91)
    const lit = new Set(dotCells(WORD).map((c) => c.r * 100 + c.c))
    const cells: { c: number; r: number; on: boolean; at: number }[] = []
    for (let r = 0; r < 7; r++) for (let c = 0; c < COLS; c++) {
      const on = lit.has(r * 100 + c)
      cells.push({ c, r, on, at: START + 0.12 + (c / COLS) * 0.55 + rnd() * 0.15 })
    }
    const nodes = Array.from({ length: 90 }, () => {
      const a = rnd() * Math.PI * 2
      const d = 300 + rnd() * 900
      return { x: P[0] + Math.cos(a) * d * 1.3, y: P[1] + Math.sin(a) * d * 0.6, file: rnd() < 0.4, ph: rnd() }
    })
    return { g, cells, nodes, glitch: new Glitch(g.canvas.width, g.canvas.height) }
  },
  render(f, s) {
    const { g } = s
    const t = f.t
    clear(g, f)
    const col = seg(t, COLLAPSE, COLLAPSE + 0.38)
    const sc = 1 - inCubic(col) * 0.995
    g.save()
    g.translate(W / 2, 540); g.scale(sc, sc * (1 - 0.6 * col)); g.translate(-W / 2, -540)

    // File mesh converging to a point.
    const conv = outCubic(seg(t, START, TYPE + 0.6))
    g.lineWidth = 1
    s.nodes.forEach((n, i) => {
      const k = clamp01(conv * (0.6 + 0.5 * n.ph))
      const x = lerp(n.x, P[0], k * 0.92)
      const y = lerp(n.y, P[1], k * 0.92)
      const a = seg(t, START + n.ph * 0.4, START + n.ph * 0.4 + 0.2)
      g.globalAlpha = 0.28 * a
      g.strokeStyle = i % 5 === 0 ? C.lime : C.teal
      g.beginPath(); g.moveTo(x, y); g.lineTo(P[0], P[1]); g.stroke()
      const m = s.nodes[(i * 7 + 3) % s.nodes.length]
      const mk = clamp01(conv * (0.6 + 0.5 * m.ph))
      g.globalAlpha = 0.18 * a
      g.beginPath(); g.moveTo(x, y); g.lineTo(lerp(m.x, P[0], mk * 0.92), lerp(m.y, P[1], mk * 0.92)); g.stroke()
      g.globalAlpha = 0.8 * a
      g.strokeStyle = C.white; g.fillStyle = C.white
      if (n.file) { g.lineWidth = 1.4; fileIcon(g, x, y, 18); g.lineWidth = 1 } else g.fillRect(x - 2, y - 2, 4, 4)
    })
    g.globalAlpha = 1
    const pulse = 0.5 + 0.5 * Math.sin(t * 22)
    g.fillStyle = C.cyan
    g.shadowColor = C.cyan; g.shadowBlur = 20
    g.beginPath(); g.arc(P[0], P[1], 5 + 3 * pulse * conv, 0, Math.PI * 2); g.fill()
    g.shadowBlur = 0

    // OVERLOADED: every dot is a tiny line of text.
    mono(g, 10, 500)
    const tick = Math.floor(t * 15)
    for (const c of s.cells) {
      if (t < c.at) continue
      const x = X0 + c.c * PITCH
      const y = Y0 + c.r * PITCH + 14
      const id = c.r * 100 + c.c
      let str = ''
      for (let k = 0; k < 4; k++) str += HEX[Math.floor(hash(id * 4 + k, c.on ? tick : 0) * 16)]
      const fresh = t - c.at < 0.1
      g.fillStyle = c.on ? (fresh ? C.cyan : C.white) : 'rgba(140,155,160,0.1)'
      g.fillText(str, x, y)
      if (c.on) { g.fillText(str.split('').reverse().join(''), x, y - 8); g.fillText(str.slice(2) + str.slice(0, 2), x, y + 8) }
    }
    mono(g, 15, 500)
    g.fillStyle = C.grey
    if (t >= START + 0.6) g.fillText(`GRID LOAD ${(100 + 46 * seg(t, START + 0.6, TYPE)).toFixed(1)}%   //   SUBSTATION 12-41   //   BREAKERS TRIPPING`, X0, Y0 + 7 * PITCH + 40)

    // "the grid shutdown" typed on a white box at 31.4.
    if (t >= TYPE) {
      const n = Math.min(LINE.length, Math.floor((t - TYPE) * 30 + 1e-6))
      const cw = 52 * 0.6
      boxText(g, LINE.slice(0, n), (W - (LINE.length + 1) * cw) / 2 - 16, 640, 52, { cursor: true })
    }
    g.restore()

    // Collapse to a point, then a horizontal flash.
    if (col > 0) {
      const fl = seg(t, COLLAPSE + 0.3, COLLAPSE + 0.42)
      const fade = 1 - seg(t, COLLAPSE + 0.5, END)
      const len = W * outExpo(fl)
      g.save()
      g.globalAlpha = fade
      g.shadowColor = '#bff4ff'; g.shadowBlur = 40
      g.fillStyle = '#f4fdff'
      g.fillRect(W / 2 - len / 2, 540 - 3 - 4 * fl, len, 6 + 8 * fl)
      g.shadowBlur = 0
      g.beginPath(); g.arc(W / 2, 540, 6 * (1 - fl), 0, Math.PI * 2); g.fill()
      g.globalAlpha = 0.35 * fl * fade * fade
      const gr = g.createLinearGradient(0, 540 - 260, 0, 540 + 260)
      gr.addColorStop(0, 'rgba(160,230,255,0)'); gr.addColorStop(0.5, 'rgba(200,245,255,1)'); gr.addColorStop(1, 'rgba(160,230,255,0)')
      g.fillStyle = gr
      g.fillRect(0, 280, W, 520)
      g.restore()
    }

    s.glitch.apply(g, f, 1 - seg(t, START, START + 0.2), 9)
  },
})
