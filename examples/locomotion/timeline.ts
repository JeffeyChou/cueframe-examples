import { timeline } from '@cueframe/core'
import hits from './build/hits.json'
import env from './build/env.json'
import fonts from './build/fonts/fonts.json'
import film from './scenes/film.js'
import { T } from './edit.js'

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  deliver: 'music-master',
  audio: '/build/music.wav',
  hits,
  env,
  cues: { ...T },
  scenes: [film],
  fonts: [
    { family: 'JetBrains Mono', src: '/data/fonts/JetBrainsMono.ttf', weight: '100 800' },
    { family: 'Michroma', src: '/data/fonts/Michroma-Regular.ttf', weight: '400' },
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '100 900', glyphs: fonts.text },
  ],
})
