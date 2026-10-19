import { timeline } from '@cueframe/core'
import cues from './build/cues.json'
import fonts from './build/fonts/fonts.json'
import { hall, kevin, lim } from './scenes/booth.js'
import { code } from './scenes/code.js'
import { sunrise } from './scenes/sunrise.js'
import { paper, subs } from './scenes/overlay.js'

const glyphs = fonts.text

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  cues,
  scenes: [hall, kevin, lim, code, sunrise, paper, subs],
  fonts: [
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '900', glyphs },
    { family: 'Noto Serif SC', src: '/build/fonts/NotoSerifSC.subset.woff2', weight: '900', glyphs },
    { family: 'Jost', src: '/build/fonts/Jost.subset.woff2', weight: '700', glyphs },
    { family: 'IBM Plex Mono', src: '/build/fonts/IBMPlexMono-Medium.subset.woff2', weight: '500', glyphs },
  ],
})
