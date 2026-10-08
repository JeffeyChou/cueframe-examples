import raw from './data/lyrics.json'
import { smooth } from './lib.js'

// Narrative time 0 = song time SONG0.
export const SONG0 = 29.709
export const SONG1 = 44.452
export const DUR = SONG1 - SONG0
const EPS = 1e-6

export interface Line { i: number; t0: number; t1: number; en: string; zh: string; caps: boolean }
export const lines: Line[] = (raw as { time: number; end: number; en: string; zh: string }[])
  .filter((l) => l.time >= SONG0 - EPS && l.end <= SONG1 + EPS)
  .map((l, i) => ({ i, t0: l.time - SONG0, t1: l.end - SONG0, en: l.en, zh: l.zh, caps: /^[A-Z .]+$/.test(l.en) }))

// A stanza ends on its all-caps line.
export interface Stanza { k: number; t0: number; t1: number; lines: Line[] }
export const stanzas: Stanza[] = []
{
  let cur: Line[] = []
  for (const l of lines) {
    cur.push(l)
    if (l.caps) {
      stanzas.push({ k: stanzas.length, t0: cur[0].t0, t1: l.t1, lines: cur })
      cur = []
    }
  }
}

export function lineAt(t: number): Line {
  let cur = lines[0]
  for (const l of lines) if (t >= l.t0 - EPS) cur = l
  return cur
}
export function stanzaAt(t: number): Stanza {
  let cur = stanzas[0]
  for (const s of stanzas) if (t >= s.t0 - EPS) cur = s
  return cur
}

/** Glitch intensity 0..~1.6: a floor, spikes on lyric onsets, stronger on stanza cuts and caps lines. */
export function glitch(t: number): number {
  let g = 0.1 + 0.05 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 17.1 + 1)
  for (const l of lines) {
    const d = t - l.t0
    if (d >= -0.07 && d < 0) g += 0.5 * (1 + d / 0.07)
    if (d >= 0) g += (l.caps ? 0.95 : 0.45) * Math.exp(-d / (l.caps ? 0.32 : 0.16))
    if (l.caps && d >= 0 && t < l.t1) g += 0.18
  }
  for (const s of stanzas.slice(1)) g += 0.5 * Math.exp(-Math.abs(t - s.t0) / 0.1)
  g += 0.75 * smooth(DUR - 0.55, DUR, t)
  return Math.max(0, Math.min(1.6, g))
}
