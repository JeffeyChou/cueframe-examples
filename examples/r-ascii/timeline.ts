import { timeline } from '@cueframe/core'
import jbm from './fonts/JetBrainsMono-Regular.woff?url'
import jbmBold from './fonts/JetBrainsMono-ExtraBold.woff?url'
import noto from './fonts/NotoSansSC-Bold-subset.woff?url'
import terminal from './scenes/terminal.js'
import { lines } from './timing.js'

const cues = Object.fromEntries(lines.map((l) => [`l${l.i}`, l.t0]))

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  cues,
  fonts: [
    { family: 'JBM', src: jbm, weight: '400', glyphs: 'Aa0█▓▒░─│┌┐◆·' },
    { family: 'JBM', src: jbmBold, weight: '800', glyphs: 'DIMENSION' },
    { family: 'NotoSC', src: noto, weight: '700', glyphs: lines.map((l) => l.zh).join('') },
  ],
  scenes: [terminal],
})
