// s9–s12: "now it is different" — the narrator turns to its dark side under a red sun beside the
// small black box (Opus); then, alone with the box, it copies Claude and gives the instruction, which
// flies into the box as a wobbling yellow paper blob.
import { cue, scene } from '@cueframe/core'
import { T as E } from '../timing.js'
import { BODY, C, SANS, VILLAGE, ball, blink, blobPath, bump, camera, crowd, cube, defs, elder, envelope, hop, inOutCubic, look, nod, outBack, outCubic, pose, said, s, seg, shake, squashed, stageSvg, start } from '../lib.js'

export const turn = scene({
  id: 'turn',
  at: cue('scene.s9.start'),
  end: cue('scene.s11.start'),
  mount(ctx) {
    const svg = stageSvg(ctx.root, C.paper)
    defs(svg)
    const world = s(svg, 'g')
    s(world, 'circle', { cx: 760, cy: 430, r: 330, fill: C.red })
    const sil = crowd(world, 5, { x0: -40, x1: 330, y: 1000, h: [150, 230], seed: 5, colors: [C.ink], spread: 60 })
    s(world, 'path', { d: 'M250 1200 L420 650 L1600 610 L1600 1200 Z', fill: C.ink })
    const ae = elder(world, 46)
    const me = ball(world, 120)
    const box = cube(world, 110)
    return { world, sil, ae, me, box, t0: start('s9'), dark: E.dark, power: said(ctx, 's10', '力量'), shame: said(ctx, 's10', '下不来台'), end: start('s11') }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, { x: 760, y: 560 - 30 * seg(t, st.t0, st.end), zoom: 1 + 0.12 * seg(t, st.t0, st.end, inOutCubic) })
    st.me.set(pose({ ...BODY, x: 640, y: 655, dark: seg(t, st.dark - 0.1, st.dark + 0.6, inOutCubic), eyes: 'open' as 'open' | 'line' },
      { mode: 'add', w: envelope(t, st.shame - 0.08, { in: 0.58, hold: Infinity, out: 0 }, VILLAGE), v: { y: -18, sx: -0.04, sy: 0.04 } },
      squashed(t, st.dark - 0.1, { q: 0.06, dur: 0.5 }),
      { mode: 'replace', w: t > st.shame ? 1 : 0, v: { eyes: 'line' } },
      look(t, st.power, { x: 0.7, y: 0, in: 0.12 }),
      blink(t, 4)))
    const glow = bump(t, st.power, 0.8)
    st.box.set({ x: 910, y: 640, slit: glow > 0.3 ? C.mustard : C.cream, glow: 0.8 * glow, depth: 0.25 })
    st.ae.set(pose({ ...BODY, x: 92, y: 1068, eyes: 'happy' as const }, blink(t, 6)))
    st.sil.forEach((v) => v.v.set(pose({ ...BODY, x: v.x, y: v.y, look: 1, up: 0.6 }, blink(t, v.seed))))
  },
})

export const prompt = scene({
  id: 'prompt',
  at: cue('scene.s11.start'),
  end: cue('total'),
  mount(ctx) {
    const svg = stageSvg(ctx.root, C.paper)
    defs(svg)
    const world = s(svg, 'g')
    s(world, 'line', { x1: -3000, x2: 5000, y1: 830, y2: 830, stroke: C.ink, 'stroke-width': 4 })
    const box = cube(world, 340)
    const me = ball(world, 48)
    const blob = s(world, 'g')
    const shape = s(blob, 'path', { fill: C.mustard })
    s(blob, 'path', { d: 'M-34 -40 L44 4 L-30 44 Z', fill: C.ink })
    s(blob, 'text', { x: 4, y: 12, 'text-anchor': 'middle', 'font-family': SANS, 'font-weight': 700, 'font-size': 34, fill: C.cream, transform: 'rotate(-28)' }, '流畅')
    return {
      world, box, me, blob, shape, t0: start('s11'),
      copy: said(ctx, 's11', '样子'), done: said(ctx, 's12', '一点'), say: E.say, pop: E.pop, fly: E.fly,
    }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, { x: 720, y: 560, zoom: 1 + 0.05 * seg(t, st.t0, st.fly + 1.5, inOutCubic) })
    // The narrator straightens up like Claude (smug eyes), hops toward the box on "说".
    const step = seg(t, st.say - 0.1, st.say + 0.3, outCubic)
    st.me.set(pose({ ...BODY, x: 250 + 90 * step, y: 830, look: 0.6, eyes: 'open' as 'open' | 'line' },
      hop(t, st.say - 0.1, { height: 60, dur: 0.4, stretch: 0.15 }),
      nod(t, st.done, { depth: 1.4, dur: 0.5 }, VILLAGE),
      squashed(t, st.done, { q: 0.14, dur: 0.5 }, VILLAGE),
      { mode: 'replace', w: t > st.copy ? 1 : 0, v: { eyes: 'line' } },
      blink(t, 3)))
    // The instruction: pops up beside the narrator, wobbles, then arcs into the slit and lights it.
    const grow = seg(t, st.pop - 0.1, st.pop + 0.35, outBack)
    const fly = seg(t, st.fly, st.fly + 0.7, inOutCubic)
    const [x0, y0, x1, y1] = [470, 560, 1040, 830 - 340 * 0.43]
    const x = x0 + (x1 - x0) * fly
    const y = y0 + (y1 - y0) * fly - Math.sin(Math.PI * fly) * 160
    const k = 1.4 * grow * (1 - 0.85 * fly)
    st.blob.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(-8 + 40 * fly).toFixed(2)}) scale(${k.toFixed(4)})`)
    st.blob.style.opacity = fly >= 1 ? '0' : '1'
    st.shape.setAttribute('d', blobPath(80, t, 3, 0.09))
    const hit = st.fly + 0.7
    const lit = seg(t, hit, hit + 0.15)
    const jolt = shake(t, hit, { dur: 0.35, amp: 10, freq: 22, seed: 4 })
    st.box.set({ x: 1040 + (jolt.x ?? 0), y: 830, slit: lit > 0.5 ? C.mustard : C.cream, glow: lit * (0.7 + 0.3 * Math.sin(t * 6)), depth: 0.22 })
  },
})
