import { timeline } from '@cueframe/core'
import virgil from './fonts/Virgil.woff2?url'
import mono from './fonts/JetBrainsMono-Regular.woff?url'
import board from './scenes/board.js'

const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?()"%*-_=·'

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  fonts: [
    { family: 'Virgil', src: virgil, glyphs: latin },
    { family: 'JBM', src: mono, glyphs: latin },
  ],
  scenes: [board],
})
