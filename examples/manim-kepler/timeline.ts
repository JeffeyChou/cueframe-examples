import { timeline } from '@cueframe/core'
import cues from './build/cues.json'
import words from './build/words.json'
import { glyphsOf, CJK } from './lib.js'
import { bg, subs } from './scenes/frame.js'
import open from './scenes/open.js'
import plane from './scenes/plane.js'
import triangles from './scenes/triangles.js'
import polygon from './scenes/polygon.js'
import momentum from './scenes/momentum.js'
import anyforce from './scenes/anyforce.js'

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  deliver: 'podcast',
  cues,
  words,
  fonts: [{ family: CJK, src: '/build/fonts/NotoSansSC.subset.woff2', weight: '500', glyphs: glyphsOf(words, '开普勒第二定律角动量守恒') }],
  scenes: [bg, open, plane, triangles, polygon, momentum, anyforce, subs],
})
