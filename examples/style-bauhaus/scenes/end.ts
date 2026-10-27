// The end card: the three primitives with their ink accents, the series title; the disc's quarter
// turns twice in steps, and the card fades to paper.
import { scene } from '@cueframe/core'
import { seg } from '@cueframe/recipes/motion.js'
import { BH, TYPE, primitive, rise, settle, stepped } from '../../../kits/bauhaus.js'
import { el, stageSvg } from '../../../kits/svg.js'
import { K, TOTAL } from '../timing.js'

export const end = scene({
  id: 'end',
  at: K.columns[1],
  end: TOTAL,
  mount(ctx) {
    const svg = stageSvg(ctx, BH.paper)
    const shapes = [
      primitive(ctx, svg, 'disc', 128, BH.red),
      primitive(ctx, svg, 'block', 118, BH.navy, BH.mustard),
      primitive(ctx, svg, 'wedge', 140, BH.mustard),
    ]
    const title = rise(ctx, svg, 960, 660, '包豪斯寓言', { size: 64, font: TYPE.serif, weight: 900, fill: BH.ink, spacing: 18, anchor: 'middle', stagger: 0.1 })
    const latin = rise(ctx, svg, 960, 722, 'BAUHAUS FABLE · No.1', { size: 24, font: TYPE.latin, weight: 600, fill: BH.ink, spacing: 12, anchor: 'middle', stagger: 0.02 })
    const fade = el(svg, 'rect', { width: ctx.stage.w, height: ctx.stage.h, fill: BH.paper })
    return { shapes, title, latin, fade }
  },
  render(f, st) {
    const t = f.t
    const xs = [960 - 190, 960, 960 + 190]
    st.shapes.forEach((s, i) => {
      const k = settle(seg(t, K.shapes[i]!, K.shapes[i]! + 0.35))
      s.set({ x: xs[i]!, y: 480 + (1 - k) * 40 + (i === 2 ? 10 : 0), s: Math.max(0.001, k), o: k > 0 ? 1 : 0, turn: -90 * stepped(t, K.turns, 0.22) })
    })
    st.title.set(seg(t, K.title, K.title + 0.6))
    st.latin.set(seg(t, K.latin, K.latin + 0.5))
    st.fade.setAttribute('opacity', seg(t, K.fade, K.fade + 0.5).toFixed(3))
  },
})
