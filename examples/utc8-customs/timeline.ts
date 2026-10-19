import { timeline } from '@cueframe/core'
import cues from './build/cues.json'
import words from './build/words.json'
import fonts from './build/fonts/fonts.json'
import { again, hall, kevin, lim, lunch, mike, tanaka } from './scenes/booth.js'
import { code } from './scenes/code.js'
import { calendar, montage, traffic } from './scenes/evidence.js'
import { opening, queue } from './scenes/hall.js'
import { loop } from './scenes/loop.js'
import { sunrise } from './scenes/sunrise.js'
import { paper, subs } from './scenes/overlay.js'
import { SFX } from './timing.js'

const glyphs = fonts.text

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  deliver: 'podcast',
  cues,
  words,
  events: [SFX],
  scenes: [opening, hall, queue, kevin, tanaka, lim, code, mike, calendar, montage, lunch, loop, again, traffic, sunrise, paper, subs],
  fonts: [
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '500 900', glyphs },
    { family: 'Noto Serif SC', src: '/build/fonts/NotoSerifSC.subset.woff2', weight: '700 900', glyphs },
    { family: 'Jost', src: '/build/fonts/Jost.subset.woff2', weight: '400 700', glyphs },
    { family: 'IBM Plex Mono', src: '/build/fonts/IBMPlexMono-Medium.subset.woff2', weight: '500', glyphs },
  ],
})
