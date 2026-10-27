// Every beat of the strip, in seconds; the score gets the sounds as events.
import { events } from '@cueframe/core'

export const TOTAL = 17
/** The camera's flights between shots (page → panels → page), motion-blurred. */
export const MOVES: [number, number][] = [[1.8, 2.45], [4.85, 5.45], [7.85, 8.45], [10.75, 11.3], [14.15, 15.0]]
/** The four panels' acting windows: before `a` a panel holds its first state, after `b` its last. */
export const WIN = { p1: [2.4, 4.9], p2: [5.3, 7.9], p3: [8.4, 10.8], p4: [11.2, 14.2] } as const

export const K = {
  mast: 0.3,
  inks: [0.55, 0.7, 0.85, 1.0],
  caption1: 2.5,
  seven: 3.55,
  wake: 3.95,
  ring: 5.4,
  hops: [5.45, 5.95, 6.45, 6.95, 7.45],
  ring2: 6.5,
  throw: 8.55,
  hit: 9.15,
  drop: 11.35,
  balloon: 12.2,
  snore: 13.0,
  tbc: 13.5,
  black: 16.3,
}

export const SFX = events('sfx', {
  panel1: MOVES[0]![1],
  ink: K.inks,
  mast: K.mast,
  tick: [K.seven - 1, K.seven - 0.5, K.seven],
  wake: K.wake,
  ring: K.ring,
  hop: K.hops,
  ring2: K.ring2,
  throw: K.throw,
  hit: K.hit,
  drop: K.drop,
  balloon: K.balloon,
  snore: K.snore,
  tbc: K.tbc,
  black: K.black,
})
