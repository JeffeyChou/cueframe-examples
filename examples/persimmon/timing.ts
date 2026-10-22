// The film's times, shared by the scene and the score (timeline events → build/page-cues.json → score.py).
import { events } from '@cueframe/core'

export const DUR = 13.6
export const U = 14, X = 1000
// s1 (wide): walk in (a stride is 20u) and stop; s2 (medium, from the turn): notice, want, crouch, jump, miss, land, sulk
export const WALK = { a: 0.9, b: 2.6, from: -120 }
export const TURN = 2.62
export const JUMP = { at: 5.2, land: 6.15, h: 10.2 }
// s3: the gust, the fall, the bonk, the catch
export const WIND = 8.4, DROP = 9.7, BONK = 10.3, CATCH = 10.95, CLOSE = { a: 12.7, b: 13.5 }
export const SEEN = 3.05, WANT = 3.6, SULK = 6.9, REALISE = 11.3, JOY = 12.0

/** The walk's progress 0..1: a steady trot that slows over the last 0.4 s to stop under the tree. */
export function walkK(t: number) {
  const T = WALK.b - WALK.a, d = 0.4, v = 1 / (T - d / 2), x = Math.min(Math.max(t - WALK.a, 0), T)
  return x < T - d ? v * x : v * (T - d) + v * (x - (T - d)) - (v * (x - (T - d)) ** 2) / (2 * d)
}
/** The walk's leg phase at t (rad). */
export const walkPhase = (t: number) => ((walkK(t) * (X - WALK.from)) / (20 * U)) * 2 * Math.PI

// a footstep each time a foot comes down (the phase crosses a multiple of π)
const steps: number[] = []
for (let t = WALK.a, last = 0; t < WALK.b; t += 1 / 480) {
  const k = Math.floor(walkPhase(t) / Math.PI)
  if (k > last) { steps.push(+t.toFixed(4)); last = k }
}

export const SFX = events('sfx', {
  iris: 0.7, steps, seen: SEEN, want: WANT, jump: JUMP.at, land: JUMP.land, sulk: SULK,
  wind: WIND, drop: DROP, bonk: BONK, catch: CATCH, realise: REALISE, joy: JOY, close: CLOSE.b,
})
