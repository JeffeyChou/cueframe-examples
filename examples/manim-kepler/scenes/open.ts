// Shot 0: the orbit in 3D. Equal-time sectors tile the ellipse; the camera then flattens to the
// top view, whose grid lines up with the flat shots' plane.
import { cue, scene } from '@cueframe/core'
import { chain, CUES, fade, said, seg } from '../lib.js'
import { kepler, type V2 } from '../orbit.js'
import { A, E, PERIOD, toWorld, world } from '../world3d.js'

const N = 12
const DT = PERIOD / N

export default scene({
  id: 'open',
  at: cue('scene.k1.start'),
  end: cue('scene.i1.start', { offset: 1.0 }),
  holds: [{ id: 'kepler', at: CUES['scene.k4.end']! - 0.2 - CUES['scene.k1.start']! }],
  async mount(ctx) {
    const w = world(ctx, 'orbit', N)
    const T = {
      in: CUES['scene.k1.start']!,
      draw: said(ctx, 'k1', '开普勒'),
      move: said(ctx, 'k2', '行星'),
      sweep: said(ctx, 'k3', '相同的时间'),
      equal: said(ctx, 'k3', '永远相等'),
      flat: said(ctx, 'k4', '七十年后'),
      newton: said(ctx, 'k4', '三角形'),
      out: CUES['scene.i1.start']!,
    }
    // One orbit of sectors from the first sector boundary after `sweep`.
    const rate = PERIOD / 11
    const tauAt = (t: number) => Math.max(0, t - T.move) * rate
    const first = Math.ceil(tauAt(T.sweep) / DT)
    const f0 = await chain(ctx, ctx.root, [String.raw`\Delta t_1 = \Delta t_2`, String.raw`\gold{\Delta A_1} = \gold{\Delta A_2}`], [T.sweep, T.equal], { x: 1560, y: 150, size: 64, align: 'center' })
    return { w, T, rate, tauAt, first, f0, p: [0, 0] as V2 }
  },
  render(f, s) {
    const { w, T } = s
    const t = f.t
    // Camera: a slow drift, then down to the top view with a narrowing lens.
    const k = seg(t, T.flat, T.newton + 1.2)
    w.view({ el: 30 + 60 * k, az: -24 + 18 * seg(t, T.in, T.flat) + 6 * k, fov: 40 - 26 * k })

    const vis = fade(t, T.in, T.out + 1.0, 1.0)
    const leave = 1 - seg(t, T.out - 0.4, T.out + 0.8)
    w.mats.grid.opacity = 0.16 * vis
    w.mats.major.opacity = 0.32 * vis
    const draw = seg(t, T.draw, T.draw + 3.2)
    w.orbit.geometry.instanceCount = Math.max(0, Math.round(draw * 360))
    w.orbit.visible = draw > 0 && leave > 0
    w.mats.orbit.opacity = leave

    const tau = s.tauAt(t)
    const pos = kepler(A, E, tau)
    toWorld(pos, w.planet.position)
    w.planet.visible = t >= T.draw + 2.6 && leave > 0
    w.planet.scale.setScalar(seg(t, T.draw + 2.6, T.draw + 3.2) || 0.0001)
    w.sun.visible = vis > 0
    w.sun.scale.setScalar(Math.max(0.0001, seg(t, T.in + 0.3, T.in + 1.5)))

    const cur = Math.floor(tau / DT)
    w.sectors.forEach((m, i) => {
      // Sector i (mod N) is done once its interval has passed during the sweep orbit.
      const idx = s.first + ((i - (s.first % N) + N) % N)
      m.visible = cur > idx && idx < s.first + N && leave > 0
      ;(m.material as { opacity: number }).opacity = (idx % 2 ? 0.22 : 0.42) * leave
    })
    const sweeping = cur >= s.first && cur < s.first + N
    w.sweep(cur, sweeping ? tau / DT - cur : 0, leave)
    w.render()

    s.f0.render(t, leave * seg(t, T.sweep, T.sweep + 0.4))
  },
})
