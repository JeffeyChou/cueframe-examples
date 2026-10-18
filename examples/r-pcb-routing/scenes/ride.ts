// One panel's ride as a composition: the bus of layer `i` winding between stones, its camera
// following the head. The field scene places ten instances, each on its own clock.
import { composition, scene } from '@cueframe/core'
import { C, LAYERS, W, H, drawWorld, el, inOutCubic, seg, world } from '../lib.js'

export const ride = composition<{ i: number; zoomOut?: [number, number] }>({
  size: { w: W, h: H },
  scenes: (p) => [scene({
    id: 'ride',
    dur: 90,
    mount(ctx) {
      el(ctx.root, 'div', { inset: '0', background: C.bg })
      const L = LAYERS[p.i]!
      return { g: ctx.canvas('world', { frame: true }), w: world(L.seed, L.color, L.hat, { t0: 0, speed: 260 - (p.i % 3) * 20 }) }
    },
    render(f, s) {
      // The hero's camera pulls back on "镜头拉远" (times given in its local clock by the field).
      const zoom = p.zoomOut ? 1 - 0.45 * seg(f.t, p.zoomOut[0], p.zoomOut[1], inOutCubic) : 1
      drawWorld(s.g, s.w, f.t, { x: 0, y: 0, w: W, h: H }, zoom, 7)
    },
  })],
})
