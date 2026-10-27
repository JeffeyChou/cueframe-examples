// Over everything: the printed sheet (kits/paper.ts `sheet`: grain, mottling, vignette, multiplied).
import { scene } from '@cueframe/core'
import { sheet } from '../../../kits/paper.js'
import { TOTAL } from '../timing.js'

export const paper = scene({
  id: 'paper',
  layer: 'overlay',
  at: 0,
  end: TOTAL,
  mount(ctx) {
    sheet(ctx, { seed: 19, grain: 0.3, mottle: 0.28, vignette: '#cfc2a4' })
    return {}
  },
  render() {},
})
