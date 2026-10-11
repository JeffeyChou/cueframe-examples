// Deterministic randomness: integer hash, value noise, and small PRNGs keyed by strings and frames.

export interface Rng { (): number; range(a: number, b: number): number; int(a: number, b: number): number; pick<T>(xs: readonly T[]): T }

export function hash(n: number, seed = 0): number {
  let h = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x9e3779b1), 0x27d4eb2d) ^ 0x165667b1
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export const hash2 = (x: number, y: number, seed = 0) => hash(Math.imul(x | 0, 0x1f1f1f1f) ^ (y | 0), seed)
const smooth = (u: number) => u * u * (3 - 2 * u)
/** Value noise in [-1, 1]. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x), s = smooth(x - i)
  return (hash(i, seed) + (hash(i + 1, seed) - hash(i, seed)) * s) * 2 - 1
}
export function noise2(x: number, y: number, seed = 0): number {
  const i = Math.floor(x), j = Math.floor(y), u = smooth(x - i), v = smooth(y - j)
  const a = hash2(i, j, seed), b = hash2(i + 1, j, seed), c = hash2(i, j + 1, seed), d = hash2(i + 1, j + 1, seed)
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1
}
export function fbm(x: number, y: number, seed = 0, oct = 4): number {
  let s = 0, a = 0.5, f = 1
  for (let k = 0; k < oct; k++) { s += a * noise2(x * f, y * f, seed + k * 17); a *= 0.5; f *= 2.03 }
  return s
}

export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
function fromState(state: number): Rng {
  let a = state >>> 0
  const next = (() => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }) as Rng
  next.range = (lo, hi) => lo + (hi - lo) * next()
  next.int = (lo, hi) => lo + Math.floor((hi - lo) * next())
  next.pick = (xs) => xs[Math.floor(xs.length * next())]!
  return next
}
export const seeded = (seed: number | string) => fromState(typeof seed === 'string' ? hashString(seed) : Math.floor(hash(seed) * 4294967296))
/** PRNG for one frame: same (seed, frame) → same sequence. */
export const frameRng = (seed: string, frame: number) => fromState(hashString(seed) ^ Math.imul(frame + 1, 0x9e3779b1))
