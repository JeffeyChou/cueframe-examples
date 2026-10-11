import { timeline } from '@cueframe/core'
import { deck } from '../deck/deck.js'
import { slides } from './slides.js'

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  scenes: deck({ name: 'FINCCL · Part 2 · Device-API collectives', slides }),
})
