// When things happen, from the narration only (words.json, cues.json): the scenes read these, and the
// score gets the sounds as events (timeline({ events }) → cueframe cues → ctx.event).
import { events, saidIn } from '@cueframe/core'
import cueTable from './build/cues.json'
import words from './build/words.json'

const CUE = cueTable as Record<string, number>
const st = (id: string) => CUE[`scene.${id}.start`]!
const said = (id: string, text: string) => saidIn(words, id, text)
const line = (id: string) => words.lines.find((l) => l.id === id)!
/** Voice start and end of a line. */
const vo = (id: string) => line(id).vo.start
const voEnd = (id: string) => line(id).vo.start + line(id).vo.dur

export const TOTAL = CUE.total!
/** Each shot's window: from its first line's slot to the next shot's. */
export const SHOT = {
  s01: [st('s01'), st('s02')], s02: [st('s02'), st('s03')], s03: [st('s03'), st('s04')], s04: [st('s04'), st('s05')],
  s05: [st('s05'), st('s06-tanaka')], s06: [st('s06-tanaka'), st('s07-lim')], s07: [st('s07-lim'), st('s08')], s08: [st('s08'), st('s09')],
  s09: [st('s09'), st('s10')], s10: [st('s10'), st('s11')], s11: [st('s11'), st('s12')], s12: [st('s12'), st('s13')],
  s13: [st('s13'), st('s14-kevin')], s14: [st('s14-kevin'), st('s15')], s15: [st('s15'), st('s16')], s16: [st('s16'), TOTAL],
} as const satisfies Record<string, readonly [number, number]>
export type ShotId = keyof typeof SHOT

const s11cards = Array.from({ length: 6 }, (_, i) => voEnd('s11') + 0.5 + i * 1.4 - i * i * 0.04)

/** Every timed beat the scenes use. */
export const K = {
  capOn: said('s01', '守边境') - 0.2,
  drop: SHOT.s02[0] + 0.8,
  tap2: said('s02', '不入境'),
  kevinIn: SHOT.s04[0] + 0.1,
  slap: said('s04', 'Kevin'),
  hello: vo('s04-kevin'),
  ringZaima: said('s05', '在吗'),
  ringComma: said('s05', '全角'),
  stamp5: voEnd('s05') + 0.5,
  bows: [0, 0.42, 0.84].map((d) => vo('s06-tanaka') - 0.7 + d),
  request: said('s06', '想把') - 0.2,
  ringJa: said('s06', '翻译成日语'),
  stamp6: voEnd('s06') + 0.7,
  lim: vo('s07-lim'),
  fan: said('s07', '可新加坡人') - 1.6,
  ringReport: said('s07', '思想汇报'),
  glance: said('s07', '思想汇报') + 1.0,
  stamp7: SHOT.s07[1] - 0.7,
  typing: SHOT.s08[0] + 1.0,
  rings8: [0, 1.5, 3].map((d) => SHOT.s08[0] + 4.4 + d),
  stamp8: voEnd('s08') + 0.5,
  barOn: said('s09', '纽约') + 0.3,
  midnight: said('s09', '半夜十二点'),
  ringLunch: said('s09', '午休'),
  mike: vo('s09-mike'),
  stamp9: SHOT.s09[1] - 0.6,
  holiday: SHOT.s10[0] + 0.8,
  ban: SHOT.s10[0] + 4.2,
  flood: SHOT.s10[0] + 4.6,
  ringBan: said('s10', '调休'),
  cards11: s11cards,
  miss11: s11cards[5]! + 1.2,
  noon: said('s12', '中午'),
  sign: said('s12', '我也该') + 0.6,
  realise: said('s12', '我也该') + 2.4,
  yank: said('s12', '我也该') + 3.6,
  pullOut: SHOT.s13[0] + 0.3,
  hats: said('s13', '换了顶帽子'),
  kevinBack: SHOT.s14[0] + 0.2,
  bowBack: vo('s14-kevin') - 0.3,
  stamp14: voEnd('s14-kevin') + 1.4,
  peak: said('s15', '下午六点'),
  bjAxis: said('s15', '北京时间') - 0.3,
  ringNine: said('s15', '早上九点'),
  rise: SHOT.s16[0] + 0.3,
  helloLast: vo('s16-hello'),
  black: voEnd('s16-hello') + 0.6,
  title: voEnd('s16-hello') + 1.3,
}

export const SFX = events('sfx', {
  bell: 0.25,
  drop: K.drop + 0.45,
  stamp: [K.tap2, K.stamp5, K.stamp6, K.stamp7, K.stamp8, K.stamp9, K.ban, ...K.cards11, K.stamp14, K.title],
  ring: [K.ringZaima, K.ringComma, K.ringJa, K.ringReport, ...K.rings8, K.ringLunch, K.ringBan, K.ringNine],
  slap: K.slap,
  bow: K.bows,
  whoosh: [K.fan, K.request, K.pullOut, K.bjAxis],
  typing: K.typing,
  empty: K.holiday,
  flood: K.flood,
  miss: K.miss11,
  noon: K.noon,
  sign: K.sign,
  yank: K.yank,
  black: K.black,
})
