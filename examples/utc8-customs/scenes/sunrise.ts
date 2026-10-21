// s16: out of the booth window the time zones stand as bands; the sun rises in the UTC+8 band and
// the queue runs from under the window to the horizon. Claude, from behind, watches. The first
// traveler of the day pops up at the sill: "Hello，在吗？" — black — the title, stamped.
import { scene } from '@cueframe/core'
import { mix } from '../../../kits/materials.js'
import {
  C, JOST, SANS, SERIF, bubble, camera, inOutCubic, lerp, mulberry, officer, outBack, outCubic, paperShape, s, seg, stageSvg, stampMark, text,
  traveler, type Disguise,
} from '../lib.js'
import { K, SHOT } from '../timing.js'

const HORIZON = 560
const TOP = 180
const ZONES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export const sunrise = scene({
  id: 'sunrise',
  at: SHOT.s16[0],
  end: SHOT.s16[1],
  mount(ctx) {
    const svg = stageSvg(ctx, C.sky)
    const world = s(svg, 'g')
    const sky = s(world, 'rect', { x: -400, y: -400, width: 2720, height: HORIZON + 400, fill: C.sky })
    const x8 = 960
    ZONES.forEach((z) => {
      const x = x8 + (z - 8) * 120
      if (z === 8) return
      s(world, 'line', { x1: x, x2: x, y1: TOP + 16, y2: HORIZON, stroke: C.ink, 'stroke-width': 2, opacity: 0.25 })
      text(world, x, TOP, `UTC+${z}`, { size: 22, font: JOST, weight: 500, fill: C.ink, anchor: 'middle', spacing: 1 })
    })
    s(world, 'rect', { x: x8 - 60, y: TOP + 16, width: 120, height: HORIZON - TOP - 16, fill: C.mustard, opacity: 0.55 })
    text(world, x8, TOP + 2, 'UTC+8', { size: 30, font: JOST, weight: 700, fill: C.red, anchor: 'middle', spacing: 2 })
    const sun = s(world, 'g')
    paperShape(sun, { circle: { cx: 0, cy: 0, r: 150 } }, C.red)
    s(world, 'rect', { x: -400, y: HORIZON, width: 2720, height: 800, fill: '#C9B98F' })
    s(world, 'line', { x1: -400, x2: 2320, y1: HORIZON, y2: HORIZON, stroke: C.ink, 'stroke-width': 4 })
    // The queue in perspective: equal steps on the ground, so size falls as 1/z.
    const rnd = mulberry(8)
    const kinds: Disguise[] = ['kevin', 'tanaka', 'lim', 'dev', 'mike']
    const queue = Array.from({ length: 40 }, (_, i) => {
      const z = 1 + i * 0.55
      const y = HORIZON + (900 - HORIZON) / z
      const h = 230 / z
      const x = x8 + (430 - x8) / z + (rnd() - 0.5) * h * 0.25
      return { x, y, h, v: traveler(world, kinds[i % 5]!, h) }
    }).reverse()
    queue.forEach((q) => world.append(q.v.g))
    // The first traveler rises behind the sill; the window frame, the sill and Claude in front.
    const frame = s(svg, 'g')
    const first = traveler(frame, 'kevin', 380)
    s(frame, 'path', { d: `M0 0 H1920 V1080 H0 Z M150 110 H1770 V880 H150 Z`, fill: C.navy, 'fill-rule': 'evenodd' })
    s(frame, 'rect', { x: 0, y: 880, width: 1920, height: 200, fill: C.navy })
    paperShape(frame, { rect: { x: 100, y: 860, w: 1720, h: 34 } }, C.mustard, { edge: 'cut' })
    const back = officer(frame, 300)
    const hello = bubble(frame, 'Hello，在吗？', { size: 56 })
    // The end: black, then the title card stamped on paper.
    const end = s(svg, 'g')
    const black = s(end, 'rect', { width: 1920, height: 1080, fill: C.ink })
    const title = s(end, 'g')
    s(title, 'rect', { width: 1920, height: 1080, fill: C.paper })
    text(title, 960, 470, '东八区海关', { size: 168, font: SERIF, weight: 900, anchor: 'middle', spacing: 24 })
    text(title, 960, 560, 'UTC+8 CUSTOMS', { size: 40, font: JOST, weight: 700, fill: C.navy, anchor: 'middle', spacing: 18 })
    const mark = stampMark(title, 0.9, 77)
    text(title, 960, 860, '本片纯属虚构。如有雷同，那就是你。', { size: 34, font: SANS, weight: 900, fill: C.grey, anchor: 'middle', spacing: 3 })
    return { world, sky, sun, queue, back, first, hello, x8, black, title, mark }
  },
  render(f, st) {
    const t = f.t
    const k = seg(t, K.rise, K.rise + 8, inOutCubic)
    st.sun.setAttribute('transform', `translate(${st.x8} ${lerp(HORIZON + 160, 300, k).toFixed(1)})`)
    st.sky.setAttribute('fill', mix('#E9D3B0', C.sky, k))
    camera(st.world, { x: 960, y: 540 - 30 * seg(t, SHOT.s16[0], K.helloLast, outCubic), zoom: 1 + 0.05 * seg(t, SHOT.s16[0], K.helloLast) })
    st.queue.forEach((q, i) => q.v.set({ x: q.x, y: q.y - Math.max(0, Math.sin(t * 4 + i)) * q.h * 0.02, look: 0 }))
    st.back.set({ x: 1560, y: 1150, back: true, sx: -1 })
    const up = seg(t, K.helloLast - 0.6, K.helloLast - 0.2, outBack)
    st.first.set({ x: 560, y: 900 + 460 * (1 - up), look: 1, o: t > K.helloLast - 0.6 ? 1 : 0 })
    const b = seg(t, K.helloLast, K.helloLast + 0.2, outBack)
    st.hello.set({ x: 640, y: 540, o: b > 0 && t < K.black ? 1 : 0, s: Math.max(0.001, b) })
    st.black.style.opacity = t >= K.black ? '1' : '0'
    st.title.style.opacity = String(seg(t, K.title - 0.5, K.title - 0.1))
    st.mark.set({ x: 1440, y: 650, rot: -12, s: t >= K.title ? 1 + 0.25 * (1 - seg(t, K.title, K.title + 0.12)) : 1, o: t >= K.title ? 1 : 0 })
  },
})
