// Over every shot: the printed page (kits/paper.ts `sheet`, multiplied) and the narration's
// subtitles in a dark box. Character lines (ids with a suffix, s04-kevin…) are in speech bubbles.
import { cue, scene } from '@cueframe/core'
import { sheet } from '../../../kits/paper.js'
import { subtitles } from '@cueframe/recipes/subtitles.js'
import { C, H } from '../lib.js'
import { K } from '../timing.js'

export const paper = scene({
  id: 'paper',
  layer: 'overlay',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    sheet(ctx, { seed: 19, grain: 0.3, mottle: 0.45 })
    return {}
  },
  render() {},
})

export const subs = scene({
  id: 'subs',
  layer: 'overlay',
  at: 0,
  end: K.black,
  mount(ctx) {
    const draw = subtitles(ctx, { y: H - 112, size: 40, font: 'Noto Sans SC', weight: '700', color: C.cream, box: 'rgba(30,30,30,0.66)', lines: (id) => !id.includes('-') })
    return { draw }
  },
  render: (f, st) => st.draw(f),
})
