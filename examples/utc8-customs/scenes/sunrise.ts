// s16: out of the booth window the time zones stand as bands; the sun rises in the UTC+8 band and
// the queue runs from under the window to the horizon. Claude, from behind, watches.
import { cue, scene } from '@cueframe/core'
import { C, JOST, camera, inOutCubic, lerp, mulberry, officer, outCubic, paperShape, s, seg, stageSvg, start, text, traveler, type Disguise } from '../lib.js'

const HORIZON = 560
const TOP = 180
const ZONES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export const sunrise = scene({
  id: 's16',
  at: cue('scene.s16.start'),
  end: cue('scene.s16.end'),
  mount(ctx) {
    const svg = stageSvg(ctx, C.sky)
    const world = s(svg, 'g')
    const sky = s(world, 'rect', { x: -400, y: -400, width: 2720, height: HORIZON + 400, fill: C.sky })
    // Time-zone bands: thin rules, labels along the top; UTC+8 a wide mustard band.
    const x8 = 960
    ZONES.forEach((z) => {
      const x = x8 + (z - 8) * 120
      if (z === 8) return
      s(world, 'line', { x1: x, x2: x, y1: TOP + 16, y2: HORIZON, stroke: C.ink, 'stroke-width': 2, opacity: 0.25 })
      text(world, x, TOP, `UTC${z < 0 ? '−' : '+'}${Math.abs(z)}`, { size: 22, font: JOST, weight: 500, fill: C.ink, anchor: 'middle', spacing: 1 })
    })
    s(world, 'rect', { x: x8 - 60, y: TOP + 16, width: 120, height: HORIZON - TOP - 16, fill: C.mustard, opacity: 0.55 })
    text(world, x8, TOP + 2, 'UTC+8', { size: 30, font: JOST, weight: 700, fill: C.red, anchor: 'middle', spacing: 2 })
    const sun = s(world, 'g')
    paperShape(sun, { circle: { cx: 0, cy: 0, r: 150 } }, C.red)
    // Ground: a flat plain with the queue receding to the sun.
    s(world, 'rect', { x: -400, y: HORIZON, width: 2720, height: 800, fill: '#C9B98F' })
    s(world, 'line', { x1: -400, x2: 2320, y1: HORIZON, y2: HORIZON, stroke: C.ink, 'stroke-width': 4 })
    const rnd = mulberry(8)
    const kinds: Disguise[] = ['kevin', 'tanaka', 'lim', 'dev', 'mike']
    // The queue: from the foreground left, under the window sill, to the vanishing point under the sun.
    // Perspective: equal steps on the ground, so depth z grows and size falls as 1/z.
    const queue = Array.from({ length: 40 }, (_, i) => {
      const z = 1 + i * 0.55
      const y = HORIZON + (900 - HORIZON) / z
      const h = 230 / z
      const x = x8 + (430 - x8) / z + (rnd() - 0.5) * h * 0.25
      return { x, y, h, v: traveler(world, kinds[i % 5]!, h) }
    }).reverse()
    queue.forEach((q) => world.append(q.v.g))
    // The window frame and the counter in the foreground; Claude seen from behind at the right.
    const frame = s(svg, 'g')
    s(frame, 'path', { d: `M0 0 H1920 V1080 H0 Z M150 110 H1770 V880 H150 Z`, fill: C.navy, 'fill-rule': 'evenodd' })
    s(frame, 'rect', { x: 0, y: 880, width: 1920, height: 200, fill: C.navy })
    paperShape(frame, { rect: { x: 100, y: 860, w: 1720, h: 34 } }, C.mustard, { edge: 'cut' })
    const back = officer(frame, 300)
    const t0 = start('s16')
    return { world, sky, sun, queue, back, t0, x8, rise: t0 + 0.5 }
  },
  render(f, st) {
    const t = f.t
    // The sun climbs out of the horizon inside its band; the sky warms with it.
    const k = seg(t, st.rise, st.rise + 9, inOutCubic)
    st.sun.setAttribute('transform', `translate(${st.x8} ${lerp(HORIZON + 160, 300, k).toFixed(1)})`)
    st.sky.setAttribute('fill', k < 0.5 ? '#E9D9B8' : C.sky)
    camera(st.world, { x: 960, y: 540 - 30 * seg(t, st.t0, st.t0 + 12, outCubic), zoom: 1 + 0.05 * seg(t, st.t0, st.t0 + 12) })
    st.queue.forEach((q, i) => q.v.set({ x: q.x, y: q.y + Math.max(0, Math.sin(t * 4 + i)) * -q.h * 0.02, look: 0 }))
    st.back.set({ x: 1560, y: 1150, back: true, sx: -1 })
  },
})
