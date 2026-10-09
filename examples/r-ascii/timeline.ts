import { timeline } from '@cueframe/core'
import regular from './data/fonts/JetBrainsMono-Regular.woff?url'
import bold from './data/fonts/JetBrainsMono-ExtraBold.woff?url'
import { LINES, SECTIONS } from './lib.js'
import screen from './scenes/screen.js'
import captions from './scenes/captions.js'

const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
const mono = `${ascii}─│┌┐└┘━┃┏┓┗┛═╞╡┊┤┴┼▏▼▲◆◇●○◐◑▸·•→−∀∞πθεΣ█▓▒░▀▄▁▂▃▄▅▆▇▎▍▌▋▊▉╱╲`
const zh = [...new Set(LINES.map((l) => l.zh).join(''))].join('')

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  cues: {
    ...Object.fromEntries(LINES.map((l) => [`lyric.${String(l.i + 12).padStart(2, '0')}`, l.t0])),
    ...Object.fromEntries(SECTIONS.map((s) => [`section.${s.kind}`, s.t0])),
  },
  fonts: [
    { family: 'JBM', src: regular, weight: '400', glyphs: mono },
    { family: 'JBM', src: bold, weight: '800', glyphs: ascii },
    { family: 'Noto', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '700', glyphs: zh },
  ],
  scenes: [screen, captions],
})
