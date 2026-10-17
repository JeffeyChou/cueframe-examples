// h1–h3: stop drawing transistors, describe the circuit: "HDL", then Verilog / SystemVerilog.
import { cue, scene } from '@cueframe/core'
import { C, el, MONO, outBack, outCubic, PANEL_H, said, SANS, seg, start } from '../lib.js'

const LETTERS = [['H', '硬件'], ['D', '描述'], ['L', '语言']] as const

export default scene({
  id: 'hdl',
  at: cue('scene.h1.start'),
  end: cue('scene.r1.start', { offset: 1 }),
  mount(ctx) {
    const root = ctx.root
    const T = {
      h1: start('h1'), not: said(ctx, 'h1', '不再'), describe: said(ctx, 'h1', '描述'),
      lang: said(ctx, 'h2', '硬件描述语言'), hdl: said(ctx, 'h2', 'HDL'),
      v: said(ctx, 'h3', 'Verilog'), sv: said(ctx, 'h3', 'SystemVerilog'), r1: start('r1'),
    }
    const y = 640
    const draw = el(root, 'div', { left: '660px', top: `${y}px`, font: `700 60px ${SANS}`, color: C.dim, whiteSpace: 'nowrap' }, '画晶体管')
    const strike = el(draw, 'div', { left: '-10px', right: '-10px', top: '50%', height: '5px', background: C.red, transformOrigin: 'left' })
    const arrow = el(root, 'div', { left: '940px', top: `${y + 38}px`, width: '160px', height: '4px', background: C.cyan, transformOrigin: 'left' })
    const desc = el(root, 'div', { left: '1140px', top: `${y}px`, font: `700 60px ${SANS}`, color: C.cyan, whiteSpace: 'nowrap', textShadow: `0 0 24px ${C.cyan}66` }, '“描述”')
    const letters = LETTERS.map(([ch, zh], i) => {
      const x = 860 + i * 240
      const big = el(root, 'div', { left: `${x}px`, top: `${y - 40}px`, width: '200px', textAlign: 'center', font: `700 150px ${MONO}`, color: C.text, textShadow: `0 0 30px ${C.cyan}55` }, ch)
      const sub = el(root, 'div', { left: `${x}px`, top: `${y + 140}px`, width: '200px', textAlign: 'center', font: `600 30px ${SANS}`, color: C.cyan }, zh)
      return { big, sub }
    })
    const chips = ['Verilog', 'SystemVerilog'].map((name, i) => el(root, 'div', {
      left: `${PANEL_H.x + i * 210}px`, top: `${PANEL_H.y + PANEL_H.h + 22}px`, padding: '6px 18px', borderRadius: '6px',
      border: `1.5px solid ${C.cyan}88`, background: `${C.cyan}14`, font: `600 24px ${MONO}`, color: C.cyan,
    }, name))
    return { T, draw, strike, arrow, desc, letters, chips }
  },
  render(f, s) {
    const { T } = s
    const t = f.t
    const words = seg(t, T.h1 + 0.2, T.h1 + 0.7) * (1 - seg(t, T.lang - 0.3, T.lang + 0.2))
    s.draw.style.opacity = String(words)
    s.strike.style.transform = `scaleX(${seg(t, T.not, T.not + 0.4, outCubic).toFixed(4)})`
    s.arrow.style.transform = `scaleX(${seg(t, T.describe - 0.3, T.describe + 0.1, outCubic).toFixed(4)})`
    s.arrow.style.opacity = String(words)
    s.desc.style.opacity = String(seg(t, T.describe, T.describe + 0.3) * words)
    const out = 1 - seg(t, T.r1 - 0.2, T.r1 + 0.4)
    s.letters.forEach((l, i) => {
      const k = seg(t, T.lang + 0.1 + i * 0.25, T.lang + 0.5 + i * 0.25, outBack)
      l.big.style.opacity = String(Math.min(1, k) * out)
      l.big.style.transform = `translateY(${(1 - k) * 30}px) scale(${(1 + 0.25 * flashAt(t, T.hdl + i * 0.15)).toFixed(4)})`
      l.sub.style.opacity = String(seg(t, T.lang + 0.3 + i * 0.25, T.lang + 0.6 + i * 0.25) * out)
    })
    const ats = [T.v, T.sv]
    s.chips.forEach((c, i) => {
      const k = seg(t, ats[i]! - 0.1, ats[i]! + 0.3, outBack)
      c.style.opacity = String(Math.min(1, k) * out)
      c.style.transform = `scale(${(0.7 + 0.3 * k).toFixed(4)})`
    })
  },
})

const flashAt = (t: number, at: number) => (t < at ? 0 : Math.exp(-6 * (t - at)))
