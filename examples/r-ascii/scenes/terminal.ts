import { scene, seeded } from '@cueframe/core'
import { CAP, COLS, ROWS, TIMELINE_ROW, VIEW, chrome } from '../chrome.js'
import { composite, corrupt, crtPass, drawGrid, makeScan } from '../crt.js'
import { BIG_W, C, CH, CSS, Grid, big, type Rect } from '../lib.js'
import { DUR, glitch, lineAt, lines, stanzaAt, stanzas, type Line } from '../timing.js'
import circle from '../visuals/circle.js'
import infinity from '../visuals/infinity.js'
import points from '../visuals/points.js'
import sine from '../visuals/sine.js'
import { marks, type LogLine } from '../visuals/types.js'

const VIS = [points, circle, sine, infinity]
const LOG: LogLine[] = stanzas.flatMap((s) => VIS[s.k].log(s)).sort((a, b) => a[0] - b[0])
const INNER: Rect = { x: VIEW.x + 1, y: VIEW.y + 1, w: VIEW.w - 2, h: VIEW.h - 2 }

function caption(c: CanvasRenderingContext2D, line: Line, t: number, w: number) {
  const top = CAP.y * CH, hgt = CAP.h * CH
  const lt = t - line.t0
  const cx = w / 2
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const enY = top + hgt * 0.36, zhY = top + hgt * 0.72
  // English: capitalised words are emphasised (inverse amber blocks)
  const words = line.en.split(' ')
  const caps = (s: string) => /^[A-Z][A-Z.]+$/.test(s)
  const fs = line.caps ? 58 : 46
  c.font = `800 ${fs}px JBM`
  const adv = c.measureText('M').width
  const total = line.en.length * adv
  let x = cx - total / 2
  c.textAlign = 'left'
  for (let i = 0; i < words.length; i++) {
    const wd = words[i] + (i < words.length - 1 ? ' ' : '')
    const em = caps(words[i])
    if (em) {
      const pad = 10
      c.fillStyle = CSS[C.amber]
      c.fillRect(x - pad, enY - fs * 0.62, words[i].length * adv + pad * 2, fs * 1.24)
      c.fillStyle = CSS[C.red]
      c.fillRect(x - pad - 8, enY - fs * 0.62, 4, fs * 1.24)
      c.fillRect(x + words[i].length * adv + pad + 4, enY - fs * 0.62, 4, fs * 1.24)
      // two-frame chromatic kick on the onset
      if (lt < 2 / 30) {
        c.fillStyle = CSS[C.cyan]
        c.fillText(words[i], x + 4, enY + 2)
      }
      c.fillStyle = CSS[16]
      c.fillText(words[i], x, enY + 2)
    } else {
      c.fillStyle = CSS[C.white]
      c.fillText(wd, x, enY + 2)
    }
    x += wd.length * adv
  }
  if (!line.caps && Math.floor(t * 3.5) % 2 === 0) {
    c.fillStyle = CSS[C.cyan]
    c.fillRect(x + 6, enY - fs * 0.45, adv * 0.6, fs * 0.9)
  }
  c.textAlign = 'center'
  c.font = `700 ${line.caps ? 44 : 38}px NotoSC`
  c.fillStyle = CSS[line.caps ? C.amber : 250]
  c.fillText(line.zh, cx, zhY)
  c.textAlign = 'left'
  c.font = '20px JBM'
  c.fillStyle = CSS[C.dim + 3]
  c.fillText(`> lyric[${line.i}].en`, 24, enY)
  c.fillText(`> lyric[${line.i}].zh`, 24, zhY)
  c.textAlign = 'right'
  c.fillText(`+${lt.toFixed(3)}s`, w - 24, enY)
  c.fillText(`${(line.t1 - line.t0).toFixed(3)}s`, w - 24, zhY)
  c.textAlign = 'left'
}

export default scene({
  id: 'terminal',
  dur: DUR,
  // live-mode pause on the final caps line; dropped in video export
  holds: [{ id: 'limitations', at: lines[lines.length - 1].t0 + 0.5 }],
  mount(ctx) {
    const { w, h, scale } = ctx.stage
    const gc = ctx.canvas('grid')
    gc.canvas.style.display = 'none'
    const out = ctx.canvas('crt')
    return { grid: new Grid(COLS, ROWS), gc, out, scan: makeScan(w, h, scale), sc: scale }
  },
  render(f, s) {
    const { w, h } = f.stage
    const t = Math.min(f.t, DUR - 1e-6)
    const line = lineAt(t)
    const st = stanzaAt(t)
    const G = glitch(t)
    const g = s.grid
    g.clear()
    g.clip = INNER
    const m = marks(st)
    const u = t - st.t0
    const rd = VIS[st.k].draw(g, INNER, u, m, f)
    // big caps word sweeps in along the bottom of the viewport
    if (line.caps) {
      const lt = t - line.t0
      const word = line.en
      const wd = word.length * BIG_W - 1
      const bx = INNER.x + Math.floor((INNER.w - wd) / 2)
      const by = INNER.y + INNER.h - 7
      const wipe = Math.min(1, lt / 0.18) * wd
      const sr = seeded(`cap${Math.floor(f.frame / 2)}`)
      big(g, bx, by, word, (x) => (x > wipe ? C.faint : sr() < 0.08 ? C.white : st.k === 3 ? (sr() < 0.5 ? C.yellow : C.white) : C.amber),
        (x, y) => (x > wipe ? '░' : (x + y * 2 + Math.floor(lt * 30)) % 9 === 0 ? '▓' : '█'))
    }
    g.clip = { x: 0, y: 0, w: COLS, h: ROWS }
    chrome(g, f, G, VIS[st.k].title, rd, LOG, line)
    const slow = seeded(`slow${Math.floor(f.frame / 3)}`)
    corrupt(g, G, f.rng('cells'), slow, TIMELINE_ROW)
    drawGrid(s.gc, g, w, h)
    const r = f.rng('crt')
    composite(s.out, s.gc.canvas, s.sc, G, r, seeded(`rows${Math.floor(f.frame / 2)}`), ROWS, TIMELINE_ROW, w, h)
    caption(s.out, line, t, w)
    crtPass(s.out, s.scan, t, G, r, w, h)
  },
})
