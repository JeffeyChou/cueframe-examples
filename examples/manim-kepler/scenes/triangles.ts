// Shots 1-2: Newton's two triangles. Without force AB = BC gives equal areas; a kick at B towards
// S moves c to C along a line parallel to SB, which keeps the height over SB and so the area.
import { cue, scene } from '@cueframe/core'
import { add, area, arrow, circle, foot, line, M, mix, mul, poly, rightAngle, star, sub, ticks, trail, type P } from '@cueframe/recipes/manim.js'
import { chain, CUES, fade, label, said, seg } from '../lib.js'

const A: P = [300, 300]
const B: P = [660, 252]
const C: P = [1020, 204]   // also c, the no-kick position, in shot 2
const S: P = [580, 860]
const LAMBDA = 0.3
const K: P = add(B, mul(sub(S, B), LAMBDA))          // tip of the kick arrow
const C2: P = add(C, mul(sub(S, B), LAMBDA))         // where the kicked planet lands
const STEP = 1.5                                      // seconds per A→B

const IN = CUES['scene.i1.start']!
const OUT = CUES['scene.p1.start']!

export default scene({
  id: 'triangles',
  at: cue('scene.i1.start'),
  end: cue('scene.p1.start', { offset: 0.8 }),
  holds: [
    { id: 'inertia', at: CUES['scene.i5.end']! - 0.2 - IN },
    { id: 'kick', at: CUES['scene.c7.end']! - 0.2 - IN },
  ],
  async mount(ctx) {
    const svg = ctx.root.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
    svg.setAttribute('width', '1920')
    svg.setAttribute('height', '1080')
    Object.assign(svg.style, { position: 'absolute', left: '0', top: '0' })
    const g = svg
    const T = {
      start: said(ctx, 'i2', '行星'),
      a: said(ctx, 'i2', '相同的时间'),
      eq: said(ctx, 'i2', 'A B'),
      sun: said(ctx, 'i3', '太阳'),
      join: said(ctx, 'i3', '连起来'),
      tri: said(ctx, 'i3', '两个三角形'),
      base: said(ctx, 'i4', '底'),
      height: said(ctx, 'i4', '高'),
      equal: said(ctx, 'i5', '面积相等'),
      // shot 2
      pull: said(ctx, 'c1', '拉'),
      ghost: said(ctx, 'c2', '原来的方向'),
      small: said(ctx, 'c2', '小'),
      toward: said(ctx, 'c3', '指向太阳'),
      combine: said(ctx, 'c3', '速度合成'),
      land: said(ctx, 'c3', '实际到达'),
      seg: said(ctx, 'c4', '这一段'),
      par: said(ctx, 'c4', '平行于'),
      share: said(ctx, 'c5', '共用底边'),
      same: said(ctx, 'c5', '同一条平行线'),
      hsame: said(ctx, 'c5', '所以高相同'),
      slide: said(ctx, 'c6', '滑过去'),
      kept: said(ctx, 'c6', '一点都没有变'),
      still: said(ctx, 'c7', '依然相等'),
    }
    const F = foot(S, A, C)

    // Fills under strokes.
    const sab = poly(g, { fill: M.gold, alpha: 0.42 })
    const sbc = poly(g, { fill: M.gold, alpha: 0.24 })
    const shear = poly(g, { fill: M.gold, alpha: 0.32, stroke: M.gold, width: 3 })
    const ghostTri = poly(g, { fill: 'none', stroke: M.gold, width: 2.5 })
    ghostTri.el.setAttribute('stroke-dasharray', '10 8')
    const path = trail(g, { color: M.teal, width: 4 })
    const ghostPath = line(g, { color: M.teal, width: 3, dash: '12 10' })
    const kickedPath = line(g, { color: M.teal, width: 4 })
    const parLine = line(g, { color: M.white, width: 2, dash: '6 10' })
    const cC = line(g, { color: M.red, width: 6 })
    const legs = [A, B, C].map(() => line(g, { color: M.white, width: 3 }))
    const sb2 = line(g, { color: M.gold, width: 7 })
    const sC2 = line(g, { color: M.white, width: 3 })
    const sc = line(g, { color: M.white, width: 3, dash: '10 8' })
    const h = line(g, { color: M.green, width: 3.5, dash: '10 8' })
    const hc = line(g, { color: M.green, width: 3.5, dash: '10 8' })
    const hC = line(g, { color: M.green, width: 3.5, dash: '10 8' })
    const sbExt = line(g, { color: M.gold, width: 3, dash: '8 8' })
    const ra = rightAngle(g, { color: M.green })
    const raC = rightAngle(g, { color: M.green })
    const rac = rightAngle(g, { color: M.green })
    const t1 = ticks(g, 1, { color: M.green })
    const t2 = ticks(g, 1, { color: M.green })
    const basesAB = line(g, { color: M.white, width: 7 })
    const basesBC = line(g, { color: M.white, width: 7 })
    const kick = arrow(g, { color: M.red, width: 6, head: 24 })
    const vel = arrow(g, { color: M.teal, width: 5, head: 22 })
    const kParA = line(g, { color: M.red, width: 2.5, dash: '8 8' })
    const kParB = line(g, { color: M.teal, width: 2.5, dash: '8 8' })
    const sun = star(g, 'tri-sun', { r: 16 })
    const dots = [A, B, C].map(() => circle(g, { r: 8, fill: M.white }))
    const dotC2 = circle(g, { r: 8, fill: M.white })
    const ghostDot = circle(g, { r: 8, fill: 'none', stroke: M.teal, width: 3 })
    const mover = circle(g, { r: 10, fill: '#E6F7FB' })
    const slider = circle(g, { r: 9, fill: M.gold })

    const L = {
      A: await label(ctx, ctx.root, 'A'), B: await label(ctx, ctx.root, 'B'), C: await label(ctx, ctx.root, 'C'),
      c: await label(ctx, ctx.root, 'c', { color: M.teal }), C2: await label(ctx, ctx.root, 'C'),
      S: await label(ctx, ctx.root, 'S'), h: await label(ctx, ctx.root, String.raw`\green{h}`),
      area: await label(ctx, ctx.root, String.raw`\gold{S_{\triangle SBP}} = ${(area(S, B, C) / 3600).toFixed(2)}`, { size: 40 }),
      P: await label(ctx, ctx.root, String.raw`\gold{P}`, { size: 38 }),
    }
    const f = await chain(ctx, ctx.root, [
      String.raw`|AB| = |BC|`,
      String.raw`\tfrac{1}{2}\,|AB|\,\green{h} = \tfrac{1}{2}\,|BC|\,\green{h}`,
      String.raw`\gold{S_{\triangle SAB}} = \gold{S_{\triangle SBC}}`,
      String.raw`\gold{S_{\triangle SAB}} = \gold{S_{\triangle SBc}}`,
      String.raw`\gold{S_{\triangle SAB}} = \gold{S_{\triangle SBc}} = \gold{S_{\triangle SBC}}`,
      String.raw`\gold{S_{\triangle SAB}} = \gold{S_{\triangle SBC}}`,
    ], [T.eq, T.height, T.equal, T.small, T.kept, T.still], { x: 1150, y: 170, size: 52 })
    return { root: ctx.root, T, F, sbExt, sab, sbc, shear, ghostTri, path, ghostPath, kickedPath, parLine, cC, legs, sb2, sC2, sc, h, hc, hC, ra, raC, rac, t1, t2, basesAB, basesBC, kick, vel, kParA, kParB, sun, dots, dotC2, ghostDot, mover, slider, L, f }
  },
  render(fr, s) {
    const t = fr.t
    const T = s.T
    // Fade the scene on its HTML root (a composited layer), not on each SVG child: Blink paints
    // fractional opacity on SVG children differently depending on earlier frames.
    const sceneVis = fade(t, IN, OUT + 0.8, 0.6)
    s.root.style.opacity = String(sceneVis)
    const vis = sceneVis > 0 ? 1 : 0
    const shot2 = seg(t, CUES['scene.c1.start']!, CUES['scene.c1.start']! + 0.8)

    // Inertial motion: from before A, through A, B, C at equal steps.
    const u = (t - T.a) / STEP
    const pos = add(A, mul(sub(B, A), u))
    const moving = t >= T.start - 0.5 && u <= 2.3
    s.mover.set(pos, moving ? vis * seg(t, T.start - 0.5, T.start) * (1 - seg(u, 2.05, 2.3)) : 0)
    s.path.set([add(A, mul(sub(B, A), -0.9)), add(A, mul(sub(B, A), Math.max(-0.9, Math.min(2.3, u))))], 1, vis * (1 - 0.65 * shot2))
    const pts = [A, B, C]
    pts.forEach((p, i) => {
      const on = seg(u, i - 0.02, i + 0.15)
      const dimC = i === 2 ? 1 - seg(t, T.ghost - 0.3, T.ghost + 0.3) : 1
      s.dots[i]!.set(p, vis * on * dimC)
    })
    s.L.A.set(A[0] - 10, A[1] - 44, vis * seg(u, 0, 0.2))
    s.L.B.set(B[0] - 42, B[1] - 30, vis * seg(u, 1, 1.2))
    s.L.C.set(C[0] - 34, C[1] - 32, vis * seg(u, 2, 2.2) * (1 - seg(t, T.small - 0.2, T.small + 0.3)))
    s.L.c.set(C[0] - 34, C[1] - 32, vis * seg(t, T.small - 0.2, T.small + 0.3))
    s.t1.set(A, B, vis * seg(t, T.eq, T.eq + 0.3) * (1 - shot2))
    s.t2.set(B, C, vis * seg(t, T.eq + 0.2, T.eq + 0.5) * (1 - shot2))

    // Sun, legs, triangles.
    s.L.S.set(S[0] - 46, S[1] + 14, vis * seg(t, T.sun, T.sun + 0.4))
    s.sun.set(S, vis * seg(t, T.sun - 0.2, T.sun + 0.4), 0.5 + 0.5 * seg(t, T.sun - 0.2, T.sun + 0.5))
    s.legs.forEach((l, i) => {
      const fadeC = i === 2 ? 1 - shot2 : 1
      l.set(S, pts[i]!).draw(seg(t, T.join + i * 0.25, T.join + i * 0.25 + 0.6), vis * fadeC)
    })
    const fill = seg(t, T.tri, T.tri + 0.6)
    s.sab.set([S, A, B], vis * fill)
    s.sbc.set([S, B, C], vis * fill * (1 - shot2))
    const base = fade(t, T.base, T.base + 1.6, 0.3)
    s.basesAB.set(A, B).draw(1, vis * base * 0.9)
    s.basesBC.set(B, C).draw(1, vis * base * 0.9)
    const hk = seg(t, T.height, T.height + 0.6)
    const hFade = vis * (1 - shot2)
    s.h.set(S, s.F).draw(hk, hFade)
    s.ra.set(s.F, S, C, hFade * seg(t, T.height + 0.5, T.height + 0.8))
    s.L.h.set((S[0] + s.F[0]) / 2 + 30, (S[1] + s.F[1]) / 2, hFade * seg(t, T.height + 0.4, T.height + 0.8))

    // Shot 2: ghost path to c, the kick, the parallelogram, the real C.
    s.ghostPath.set(B, C).draw(1, vis * seg(t, T.ghost - 0.3, T.ghost + 0.3))
    s.ghostDot.set(C, vis * seg(t, T.ghost - 0.3, T.ghost + 0.3))
    s.sc.set(S, C).draw(seg(t, T.small, T.small + 0.6), vis * (1 - seg(t, T.slide - 0.3, T.slide)))
    s.ghostTri.set([S, B, C], vis * seg(t, T.share, T.share + 0.5))
    const kk = seg(t, T.pull, T.pull + 0.5)
    s.kick.set(B, K, kk, vis * (1 - seg(t, T.seg, T.seg + 0.6) * 0.5))
    s.vel.set(B, C, seg(t, T.combine - 0.3, T.combine + 0.2), vis * fade(t, T.combine - 0.3, T.land + 1.2, 0.3))
    const par = fade(t, T.combine, T.land + 1.4, 0.4)
    s.kParA.set(K, C2).draw(seg(t, T.combine, T.combine + 0.5), vis * par)
    s.kParB.set(C, C2).draw(seg(t, T.combine + 0.2, T.combine + 0.7), vis * par)
    s.kickedPath.set(B, C2).draw(seg(t, T.land, T.land + 0.6), vis)
    s.dotC2.set(C2, vis * seg(t, T.land + 0.4, T.land + 0.7))
    s.L.C2.set(C2[0] + 34, C2[1] + 8, vis * seg(t, T.land + 0.4, T.land + 0.8))
    s.sC2.set(S, C2).draw(seg(t, T.land + 0.4, T.land + 1.0), vis)

    // c→C is parallel to SB.
    s.cC.set(C, C2).draw(seg(t, T.seg, T.seg + 0.5), vis * (1 - 0.6 * seg(t, T.share, T.share + 0.5)))
    const dir = sub(S, B)
    s.parLine.set(add(C, mul(dir, -0.35)), add(C, mul(dir, 0.75))).draw(seg(t, T.par, T.par + 0.8), vis * 0.8)
    s.sb2.set(S, B).draw(seg(t, T.par + 0.3, T.par + 0.8), vis * (1 - 0.4 * seg(t, T.share + 1, T.share + 1.5)))

    // Both apexes are the same distance from line SB.
    const fc = foot(C, S, B)
    const fC = foot(C2, S, B)
    const hs = fade(t, T.hsame, T.slide, 0.4)
    // The feet lie on SB extended past B: draw that extension so the right angles sit on a line.
    const far = mix(B, fc, 1.25)
    s.sbExt.set(B, far).draw(seg(t, T.hsame - 0.3, T.hsame + 0.2), vis * hs)
    s.hc.set(C, fc).draw(seg(t, T.hsame, T.hsame + 0.5), vis * hs)
    s.hC.set(C2, fC).draw(seg(t, T.hsame + 0.2, T.hsame + 0.7), vis * hs)
    s.rac.set(fc, C, S, vis * hs * seg(t, T.hsame + 0.5, T.hsame + 0.8))
    s.raC.set(fC, C2, S, vis * hs * seg(t, T.hsame + 0.7, T.hsame + 1.0))

    // The shear: P slides from c to C; the area readout never changes.
    const k = seg(t, T.slide, T.slide + 2.2)
    const P = mix(C, C2, k)
    const showShear = t >= T.slide - 0.3
    s.shear.set([S, B, P], showShear ? vis * seg(t, T.slide - 0.3, T.slide) : 0)
    s.slider.set(P, showShear ? vis * seg(t, T.slide - 0.3, T.slide) : 0)
    s.L.P.set(P[0] + 30, P[1] - 18, showShear ? vis * seg(t, T.slide - 0.3, T.slide) : 0)
    s.L.area.set(1180, 560, showShear ? vis * seg(t, T.slide - 0.2, T.slide + 0.3) : 0)

    s.f.render(t, vis)
  },
})
