import { timeline } from '@cueframe/core'
import fonts from './build/fonts/fonts.json'
import { end } from './scenes/end.js'
import { fable } from './scenes/fable.js'
import { moral } from './scenes/moral.js'
import { paper } from './scenes/overlay.js'
import { SFX } from './timing.js'

const glyphs = fonts.text

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  events: [SFX],
  scenes: [fable, moral, end, paper],
  fonts: [
    { family: 'Noto Serif SC', src: '/build/fonts/NotoSerifSC.subset.woff2', weight: '700 900', glyphs },
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '500 900', glyphs },
    { family: 'Jost', src: '/build/fonts/Jost.subset.woff2', weight: '400 700', glyphs },
  ],
})
