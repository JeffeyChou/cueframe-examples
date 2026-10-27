// The poster and the inspection: the grid draws on, 方圆 rises, three squares hop in step onto the
// baseline, the circle rolls in late. A red marker steps along the labels and each square is stamped
// 合格; the circle is ringed and stamped 不合格, squeezes itself square and is stamped 合格 over it.
// The squares nod; the circle hops, pops round again, rolls off and swells to fill the frame.
import { scene } from '@cueframe/core'
import { clamp01, inOutCubic, lerp, outBack, seg } from '@cueframe/recipes/motion.js'
import {
  BH, TYPE, circleWipe, columns, figure, grid, ring, rise, rule, settle, stamp, stampPose, stepped,
} from '../../../kits/bauhaus.js'
import { el, stageSvg, text } from '../../../kits/svg.js'
import { K } from '../timing.js'

const GROUND = 800
const XS = [300, 610, 920], XC = 1290
const SIZE = 220, R = SIZE / 2, STEP = 190, LEG = 48

export const fable = scene({
  id: 'fable',
  at: 0,
  end: K.wipe[1],
  mount(ctx) {
    const stage = { w: ctx.stage.w, h: ctx.stage.h }
    const svg = stageSvg(ctx, BH.paper)
    const c = columns(stage.w)
    const lines = grid(svg, stage, [96, 400, GROUND, stage.h - 96])
    const head = rise(ctx, svg, c.x(0) - 8, 400, '方圆', { size: 280, font: TYPE.serif, weight: 900, fill: BH.ink, stagger: 0.25 })
    const latin = rise(ctx, svg, c.x(5), 300, 'SQUARE & CIRCLE', { size: 40, font: TYPE.latin, weight: 600, fill: BH.ink, spacing: 12, stagger: 0.03 })
    const note = el(svg, 'g')
    ;['包豪斯寓言', '第一则'].forEach((l, i) => text(note, stage.w - 96, 150 + i * 40, l, { size: 30, font: TYPE.sans, weight: 700, fill: BH.ink, anchor: 'end', spacing: 4 }))
    const noteMark = el(note, 'rect', { x: stage.w - 96 - 28, y: 214, width: 28, height: 28, fill: BH.red })
    const base = rule(svg, c.x(0), GROUND, c.span(12), 8)

    const labels = [...XS, XC].map((x, i) => {
      const num = text(svg, x - 60, 862, `0${i + 1}`, { size: 24, font: TYPE.latin, weight: 600, fill: BH.ink, spacing: 3 })
      const word = rise(ctx, svg, x - 60, 950, i < 3 ? '方' : '圆', { size: 76, font: TYPE.sans, weight: 900, fill: BH.ink })
      return { num, word, x }
    })
    const marker = rule(svg, 0, 976, 64, 10, BH.red)
    const passes = XS.map((x, i) => ({ s: stamp(svg, '合格', { size: 50, seed: 5 + i, ground: BH.paper }), x }))
    const circleRing = ring(svg, { x: XC - 62, y: 950 - 70, w: 80, h: 84 }, 9, { pad: 16 })
    const reject = stamp(svg, '不合格', { size: 46, seed: 21, ground: BH.paper })
    const pass4 = stamp(svg, '合格', { size: 54, seed: 23, ground: BH.paper })

    const squares = XS.map((_, i) => figure(ctx, svg, 'square', SIZE, BH.navy, { leg: LEG, seed: 30 + i }))
    const circle = figure(ctx, svg, 'circle', SIZE, BH.red, { leg: LEG, seed: 41 })
    const strain = el(svg, 'path', { d: Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + 0.3; return `M${(Math.cos(a) * 145).toFixed(1)} ${(Math.sin(a) * 145).toFixed(1)}L${(Math.cos(a) * 182).toFixed(1)} ${(Math.sin(a) * 182).toFixed(1)}` }).join(''), stroke: BH.ink, 'stroke-width': 6, 'stroke-linecap': 'round' })
    const wipe = circleWipe(svg, stage, BH.red)
    return { stage, lines, head, latin, note, noteMark, base, labels, marker, passes, circleRing, reject, pass4, squares, circle, strain, wipe }
  },
  render(f, st) {
    const t = f.t
    st.lines.set(seg(t, 0, 1.1))
    st.head.set(seg(t, 0.35, 1.3))
    st.latin.set(seg(t, 0.9, 1.6))
    const n = seg(t, 1.0, 1.4)
    st.note.style.opacity = n > 0 ? '1' : '0'
    st.note.setAttribute('transform', `translate(0 ${((1 - settle(n)) * 20).toFixed(1)})`)
    st.noteMark.setAttribute('width', (28 * settle(n)).toFixed(1))
    st.base.set(seg(t, 0.6, 1.4))

    // Three squares hop in step, one column per eighth note, and land with a small squash.
    const v = stepped(t, K.hops, 0.22)
    const frac = v - Math.floor(v), last = K.hops.filter((h) => t >= h + 0.22).at(-1)
    const land = last === undefined ? 1 : clamp01((t - last - 0.22) / 0.14)
    const nod = seg(t, K.nod, K.nod + 0.26)
    st.squares.forEach((sq, i) => {
      const hopY = frac > 0 && frac < 1 ? Math.sin(Math.PI * frac) * 60 : 0
      const stampK = K.stamps.map((s) => clamp01((t - s) / 0.2)).map((k) => Math.sin(Math.PI * k))[i]!
      sq.set({
        x: XS[i]! - (6 - v) * STEP, y: GROUND - hopY - Math.sin(Math.PI * nod) * 36,
        squash: 0.1 * Math.sin(Math.PI * land) + 0.08 * stampK, eyes: t >= K.stamps[i]! && t < K.stamps[i]! + 0.25 ? 'line' : 'open', look: t > K.reject ? 1 : 0.4,
      })
    })
    st.labels.forEach((l, i) => {
      const at = i < 3 ? K.labels[i]! : K.label4
      l.num.style.opacity = t >= at ? '1' : '0'
      l.word.set(seg(t, at + 0.05, at + 0.5))
    })

    // The marker steps along the labels; stamps land on the beat after each step.
    const at = stepped(t, K.steps, 0.2)
    const lx = [...XS, XC].map((x) => x - 60)
    const i0 = Math.min(3, Math.floor(at)), mx = lerp(lx[i0]!, lx[Math.min(3, i0 + 1)]!, at - i0)
    st.marker.el.setAttribute('x', mx.toFixed(1))
    st.marker.set(seg(t, K.marker, K.marker + 0.2))
    st.passes.forEach((p, i) => p.s.set(stampPose(t, K.stamps[i]!, { x: p.x + 92, y: 918, rot: -10 + i * 7 })))
    st.circleRing.set(seg(t, K.ring, K.ring + 0.45))
    st.reject.set(stampPose(t, K.reject, { x: XC + 110, y: 922, rot: 8 }))
    st.pass4.set(stampPose(t, K.pass, { x: XC + 96, y: 892, rot: -13 }))

    // The circle: rolls in (two turns, so it stops upright), legs pop out; flinches at 不合格,
    // squeezes itself square in three pushes, hops, pops round mid-air, rolls off and swells.
    const rollK = settle(seg(t, K.roll[0], K.roll[1]))
    const awayK = seg(t, K.rollAway[0], K.rollAway[1], inOutCubic)
    const x = t < K.rollAway[0] ? lerp(XC + 4 * Math.PI * R, XC, rollK) : lerp(XC, 1640, settle(awayK))
    const spin = ((x - XC) / R) * (180 / Math.PI)
    const push = stepped(t, [K.squeeze[0], K.squeeze[0] + 0.5, K.squeeze[0] + 1.0], 0.38, (u) => outBack(u, 2)) / 3
    const hopK = seg(t, K.hop, K.hop + 0.36)
    const popK = seg(t, K.hop + 0.12, K.hop + 0.4)
    const morph = t < K.hop + 0.12 ? push : 1 - outBack(popK, 2.2)
    const squeezing = t >= K.squeeze[0] && t < K.squeeze[1]
    const legs = t < K.legs ? 0 : t < K.rollAway[0] - 0.05 ? settle(seg(t, K.legs, K.legs + 0.25)) : 1 - seg(t, K.rollAway[0] - 0.05, K.rollAway[0] + 0.1)
    const flinch = Math.sin(Math.PI * seg(t, K.reject, K.reject + 0.3))
    const eyes = t < K.reject ? 'open' : t < K.squeeze[0] ? 'line' : squeezing ? 'squint' : t < K.hop + 0.12 ? 'open' : t < K.hop + 0.4 ? 'wide' : 'line'
    st.circle.set({
      x: x + (squeezing ? Math.sin(t * 70) * 3 : 0), y: GROUND - Math.sin(Math.PI * hopK) * 130,
      spin, legs, morph: clamp01(morph), squash: 0.16 * flinch - 0.06 * Math.sin(Math.PI * hopK),
      eyes, look: t < K.reject ? -0.6 : t < K.rollAway[1] - 0.1 ? 0.5 : 0, o: t >= K.roll[0] ? 1 : 0,
    })
    st.strain.style.display = squeezing && Math.floor((t - K.squeeze[0]) / 0.15) % 2 === 0 ? '' : 'none'
    st.strain.setAttribute('transform', `translate(${x.toFixed(1)} ${GROUND - LEG - R})`)
    st.wipe.set(seg(t, K.wipe[0], K.wipe[1]), x, GROUND - LEG * legs - R, R)
  },
})
