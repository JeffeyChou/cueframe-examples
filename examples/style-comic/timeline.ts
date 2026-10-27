import { timeline } from '@cueframe/core'
import fonts from './build/fonts/fonts.json'
import { grain } from './scenes/overlay.js'
import { strip } from './scenes/strip.js'
import { SFX } from './timing.js'

const glyphs = fonts.text

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  events: [SFX],
  scenes: [strip, grain],
  fonts: [
    { family: 'ZCOOL KuaiLe', src: '/build/fonts/ZCOOLKuaiLe.subset.woff2', glyphs },
    { family: 'ZCOOL QingKe HuangYou', src: '/build/fonts/ZCOOLQingKeHuangYou.subset.woff2', glyphs },
    { family: 'Bangers', src: '/build/fonts/Bangers.subset.woff2', glyphs },
  ],
})
