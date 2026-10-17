import { timeline } from '@cueframe/core'
import cues from './build/cues.json'
import words from './build/words.json'
import fonts from './build/fonts/fonts.json'
import { bg, chrome } from './scenes/frame.js'
import die from './scenes/die.js'
import ladder from './scenes/ladder.js'
import hdl from './scenes/hdl.js'
import rtl from './scenes/rtl.js'
import contrast from './scenes/contrast.js'

const glyphs = fonts.text

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  deliver: 'podcast',
  cues,
  words,
  scenes: [bg, die, ladder, hdl, rtl, contrast, chrome],
  fonts: [
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '500', glyphs },
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '600', glyphs },
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '700', glyphs },
    { family: 'Plex Mono', src: '/data/fonts/IBMPlexMono-Regular.ttf', weight: '500' },
    { family: 'Plex Mono', src: '/data/fonts/IBMPlexMono-Medium.ttf', weight: '600' },
    { family: 'Plex Mono', src: '/data/fonts/IBMPlexMono-Medium.ttf', weight: '700' },
  ],
})
