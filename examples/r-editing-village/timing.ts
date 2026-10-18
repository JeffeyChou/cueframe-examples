// When things happen, from the narration only: the scenes read these, and the score gets them as
// events (timeline({ events }) → cueframe cues → ctx.event), so picture and sound move together.
import { events, saidIn } from '@cueframe/core'
import cueTable from './build/cues.json'
import words from './build/words.json'

const said = (id: string, text: string) => saidIn(words, id, text)
const start = (id: string) => (cueTable as Record<string, number>)[`scene.${id}.start`]!

/** Seconds of the whip pan out of the laugh and into the point. */
export const WHIP = 0.32
// AE lands on "机会"; the other seven one by one from "软件" until just before "多少个夜晚".
const first = said('s7', '机会')
const a = said('s8', '软件')
const b = said('s8', '夜晚') - 0.4

export const T = events('sfx', {
  whip: start('s2') - WHIP,
  point: said('s2', '指向'),
  ring: said('s3', '镜头'),
  rush: said('s6', '冲'),
  land: said('s6', '台'),
  books: [first, ...Array.from({ length: 7 }, (_, i) => a + ((b - a) * i) / 6)],
  dark: said('s9', '不一样'),
  say: said('s11', '说'),
  pop: said('s12', '运镜'),
  fly: said('s12', '改顺'),
})
