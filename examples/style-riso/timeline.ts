import { timeline } from '@cueframe/core'
import fonts from './build/fonts/fonts.json'
import { print } from './scenes/print.js'
import { SFX } from './timing.js'

const glyphs = fonts.text

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 24,
  events: [SFX],
  scenes: [print],
  fonts: [
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '500 900', glyphs },
    { family: 'Jost', src: '/build/fonts/Jost.subset.woff2', weight: '400 700', glyphs },
  ],
})
