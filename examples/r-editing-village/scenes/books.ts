// s7–s8: "this chance I waited for too long" — the narrator alone, then every tool it had to learn
// drops onto a tower above it, the camera climbing with the stack and pulling out to show it whole.
import { cue, scene } from '@cueframe/core'
import { T } from '../timing.js'
import { C, SERIF, ball, blink, bump, camera, inCubic, mulberry, outCubic, said, s, seg, squash, stageSvg, start, end } from '../lib.js'

const GROUND = 930
const BH = 84
const BOOKS: [string, string][] = [
  ['After Effects', C.navy], ['Cinema 4D', C.orange], ['Blender', C.ink], ['DaVinci Resolve', C.navy],
  ['Premiere Pro', C.orange], ['Houdini', C.ink], ['Nuke', C.navy], ['Fusion', C.orange],
]

export const books = scene({
  id: 'books',
  at: cue('scene.s7.start'),
  end: cue('scene.s9.start'),
  mount(ctx) {
    const svg = stageSvg(ctx.root, C.paper)
    const world = s(svg, 'g')
    s(world, 'line', { x1: -3000, x2: 5000, y1: GROUND, y2: GROUND, stroke: C.ink, 'stroke-width': 5 })
    const rnd = mulberry(17)
    const stack = BOOKS.map(([name, fill], i) => {
      const w = 560 + rnd() * 160
      const g = s(world, 'g')
      s(g, 'rect', { x: -w / 2, y: -BH, width: w, height: BH, fill })
      s(g, 'rect', { x: -w / 2, y: -BH, width: w, height: 7, fill: '#000', opacity: 0.12 })
      s(g, 'text', { x: 0, y: -BH / 2 + 15, 'text-anchor': 'middle', 'font-family': SERIF, 'font-weight': 700, 'font-size': 42, 'letter-spacing': 2, fill: C.cream }, name)
      return { g, x: 820 + (rnd() - 0.5) * 70, rot: (rnd() - 0.5) * 2.4, i }
    })
    const me = ball(world, 40)
    const lands = T.books
    return { world, stack, me, lands, wait: said(ctx, 's7', '太久'), nights: said(ctx, 's8', '夜晚'), t0: start('s7'), t1: end('s8') }
  },
  render(f, st) {
    const t = f.t
    let top = GROUND
    let thud = 0
    st.stack.forEach((b, i) => {
      const land = st.lands[i]!
      const fall = seg(t, land - 0.32, land, inCubic)
      const rest = GROUND - i * BH
      const sq = bump(t, land, 0.22)
      b.g.setAttribute('transform', `translate(${b.x.toFixed(1)} ${(rest - (1 - fall) * 1100).toFixed(1)}) rotate(${(b.rot * fall).toFixed(2)}) scale(${(1 + 0.05 * sq).toFixed(3)} ${(1 - 0.12 * sq).toFixed(3)})`)
      b.g.style.opacity = fall > 0 ? '1' : '0'
      if (t >= land) top = rest - BH
      thud = Math.max(thud, bump(t, land, 0.18) * (i === 0 ? 1.6 : 1))
    })
    // Camera: close on the narrator, climbs with the tower, then pulls back to the whole of it.
    const climb = Math.min(GROUND - 260, top + 140)
    const out = seg(t, st.nights - 0.2, st.nights + 1.4, outCubic)
    const close = Math.min(climb, GROUND - 330 / 1.7)
    const cam = { x: 785 - 25 * out, y: close * (1 - out) + 660 * out, zoom: 1.7 * (1 - out) + 0.95 * out }
    camera(st.world, { ...cam, y: cam.y + thud * 6 })
    // The narrator flinches at every landing, eyes close on "太久", then it looks up at the tower.
    const flinch = Math.max(...st.lands.map((l) => bump(t, l, 0.25)))
    const up = seg(t, st.lands[1]! - 0.3, st.lands[1]!)
    st.me.set({ x: 400, y: GROUND, ...squash(0.18 * flinch), eyes: t > st.wait && t < st.lands[1]! - 0.3 ? 'line' : 'open', lookY: -up, look: 0.4 * up, blink: blink(t, 8) })
    // Rack focus out before the cut.
    const blurPx = 14 * seg(t, st.t1 - 0.25, st.t1 + 0.2)
    st.world.style.filter = blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : 'none'
  },
})
