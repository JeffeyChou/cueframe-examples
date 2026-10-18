// h1–h3: stop drawing transistors, describe the circuit: the code panel appears and is typed,
// "HDL" is spelled out, then Verilog / SystemVerilog. The panel goes on to scene `rtl`.
import { cue, scene } from '@cueframe/core'
import { blocking, C, caret, COUNTER, el, MONO, outCubic, PANEL_H, said, SANS, seg, start, ui, VERILOG } from '../lib.js'

const IDS = ['draw', 'describe', 'hdl', 'verilog', 'system', 'out'] as const
const Y = 640

export default scene({
  id: 'hdl',
  at: cue('scene.h1.start'),
  end: cue('scene.r1.start'),
  mount(ctx) {
    const root = ctx.root
    const b = blocking(IDS)
    const at = {
      draw: start('h1'), describe: said(ctx, 'h1', '描述'), hdl: said(ctx, 'h2', '硬件描述语言'),
      verilog: said(ctx, 'h3', 'Verilog'), system: said(ctx, 'h3', 'SystemVerilog'), out: start('r1') - 0.45,
    }
    const T = { not: said(ctx, 'h1', '不再'), type: start('h2') + 0.4 }
    const words = { font: `700 60px ${SANS}`, whiteSpace: 'nowrap' }
    const draw = ctx.key(b.set(el(root, 'div', { ...words, color: C.dim }, '画晶体管'), { draw: { x: 660, y: Y, w: 260, h: 80 }, hdl: null }), 'draw')
    const strike = el(draw, 'div', { left: '-10px', right: '-10px', top: '50%', height: '5px', background: C.alert, transformOrigin: 'left' })
    ctx.key(b.set(el(root, 'div', { background: C.accent }), { describe: { x: 940, y: Y + 38, w: 160, h: 4 }, hdl: null }), 'desc-arrow')
    ctx.key(b.set(el(root, 'div', { ...words, color: C.accent, textShadow: `0 0 24px ${C.accent}66` }, '“描述”'), { describe: { x: 1140, y: Y, w: 300, h: 80 }, hdl: null }), 'desc')
    const panel = ui.panel(root)
    const code = ui.code(panel.body, { lines: COUNTER, ...VERILOG })
    ctx.key(b.set(panel.el, { describe: PANEL_H }), 'code')
    ;[['H', '硬件'], ['D', '描述'], ['L', '语言']].forEach(([ch, zh], i) => {
      const l = ctx.key(b.set(el(root, 'div', { textAlign: 'center', font: `700 150px ${MONO}`, color: C.text, textShadow: `0 0 30px ${C.accent}55`, lineHeight: '180px' }, ch),
        { hdl: { x: 860 + i * 240, y: Y - 40, w: 200, h: 230 }, out: null }), `letter-${i}`)
      el(l, 'div', { left: '0', right: '0', top: '180px', font: `600 30px ${SANS}`, color: C.accent, lineHeight: '1' }, zh)
    })
    ;['Verilog', 'SystemVerilog'].forEach((name, i) => ctx.key(b.set(ui.tag(root, name).el,
      { [IDS[3 + i]!]: { x: PANEL_H.x + i * 210, y: PANEL_H.y + PANEL_H.h + 22, w: i ? 230 : 190, h: 46 }, out: null }), `chip-${i}`, { enter: 'pop' }))
    ctx.layouts(IDS.map((id) => ({
      id, at: at[id],
      motion: id === 'draw' ? { draw: { enter: 'fade', delay: 0.2 } } : id === 'describe' ? { 'desc-arrow': { dur: 0.3 }, desc: { delay: 0.2 } } : id === 'hdl' ? { 'letter-*': { enter: 'pop', delay: 0.3, stagger: 0.25 } } : {},
    })), b.apply)
    return { T, strike, code }
  },
  render(f, s) {
    s.strike.style.transform = `scaleX(${seg(f.t, s.T.not, s.T.not + 0.4, outCubic).toFixed(4)})`
    // Typing, with a caret that blinks once the two lines are done.
    const n = Math.max(0, f.t - s.T.type) * 11
    s.code.set({ typed: n, caret: n <= COUNTER.join('\n').length || caret(f.t) })
  },
})
