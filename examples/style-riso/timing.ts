// Every beat of 雨停了 in seconds, on a 96 BPM bar grid (one bar = 2.5 s); the score gets them as events.
import { events } from '@cueframe/core'

export const BAR = 2.5
export const TOTAL = 17.5

/** Shots: A tracks the walker in the rain, B holds on the walker, C is the cleared street. */
export const SHOT = { a: 0, b: 5, c: 10 } as const

export const K = {
  /** Each plate's roller: teal, yellow, pink. */
  plates: [0.15, 2.5, 7.5] as const,
  /** The walker stops; the rain thins and the plates drift apart. */
  stop: 5.6,
  drift: [6.25, 7.5] as const,
  /** Downbeat: the umbrella comes down, the plates snap back, pink rolls in. */
  snap: 7.5,
  /** The title is stamped twice, the second hit a hair off. */
  title: [11.25, 11.55] as const,
  /** Pull back from the picture to the printed sheet. */
  pull: [12.5, 15] as const,
}

export const SFX = events('sfx', {
  plate: [...K.plates],
  cut: [SHOT.b, SHOT.c],
  stop: K.stop,
  snap: K.snap,
  title: [...K.title],
  sheet: K.pull[1],
})
