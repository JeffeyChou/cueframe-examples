// s3–s6: the strip fills the frame (s3), a red ring marks card 3 while the crowd looks up (s4), the
// camera pulls out through the screen to the stage where Claude is about to speak (s5), and the
// narrator rushes on (s6), motion-blurred only while it rushes. The strip is an instance of the
// `cards` composition placed on the screen through the camera; the ring finds card 3 by its anchor.
import { clock, cue, scene, type Frame, type MountContext } from '@cueframe/core'
import {
  BODY, C, H, STAGE, VILLAGE, W, ball, blink, bump, camPath, camera, claude, compRect, crowd, envelope, flinch, hop, look, outBack, outCubic,
  pose, said, s, seg, squashed, stageSvg, start,
} from '../lib.js'
import { cards, LENGTH } from './strip.js'
import { T as E } from '../timing.js'

export const T0 = 7.62          // strip clock zero: the 2 → 3 stutter lands just after s3 starts
const SCREEN = { x: 540, y: 150, w: 360, h: 270 }   // the strip's W×H frame, scaled by 1/4
const K = SCREEN.w / W
const GROUND = 690

function times(ctx: MountContext) {
  return {
    s3: start('s3'), ring: said(ctx, 's3', '镜头'), look: said(ctx, 's4', '看了'), shrug: said(ctx, 's4', '确实'), bad: said(ctx, 's4', '不太顺'),
    out: start('s5') + 0.2, speak: said(ctx, 's5', '开口'), rush: E.rush, land: E.land, end: start('s7'),
  }
}

/** The camera: the screen fills the frame, then pull out to the stage; a small push as the narrator lands. */
const cameraOf = (T: ReturnType<typeof times>) => camPath([
  { t: T.s3, x: SCREEN.x + SCREEN.w / 2, y: SCREEN.y + SCREEN.h / 2, zoom: 1 / K },
  { t: T.out },
  { t: T.out + 2.4, x: 720, y: 450, zoom: 1.45 },
  { t: T.rush },
  { t: T.land + 0.9, y: 500, zoom: 1.7, ease: outCubic },
])

function build(ctx: MountContext) {
  const T = times(ctx)
  const cam = cameraOf(T)
  // Back: villagers on the horizon, the posts. Then the strip, playing on the screen. Front: its frame,
  // Claude behind the lectern, the narrator, the ring, the foreground crowd.
  const svg = stageSvg(ctx, C.paper)
  const world = s(svg, 'g')
  const back = crowd(world, 26, { x0: -300, x1: 1740, y: GROUND, h: [60, 96], seed: 4, spread: 14 })
  s(world, 'line', { x1: -2000, x2: 3400, y1: GROUND, y2: GROUND, stroke: C.ink, 'stroke-width': 4 })
  for (const x of [SCREEN.x + 40, SCREEN.x + SCREEN.w - 40]) s(world, 'rect', { x: x - 5, y: SCREEN.y + SCREEN.h, width: 10, height: 200, fill: C.ink })
  const film = ctx.comp(cards, {
    id: 'screen', params: { stutter: true }, time: clock.loop({ start: T0, length: LENGTH }),
    rect: (f) => compRect(cam(f.t), STAGE, SCREEN), fit: 'stretch',
  })
  const front = stageSvg(ctx)
  const fworld = s(front, 'g')
  s(fworld, 'rect', { x: SCREEN.x - 5, y: SCREEN.y - 5, width: SCREEN.w + 10, height: SCREEN.h + 10, fill: 'none', stroke: C.ink, 'stroke-width': 10 })
  const cl = claude(fworld, 76)
  s(fworld, 'rect', { x: 600, y: 560, width: 240, height: GROUND - 560, fill: C.ink })
  const me = ball(fworld, 34)
  // The ring around card 3, in stage px where the strip says card 3 is; clipped to the screen.
  const clip = s(s(front, 'defs'), 'clipPath', { id: ctx.id('screen') })
  const clipRect = s(clip, 'rect', {})
  const ringG = s(front, 'g', { 'clip-path': `url(#${clip.id})` })
  const ring = [0, 1].map((i) => s(ringG, 'ellipse', { cx: 0, cy: 0, rx: 300 + i * 22, ry: 270 + i * 18, fill: 'none', stroke: C.red, 'stroke-width': 14 - i * 5, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }))
  // Foreground crowd: a layer of its own, anchored to the frame's bottom edge.
  const fgLayer = s(front, 'g')
  const fg = crowd(fgLayer, 11, { x0: -60, x1: 1500, y: H + 30, h: [150, 220], seed: 9, colors: [C.ink, C.ink, C.navy, C.ink], spread: 30 })
  const FACE = { ...BODY, brow: 0, up: 0 }
  return { times: T, cam, world, fworld, film, ring, ringG, clipRect, cl, me, back, fgLayer, front: fg, FACE }
}
type S = ReturnType<typeof build>

function draw(f: Frame, st: S) {
  const T = st.times
  const t = f.t
  const cam = st.cam(t)
  camera(st.world, cam)
  camera(st.fworld, cam)
  // Ring: drawn on as the voice says "镜头", a second stroke and a pulse on "不太顺"; it sits where the
  // strip instance says card 3 is, at the strip's scale on stage.
  const scr = compRect(cam, STAGE, SCREEN)
  for (const [k, v] of Object.entries({ x: scr.x, y: scr.y, width: scr.w, height: scr.h })) st.clipRect.setAttribute(k, v.toFixed(2))
  const c3 = st.film.map(f, 'card3')
  const pulse = 1 + 0.05 * bump(t, T.bad, 0.35)
  st.ringG.style.visibility = c3.visible ? 'visible' : 'hidden'
  st.ring.forEach((r, i) => {
    const on = seg(t, T.ring + i * 0.25, T.ring + 0.7 + i * 0.25, outCubic)
    r.setAttribute('stroke-dashoffset', String(1 - on))
    r.setAttribute('opacity', String(1 - seg(t, T.out, T.out + 0.6)))
    r.setAttribute('transform', `translate(${c3.x.toFixed(2)} ${c3.y.toFixed(2)}) scale(${(pulse * scr.w / W).toFixed(5)})`)
  })
  // Foreground crowd: hidden below the frame while zoomed in, rises and looks up on "看了过去".
  const rise = 1 - seg(t, T.look - 0.3, T.look + 0.5, outBack)
  // Anchored to the frame's bottom edge and scaled by zoom^0.3: not a parallax layer (parallax() scales
  // about the stage centre and follows the camera, which pushes the crowd out of the frame).
  const fs = cam.zoom ** 0.3
  st.fgLayer.setAttribute('transform', `translate(${W / 2} ${H + 260 * rise}) scale(${fs.toFixed(4)}) translate(${-W / 2} ${-H})`)
  const lookUp = seg(t, T.look, T.look + 0.3)
  st.front.forEach((v, i) => st.front[i]!.v.set(pose({ ...st.FACE, x: v.x, y: v.y, look: v.face * 0.6 },
    { mode: 'blend', w: lookUp, v: { look: 0, up: 1 } },
    hop(t, T.look + 0.04 * i, { height: 18, dur: 0.3, stretch: 0 }),
    { mode: 'add', w: bump(t, T.shrug + 0.05 * (i % 4), 0.4), v: { y: -10, brow: -0.6 } },
    blink(t, v.seed))))
  st.back.forEach((v) => v.v.set(pose({ ...st.FACE, x: v.x, y: v.y, look: Math.max(-1, Math.min(1, (720 - v.x) / 800)), up: 0.4 },
    look(t, T.rush, { x: -1, y: 0, in: 0.12 }),
    blink(t, v.seed))))
  // Claude: leans in to speak (the rush is the lean's release), flinches at the landing, looks after the narrator.
  const fl = flinch(t, T.land, { dir: -1 })
  st.cl.set(pose({ ...BODY, x: 720, y: 594, eyes: 'line' as 'line' | 'wide' },
    { mode: 'add', w: envelope(t, T.speak - 0.35, { in: 0.35, hold: T.rush - T.speak, out: 0.15 }), v: { y: -10, sx: -0.05, sy: 0.05 } },
    fl,
    { mode: 'replace', w: (fl.w as number) > 0.2 ? 1 : 0, v: { eyes: 'wide' } },
    look(t, T.rush, { x: -0.8, y: 0, in: 0.12 }),
    blink(t, 3)))
  // Narrator: zips in from the left, stretched by speed, lands in front of the lectern with a squash.
  const run = seg(t, T.rush - 0.3, T.land, outCubic)
  const speed = t >= T.rush - 0.3 && run < 1 ? 1 - run : 0
  st.me.set(pose({ ...BODY, x: -120 + run * 840, y: GROUND, look: 0.6, o: run > 0 ? 1 : 0, eyes: 'line' as const },
    { mode: 'add', w: speed, v: { sx: -0.35, sy: 0.35, rot: 8 } },
    squashed(t, T.land, { q: 0.25, dur: 0.3 }, VILLAGE)))
}

export const stage = scene({
  id: 'stage',
  at: cue('scene.s3.start'),
  end: cue('scene.s7.start'),
  blur: { samples: 6, shutter: 0.6, when: [[E.rush - 0.3, E.land + 0.3]] },
  mount: build,
  render: draw,
})
