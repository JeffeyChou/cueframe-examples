// The song as data: lyric lines from data/lyrics.json, acts derived from line indices, beats and
// a spectrum (from build/audio.json when a track was analysed, procedural otherwise).
import lyrics from '../data/lyrics.json' with { type: 'json' }
import audio from '../build/audio.json' with { type: 'json' }
import { hash, noise1 } from './rng.ts'

export interface Line { i: number; t0: number; t1: number; next: number; en: string; zh: string; caps: boolean; title: boolean }
const raw = lyrics as { time: number; end: number; en: string; zh: string }[]
export const LINES: Line[] = raw.map((l, i) => ({
  i, t0: l.time, t1: l.end, next: raw[i + 1]?.time ?? l.end, en: l.en, zh: l.zh,
  caps: /[A-Z]/.test(l.en) && !/[a-z]/.test(l.en), title: /\(.*\);/.test(l.en),
}))

const A = audio as { source: string | null; duration: number; fps: number; bands: number; spec: string; beats: number[] }
/** Song length: the analysed track, or the last line plus a power-down tail. */
export const END = A.duration > 0 ? A.duration : LINES[LINES.length - 1]!.t1 + 3.6

export type ActId = 'boot' | 'title' | 'geometry' | 'current' | 'chorus' | 'organic' | 'switch' | 'vibrate' | 'left' |
  'fragments' | 'illegal' | 'crash' | 'execution' | 'chorus2' | 'love' | 'decay' | 'finale'
export interface Act { id: ActId; t0: number; t1: number; first: number; last: number; file: string; accent: number; hue: number }
const at = (i: number) => LINES[i]!.t0
const after = (i: number) => LINES[i]!.t1
/** [id, start time, first line, file name in the tab bar, accent]. Line indices come from the lyric data. */
const SPEC: [ActId, number, number, string, number, number][] = [
  ['boot', 0, 0, 'boot.sys', 0x39ff88, 0.38],
  ['title', at(11), 11, 'world.exe', 0x39ff88, 0.38],
  ['geometry', at(12), 12, 'geom.obj', 0x2ee6ff, 0.52],
  ['current', at(24), 24, 'current.ac', 0x4fa8ff, 0.6],
  ['chorus', at(32), 32, 'stim.dll', 0xff3df0, 0.85],
  ['organic', at(44), 44, 'organic.db', 0xb06cff, 0.75],
  ['switch', at(56), 56, 'switch.cfg', 0xff6ab4, 0.92],
  ['vibrate', at(64), 64, 'vibe.wav', 0x3dfcff, 0.5],
  ['left', at(70), 70, 'session.log', 0x9aa7b8, 0.6],
  ['fragments', at(77), 77, 'heap.dump', 0xd8f4ff, 0.55],
  ['illegal', at(83), 83, 'god.sys', 0xff2a3a, 0.0],
  ['crash', after(85), 86, 'core.dump', 0xff2a3a, 0.0],
  ['execution', at(86), 86, 'exec.bin', 0xff3030, 0.0],
  ['chorus2', at(105), 105, 'exec.bin', 0xff3a6a, 0.97],
  ['love', at(116), 116, 'love.alg', 0xff4f8b, 0.95],
  ['decay', after(127), 128, 'love.alg', 0xff4f8b, 0.95],
  ['finale', at(128), 128, 'world.exe', 0xff3030, 0.0],
]
export const ACTS: Act[] = SPEC.map(([id, t0, first, file, accent, hue], k) => {
  const nx = SPEC[k + 1]
  const t1 = nx ? nx[1] : END
  let last = first
  while (last + 1 < LINES.length && LINES[last + 1]!.t0 < t1 - 1e-6) last++
  return { id, t0, t1, first, last, file, accent, hue }
})

export function lineAt(t: number): Line | null {
  let lo = 0, hi = LINES.length - 1
  if (t < LINES[0]!.t0) return null
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (LINES[m]!.t0 <= t) lo = m; else hi = m - 1 }
  const l = LINES[lo]!
  return t < l.t1 + 0.35 || t < l.next - 0.02 && l.next - l.t1 < 0.6 ? l : null
}
export const lastLine = (t: number) => {
  let i = 0
  while (i + 1 < LINES.length && LINES[i + 1]!.t0 <= t) i++
  return t >= LINES[0]!.t0 ? LINES[i]! : null
}
export function actAt(t: number): Act {
  let i = 0
  while (i + 1 < ACTS.length && t >= ACTS[i + 1]!.t0) i++
  return ACTS[i]!
}
export const act = (id: ActId) => ACTS.find((a) => a.id === id)!
/** Lines of an act, in order. */
export const linesOf = (a: Act) => LINES.slice(a.first, a.last + 1)
/** Capitalised hit lines inside [a, b). */
export const capsIn = (a: number, b: number) => LINES.filter((l) => l.caps && l.t0 >= a && l.t0 < b)
/** Most recent line start at or before t within the act (or null). */
export function lineIn(a: Act, t: number): Line | null {
  let r: Line | null = null
  for (const l of linesOf(a)) if (l.t0 <= t) r = l
  return r
}

// beats: analysed when available; otherwise a 130 BPM grid phase-fitted to the lyric onsets
const BPM = 130
const PERIOD = 60 / BPM
const PHASE = (() => {
  let re = 0, im = 0
  for (const l of LINES) { const a = (2 * Math.PI * l.t0) / PERIOD; re += Math.cos(a); im += Math.sin(a) }
  return ((Math.atan2(im, re) / (2 * Math.PI)) * PERIOD + PERIOD) % PERIOD
})()
export function beatAt(t: number): { n: number; phase: number; t0: number } {
  const b = A.beats
  if (b.length > 8) {
    let lo = 0, hi = b.length - 1
    if (t < b[0]!) return { n: -1, phase: 0, t0: b[0]! - PERIOD }
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (b[m]! <= t) lo = m; else hi = m - 1 }
    const d = (b[lo + 1] ?? b[lo]! + PERIOD) - b[lo]!
    return { n: lo, phase: (t - b[lo]!) / d, t0: b[lo]! }
  }
  const x = (t - PHASE) / PERIOD
  const n = Math.floor(x)
  return { n, phase: x - n, t0: PHASE + n * PERIOD }
}
/** A kick envelope: 1 on the beat, decaying. */
export const pulse = (t: number, decay = 7) => Math.exp(-beatAt(t).phase * decay)

// spectrum: bands × frames, uint8, base64
const specBytes: Uint8Array | null = A.spec ? Uint8Array.from(atob(A.spec), (c) => c.charCodeAt(0)) : null
export const BANDS = A.bands > 0 ? A.bands : 48
/** Band energies 0..1 at t (length BANDS). */
export function spectrum(t: number, out: Float32Array = new Float32Array(BANDS)): Float32Array {
  if (specBytes) {
    const f = Math.max(0, Math.min(specBytes.length / BANDS - 1, Math.round(t * A.fps)))
    for (let b = 0; b < BANDS; b++) out[b] = specBytes[f * BANDS + b]! / 255
    return out
  }
  const E = energy(t)
  const k = pulse(t, 6), hat = Math.exp(-((beatAt(t).phase * 2) % 1) * 12)
  for (let b = 0; b < BANDS; b++) {
    const u = b / (BANDS - 1)
    const body = 0.55 * Math.exp(-u * 2.2) + 0.25 * (0.5 + 0.5 * noise1(t * 9 + b * 0.7, b))
    const low = k * Math.exp(-u * 7) * 0.9, high = hat * Math.exp(-((u - 0.82) ** 2) * 40) * 0.5
    out[b] = Math.max(0, Math.min(1, E * (body + low + high) * (0.7 + 0.3 * hash(b, Math.floor(t * 30)))))
  }
  return out
}

/** Musical energy 0..1: quiet intro and breaks, full choruses, the execution run at the top. */
export function energy(t: number): number {
  const a = actAt(t)
  const base: Record<ActId, number> = {
    boot: 0.35, title: 0.55, geometry: 0.7, current: 0.65, chorus: 0.9, organic: 0.72, switch: 0.7, vibrate: 0.85,
    left: 0.45, fragments: 0.6, illegal: 0.85, crash: 0.95, execution: 1, chorus2: 0.95, love: 0.8, decay: 0.5, finale: 0.6,
  }
  let e = base[a.id]
  if (a.id === 'finale') e *= Math.max(0, 1 - (t - a.t0) / Math.max(1, END - a.t0))
  return e
}
