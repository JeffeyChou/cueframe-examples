import { timeline } from '@cueframe/core'
import { T, film, narr } from './lib.js'
import main from './scenes/film.js'
import subs from './scenes/subs.js'

const cjk = film.subs.map((s) => s.cn).join('')
const en = film.subs.map((s) => s.en).join('')

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: film.fps,
  beats: { bpm: film.bpm, offset: 0, perBar: film.beatsPerBar },
  cues: { ...Object.fromEntries(Object.entries(T)), narrative: narr(0), ...Object.fromEntries(film.subs.map((s, i) => [`sub${i + 1}`, s.from])) },
  fonts: [
    { family: 'SubCJK', src: '/build/fonts/NotoSerifSC-Medium.subset.ttf', weight: '500', glyphs: cjk },
    { family: 'SubEN', src: '/build/fonts/Cormorant-Italic.subset.ttf', weight: '500', style: 'italic', glyphs: en },
  ],
  scenes: [main, subs],
})

