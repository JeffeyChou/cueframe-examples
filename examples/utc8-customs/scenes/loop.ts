// s13: the camera pulls out from the booth to a cross-section of the building: the hall above, a back
// corridor below. Stamped travelers leave by the exit, go down, pass the hat stall ("帽子 · 租"),
// change disguise and climb back to the end of the queue. The camera rides with Kevin: cowboy hat in,
// kimono out. A red loop arrow draws itself over the route.
import { scene } from '@cueframe/core'
import {
  BOOTH, C, JOST, SANS, booth, camPath, officer, camera, inOutCubic, outCubic, paperShape, s, seg, stageSvg, text, traveler, type Disguise,
} from '../lib.js'
import { K, SHOT } from '../timing.js'

const UP = 520          // the hall floor
const DOWN = 960        // the corridor floor
const H = 170           // traveler height in the wide shot
/** The route: counter → exit → down → along the corridor past the stall → up → the queue's end. */
const ROUTE = [
  { x: 1140, y: UP }, { x: 1680, y: UP }, { x: 1800, y: DOWN }, { x: 900, y: DOWN }, { x: 160, y: DOWN }, { x: 60, y: UP }, { x: 260, y: UP },
]
const STALL = 900
const lens = ROUTE.slice(1).map((p, i) => Math.hypot(p.x - ROUTE[i]!.x, p.y - ROUTE[i]!.y))
const TOTAL_LEN = lens.reduce((a, b) => a + b, 0)
/** Where along the route (0..1) a point is, and the point at a fraction. */
function at(u: number) {
  let d = Math.min(1, Math.max(0, u)) * TOTAL_LEN
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]! || i === lens.length - 1) {
      const a = ROUTE[i]!, b = ROUTE[i + 1]!, k = Math.min(1, d / lens[i]!)
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dir: Math.sign(b.x - a.x) || 1 }
    }
    d -= lens[i]!
  }
  return { ...ROUTE[ROUTE.length - 1]!, dir: 1 }
}
const U_STALL = (lens[0]! + lens[1]! + (ROUTE[2]!.x - STALL)) / TOTAL_LEN

export const loop = scene({
  id: 'loop',
  at: SHOT.s13[0],
  end: SHOT.s13[1],
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    const world = s(svg, 'g')
    // The building in section: hall floor slab, corridor, stairs, walls.
    s(world, 'rect', { x: -600, y: UP + 30, width: 3200, height: DOWN - UP - 30, fill: '#CDBF9F' })
    s(world, 'rect', { x: -600, y: DOWN, width: 3200, height: 600, fill: C.floor })
    paperShape(world, { rect: { x: 0, y: UP, w: 1700, h: 40 } }, C.navy)
    s(world, 'line', { x1: -600, x2: 2600, y1: DOWN, y2: DOWN, stroke: C.ink, 'stroke-width': 5 })
    // Two flights of stairs as stepped solids: down at the exit, up at the queue's end.
    for (const [x0, x1] of [[1700, 1830], [180, 30]] as const) {
      const n = 9, dx = (x1 - x0) / n, dy = (DOWN - UP - 40) / n
      let d = `M${x0} ${UP + 40}`
      for (let k = 0; k < n; k++) d += ` V${UP + 40 + (k + 1) * dy} H${x0 + (k + 1) * dx}`
      d += ` V${DOWN} H${x0} Z`
      paperShape(world, d, '#B7A782')
    }
    text(world, 1690, UP - 230, 'EXIT · 出口', { size: 34, font: JOST, weight: 700, fill: C.red, anchor: 'middle', spacing: 3 })
    text(world, 260, UP - 230, '队尾 · END OF QUEUE', { size: 30, font: SANS, weight: 900, fill: C.navy, anchor: 'middle', spacing: 2 })
    // The hat stall in the corridor.
    const stall = s(world, 'g')
    paperShape(stall, { rect: { x: STALL - 170, y: DOWN - 230, w: 340, h: 230 } }, C.mustard)
    paperShape(stall, { rect: { x: STALL - 200, y: DOWN - 290, w: 400, h: 60 } }, C.red)
    text(stall, STALL, DOWN - 248, '帽子 · 租', { size: 36, font: SANS, weight: 900, fill: C.cream, anchor: 'middle', spacing: 6 })
    // A rack of disguises: cowboy hats, Merlion caps, NY caps, kimonos (as small swatches).
    ;[C.mustard, C.cream, C.navy, C.red].forEach((c, i) => {
      paperShape(stall, { ellipse: { cx: STALL - 110 + i * 74, cy: DOWN - 150, rx: 30, ry: 16 } }, c === C.mustard ? '#C98F22' : c)
      s(stall, 'line', { x1: STALL - 110 + i * 74, x2: STALL - 110 + i * 74, y1: DOWN - 134, y2: DOWN - 60, stroke: C.ink, 'stroke-width': 3 })
    })
    const b = booth(world)
    b.back.setAttribute('transform', `translate(-60 ${UP - 860}) `)
    b.mid.setAttribute('transform', `translate(-60 ${UP - 860})`)
    b.front.setAttribute('transform', `translate(-60 ${UP - 860})`)
    officer(b.mid, 200).set({ x: 1410, y: BOOTH.counter + 40, look: -1 })
    // The queue, upstairs, facing the booth.
    const kinds: Disguise[] = ['tanaka', 'lim', 'mike', 'dev', 'kevin', 'lim', 'tanaka']
    kinds.forEach((k, i) => traveler(world, k, H).set({ x: 1000 - i * 110, y: UP, look: 1 }))
    // The loop arrow over the route, drawn on.
    const d = ROUTE.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y - H - 40}`).join('')
    const arrow = s(world, 'path', { d, fill: 'none', stroke: C.red, 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': '30 22', opacity: 0.9 })
    const head = s(world, 'path', { d: 'M0 -22 L36 0 L0 22 Z', fill: C.red })
    // Loopers: Kevin (cowboy hat → kimono) leads; two others follow.
    // Quick-footed: the whole loop in a few seconds, one after another.
    const loopers = [
      { a: traveler(world, 'kevin', H), b: traveler(world, 'kevin', H, { kimono: true, hat: false }), start: K.pullOut + 0.6, dur: 3.6 },
      { a: traveler(world, 'lim', H * 0.9), b: traveler(world, 'mike', H * 0.9), start: K.pullOut + 1.3, dur: 3.4 },
      { a: traveler(world, 'tanaka', H), b: traveler(world, 'dev', H), start: K.pullOut + 2.0, dur: 3.5 },
      { a: traveler(world, 'mike', H * 0.9), b: traveler(world, 'lim', H * 0.9), start: K.pullOut + 2.7, dur: 3.4 },
      { a: traveler(world, 'dev', H), b: traveler(world, 'tanaka', H), start: K.pullOut + 3.4, dur: 3.5 },
    ]
    const cam = camPath([
      { t: SHOT.s13[0], x: 900, y: UP - 320, zoom: 1.0 },
      { t: K.pullOut },
      { t: K.pullOut + 1.0, x: 940, y: 600, zoom: 0.92, ease: inOutCubic },
      { t: SHOT.s13[1], x: 960, y: 610, zoom: 0.9 },
    ])
    return { world, arrow, head, loopers, cam, len: (arrow as SVGPathElement).getTotalLength() }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, st.cam(t))
    st.loopers.forEach((l) => {
      const u = seg(t, l.start, l.start + l.dur)
      const p = at(u)
      const step = u > 0 && u < 1 ? Math.abs(Math.sin(t * 20)) * 10 : 0
      const swapped = u >= U_STALL
      const pose = { x: p.x, y: p.y - step, sx: p.dir, look: p.dir, o: u > 0 && u < 1 ? 1 : u >= 1 ? 1 : 0 }
      l.a.set({ ...pose, o: swapped ? 0 : pose.o })
      l.b.set({ ...pose, o: swapped ? pose.o : 0 })
    })
    const k = seg(t, K.pullOut + 0.8, K.pullOut + 2.2, outCubic)
    st.arrow.setAttribute('stroke-dashoffset', '0')
    st.arrow.style.opacity = String(Math.min(0.9, k * 3))
    st.arrow.style.clipPath = ''
    const shown = st.len * k
    st.arrow.setAttribute('stroke-dasharray', `${shown.toFixed(1)} ${st.len.toFixed(1)}`)
    const tip = (st.arrow as SVGPathElement).getPointAtLength(Math.max(0.1, shown))
    const before = (st.arrow as SVGPathElement).getPointAtLength(Math.max(0, shown - 4))
    const ang = Math.atan2(tip.y - before.y, tip.x - before.x) * 180 / Math.PI
    st.head.setAttribute('transform', `translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)}) rotate(${ang.toFixed(1)})`)
    st.head.style.opacity = k > 0 ? '1' : '0'
  },
})
