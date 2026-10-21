// Acting: pose channels folded from layers, action envelopes with explicit phases, authored secondary
// motion, opt-in idle signals and optional verbs. Pure functions of time; nothing draws — a rig's
// set(pose) does. Nothing is on by default (no idle, no personality). Design: cueframe/docs/design/camera-space-acting.md.
//
//   const p = pose({ x: 720, y: 594, rot: 0, sx: 1, sy: 1, look: 0, lookY: 0, blink: 0, eyes: 'line' },
//     lean(t, T.speak, { hold: T.rush - T.speak, out: 0.15 }, snappy),
//     flinch(t, T.land, {}, snappy),
//     { mode: 'replace', w: phase(t, T.land, FLINCH) === 'hold' ? 1 : 0, v: { eyes: 'wide' } },
//     blink(t, 3))
//   rig.set(p)

import { clamp01, hash, inOutCubic, lerp, outBack, outCubic } from '@cueframe/recipes/motion.js'

export type Value = number | string
export type Channels = Record<string, Value>
export type Mode = 'add' | 'blend' | 'replace'
/** A layer: weight `w` (one number, or per channel: a written channel missing from the record weighs 0,
 * in pose() and strongest() alike) and channel values `v`. */
export interface Layer { mode: Mode; w: number | Record<string, number>; v: Record<string, Value> }

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
function weightOf(l: Layer, c: string): number {
  if (typeof l.w === 'number') return l.w
  if (l.w === null || typeof l.w !== 'object') throw new Error(`layer has no weight (w: ${String(l.w)})`)
  return own(l.w, c) ? l.w[c]! : 0
}

/**
 * Folds layers over `base` in order. `base` declares every channel; numbers: add `p + v·w`, blend
 * `lerp(p, v, w)` with w in [0, 1], replace `v` when w > 0; discrete values: blend switches at w ≥ 0.5,
 * replace when w > 0, add is an error. Falsy entries are skipped (conditional layers).
 */
export function pose<P extends Channels>(base: P, ...layers: (Layer | null | undefined | false)[]): P {
  const p: Channels = { ...base }
  layers.forEach((l, i) => {
    if (!l) return
    for (const [c, v] of Object.entries(l.v)) {
      if (!own(base, c)) throw new Error(`pose: layer ${i} writes channel "${c}", which the base does not declare`)
      const w = weightOf(l, c)
      if (!Number.isFinite(w)) throw new Error(`pose: layer ${i} channel "${c}" has weight ${w}`)
      if (l.mode === 'blend' && (w < 0 || w > 1)) throw new Error(`pose: layer ${i} blends "${c}" with weight ${w} (blend weights lie in [0, 1])`)
      const cur = p[c]!
      if (typeof cur !== typeof v) throw new Error(`pose: layer ${i} channel "${c}" is a ${typeof v}, the base's is a ${typeof cur}`)
      if (typeof cur === 'number') {
        const n = v as number
        if (l.mode === 'add') p[c] = cur + n * w
        else if (l.mode === 'blend') p[c] = lerp(cur, n, w)
        else if (w > 0) p[c] = n
      } else {
        if (l.mode === 'add') throw new Error(`pose: layer ${i} adds to discrete channel "${c}"`)
        if (l.mode === 'blend' ? w >= 0.5 : w > 0) p[c] = v
      }
    }
  })
  return p as P
}

/** One layer from several of the same mode: per channel, the value and weight of the layer with the
 * largest |w| (ties: the earlier). Repeated one-shots (flinches) combine this way. */
export function strongest(layers: readonly Layer[]): Layer {
  if (!layers.length) return { mode: 'add', w: 0, v: {} }
  const mode = layers[0]!.mode
  const w = Object.create(null) as Record<string, number>
  const v = Object.create(null) as Record<string, Value>
  for (const l of layers) {
    if (l.mode !== mode) throw new Error(`strongest: layers mix modes "${mode}" and "${l.mode}"`)
    for (const [c, x] of Object.entries(l.v)) {
      const k = weightOf(l, c)
      if (!own(w, c) || Math.abs(k) > Math.abs(w[c]!)) { w[c] = k; v[c] = x }
    }
  }
  return { mode, w, v }
}

export interface Phases { in: number; hold?: number; out: number }
export interface Style {
  /** Seconds of anticipation before `at`. */
  anticipate?: number
  /** Depth of the anticipation (the weight dips to −antic). Needs `anticipate` > 0. */
  antic?: number
  /** outBack overshoot of the attack (0: `ease`). */
  overshoot?: number
  /** A damped wobble in the release: (1 − u)·cos(2π·cycles·u)·e^(−decay·u). */
  settle?: { cycles: number; decay: number }
  ease?: (x: number) => number
  release?: (x: number) => number
}
export type PhaseName = 'before' | 'anticipate' | 'in' | 'hold' | 'out' | 'after'

function check(ph: Phases, st: Style) {
  for (const [k, v] of [['in', ph.in], ['out', ph.out]] as const) if (!(Number.isFinite(v) && v >= 0)) throw new Error(`envelope: ${k} must be a finite number ≥ 0`)
  const hold = ph.hold ?? 0
  if (!(hold >= 0)) throw new Error('envelope: hold must be ≥ 0')
  const A = st.anticipate ?? 0
  const antic = st.antic ?? 0
  if (!(Number.isFinite(A) && A >= 0)) throw new Error('envelope: anticipate must be a finite number ≥ 0')
  if (!(Number.isFinite(antic) && antic >= 0)) throw new Error('envelope: antic must be a finite number ≥ 0')
  if (antic > 0 && A === 0) throw new Error('envelope: antic needs anticipate > 0 (it would jump)')
  if (!((st.overshoot ?? 0) >= 0)) throw new Error('envelope: overshoot must be ≥ 0')
  if (st.settle && !(st.settle.cycles >= 0 && st.settle.decay >= 0)) throw new Error('envelope: settle cycles and decay must be ≥ 0')
  // Custom eases must run 0 → 1, or the phases would not meet.
  for (const [k, f] of [['ease', st.ease], ['release', st.release]] as const) {
    if (f && !(Math.abs(f(0)) < 1e-9 && Math.abs(f(1) - 1) < 1e-9)) throw new Error(`envelope: ${k} must map 0 to 0 and 1 to 1`)
  }
  return { A, antic, hold }
}

/** The phase of an action at t: before, anticipate, in (attack), hold, out (release), after. */
export function phase(t: number, at: number, ph: Phases, st: Style = {}): PhaseName {
  const { A, hold } = check(ph, st)
  const r = at + ph.in + hold
  if (t < at - A) return 'before'
  if (t < at) return 'anticipate'
  if (t < at + ph.in) return 'in'
  if (t < r) return 'hold'
  if (t < r + ph.out) return 'out'
  return 'after'
}

/** An action's weight at t: 0, an anticipation dip to −antic, the attack to 1 (overshooting by style),
 * a hold at 1, the release to 0 (with an optional settle), 0. Continuous wherever durations are > 0. */
export function envelope(t: number, at: number, ph: Phases, st: Style = {}): number {
  const { A, antic, hold } = check(ph, st)
  const r = at + ph.in + hold
  if (t < at - A) return 0
  if (t < at) return (-antic * (1 - Math.cos(Math.PI * ((t - (at - A)) / A)))) / 2 + 0   // + 0: never −0
  if (t === at && ph.in > 0) return antic > 0 ? -antic : 0
  if (t < at + ph.in) {
    const u = (t - at) / ph.in
    const e = (st.overshoot ?? 0) > 0 ? outBack(u, st.overshoot) : (st.ease ?? outCubic)(u)
    return -antic + (1 + antic) * e
  }
  if (t < r) return 1
  if (t === r && ph.out > 0) return 1
  if (t < r + ph.out) {
    const u = (t - r) / ph.out
    if (st.settle) return (1 - u) * Math.cos(2 * Math.PI * st.settle.cycles * u) * Math.exp(-st.settle.decay * u)
    return 1 - (st.release ?? inOutCubic)(u)
  }
  return 0
}

/** The strongest envelope (largest |w|, ties: the earlier) of an action repeated at several times. */
export function envelopeAt(t: number, at: number | readonly number[], ph: Phases, st: Style = {}): number {
  const ats = typeof at === 'number' ? [at] : at
  let best = 0
  for (const a of ats) { const w = envelope(t, a, ph, st); if (Math.abs(w) > Math.abs(best)) best = w }
  return best
}

/** Secondary motion: `fn` delayed. */
export const lag = (fn: (t: number) => number, t: number, delay: number) => fn(t - delay)

/**
 * Secondary motion: a damped spring following `fn`, integrated with a fixed step over [t − window, t]
 * from rest at fn(t − window). Pure (the same t gives the same value in any order); cost window·rate
 * calls of `fn`.
 */
export function springy(fn: (t: number) => number, t: number, o: { freq: number; zeta: number; window: number; rate?: number }): number {
  const rate = o.rate ?? 240
  const fin = (x: number) => Number.isFinite(x)
  if (!(fin(o.freq) && o.freq > 0 && fin(o.zeta) && o.zeta >= 0 && fin(o.window) && o.window >= 0 && fin(rate) && rate > 0)) {
    throw new Error('springy: freq > 0, zeta ≥ 0, window ≥ 0 and rate > 0, all finite')
  }
  const n = Math.max(1, Math.ceil(o.window * rate))
  if (n > 1e6) throw new Error(`springy: ${n} steps (window · rate) is over the 1e6 limit`)
  const dt = o.window / n
  const w = 2 * Math.PI * o.freq
  const t0 = t - o.window
  let x = fn(t0)
  let v = 0
  for (let k = 1; k <= n; k++) {
    v += (w * w * (fn(t0 + k * dt) - x) - 2 * o.zeta * w * v) * dt
    x += v * dt
  }
  return x
}

/** Opt-in idle: eyes close briefly about every `every` s, at seeded times (a blend layer on `blink`). */
export function blink(t: number, seed: number, o: { every?: number; dur?: number; channel?: string } = {}): Layer {
  const every = o.every ?? 3.2
  const dur = o.dur ?? 0.16
  const k = Math.floor(t / every)
  let w = 0
  for (const j of [k - 1, k]) {
    const at = j * every + every * (0.2 + 0.6 * hash(j, seed))
    const x = (t - at) / dur
    if (x > 0 && x < 1) w = Math.max(w, Math.sin(Math.PI * x))
  }
  return { mode: 'blend', w, v: { [o.channel ?? 'blink']: 1 } }
}

/** Opt-in idle: a seeded breathing sway (an add layer on `sy`, or `channel`). */
export function breath(t: number, o: { period?: number; amp?: number; seed?: number; channel?: string } = {}): Layer {
  const period = o.period ?? 3.6
  const ph = hash(0, o.seed ?? 0)
  return { mode: 'add', w: 1, v: { [o.channel ?? 'sy']: (o.amp ?? 0.015) * Math.sin(2 * Math.PI * (t / period + ph)) } }
}

// Verbs: optional, a few lines each over envelope(), on the standard channels x y rot sx sy look lookY
// (`channels` renames them for a rig that uses others). The default style is neutral.

type Rename = { channels?: Partial<Record<string, string>> }
const named = (v: Record<string, Value>, o: Rename) =>
  Object.fromEntries(Object.entries(v).map(([k, x]) => [o.channels?.[k] ?? k, x]))

/** Up `height` px and back over `dur`, stretching in the air (anticipation crouches and squashes). */
export function hop(t: number, at: number | readonly number[], o: { height?: number; dur?: number; stretch?: number } & Rename = {}, st: Style = {}): Layer {
  const d = o.dur ?? 0.35
  const w = envelopeAt(t, at, { in: d / 2, out: d / 2 }, { release: (x) => x * x, ...st })
  return { mode: 'add', w, v: named({ y: -(o.height ?? 40), sx: -(o.stretch ?? 0.08), sy: o.stretch ?? 0.08 }, o) }
}

/** A nod: the gaze drops by `depth` and comes back. */
export function nod(t: number, at: number | readonly number[], o: { depth?: number; dur?: number } & Rename = {}, st: Style = {}): Layer {
  const d = o.dur ?? 0.4
  return { mode: 'add', w: envelopeAt(t, at, { in: d * 0.4, out: d * 0.6 }, st), v: named({ lookY: o.depth ?? 0.8 }, o) }
}

/** A flinch: a quick squash away from `dir` (−1 left, 1 right), released slowly. */
export function flinch(t: number, at: number | readonly number[], o: { amount?: number; dir?: number; dur?: number } & Rename = {}, st: Style = {}): Layer {
  const d = o.dur ?? 0.4
  const a = o.amount ?? 1
  return { mode: 'add', w: envelopeAt(t, at, { in: d * 0.2, out: d * 0.8 }, st), v: named({ x: -6 * a * (o.dir ?? 1), y: 6 * a, sx: 0.08 * a, sy: -0.08 * a }, o) }
}

/** A lean of `angle` degrees, held for `hold` s (the release is the gate). */
export function lean(t: number, at: number, o: { angle?: number; in?: number; hold?: number; out?: number } & Rename = {}, st: Style = {}): Layer {
  return { mode: 'add', w: envelope(t, at, { in: o.in ?? 0.35, hold: o.hold ?? 0, out: o.out ?? 0.3 }, st), v: named({ rot: o.angle ?? 6, sx: 0.02, sy: -0.02 }, o) }
}

/** Look toward (x, y) in look units, held for `hold` s (default: until the end). A blend: weights are
 * clamped to [0, 1], so a style's anticipation and overshoot do not apply to the gaze itself. */
export function look(t: number, at: number, o: { x: number; y?: number; in?: number; hold?: number; out?: number } & Rename, st: Style = {}): Layer {
  const w = clamp01(envelope(t, at, { in: o.in ?? 0.2, hold: o.hold ?? Infinity, out: o.out ?? 0.2 }, st))
  return { mode: 'blend', w, v: named({ look: o.x, lookY: o.y ?? 0 }, o) }
}

/** Squash (q > 0) or stretch (q < 0) and back over `dur`. */
export function squash(t: number, at: number | readonly number[], o: { q?: number; dur?: number } & Rename = {}, st: Style = {}): Layer {
  const d = o.dur ?? 0.3
  const q = o.q ?? 0.15
  return { mode: 'add', w: envelopeAt(t, at, { in: d * 0.3, out: d * 0.7 }, st), v: named({ sx: q, sy: -q }, o) }
}

/** Sample styles (data, not defaults): short anticipation, strong overshoot, underdamped settle… */
export const snappy: Style = { anticipate: 0.08, antic: 0.3, overshoot: 2.4, settle: { cycles: 1.5, decay: 3 } }
/** …and long anticipation, no overshoot, slow eases. */
export const floaty: Style = { anticipate: 0.3, antic: 0.12, ease: inOutCubic, release: inOutCubic }
