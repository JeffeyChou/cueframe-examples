import { timeline } from '@cueframe/core'
import beats from './build/beats.json'
import cues from './build/cues.json'
import words from './build/words.json'
import script from './data/script.json'
import captions from './scenes/captions.js'
import wipe from './scenes/wipe.js'
import cover from './scenes/cover.js'
import hook from './scenes/hook.js'
import fail from './scenes/fail.js'
import stop from './scenes/stop.js'
import isolate from './scenes/isolate.js'
import deploy from './scenes/deploy.js'
import perks from './scenes/perks.js'
import compare from './scenes/compare.js'
import cta from './scenes/cta.js'

const src = Object.values(import.meta.glob('./scenes/*.ts', { query: '?raw', import: 'default', eager: true })).join('')
const glyphs = [...new Set(src + script.scenes.map((s) => s.say + s.sub).join(''))].filter((c) => c > ' ').join('')

export default timeline({
  formats: { vertical: { w: 1080, h: 1920 }, cover34: { w: 1080, h: 1440 } },
  fps: script.fps,
  cues,
  words,
  beats,
  fonts: [
    { family: 'Noto', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '900', glyphs },
    { family: 'Noto', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '700', glyphs },
    { family: 'JBM', src: '/build/fonts/JBM-Bold.subset.woff2', weight: '800', glyphs },
  ],
  scenes: [hook, fail, stop, isolate, deploy, perks, compare, cta, wipe, captions, cover],
})
