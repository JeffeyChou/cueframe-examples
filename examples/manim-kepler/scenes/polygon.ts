// Shots 3-4: kick every Δt with F ∝ 1/r². Equal triangles all round; halving Δt turns the polygon
// into the ellipse, and the cross product shows why the rate never changes.
import { cue, scene } from '@cueframe/core'
import { arrow, circle, mix, M, poly, star, sub, add, mul, unit, len, trail, type P } from '../../../recipes/manim.js'
import { chain, CUES, fade, label, said, seg } from '../lib.js'
import { inverseSquare, kepler, keplerVel, newton, type V2 } from '../orbit.js'
import { A, E, PERIOD, toPx } from '../world3d.js'

const IN = CUES['scene.p1.start']!
const OUT = CUES['scene.m1.start']!
const LEVELS = [12, 24, 48, 96]
const SUN = toPx([0, 0])
/** Orbit time of the demonstration planet from l3 on (shared with the 3D shot). */
export const tauAt = (t: number, from: number) => (t - from) * 0.18 + 0.9
export const V_SCALE = 0.6

/** Newton polygon from aphelion; the first kick is a half step so the polygon stays near the ellipse. */
function level(n: number) {
  const dt = PERIOD / n
  const p0: V2 = [-A * (1 + E), 0]
  const v0: V2 = [0, -Math.sqrt((1 - E) / (A * (1 + E)))]
  const a0 = inverseSquare(p0)
  return { n, dt, ...newton(p0, [v0[0] + (a0[0] * dt) / 2, v0[1] + (a0[1] * dt) / 2], dt, n, inverseSquare) }
}

export default scene({
  id: 'polygon',
  at: cue('scene.p1.start'),
  end: cue('scene.m1.start', { offset: 1.2 }),
  holds: [
    { id: 'polygon', at: CUES['scene.p2.end']! - 0.2 - IN },
    { id: 'limit', at: CUES['scene.l5.end']! - 0.2 - IN },
  ],
  async mount(ctx) {
    const T = {
      build: said(ctx, 'p1', '每隔'),
      law: said(ctx, 'p1', '平方成反比'),
      same: said(ctx, 'p2', '每一个三角形'),
      shorter: said(ctx, 'l1', '越来越短'),
      smooth: said(ctx, 'l2', '光滑的椭圆'),
      sector: said(ctx, 'l2', '扇形'),
      vec: said(ctx, 'l3', '用矢量来写'),
      half: said(ctx, 'l3', '一半'),
      dv: said(ctx, 'l4', '速度的变化'),
      par: said(ctx, 'l4', 'r 平行'),
      zero: said(ctx, 'l4', '等于零'),
      never: said(ctx, 'l5', '永远不变'),
      rate: said(ctx, 'l5', '扫面积的速度'),
      L: said(ctx, 'l5', '角动量'),
    }
    const buildEnd = CUES['scene.p2.end']! - 1.2
    const levels = LEVELS.map(level)
    const svg = ctx.root.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
    svg.setAttribute('width', '1920')
    svg.setAttribute('height', '1080')
    Object.assign(svg.style, { position: 'absolute', left: '0', top: '0' })
    const groups = levels.map((lv) => {
      const g = svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'g'))
      const tris = lv.areas.map((_, k) => poly(g, { fill: M.gold, alpha: k % 2 ? 0.2 : 0.42 }))
      const path = trail(g, { color: M.teal, width: lv.n > 24 ? 3 : 4 })
      const kicks = lv.n <= 24 ? lv.kicks.map(() => arrow(g, { color: M.red, width: 4, head: 16 })) : []
      return { g, lv, tris, path, kicks, px: lv.pts.map((p) => toPx(p)) }
    })
    const ellipse = trail(svg, { color: M.teal, width: 4 })
    const ring = Array.from({ length: 361 }, (_, i) => toPx(kepler(A, E, (PERIOD * i) / 360)))
    const sweep = poly(svg, { fill: M.gold, alpha: 0.5 })
    const rArrow = arrow(svg, { color: M.white, width: 5, head: 22 })
    const vArrow = arrow(svg, { color: M.teal, width: 5, head: 22 })
    const dvArrow = arrow(svg, { color: M.red, width: 5, head: 20 })
    const sun = star(svg, 'poly-sun', { r: 16 })
    const planet = circle(svg, { r: 10, fill: '#E6F7FB' })

    const rows = await Promise.all(levels[0]!.areas.map((a, k) => label(ctx, ctx.root, String.raw`\gold{\Delta A_{${k + 1}}} = ${a.toFixed(5)}`, { size: 32 })))
    const law = await chain(ctx, ctx.root, [String.raw`\red{F} \propto \dfrac{1}{r^2}`], [T.law], { x: 1290, y: 190, size: 58 })
    const labels = { r: await label(ctx, ctx.root, String.raw`\vec r`), v: await label(ctx, ctx.root, String.raw`\teal{\vec v}`), dv: await label(ctx, ctx.root, String.raw`\red{\Delta \vec v}`, { size: 40 }) }
    const top = await chain(ctx, ctx.root, [
      String.raw`\gold{\Delta A} = \tfrac{1}{2}\,|\vec r \times \teal{\vec v}|\,\Delta t`,
      String.raw`\gold{\dfrac{dA}{dt}} = \tfrac{1}{2}\,|\vec r \times \teal{\vec v}|`,
      String.raw`\gold{\dfrac{dA}{dt}} = \dfrac{L}{2m}`,
    ], [T.vec, T.rate, T.L], { x: 1230, y: 230, size: 58 })
    const bottom = await chain(ctx, ctx.root, [
      String.raw`\vec r \times (\teal{\vec v} + \red{\Delta \vec v})`,
      String.raw`\vec r \times \teal{\vec v} + \strike{\vec r \times \red{\Delta \vec v}}`,
      String.raw`\vec r \times \teal{\vec v} = \text{const}`,
    ], [T.dv, T.zero, T.never], { x: 1230, y: 470, size: 54 })
    return { root: ctx.root, T, buildEnd, groups, ellipse, ring, sweep, rArrow, vArrow, dvArrow, sun, planet, rows, law, labels, top, bottom }
  },
  render(f, s) {
    const t = f.t
    const T = s.T
    // Fade the scene on its HTML root (a composited layer), not on each SVG child: Blink paints
    // fractional opacity on SVG children differently depending on earlier frames.
    const sceneVis = fade(t, IN, OUT + 1.2, 0.8)
    s.root.style.opacity = String(sceneVis)
    const vis = sceneVis > 0 ? 1 : 0
    s.sun.set(SUN, vis)

    // Level 0 builds step by step; later levels replace it at each halving.
    const switches = [-Infinity, T.shorter, T.shorter + 1.4, T.shorter + 2.8]
    const step = (s.buildEnd - T.build) / 12
    s.groups.forEach((G, li) => {
      const on = li === 0 ? 1 - seg(t, switches[1]! - 0.2, switches[1]! + 0.3) : fade(t, switches[li]! - 0.2, li === 3 ? Infinity : switches[li + 1]! + 0.3, 0.4)
      const dim = 1 - 0.55 * seg(t, T.vec - 0.6, T.vec)
      G.g.style.display = on * vis > 0 ? '' : 'none'
      G.g.style.opacity = String(on * vis * dim)
      if (on * vis <= 0) return
      const n = G.lv.n
      const k = li === 0 ? (t - T.build) / step : n
      G.path.set(G.px, Math.max(0, Math.min(1, k / n)), 1 - seg(t, T.smooth, T.smooth + 0.8))
      G.tris.forEach((tr, i) => tr.set([SUN, G.px[i]!, G.px[i + 1]!], seg(k, i + 0.15, i + 0.75)))
      G.kicks.forEach((ar, i) => {
        const at = G.px[i + 1]!
        const d = unit(sub(SUN, at))
        const L = 24 + 22 * len(G.lv.kicks[i] as unknown as P) / G.lv.dt
        ar.set(at, add(at, mul(d, Math.min(L, 0.6 * len(sub(SUN, at))))), seg(k, i + 0.8, i + 1.05), 1 - seg(t, T.shorter + 1.4, T.shorter + 1.8))
      })
    })
    s.ellipse.set(s.ring, seg(t, T.smooth, T.smooth + 1.4), vis)
    s.law.render(t, vis * (1 - seg(t, CUES['scene.p2.end']!, CUES['scene.p2.end']! + 0.6)))
    s.rows.forEach((r, i) => {
      const done = T.build + step * (i + 0.75)
      r.set(1440, 290 + i * 46, vis * seg(t, Math.max(done, T.same - 3), Math.max(done, T.same - 3) + 0.3) * (1 - seg(t, CUES['scene.l1.start']!, CUES['scene.l1.start']! + 0.5)))
    })

    // From l3: r and v at a moving planet on the exact orbit, with the thin swept triangle.
    const tau = tauAt(t, T.vec)
    const p = kepler(A, E, tau)
    const v = keplerVel(A, E, tau)
    const pp = toPx(p)
    const vv = toPx([p[0] + v[0] * V_SCALE, p[1] + v[1] * V_SCALE])
    const vecOn = vis * seg(t, T.vec, T.vec + 0.5)
    s.planet.set(pp, vecOn)
    s.rArrow.set(SUN, pp, seg(t, T.vec, T.vec + 0.5), vecOn)
    s.vArrow.set(pp, vv, seg(t, T.vec + 0.3, T.vec + 0.8), vecOn)
    // Beside the r arrow, on the side away from the orbit's centre.
    const mid = mix(SUN, pp, 0.5)
    const rn = unit(sub(pp, SUN))
    const side = rn[0] * -1 + rn[1] * 0 >= 0 ? 1 : -1
    s.labels.r.set(mid[0] - rn[1] * 34 * side, mid[1] + rn[0] * 34 * side, vecOn)
    s.labels.v.set(vv[0] + 26, vv[1] - 20, vecOn * seg(t, T.vec + 0.6, T.vec + 0.9))
    const back = toPx(kepler(A, E, tau - 0.35))
    s.sweep.set([SUN, back, ...Array.from({ length: 8 }, (_, i) => toPx(kepler(A, E, tau - 0.35 + (0.35 * (i + 1)) / 8)))], vecOn * seg(t, T.half - 0.2, T.half + 0.3))
    const dvTip = add(pp, mul(unit(sub(SUN, pp)), 90))
    s.dvArrow.set(pp, dvTip, seg(t, T.dv, T.dv + 0.4), vis * fade(t, T.dv, CUES['scene.l5.end']!, 0.4))
    s.labels.dv.set(dvTip[0] + 34, dvTip[1] + 28, vis * fade(t, T.dv + 0.3, CUES['scene.l5.end']!, 0.4))
    s.top.render(t, vis)
    s.bottom.render(t, vis)
  },
})
