// s3–s6: the strip fills the frame (s3), a red ring marks card 3 while the crowd looks up (s4), the
// camera pulls out through the screen to the stage where Claude is about to speak (s5), and the
// narrator rushes on (s6), motion-blurred only while it rushes. The strip is an instance of the
// `cards` composition placed on the screen through the camera; the ring finds card 3 by its anchor.
import { clock, cue, scene, type Frame, type MountContext, type Rect } from '@cueframe/core'
import {
  C, H, W, ball, blink, bump, camAt, camera, claude, crowd, outBack, outCubic, said, s, seg, since, squash, stageSvg, start, type Cam,
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
function cameraAt(t: number, T: ReturnType<typeof times>): Cam {
  const full = { x: SCREEN.x + SCREEN.w / 2, y: SCREEN.y + SCREEN.h / 2, zoom: 1 / K }
  return camAt(t, [
    { t: T.s3, ...full },
    { t: T.out, ...full },
    { t: T.out + 2.4, x: 720, y: 450, zoom: 1.45 },
    { t: T.rush, x: 720, y: 450, zoom: 1.45 },
    { t: T.land + 0.9, x: 720, y: 500, zoom: 1.7, ease: outCubic },
  ])
}
/** Where the screen is on stage under the camera (the strip instance's rect). */
const screenOn = (c: Cam): Rect => ({ x: (SCREEN.x - c.x) * c.zoom + W / 2, y: (SCREEN.y - c.y) * c.zoom + H / 2, w: SCREEN.w * c.zoom, h: SCREEN.h * c.zoom })

function build(ctx: MountContext) {
  const T = times(ctx)
  // Back: villagers on the horizon, the posts. Then the strip, playing on the screen. Front: its frame,
  // Claude behind the lectern, the narrator, the ring, the foreground crowd.
  const svg = stageSvg(ctx.root, C.paper)
  const world = s(svg, 'g')
  const back = crowd(world, 26, { x0: -300, x1: 1740, y: GROUND, h: [60, 96], seed: 4, spread: 14 })
  s(world, 'line', { x1: -2000, x2: 3400, y1: GROUND, y2: GROUND, stroke: C.ink, 'stroke-width': 4 })
  for (const x of [SCREEN.x + 40, SCREEN.x + SCREEN.w - 40]) s(world, 'rect', { x: x - 5, y: SCREEN.y + SCREEN.h, width: 10, height: 200, fill: C.ink })
  const film = ctx.comp(cards, {
    id: 'screen', params: { stutter: true }, time: clock.loop({ start: T0, length: LENGTH }),
    rect: (f) => screenOn(cameraAt(f.t, T)), fit: 'stretch',
  })
  const front = stageSvg(ctx.root)
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
  // Foreground crowd: a parallax layer of its own (it scales with zoom^0.3, not with the world).
  const fgLayer = s(front, 'g')
  const fg = crowd(fgLayer, 11, { x0: -60, x1: 1500, y: H + 30, h: [150, 220], seed: 9, colors: [C.ink, C.ink, C.navy, C.ink], spread: 30 })
  return { times: T, world, fworld, film, ring, ringG, clipRect, cl, me, back, fgLayer, front: fg }
}
type S = ReturnType<typeof build>

function draw(f: Frame, st: S) {
  const T = st.times
  const t = f.t
  const cam = cameraAt(t, T)
  camera(st.world, cam)
  camera(st.fworld, cam)
  // Ring: drawn on as the voice says "镜头", a second stroke and a pulse on "不太顺"; it sits where the
  // strip instance says card 3 is, at the strip's scale on stage.
  const scr = screenOn(cam)
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
  const z = cam.zoom
  const rise = 1 - seg(t, T.look - 0.3, T.look + 0.5, outBack)
  const fs = z ** 0.3
  st.fgLayer.setAttribute('transform', `translate(${W / 2} ${H + 260 * rise}) scale(${fs.toFixed(4)}) translate(${-W / 2} ${-H})`)
  const lookUp = seg(t, T.look, T.look + 0.3)
  st.front.forEach((v, i) => {
    const hop = bump(t, T.look + 0.04 * i, 0.3) * 18
    const shrug = bump(t, T.shrug + 0.05 * (i % 4), 0.4) * 10
    v.v.set({ x: v.x, y: v.y - hop - shrug, look: lookUp ? 0 : v.face * 0.6, up: lookUp, brow: shrug ? -0.6 : 0, blink: blink(t, v.seed) })
  })
  st.back.forEach((v) => {
    const toward = t > T.rush ? -1 : (720 - v.x) / 800
    v.v.set({ x: v.x, y: v.y, look: Math.max(-1, Math.min(1, toward)), up: 0.4, blink: blink(t, v.seed) })
  })
  // Claude: settles, leans in to speak, then flinches at the rush.
  const lean = seg(t, T.speak - 0.35, T.speak, outCubic) * (1 - seg(t, T.rush, T.rush + 0.15))
  const flinch = bump(t, T.land, 0.4)
  st.cl.set({ x: 720 + flinch * 6, y: 594 - lean * 10 + flinch * 6, ...squash(-0.05 * lean + 0.08 * flinch), eyes: flinch > 0.2 ? 'wide' : 'line', look: t > T.rush ? -0.8 : 0, blink: blink(t, 3) })
  // Narrator: zips in from the left, stretched by speed, lands in front of the lectern with a squash.
  const run = seg(t, T.rush - 0.3, T.land, outCubic)
  const speed = since(t, T.rush - 0.3) >= 0 && run < 1 ? (1 - run) : 0
  const land = bump(t, T.land, 0.3)
  st.me.set({ x: -120 + run * 840, y: GROUND, ...squash(-0.35 * speed + 0.25 * land), rot: 8 * speed, eyes: 'line', look: 0.6, o: run > 0 ? 1 : 0 })
}

export const stage = scene({
  id: 'stage',
  at: cue('scene.s3.start'),
  end: cue('scene.s7.start'),
  blur: { samples: 6, shutter: 0.6, when: [[E.rush - 0.3, E.land + 0.3]] },
  mount: build,
  render: draw,
})
