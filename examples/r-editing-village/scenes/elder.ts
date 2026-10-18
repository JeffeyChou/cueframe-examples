// s1–s2: the AE elder laughs between two villagers, a whip pan, then he points at the monitor
// where the strip is still playing. Both shots are motion-blurred for the whip.
import { cue, scene } from '@cueframe/core'
import { C, H, W, blink, bump, camera, crowd, elder, inCubic, outBack, outCubic, said, s, seg, squash, stageSvg, start, villager } from '../lib.js'
import { T0 } from './stage.js'
import { play, strip } from './strip.js'

const WHIP = 0.32

export const laugh = scene({
  id: 'laugh',
  at: 0,
  end: cue('scene.s2.start'),
  blur: { samples: 6, shutter: 0.7 },
  mount(ctx) {
    const svg = stageSvg(ctx.root, C.mustard)
    const world = s(svg, 'g')
    s(world, 'rect', { x: -3000, y: 790, width: 8000, height: 600, fill: C.mustard })
    s(world, 'line', { x1: -3000, x2: 5000, y1: 790, y2: 790, stroke: C.ink, 'stroke-width': 5 })
    const left = villager(world, 560, C.ink)
    const right = villager(world, 520, C.navy)
    const ae = elder(world, 230)
    return { world, left, right, ae, at: said(ctx, 's1', '笑'), end: start('s2') }
  },
  render(f, st) {
    const t = f.t
    const whip = seg(t, st.end - WHIP, st.end, inCubic)
    camera(st.world, { x: 720 + whip * 1400, y: 560, zoom: 1 + 0.06 * seg(t, 0, st.end) })
    // A chuckle: three quick squashes with the mouth open, the hat bobbing.
    const k = t - st.at
    const chuckle = k > 0 && k < 1.1 ? Math.abs(Math.sin(k * Math.PI * 3 / 1.1)) * (1 - k / 1.1) : 0
    st.ae.set({ x: 720, y: 790, ...squash(0.12 * chuckle), eyes: t > st.at - 0.2 ? 'happy' : 'flat', open: chuckle > 0.05 ? 1 : 0, hat: 12 * chuckle, blink: blink(t, 5) })
    st.left.set({ x: 360, y: 798, look: 1, brow: -0.4, blink: blink(t, 1) })
    st.right.set({ x: 1090, y: 798, look: -1, brow: 0.5, blink: blink(t, 2) })
  },
})

export const point = scene({
  id: 'point',
  at: cue('scene.s2.start'),
  end: cue('scene.s3.start'),
  blur: { samples: 6, shutter: 0.7 },
  mount(ctx) {
    const svg = stageSvg(ctx.root, C.paper)
    const world = s(svg, 'g')
    s(world, 'line', { x1: -3000, x2: 5000, y1: 640, y2: 640, stroke: C.ink, 'stroke-width': 4 })
    const trio = crowd(world, 3, { x0: 600, x1: 840, y: 640, h: [96, 120], seed: 2, colors: [C.navy, C.cobalt, C.navy] })
    const mon = s(world, 'g', { transform: `translate(960 70) scale(0.24)` })
    const clip = s(s(svg, 'defs'), 'clipPath', { id: 'monitor' })
    s(clip, 'rect', { width: W, height: H })
    const film = strip(s(mon, 'g', { 'clip-path': 'url(#monitor)' }))
    s(mon, 'rect', { x: -24, y: -24, width: W + 48, height: H + 48, fill: 'none', stroke: C.ink, 'stroke-width': 48 })
    const ae = elder(world, 380)
    return { world, film, trio, ae, at: said(ctx, 's2', '指向'), t0: start('s2') }
  },
  render(f, st) {
    const t = f.t
    const whipIn = 1 - seg(t, st.t0, st.t0 + WHIP, outCubic)
    const push = seg(t, st.at, st.at + 3, outCubic)
    camera(st.world, { x: 720 - whipIn * 1400 + push * 90, y: 540 - push * 50, zoom: 1 + 0.1 * push })
    st.film.draw(play(t, T0))
    // The point: a small hop, the body leans and the diamond swings toward the monitor.
    const p = seg(t, st.at - 0.15, st.at + 0.35, outBack)
    const hop = bump(t, st.at - 0.15, 0.35)
    st.ae.set({ x: 250, y: 1150 - 40 * hop, rot: 7 * p, ...squash(-0.08 * hop), eyes: p > 0.5 ? 'one' : 'happy', look: 0.9 * p, hat: -35 * p, blink: blink(t, 5) })
    st.trio.forEach((v, i) => v.v.set({ x: v.x, y: v.y, look: 1, up: seg(t, st.at + 0.2 + i * 0.1, st.at + 0.5 + i * 0.1), blink: blink(t, v.seed) }))
  },
})
