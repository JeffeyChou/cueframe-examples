// On the red the circle became: the moral rises in cream, a square hops in to stand by it and nods
// twice, and the attribution gives it away (—— 方 说). Paper columns rise over it.
import { scene } from '@cueframe/core'
import { seg } from '@cueframe/recipes/motion.js'
import { BH, TYPE, columnWipe, columns, figure, rise, rule, stepped } from '../../../kits/bauhaus.js'
import { el, stageSvg } from '../../../kits/svg.js'
import { K } from '../timing.js'

const GROUND = 880

export const moral = scene({
  id: 'moral',
  at: K.wipe[1],
  end: K.columns[1],
  mount(ctx) {
    const stage = { w: ctx.stage.w, h: ctx.stage.h }
    const svg = stageSvg(ctx, BH.red)
    const c = columns(stage.w)
    const lines = el(svg, 'g', { stroke: BH.ink, 'stroke-width': 1.5, opacity: 0.14 })
    for (let i = 0; i < 12; i++) el(lines, 'line', { x1: c.x(i), x2: c.x(i), y1: 0, y2: stage.h })
    const l1 = rise(ctx, svg, c.x(0) - 6, 420, '没有规矩，', { size: 156, font: TYPE.serif, weight: 900, fill: BH.cream, stagger: 0.08 })
    const l2 = rise(ctx, svg, c.x(0) - 6, 610, '不成方圆。', { size: 156, font: TYPE.serif, weight: 900, fill: BH.cream, stagger: 0.08 })
    const said = rise(ctx, svg, c.x(0), 760, '—— 方 说', { size: 56, font: TYPE.sans, weight: 900, fill: BH.ink, stagger: 0.1 })
    const floor = rule(svg, c.x(8), GROUND, c.span(4), 8)
    const speaker = figure(ctx, svg, 'square', 220, BH.navy, { leg: 50, seed: 61 })
    const wipe = columnWipe(svg, stage, [BH.ink, BH.navy, BH.ink, BH.mustard])
    return { l1, l2, said, floor, speaker, wipe }
  },
  render(f, st) {
    const t = f.t
    st.l1.set(seg(t, K.line1, K.line1 + 0.6))
    st.l2.set(seg(t, K.line2, K.line2 + 0.6))
    st.said.set(seg(t, K.said, K.said + 0.45))
    st.floor.set(seg(t, K.speaker[0]! - 0.3, K.speaker[0]! + 0.1))
    const v = stepped(t, K.speaker, 0.24), frac = v % 1
    const nod = Math.max(...K.nods.map((n) => Math.sin(Math.PI * seg(t, n, n + 0.24))))
    st.speaker.set({
      x: 2060 - v * 200, y: GROUND - (frac > 0 ? Math.sin(Math.PI * frac) * 50 : 0),
      squash: 0.12 * nod, eyes: t >= K.nods[0]! ? 'line' : 'open', look: -0.8, o: t >= K.speaker[0]! ? 1 : 0,
    })
    st.wipe.set(seg(t, K.columns[0], K.columns[1]))
  },
})
