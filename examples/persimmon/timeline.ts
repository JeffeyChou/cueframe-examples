import { timeline } from '@cueframe/core'
import { short } from './scenes/short.js'
import { SFX } from './timing.js'

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 24,
  events: [SFX],
  deliver: 'music-master',
  scenes: [short],
})
