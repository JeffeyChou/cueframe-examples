// Over everything: the screen-fixed print grain and a warm vignette (kits/paper.ts `sheet`, multiplied).
import { scene } from '@cueframe/core'
import { sheet } from '../../../kits/paper.js'
import { TOTAL } from '../timing.js'

export const grain = scene({
  id: 'grain',
  layer: 'overlay',
  at: 0,
  end: TOTAL,
  mount(ctx) {
    sheet(ctx, { seed: 23, tone: '#8C7A5A', grain: 0.32, mottle: 0.3, vignette: '#c2b08c' })
    return {}
  },
  render() {},
})
