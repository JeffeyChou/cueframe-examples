// The cut, derived from the drum hits: shots start on strong kicks, windows jump on every hit.
// cueframe: hand-rolled hit list → shot list → per-hit events; no beat-driven edit primitive.
import hitsFile from './build/hits.json'

export interface Hit { t: number; kind: 'kick' | 'snare' | 'hat' | 'other'; s: number }
export type Mode = 'tint' | 'pip' | 'grow' | 'sliver' | 'circle' | 'split' | 'strobe'
export interface Shot { i: number; clip: string; insert: string; mode: Mode; at: number; end: number; hits: Hit[]; scans: number[] }

export const DUR: number = (hitsFile as { dur?: number }).dur ?? 12
const all = (hitsFile.hits as Hit[]).filter((h) => h.t < DUR - 0.05)
// cueframe: onset lists are noisy; keep strong hits at least 0.1 s apart.
const hits: Hit[] = []
for (const h of all) if (h.s >= 0.45 && (hits.length === 0 || h.t - hits[hits.length - 1]!.t >= 0.1)) hits.push(h)
const beats = hitsFile.beats as number[]

const ORDER: [string, string, Mode][] = [
  ['puddle', 'drops', 'tint'],
  ['drops', 'puddle', 'grow'],
  ['roof', 'drops', 'sliver'],
  ['lightning', 'window', 'pip'],
  ['gulls-sunset', 'gull-glide', 'circle'],
  ['gull-glide', 'gulls-sunset', 'split'],
  ['window', 'lily', 'pip'],
  ['puddle', 'lightning', 'tint'],
  ['lily', 'puddle', 'strobe'],
]

function cuts(): number[] {
  // every second beat, snapped to a strong hit within 60 ms
  const out = [0]
  for (let i = 1; i < beats.length; i += 2) {
    const b = beats[i]!
    const near = hits.find((h) => Math.abs(h.t - b) < 0.06)
    const t = near ? near.t : b
    if (t - out[out.length - 1]! >= 0.8 && DUR - t > 0.6) out.push(t)
  }
  return out.slice(0, ORDER.length)
}

const starts = cuts()
export const SHOTS: Shot[] = starts.map((at, i) => {
  const end = starts[i + 1] ?? DUR
  const [clip, insert, mode] = ORDER[i]!
  const inside = hits.filter((h) => h.t > at + 0.04 && h.t < end - 0.04)
  return {
    i, clip, insert, mode, at, end, hits: inside,
    scans: [at, ...inside.filter((h) => h.kind !== 'hat' && h.s > 0.2).map((h) => h.t)],
  }
})

export function shotAt(t: number): Shot {
  let s = SHOTS[0]!
  for (const x of SHOTS) if (x.at <= t) s = x
  return s
}

/** Index of the last hit at or before t inside the shot (-1: before the first) and the time since it. */
export function lastHit(s: Shot, t: number): { k: number; since: number } {
  let k = -1
  for (let i = 0; i < s.hits.length; i++) if (s.hits[i]!.t <= t) k = i
  return { k, since: t - (k < 0 ? s.at : s.hits[k]!.t) }
}

export function lastScan(s: Shot, t: number): number {
  let r = s.at
  for (const x of s.scans) if (x <= t) r = x
  return r
}
