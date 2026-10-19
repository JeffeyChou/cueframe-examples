import { cue, scene, timeline } from '@cueframe/core'
import cues from './build/cues.json'
import words from './build/words.json'
import fonts from './build/fonts/fonts.json'
import { subtitles } from '@cueframe/recipes/subtitles.js'
import field from './scenes/field.js'
import stack from './scenes/stack.js'
import { T } from './timing.js'

const glyphs = fonts.text

const subs = scene({
  id: 'subs', layer: 'overlay', at: 0, end: cue('total'),
  mount: (ctx) => ({ draw: subtitles(ctx, { font: 'Noto Sans SC', y: 984, size: 38, weight: '600' }) }),
  render: (f, s) => s.draw(f),
})

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  deliver: 'podcast',
  beats: { bpm: 120, offset: 0, perBar: 4 },
  cues,
  words,
  events: [T],
  scenes: [field, stack, subs],
  fonts: [
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '500', glyphs },
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '600', glyphs },
    { family: 'Noto Sans SC', src: '/build/fonts/NotoSansSC.subset.woff2', weight: '700', glyphs },
    { family: 'Plex Mono', src: '/data/fonts/IBMPlexMono-Medium.ttf', weight: '600' },
  ],
})
