// d1–d3: the same idea as software (one line after another) beside the hardware code panel
// (scene `code`), whose lines all light at once each cycle.
import { cue, scene } from '@cueframe/core'
import { C, CODE, el, MONO, outBack, PANEL_D, panel, place, said, SANS, seg, start, type Rect } from '../lib.js'

const SOFTWARE = ['a = read_sensor();', 'b = read_sensor();', 'avg = (a + b) / 2;', 'if (avg > limit)', '  alarm = 1;', 'send(avg);']
const LEFT: Rect = { x: 110, y: PANEL_D.y, w: 810, h: PANEL_D.h }
const STEP = 0.5

export default scene({
  id: 'contrast',
  at: cue('scene.d1.start'),
  end: cue('total'),
  mount(ctx) {
    const T = { d1: start('d1'), seq: said(ctx, 'd2', '一条一条'), d3: start('d3') }
    const p = panel(ctx.root, C.orange)
    const hl = el(p, 'div', { left: `${CODE.pad - 12}px`, width: '760px', height: `${CODE.lh - 8}px`, background: `${C.orange}26`, borderLeft: `3px solid ${C.orange}` })
    const box = el(p, 'div', { left: `${CODE.pad}px`, top: `${CODE.pad}px` })
    box.className = 'chip-code'
    SOFTWARE.forEach((line, i) => {
      const row = el(box, 'div', { position: 'relative', height: `${CODE.lh}px`, lineHeight: `${CODE.lh}px` })
      const ln = el(row, 'span', { position: 'relative' }, String(i + 1))
      ln.className = 'ln'
      el(row, 'span', { position: 'relative' }, line)
    })
    const tab = el(ctx.root, 'div', { font: `600 24px ${SANS}`, color: C.orange, letterSpacing: '.06em' }, '软件 · C')
    const ne = el(ctx.root, 'div', { left: '960px', top: `${PANEL_D.y + PANEL_D.h / 2}px`, transform: 'translate(-50%,-50%)', font: `700 64px ${MONO}`, color: C.red, textShadow: `0 0 20px ${C.red}88` }, '≠')
    const note = el(ctx.root, 'div', { font: `600 28px ${SANS}`, color: C.orange, whiteSpace: 'nowrap' }, '一次一行，按顺序')
    return { T, p, hl, tab, ne, note }
  },
  render(f, s) {
    const { T } = s
    const t = f.t
    const on = seg(t, T.d1 + 0.3, T.d1 + 0.9)
    place(s.p, LEFT, on, 0.96 + 0.04 * on)
    place(s.tab, { x: LEFT.x + 4, y: LEFT.y - 44, w: 300, h: 32 }, on)
    const k = seg(t, T.d1 + 0.8, T.d1 + 1.2, outBack)
    s.ne.style.opacity = String(Math.min(1, k))
    s.ne.style.transform = `translate(-50%,-50%) scale(${(0.6 + 0.4 * k).toFixed(4)})`
    // d2: one line at a time, looping; dimmer once the hardware side takes over.
    const line = t >= T.seq ? Math.floor((t - T.seq) / STEP) % SOFTWARE.length : -1
    s.hl.style.top = `${CODE.pad + Math.max(0, line) * CODE.lh + 4}px`
    s.hl.style.opacity = String(line >= 0 ? 1 - 0.6 * seg(t, T.d3, T.d3 + 0.5) : 0)
    place(s.note, { x: LEFT.x, y: LEFT.y + LEFT.h + 28, w: 600, h: 40 }, seg(t, T.seq - 0.2, T.seq + 0.3))
  },
})
