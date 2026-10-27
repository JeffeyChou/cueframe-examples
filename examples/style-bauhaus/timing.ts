// Every beat of the fable, on the bed's eighth-note grid (100 BPM from the first hop): stepped
// things move on it, so picture and score tick together. The score gets the sounds as events.
import { events } from '@cueframe/core'

/** The n-th eighth note after the first hop. */
export const g = (n: number) => 1.3 + 0.3 * n

export const K = {
  hops: [0, 1, 2, 3, 4, 5].map(g),
  labels: [g(6), g(7), g(8)],
  roll: [g(6), g(10) - 0.15] as const,
  legs: g(10),
  label4: g(11),
  marker: g(12),
  steps: [g(14), g(16), g(18)],
  stamps: [g(13), g(15), g(17)],
  ring: g(18) + 0.1,
  reject: g(20),
  squeeze: [g(21), g(26)] as const,
  pass: g(27),
  nod: g(29),
  hop: g(30),
  rollAway: [g(31), g(33)] as const,
  wipe: [g(32.5), g(35)] as const,
  line1: g(35) + 0.2,
  line2: g(35) + 0.7,
  speaker: [g(36), g(37), g(38)],
  nods: [g(40), g(41)],
  said: g(42),
  columns: [g(46), g(48)] as const,
  shapes: [g(48), g(48.5), g(49)],
  title: g(49.5),
  latin: g(50.5),
  turns: [g(52), g(54)],
  fade: g(56),
}
export const TOTAL = K.fade + 0.6

export const SFX = events('sfx', {
  hop: K.hops,
  label: [...K.labels, K.label4],
  legs: K.legs,
  step: [K.marker, ...K.steps],
  stamp: [...K.stamps, K.reject, K.pass],
  ring: K.ring,
  squeeze: K.squeeze[0],
  nod: [K.nod, ...K.nods],
  speaker: K.speaker,
  pop: K.hop + 0.15,
  wipe: K.wipe[0],
  line: [K.line1, K.line2],
  said: K.said,
  columns: K.columns[0],
  shapes: K.shapes,
  turn: K.turns,
})
