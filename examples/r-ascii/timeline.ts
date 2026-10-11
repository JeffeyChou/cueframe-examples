import { timeline } from '@cueframe/core'
import regular from './data/fonts/JetBrainsMono-Regular.woff?url'
import bold from './data/fonts/JetBrainsMono-ExtraBold.woff?url'
import { ACTS, END, LINES } from './engine/song.ts'
import screen from './scenes/screen.ts'
import captions from './scenes/captions.ts'

const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
const mono = `${ascii}─│┌┐└┘━┃┏┓┗┛═║╔╗╚╝╬╭╮╰╯┫┼┤▏▎▍▌▋▊▉█▓▒░▀▄▁▂▃▄▅▆▇◐◓◑◒●○◆◇▸▼▲·•→←−∀∃∈⊢∎θ²³…`
const zh = [...new Set(LINES.map((l) => l.zh).join(''))].join('')

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  audio: '/build/audio.wav',
  cues: {
    ...Object.fromEntries(LINES.map((l) => [`lyric.${String(l.i).padStart(3, '0')}`, l.t0])),
    ...Object.fromEntries(ACTS.map((a) => [`act.${a.id}`, a.t0])),
    end: END,
  },
  fonts: [
    { family: 'JBM', src: regular, weight: '400', glyphs: mono },
    { family: 'JBM', src: bold, weight: '800', glyphs: ascii },
    { family: 'Noto', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '700', glyphs: zh },
  ],
  scenes: [screen, captions],
})
