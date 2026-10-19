// s1–s2: the AE elder laughs between two villagers, a whip pan, then he points at the monitor
// where the strip is still playing. Both shots are motion-blurred during the whip only.
import { clock, cue, scene, type Rect } from '@cueframe/core'
import { BODY, C, H, STAGE, VILLAGE, W, blink, camera, compRect, crowd, elder, envelope, hop, inCubic, outCubic, pose, said, s, seg, stageSvg, start, villager, type Cam } from '../lib.js'
import { T0 } from './stage.js'
import { cards, LENGTH } from './strip.js'
import { T as E, WHIP } from '../timing.js'

type ElderEyes = 'happy' | 'one' | 'flat'


export const laugh = scene({
  id: 'laugh',
  at: 0,
  end: cue('scene.s2.start'),
  blur: { samples: 6, shutter: 0.7, when: [[E.whip, cue('scene.s2.start')]] },
  mount(ctx) {
    const svg = stageSvg(ctx.root, C.mustard)
    const world = s(svg, 'g')
    s(world, 'rect', { x: -3000, y: 790, width: 8000, height: 600, fill: C.mustard })
    s(world, 'line', { x1: -3000, x2: 5000, y1: 790, y2: 790, stroke: C.ink, 'stroke-width': 5 })
    const left = villager(world, 560, C.ink)
    const right = villager(world, 520, C.navy)
    const ae = elder(world, 230)
    const ELDER = { ...BODY, eyes: 'flat' as ElderEyes, open: 0, hat: 0 }
    const FACE = { ...BODY, brow: 0, up: 0 }
    return { world, left, right, ae, ELDER, FACE, at: said(ctx, 's1', '笑'), end: start('s2') }
  },
  render(f, st) {
    const t = f.t
    const whip = seg(t, st.end - WHIP, st.end, inCubic)
    camera(st.world, { x: 720 + whip * 1400, y: 560, zoom: 1 + 0.06 * seg(t, 0, st.end) })
    // A chuckle: three quick squashes with the mouth open, the hat bobbing.
    const k = t - st.at
    const chuckle = k > 0 && k < 1.1 ? Math.abs(Math.sin(k * Math.PI * 3 / 1.1)) * (1 - k / 1.1) : 0
    st.ae.set(pose({ ...st.ELDER, x: 720, y: 790 },
      { mode: 'replace', w: t > st.at - 0.2 ? 1 : 0, v: { eyes: 'happy' } },
      { mode: 'add', w: chuckle, v: { sx: 0.12, sy: -0.11, hat: 12 } },
      { mode: 'replace', w: chuckle > 0.05 ? 1 : 0, v: { open: 1 } },
      blink(t, 5)))
    st.left.set(pose({ ...st.FACE, x: 360, y: 798, look: 1, brow: -0.4 }, blink(t, 1)))
    st.right.set(pose({ ...st.FACE, x: 1090, y: 798, look: -1, brow: 0.5 }, blink(t, 2)))
  },
})

/** The monitor, top right of the point shot (the strip at 0.24 of its size). */
const MON: Rect = { x: 960, y: 70, w: W * 0.24, h: H * 0.24 }
/** The point shot's camera: whip in, then a slow push toward the monitor. */
const cam = (t: number, t0: number, at: number): Cam => {
  const whipIn = 1 - seg(t, t0, t0 + WHIP, outCubic)
  const push = seg(t, at, at + 3, outCubic)
  return { x: 720 - whipIn * 1400 + push * 90, y: 540 - push * 50, zoom: 1 + 0.1 * push }
}

export const point = scene({
  id: 'point',
  at: cue('scene.s2.start'),
  end: cue('scene.s3.start'),
  blur: { samples: 6, shutter: 0.7, when: [[cue('scene.s2.start'), E.whip + 2 * WHIP]] },
  mount(ctx) {
    const svg = stageSvg(ctx.root, C.paper)
    const world = s(svg, 'g')
    s(world, 'line', { x1: -3000, x2: 5000, y1: 640, y2: 640, stroke: C.ink, 'stroke-width': 4 })
    const trio = crowd(world, 3, { x0: 600, x1: 840, y: 640, h: [96, 120], seed: 2, colors: [C.navy, C.cobalt, C.navy] })
    const at = E.point
    const t0 = start('s2')
    // The monitor plays the same strip (another instance of `cards`), placed through this shot's camera.
    ctx.comp(cards, { id: 'monitor', params: { stutter: true }, time: clock.loop({ start: T0, length: LENGTH }), rect: (f) => compRect(cam(f.t, t0, at), STAGE, MON), fit: 'stretch' })
    const front = stageSvg(ctx.root)
    const fworld = s(front, 'g')
    s(fworld, 'rect', { x: MON.x - 6, y: MON.y - 6, width: MON.w + 12, height: MON.h + 12, fill: 'none', stroke: C.ink, 'stroke-width': 12 })
    const ae = elder(fworld, 380)
    return { world, fworld, trio, ae, at, t0, ELDER: { ...BODY, eyes: 'happy' as ElderEyes, open: 0, hat: 0 }, FACE: { ...BODY, brow: 0, up: 0 } }
  },
  render(f, st) {
    const t = f.t
    const c = cam(t, st.t0, st.at)
    camera(st.world, c)
    camera(st.fworld, c)
    // The point: a small hop, the body leans and the diamond swings toward the monitor, and stays.
    const aim = envelope(t, st.at, { in: 0.38, hold: Infinity, out: 0 }, VILLAGE)
    st.ae.set(pose({ ...st.ELDER, x: 250, y: 1150 },
      { mode: 'add', w: aim, v: { rot: 7, look: 0.9, hat: -35 } },
      { mode: 'replace', w: aim > 0.5 ? 1 : 0, v: { eyes: 'one' } },
      hop(t, st.at - 0.15, { height: 40, dur: 0.35, stretch: 0.08 }),
      blink(t, 5)))
    st.trio.forEach((v, i) => v.v.set(pose({ ...st.FACE, x: v.x, y: v.y, look: 1 }, { mode: 'blend', w: seg(t, st.at + 0.2 + i * 0.1, st.at + 0.5 + i * 0.1), v: { up: 1 } }, blink(t, v.seed))))
  },
})
