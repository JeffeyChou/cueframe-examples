// Over every shot: the printed page (fine grain, slow mottling, a soft vignette; kits/paper.ts
// `sheet`, static and multiplied over the scene below) and the subtitles in a dark box, as in
// the reference.
import { cue, scene } from '@cueframe/core'
import { subtitles } from '@cueframe/recipes/subtitles.js'
import { sheet } from '../../../kits/paper.js'
import { C, H, SANS } from '../lib.js'

export const paper = scene({
  id: 'paper',
  layer: 'overlay',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    sheet(ctx, { seed: 7, grain: 0.32, mottle: 0.5 })
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
