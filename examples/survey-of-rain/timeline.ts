import { timeline } from '@cueframe/core'
import hits from './build/hits.json'
import env from './build/env.json'
import fonts from './build/fonts/fonts.json'
import cards from './scenes/cards.js'
import montage from './scenes/montage.js'

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  deliver: 'music-master',
  audio: '/build/music.wav',
  hits,
  env,
  cues: { sky: 6.86, build: 13.71, drop: 20.57, surface: 34.28, clear: 48.0 },
  scenes: [montage, cards],
  fonts: [
    { family: 'JetBrains Mono', src: '/data/fonts/JetBrainsMono.ttf', weight: '400' },
    { family: 'Noto Serif SC', src: '/build/fonts/NotoSerifSC.subset.woff2', weight: '600', glyphs: fonts.text },
  ],
})
