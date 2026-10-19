// The animation the village is judging: twelve cards, a diamond hopping from card to card and a
// camera following it. It plays on the stage screen and on the monitor in another shot, so it is
// drawn in its own W×H frame from its own clock (`play`), and every shot that shows it builds an
// instance. The flaw is the camera stopping dead on card 3, then snapping on.
// It is a composition: the monitor and the stage screen are two instances of `cards`, each fed the
// film's clock by ctx.comp; annotations outside it find card 3 through its anchor.
import { composition, scene } from '@cueframe/core'
import { C, H, SERIF, W, clamp01, inOutCubic, lerp, s, stageSvg } from '../lib.js'

export const PER = 1.5           // seconds per card
const N = 12
export const LENGTH = N * PER
const GAP = 560
const CARD = 400
/** Narrative time at which the strip's clock reads 0 (card 1); the 2 → 3 stutter lands on s3. */
export const play = (t: number, t0: number) => (((t - t0) % (N * PER)) + N * PER) % (N * PER)

type Icon = (g: SVGGElement) => void
const ring = (stroke: string, r: number, w: number): Icon => (g) => { s(g, 'circle', { r, fill: 'none', stroke, 'stroke-width': w }) }
const ICONS: [string, Icon][] = [
  [C.sky, (g) => { s(g, 'circle', { r: 70, fill: C.cream }); s(g, 'circle', { r: 16, fill: C.ink }) }],
  [C.mustard, (g) => { for (const y of [-60, 0, 60]) s(g, 'rect', { x: -110, y: y - 13, width: 220, height: 26, fill: C.ink }) }],
  [C.red, (g) => { s(g, 'path', { d: 'M0 -110 L120 90 L-120 90 Z', fill: C.cream }) }],
  [C.navy, ring(C.lavender, 95, 16)],
  [C.mustard, (g) => { s(g, 'rect', { x: -85, y: -85, width: 170, height: 170, fill: 'none', stroke: C.ink, 'stroke-width': 22 }) }],
  [C.cobalt, (g) => { s(g, 'rect', { x: -110, y: -12, width: 220, height: 24, fill: C.cream }); s(g, 'rect', { x: -12, y: -110, width: 24, height: 220, fill: C.cream }) }],
  [C.sky, (g) => { s(g, 'circle', { r: 85, fill: C.cream }) }],
  [C.mustard, (g) => { for (const y of [-60, 0, 60]) s(g, 'rect', { x: -110, y: y - 13, width: 220, height: 26, fill: C.ink }) }],
  [C.red, (g) => { s(g, 'path', { d: 'M0 -110 L120 90 L-120 90 Z', fill: C.cream }) }],
  [C.navy, ring(C.lavender, 95, 16)],
  [C.mustard, (g) => { s(g, 'rect', { x: -85, y: -85, width: 170, height: 170, fill: 'none', stroke: C.ink, 'stroke-width': 22 }) }],
  [C.cobalt, (g) => { s(g, 'rect', { x: -110, y: -12, width: 220, height: 24, fill: C.cream }); s(g, 'rect', { x: -12, y: -110, width: 24, height: 220, fill: C.cream }) }],
]

/** Where the diamond is (strip x, lift) at clock `tp`, and which card it sits on. */
function diamondAt(tp: number) {
  const k = Math.min(N - 1, Math.floor(tp / PER))
  const u = tp / PER - k
  const hop = k < N - 1 ? clamp01((u - 0.7) / 0.3) : 0
  const e = inOutCubic(hop)
  return { k, x: lerp(k * GAP, (k + 1) * GAP, e), lift: Math.sin(Math.PI * hop) * 150, hop }
}

/** The strip camera: follows the diamond smoothly, except that it stops dead on the 2 → 3 hop. */
function camAt(tp: number, stutter: boolean) {
  const k = Math.min(N - 1, Math.floor(tp / PER))
  const u = tp / PER - k
  const glide = (a: number, b: number, x: number) => lerp(a * GAP, b * GAP, inOutCubic(clamp01(x)))
  if (stutter && k === 1) return glide(1, 2, (u - 0.98) / 0.1)            // waits until the diamond has landed
  if (stutter && k === 2 && u < 0.1) return glide(1, 2, (u + 0.02) / 0.1)  // then jerks over in a few frames
  return glide(k, k + 1, (u - 0.6) / 0.4)
}

export function strip(parent: Element, o: { stutter?: boolean } = {}) {
  const g = s(parent, 'g')
  s(g, 'rect', { width: W, height: H, fill: C.paper })
  // The strip is a world the camera pans across: cards leave the frame on purpose.
  const film = s(g, 'g', { 'data-cf-audit': 'world' })
  ICONS.forEach(([fill, icon], i) => {
    const c = s(film, 'g', { transform: `translate(${i * GAP} 0)` })
    s(c, 'rect', { x: -CARD / 2, y: -CARD / 2, width: CARD, height: CARD, fill })
    s(c, 'text', { x: -CARD / 2 + 26, y: -CARD / 2 + 74, 'font-family': SERIF, 'font-weight': 700, 'font-size': 64, fill: fill === C.navy ? C.cream : C.ink }, String(i + 1))
    icon(s(c, 'g'))
  })
  const trail = [0, 1, 2].map(() => s(film, 'circle', { r: 9, fill: C.ink }))
  const dia = s(film, 'g')
  s(dia, 'rect', { x: -44, y: -44, width: 88, height: 88, fill: C.ink, stroke: C.cream, 'stroke-width': 9, transform: 'rotate(45)' })
  return {
    g,
    /** Annotations that ride with the cards (drawn in strip coordinates; card i is centred at x = i·GAP). */
    film,
    cardX: (i: number) => i * GAP,
    draw(tp: number) {
      const cam = camAt(tp, o.stutter ?? true)
      film.setAttribute('transform', `translate(${(W / 2 - cam).toFixed(2)} ${H / 2})`)
      const d = diamondAt(tp)
      dia.setAttribute('transform', `translate(${d.x.toFixed(2)} ${(-d.lift).toFixed(2)}) rotate(${(d.hop * 90).toFixed(2)})`)
      trail.forEach((c, j) => {
        const back = diamondAt(Math.max(0, tp - 0.05 * (j + 1)))
        c.setAttribute('cx', back.x.toFixed(2))
        c.setAttribute('cy', (-back.lift).toFixed(2))
        c.setAttribute('opacity', d.hop > 0 && d.hop < 1 ? String(0.5 - j * 0.14) : '0')
      })
    },
  }
}

/** The strip as a piece of its own: 18 s of cards in a W×H frame; `card3` is card 3's centre. */
export const cards = composition<{ stutter: boolean }>({
  size: { w: W, h: H },
  scenes: (p) => [scene({
    id: 'strip',
    dur: LENGTH,
    mount: (ctx) => strip(stageSvg(ctx.root), p),
    render: (f, st) => st.draw(f.t),
  })],
  anchors: (p) => ({ card3: (t) => ({ x: W / 2 - camAt(t, p.stutter) + 2 * GAP, y: H / 2 }) }),
})
