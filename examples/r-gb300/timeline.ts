import { timeline } from '@cueframe/core'
import fonts from './build/fonts/fonts.json'
import rack from './scenes/rack.js'
import tray from './scenes/tray.js'
import scale from './scenes/scale.js'

const glyphs = fonts.text

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 24,
  scenes: [rack, tray, scale],
  fonts: [
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '400', glyphs },
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '600', glyphs },
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '700', glyphs },
    { family: 'Plex Mono', src: '/data/fonts/IBMPlexMono-Regular.ttf', weight: '400' },
    { family: 'Plex Mono', src: '/data/fonts/IBMPlexMono-Medium.ttf', weight: '700' },
  ],
})
