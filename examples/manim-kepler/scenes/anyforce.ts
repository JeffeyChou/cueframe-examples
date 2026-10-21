// Shot 6: the proof never used 1/r². Three central forces, three different orbits, equal-time
// sectors in each; then the conclusion.
import { cue, scene } from '@cueframe/core'
import { M, poly, star, svgEl, trail, type P } from '../lib/manim.js'
import { chain, CJK, CUES, el, fade, label, said, seg } from '../lib.js'
import { constant, inverseSquare, newton, spring, type Accel, type V2 } from '../orbit.js'

const IN = CUES['scene.a1.start']!
const END = CUES['total']!
const SUB = 40

interface Panel { cx: number; law: string; acc: Accel; p0: V2; v0: V2; T: number; sectors: number; scale: number; shift: V2 }

const PANELS: Panel[] = [
  { cx: 340, law: String.raw`\red{F} \propto \dfrac{1}{r^2}`, acc: inverseSquare, p0: [-1.55, 0], v0: [0, -Math.sqrt(0.45 / 1.55)], T: 2 * Math.PI, sectors: 12, scale: 185, shift: [0.55, 0] },
  { cx: 960, law: String.raw`\red{F} \propto r`, acc: spring, p0: [1.2, 0], v0: [0, 0.6], T: 2 * Math.PI, sectors: 12, scale: 190, shift: [0, 0] },
  { cx: 1580, law: String.raw`\red{F} \propto 1`, acc: constant, p0: [1.15, 0], v0: [0, 0.62], T: 3 * 2 * Math.PI * 0.9, sectors: 36, scale: 200, shift: [0, 0] },
]
const CY = 500

export default scene({
  id: 'anyforce',
  at: cue('scene.a1.start'),
  end: cue('total'),
  holds: [{ id: 'conclusion', at: END - 0.5 - IN }],
  async mount(ctx) {
    const T = {
      first: said(ctx, 'a1', '整个证明'),
      center: said(ctx, 'a2', '同一个中心'),
      any: said(ctx, 'a2', '不管它'),
      law: said(ctx, 'a2', '面积律都成立'),
      final: said(ctx, 'a3', '开普勒第二定律'),
      cons: said(ctx, 'a3', '角动量守恒'),
    }
    const svg = svgEl(ctx.root as unknown as Element, 'svg', { width: 1920, height: 1080 })
    Object.assign(svg.style, { position: 'absolute', left: '0', top: '0' })
    const panels = await Promise.all(PANELS.map(async (pn, i) => {
      const n = pn.sectors * SUB
      const orbit = newton(pn.p0, pn.v0, pn.T / n, n, pn.acc)
      const px = orbit.pts.map(([x, y]): P => [pn.cx + (x + pn.shift[0]) * pn.scale, CY - (y + pn.shift[1]) * pn.scale])
      const sun: P = [pn.cx + pn.shift[0] * pn.scale, CY - pn.shift[1] * pn.scale]
      const g = svgEl(svg, 'g')
      const fans = Array.from({ length: pn.sectors }, (_, k) => poly(g, { fill: M.gold, alpha: k % 2 ? 0.2 : 0.42 }))
      const path = trail(g, { color: M.teal, width: 3.5 })
      const st = star(g, `af-sun-${i}`, { r: 12 })
      const area = orbit.areas.slice(0, SUB).reduce((a, b) => a + b, 0)
      return {
        pn, px, sun, g, fans, path, st,
        law: await label(ctx, ctx.root, pn.law, { size: 48 }),
        area: await label(ctx, ctx.root, String.raw`\gold{\Delta A} = ${area.toFixed(4)}`, { size: 34 }),
        start: i === 0 ? T.first : T.center + (i - 1) * 1.2,
      }
    }))
    const concl = await chain(ctx, ctx.root, [String.raw`\gold{\dfrac{dA}{dt}} = \dfrac{L}{2m}`], [T.final], { x: 960, y: 470, size: 92, align: 'center' })
    const words = el(ctx.root, 'div', {
      position: 'absolute', left: '50%', top: '700px', transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap',
      font: `500 56px "${CJK}", sans-serif`, color: M.white, letterSpacing: '0.06em',
    })
    const left = el(words, 'span', {}, '开普勒第二定律')
    const eq = el(words, 'span', { margin: '0 0.6em', color: M.grey }, '=')
    const right = el(words, 'span', { color: M.gold }, '角动量守恒')
    return { root: ctx.root, T, panels, concl, words, left, eq, right }
  },
  render(f, s) {
    const t = f.t
    const T = s.T
    // Fade the scene on its HTML root (a composited layer), not on each SVG child: Blink paints
    // fractional opacity on SVG children differently depending on earlier frames.
    const sceneVis = fade(t, IN - 0.4, END + 10, 0.8)
    s.root.style.opacity = String(sceneVis)
    const vis = sceneVis > 0 ? 1 : 0
    const out = 1 - seg(t, T.final - 0.8, T.final)
    for (const P of s.panels) {
      const n = P.px.length - 1
      const k = seg(t, P.start, P.start + 4.2, (x) => x) * n
      const on = vis * seg(t, P.start - 0.4, P.start) * out
      P.g.style.display = on > 0 ? '' : 'none'
      P.g.style.opacity = String(on)
      P.st.set(P.sun, 1)
      P.path.set(P.px, k / n, 1)
      P.fans.forEach((fan, j) => {
        const a = j * SUB
        const done = Math.max(0, Math.min(SUB, k - a))
        fan.set(done > 0 ? [P.sun, ...P.px.slice(a, a + Math.ceil(done) + 1)] : [P.sun], done > 0 ? 1 : 0)
      })
      P.law.set(P.pn.cx, 215, on)
      P.area.set(P.pn.cx, 830, on * seg(t, P.start + 1.5, P.start + 2))
    }
    s.concl.render(t, vis)
    const wk = seg(t, T.cons - 1.2, T.cons - 0.6)
    s.words.style.opacity = String(vis * seg(t, T.final, T.final + 0.6))
    s.right.style.opacity = String(wk)
    s.eq.style.opacity = String(wk)
    s.left.style.opacity = '1'
  },
})
