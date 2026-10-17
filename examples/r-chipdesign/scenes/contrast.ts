// d1–d3: the code panel arrives from `rtl` on the right and becomes the hardware side; software
// runs one line after another on the left, hardware lights every line each cycle.
import { cue, scene } from '@cueframe/core'
import { codePanel, typeTo } from '../codepanel.js'
import { blocking, C, CODE, el, MONO, PANEL_D, panel, said, SANS, seg, start } from '../lib.js'

const SOFTWARE = ['a = read_sensor();', 'b = read_sensor();', 'avg = (a + b) / 2;', 'if (avg > limit)', '  alarm = 1;', 'send(avg);']
const LEFT = { x: 110, y: PANEL_D.y, w: 810, h: PANEL_D.h }
const IDS = ['split', 'seq', 'par'] as const
const STEP = 0.5
const P = 0.6

export default scene({
  id: 'contrast',
  at: cue('scene.d1.start'),
  end: cue('total'),
  mount(ctx) {
    const root = ctx.root
    const b = blocking(IDS)
    const at = { split: start('d1'), seq: said(ctx, 'd2', '一条一条'), par: said(ctx, 'd3', '同时工作') }
    const code = codePanel(root, true)
    typeTo(code.counter, code.counter.n + 1)
    typeTo(code.hw!, code.hw!.n + 6)
    ctx.key(b.set(code.p, { split: PANEL_D }), 'code')
    const soft = ctx.key(b.set(panel(root, C.orange), { split: LEFT }), 'soft')
    const hl = el(soft, 'div', { left: `${CODE.pad - 12}px`, width: '760px', height: `${CODE.lh - 8}px`, background: `${C.orange}26`, borderLeft: `3px solid ${C.orange}` })
    const box = el(soft, 'div', { left: `${CODE.pad}px`, top: `${CODE.pad}px` })
    box.className = 'chip-code'
    SOFTWARE.forEach((line, i) => {
      const row = el(box, 'div', { position: 'relative', height: `${CODE.lh}px`, lineHeight: `${CODE.lh}px` })
      el(row, 'span', { position: 'relative' }, String(i + 1)).className = 'ln'
      el(row, 'span', { position: 'relative' }, line)
    })
    const tab = (text: string, color: string) => el(root, 'div', { font: `600 24px ${SANS}`, color, letterSpacing: '.06em', whiteSpace: 'nowrap' }, text)
    ctx.key(b.set(tab('软件 · C', C.orange), { split: { x: LEFT.x + 4, y: LEFT.y - 44, w: 300, h: 32 } }), 'tab-soft')
    ctx.key(b.set(tab('硬件 · Verilog', C.cyan), { split: { x: PANEL_D.x + 4, y: PANEL_D.y - 44, w: 300, h: 32 } }), 'tab-hard')
    ctx.key(b.set(el(root, 'div', { textAlign: 'center', font: `700 64px ${MONO}`, color: C.red, textShadow: `0 0 20px ${C.red}88`, lineHeight: '80px' }, '≠'),
      { split: { x: 920, y: PANEL_D.y + PANEL_D.h / 2 - 40, w: 80, h: 80 } }), 'ne', { enter: 'pop' })
    const note = (text: string, color: string) => el(root, 'div', { font: `600 28px ${SANS}`, color, whiteSpace: 'nowrap' }, text)
    ctx.key(b.set(note('一次一行，按顺序', C.orange), { seq: { x: LEFT.x, y: LEFT.y + LEFT.h + 28, w: 600, h: 40 } }), 'note-seq')
    ctx.key(b.set(note('每个周期，所有行同时生效', C.green), { par: { x: PANEL_D.x, y: PANEL_D.y + PANEL_D.h + 28, w: 600, h: 40 } }), 'note-par')
    ctx.layouts(IDS.map((id) => ({
      id, at: at[id],
      motion: id === 'split' ? { code: { dur: 0.8 }, soft: { enter: 'pop', delay: 0.3 }, 'tab-*': { delay: 0.5 }, ne: { delay: 0.8 } } : undefined,
    })), b.apply)
    return { at, code, hl }
  },
  render(f, s) {
    const t = f.t
    // The counter's lines give way to the comparison's.
    const swap = seg(t, s.at.split + 0.2, s.at.split + 0.6)
    s.code.counter.box.style.opacity = String(1 - swap)
    s.code.hw!.box.style.opacity = String(swap)
    // Software: one line at a time, looping; dimmer once the hardware side takes over.
    const line = t >= s.at.seq ? Math.floor((t - s.at.seq) / STEP) % SOFTWARE.length : -1
    s.hl.style.top = `${CODE.pad + Math.max(0, line) * CODE.lh + 4}px`
    s.hl.style.opacity = String(line >= 0 ? 1 - 0.6 * seg(t, s.at.par - 0.5, s.at.par) : 0)
    // Hardware: every line lights at once, every cycle.
    const all = t >= s.at.par ? 0.25 + 0.75 * Math.exp(-4 * (((t - s.at.par) % P) / P)) : 0
    s.code.hw!.rows.forEach((r) => { r.hl.style.opacity = String(all) })
  },
})
