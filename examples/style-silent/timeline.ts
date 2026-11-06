import { timeline } from '@cueframe/core'
import fonts from './build/fonts/fonts.json'
import { reel } from './scenes/reel.js'
import { CUE } from './timing.js'

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 24,
  events: [CUE],
  scenes: [reel],
  fonts: [{ family: 'Noto Serif SC', src: '/build/fonts/NotoSerifSC.subset.woff2', weight: '400 900', glyphs: fonts.text }],
})
