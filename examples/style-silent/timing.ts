// Every beat of 市场街 1906 in seconds, on a 120 BPM waltz grid (one bar = 1.5 s); the score gets them as events.
import { events } from '@cueframe/core'

export const BAR = 1.5
export const TOTAL = 24

/** Parts: title card, shot A (printed film), shot B (film turning to ink), the second card, the end card. */
export const PART = { title: 0, a: 3, b: 9, card: 15, end: 19.5 } as const

export const K = {
  /** Shot B: the photograph turns into a drawing. */
  ink: [10.5, 12] as const,
  /** The iris closes on the Ferry Building clock. */
  iris: [13.5, 15] as const,
  /** The second card burns through in the gate; then black. */
  burn: [17.25, 19] as const,
  black: 19,
}

/** Plate b: the clock face, 0..1 of the frame, over the iris. */
export const CLOCK = [0.495, 0.065] as const

export const CUE = events('cue', {
  cut: [PART.a, PART.b, PART.card, PART.end],
  ink: K.ink[0],
  iris: K.iris[0],
  burn: K.burn[0],
  black: K.black,
})
