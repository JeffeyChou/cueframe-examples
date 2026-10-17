// Shot 5: back to 3D. r and v span a parallelogram (half of it is the swept area); r × v is an
// arrow normal to the orbit plane that never changes while the planet goes round.
import * as THREE from 'three'
import { cue, scene } from '@cueframe/core'
import { M } from '@cueframe/recipes/manim.js'
import { chain, CUES, fade, label, said, seg } from '../lib.js'
import { kepler, keplerVel, type V2 } from '../orbit.js'
import { A, E, PERIOD, toWorld, world } from '../world3d.js'
import { tauAt, V_SCALE } from './polygon.js'

const IN = CUES['scene.m1.start']!
const OUT = CUES['scene.a1.start']!

export default scene({
  id: 'momentum',
  at: cue('scene.m1.start'),
  end: cue('scene.a1.start', { offset: 1.0 }),
  holds: [{ id: 'momentum', at: CUES['scene.m4.end']! - 0.2 - IN }],
  async mount(ctx) {
    const w = world(ctx, 'momentum', 12)
    w.sectors.forEach((m) => { m.visible = false })
    const T = {
      vec: said(ctx, 'l3', '用矢量来写'),
      rise: said(ctx, 'm1', '三维'),
      para: said(ctx, 'm1', '平行四边形'),
      half: said(ctx, 'm1', '一半'),
      arrow: said(ctx, 'm2', '箭头'),
      cross: said(ctx, 'm2', 'r 叉乘'),
      round: said(ctx, 'm3', '一整圈'),
      never: said(ctx, 'm3', '从来没有变过'),
      plane: said(ctx, 'm4', '同一个平面'),
      flat: said(ctx, 'm4', '轨道是平的'),
    }
    const r = w.arrow(M.white, 0.016)
    const v = w.arrow(M.teal, 0.016)
    const L = w.arrow(M.gold, 0.024)
    const para = w.quad(M.gold, 0.18, 4)
    const tri = w.quad(M.gold, 0.45, 6)
    const sheet = w.quad(M.teal, 0.1, 1)
    const labels = {
      r: await label(ctx, ctx.root, String.raw`\vec r`),
      v: await label(ctx, ctx.root, String.raw`\teal{\vec v}`),
      L: await label(ctx, ctx.root, String.raw`\gold{\vec r \times \vec v}`, { size: 46 }),
    }
    const f = await chain(ctx, ctx.root, [
      String.raw`\gold{\vec L} = m\,\vec r \times \teal{\vec v}`,
      String.raw`\gold{\vec L} = m\,\vec r \times \teal{\vec v} = \text{const}`,
    ], [T.cross, T.never], { x: 1250, y: 150, size: 58 })
    const V = () => new THREE.Vector3()
    return { w, T, r, v, L, para, tri, sheet, labels, f, tmp: { s: toWorld([0, 0]), p: V(), q: V(), sv: V(), top: V(), c: [V(), V(), V(), V()], mid: V(), sheet: [[-7, -7], [7, -7], [7, 7], [-7, 7]].map(([x, z]) => new THREE.Vector3(x, 0.003, z)) } }
  },
  render(fr, s) {
    const t = fr.t
    const { w, T } = s
    const vis = fade(t, IN - 0.2, OUT + 1.0, 0.8)
    const k = seg(t, T.rise, T.rise + 2.6)
    w.view({ el: 90 - 62 * k, az: -40 * k + 14 * seg(t, T.rise + 2.6, OUT + 1), fov: 14 + 26 * k })
    w.mats.grid.opacity = 0.16 * vis
    w.mats.major.opacity = 0.32 * vis
    w.mats.orbit.opacity = vis
    w.sun.visible = vis > 0

    const tau = tauAt(t, T.vec) + PERIOD * seg(t, T.round - 0.6, T.never + 0.6)
    const p: V2 = kepler(A, E, tau)
    const vel = keplerVel(A, E, tau)
    const P = toWorld(p, s.tmp.p)
    const Q = toWorld([p[0] + vel[0] * V_SCALE, p[1] + vel[1] * V_SCALE], s.tmp.q)
    w.planet.position.copy(P)
    w.planet.visible = vis > 0
    const S = s.tmp.s
    s.r.set(S, P, vis)
    s.v.set(P, Q, vis)
    const sv = s.tmp.sv.copy(S).add(Q).sub(P)
    const [c0, c1, c2, c3] = s.tmp.c as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
    c0.copy(S).setY(0.004); c1.copy(P).setY(0.004); c2.copy(Q).setY(0.004); c3.copy(sv).setY(0.004)
    s.para.set([c0, c1, c2, c3], vis * fade(t, T.para, OUT, 0.5))
    s.tri.set([c0, c1, c2], vis * fade(t, T.half, OUT, 0.5))

    // |r × v| is constant, so the arrow length is too (scaled to read well).
    const h = Math.abs(p[0] * vel[1] - p[1] * vel[0])
    const top = s.tmp.top.copy(S).setY(1.15 * h * seg(t, T.arrow - 0.2, T.arrow + 0.8))
    s.L.set(S, top, vis * seg(t, T.arrow - 0.2, T.arrow))
    s.sheet.set(s.tmp.sheet, vis * fade(t, T.plane, OUT + 1, 0.6))
    w.render()

    const mid = w.project(s.tmp.mid.copy(S).lerp(P, 0.5))
    s.labels.r.set(mid[0] - 24, mid[1] - 30, vis * seg(t, T.rise - 0.3, T.rise + 0.2))
    const qp = w.project(Q)
    s.labels.v.set(qp[0] + 30, qp[1] - 22, vis * seg(t, T.rise - 0.3, T.rise + 0.2))
    const tp = w.project(top)
    s.labels.L.set(tp[0] + 90, tp[1] - 10, vis * seg(t, T.arrow + 0.6, T.arrow + 1.0))
    s.f.render(t, vis)
  },
})
