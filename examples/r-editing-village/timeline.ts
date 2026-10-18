import { timeline } from '@cueframe/core'
import cues from './build/cues.json'
import words from './build/words.json'
import fonts from './build/fonts/fonts.json'
import { stage, rush } from './scenes/stage.js'
import { paper, subs } from './scenes/overlay.js'
import { laugh, point } from './scenes/elder.js'
import { books } from './scenes/books.js'
import { turn, prompt } from './scenes/opus.js'

const glyphs = fonts.text

export default timeline({
  formats: { landscape: { w: 1440, h: 1080 } },
  fps: 30,
  deliver: 'podcast',
  cues,
  words,
  scenes: [laugh, point, stage, rush, books, turn, prompt, paper, subs],
  fonts: [
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '700', glyphs },
    { family: 'Noto Serif SC', src: '/build/fonts/NotoSerifSC.subset.woff2', weight: '700', glyphs },
  ],
})
