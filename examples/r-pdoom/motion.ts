// motion: easings, time windows and one-shot effects, all pure functions of absolute time.
// const s = slam(f.t, f.cue('title.in')); el.style.transform = xf({ scale: s.scale, ...shake(f.t, f.cue('hit')) })
// el.style.opacity = String(win(f.t, a, b, 0.3, 0.4) * s.opacity); el.textContent = text.slice(0, typed(f.t, a, text.length))
// Pass `at` times from cues; nothing here keeps state, so any frame renders in any order.

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k

export const linear = (x: number) => clamp01(x)
export const outCubic = (x: number) => 1 - (1 - clamp01(x)) ** 3
export const inCubic = (x: number) => clamp01(x) ** 3
export const outExpo = (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * clamp01(x)))
export const inOutCubic = (x: number) => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
/** Overshoots past 1 and settles; `s` sets the overshoot (1.7 ≈ 10%). */
export const outBack = (x: number, s = 1.7) => {
  const t = clamp01(x) - 1
  return 1 + t * t * ((s + 1) * t + s)
}
/** Damped spring 0→1 over x ∈ [0, 1]: `zeta` damping ratio, `cycles` oscillations in the window. */
export function spring(x: number, zeta = 0.4, cycles = 2.2): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const w = 2 * Math.PI * cycles
  const wd = w * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * w * x) * (Math.cos(wd * x) + ((zeta * w) / wd) * Math.sin(wd * x))
}

/** Progress of t through [a, b], eased. 0 before a, 1 after b. */
export const seg = (t: number, a: number, b: number, ease: (x: number) => number = linear) =>
  ease(b > a ? (t - a) / (b - a) : t >= a ? 1 : 0)

/** Visibility envelope: fades in over [a, a+fadeIn], holds, fades out over [b-fadeOut, b]. */
export function win(t: number, a: number, b: number, fadeIn = 0.3, fadeOut = 0.3): number {
  if (t < a || t >= b) return 0
  const i = fadeIn > 0 ? clamp01((t - a) / fadeIn) : 1
  const o = fadeOut > 0 ? clamp01((b - t) / fadeOut) : 1
  return Math.min(i, o)
}

export interface Pose { scale: number; opacity: number }

/** Pop in at `at`: scale from 0.6 with a back-out overshoot. */
export function pop(t: number, at: number, dur = 0.45): Pose {
  const k = (t - at) / dur
  if (k <= 0) return { scale: 0.6, opacity: 0 }
  return { scale: 0.6 + 0.4 * outBack(k), opacity: clamp01(k * 2.5) }
}

/** Slam in at `at`: falls from `from`× to 1 (power-in), bounces to 1.06 and settles. */
export function slam(t: number, at: number, dur = 0.32, from = 1.6): Pose {
  const k = (t - at) / dur
  if (k <= 0) return { scale: from, opacity: 0 }
  if (k < 1) return { scale: lerp(from, 1, inCubic(k)), opacity: clamp01(k * 3) }
  const b = (t - at - dur) / 0.25
  return { scale: 1 + 0.06 * Math.sin(Math.PI * clamp01(b)) * (1 - clamp01(b)), opacity: 1 }
}

/** Deterministic hash → [0, 1). */
export function hash(n: number, seed = 0): number {
  let h = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x9e3779b1), 0x27d4eb2d) ^ 0x165667b1
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** Smooth value noise in [-1, 1]. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x)
  const u = x - i
  const s = u * u * (3 - 2 * u)
  return lerp(hash(i, seed), hash(i + 1, seed), s) * 2 - 1
}

/** Seeded shake after `at`, decaying to 0 over `dur`. Returns px offsets and degrees. */
export function shake(t: number, at: number, o: { dur?: number; amp?: number; freq?: number; seed?: number } = {}) {
  const { dur = 0.4, amp = 16, freq = 30, seed = 1 } = o
  const k = (t - at) / dur
  if (k < 0 || k >= 1) return { x: 0, y: 0, rot: 0 }
  const a = amp * (1 - k) ** 2
  const u = (t - at) * freq
  return { x: a * noise1(u, seed), y: a * noise1(u, seed + 7), rot: 0.08 * a * noise1(u, seed + 13) }
}

/** Flash opacity: jumps to `peak` at `at`, decays exponentially. */
export const flash = (t: number, at: number, dur = 0.3, peak = 1) =>
  t < at || t >= at + dur * 3 ? 0 : peak * Math.exp((-3 * (t - at)) / dur)

/** Characters revealed by a typewriter starting at `at` with `cps` chars per second. */
export const typed = (t: number, at: number, n: number, cps = 24) =>
  t < at ? 0 : Math.min(n, Math.floor((t - at) * cps + 1e-6))

/** Blinking caret: on for the first half of each 1/rate period. */
export const caret = (t: number, rate = 2) => ((t * rate) % 1 + 1) % 1 < 0.5

/** CSS transform from a pose; `center` prepends translate(-50%, -50%). */
export function xf(p: { x?: number; y?: number; scale?: number; rot?: number }, center = true): string {
  const { x = 0, y = 0, scale = 1, rot = 0 } = p
  return `${center ? 'translate(-50%, -50%) ' : ''}translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(4)})`
}
