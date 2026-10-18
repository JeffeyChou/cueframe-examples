// Over every shot: printed-paper texture (fine grain, slow mottling, a soft vignette) and the
// subtitles in a dark box, as in the reference.
// cueframe: gfx post (grain, vignette) only reaches WebGL layers, so DOM/SVG art gets its paper
// from an SVG noise overlay blended with multiply.
import { cue, scene } from '@cueframe/core'
import { subtitles } from '@cueframe/recipes/subtitles.js'
import { C, H, SANS, W, s, stageSvg } from '../lib.js'

export const paper = scene({
  id: 'paper',
  layer: 'overlay',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    const svg = stageSvg(ctx.root)
    ctx.root.style.mixBlendMode = 'multiply'
    const d = s(svg, 'defs')
    const grain = s(d, 'filter', { id: 'grain', x: 0, y: 0, width: '100%', height: '100%' })
    s(grain, 'feTurbulence', { type: 'fractalNoise', baseFrequency: 0.85, numOctaves: 2, seed: 7 })
    s(grain, 'feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 0.9 -0.25' })
    const mottle = s(d, 'filter', { id: 'mottle', x: 0, y: 0, width: '100%', height: '100%' })
    s(mottle, 'feTurbulence', { type: 'fractalNoise', baseFrequency: 0.0035, numOctaves: 4, seed: 3 })
    s(mottle, 'feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.62  0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 1.4 -0.55' })
    s(svg, 'rect', { width: W, height: H, filter: 'url(#grain)', opacity: 0.32 })
    s(svg, 'rect', { width: W, height: H, filter: 'url(#mottle)', opacity: 0.5 })
    const vg = s(d, 'radialGradient', { id: 'vig', cx: '50%', cy: '48%', r: '75%' })
    s(vg, 'stop', { offset: '55%', 'stop-color': '#fff' })
    s(vg, 'stop', { offset: '100%', 'stop-color': '#b9ab90' })
    s(svg, 'rect', { width: W, height: H, fill: 'url(#vig)' })
    return {}
  },
  render() {},
})

export const subs = scene({
  id: 'subs',
  layer: 'overlay',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    const draw = subtitles(ctx, { y: H - 100, size: 34, font: 'Noto Sans SC', weight: '700', color: C.cream, shadow: 'none', lead: 0.05 })
    // cueframe: the recipe has no boxed style; restyle its band after mount.
    const band = ctx.root.querySelector<HTMLElement>('[data-cf-id=subtitle]')!
    Object.assign(band.style, { background: 'rgba(38,34,32,0.62)', padding: '3px 12px 5px', fontFamily: SANS })
    return { draw }
  },
  render: (f, st) => st.draw(f),
})
