import { timeline } from '@cueframe/core'
import { bg, grain } from './scenes/frame.js'
import blame from './scenes/blame.js'
import pylons from './scenes/pylons.js'
import raymond from './scenes/raymond.js'
import virus from './scenes/virus.js'
import overloaded from './scenes/overloaded.js'

const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  fonts: [
    { family: 'Plex', src: '/data/fonts/IBMPlexMono-Regular.ttf', weight: '400', glyphs: ascii },
    { family: 'Plex', src: '/data/fonts/IBMPlexMono-Medium.ttf', weight: '500', glyphs: ascii },
  ],
  scenes: [bg, pylons, blame, raymond, virus, overloaded, grain],
})
