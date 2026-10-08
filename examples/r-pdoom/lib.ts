import type { Frame } from '@cueframe/core'
import { glyphs, type Glyphs, type PathCmd, type TextLayout } from '@cueframe/gfx'
import archivoUrl from './data/fonts/Archivo[wdth,wght].ttf?url'
import monoUrl from './data/fonts/IBMPlexMono-Regular.ttf?url'
import monoMedUrl from './data/fonts/IBMPlexMono-Medium.ttf?url'
import lyrics from './data/lyrics.json'
import audio from './data/audio.json'
import { clamp01 } from './motion.js'

export * from './motion.js'
export { archivoUrl, monoUrl, monoMedUrl }

export const C = {
  ink: '#0A0A0B', ink2: '#151517', graphite: '#5E5B57', ash: '#9C978F', bone: '#EEE9DF',
  signal: '#FF4D12', ember: '#FF8A3D', blood: '#C21D0B',
}
export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

export interface Fonts { archivo: Glyphs; mono: Glyphs; monoMed: Glyphs }
export const loadFonts = async (): Promise<Fonts> => {
  const [archivo, mono, monoMed] = await Promise.all([glyphs(archivoUrl), glyphs(monoUrl), glyphs(monoMedUrl)])
  return { archivo, mono, monoMed }
}

// ---- Timing: narrative 0 = start of pre-chorus 1 in song time. All times below are narrative.
const sec = (name: string) => audio.sections.find((s) => s.name === name)!
export const T0 = sec('pre1').start
const sh = (x: number) => +(x - T0).toFixed(6)

export interface W { w: string; t0: number; t1: number; syl: [number, number][] }
const lineOf = (pred: (text: string) => boolean, after = -Infinity) => {
  const l = lyrics.lines.find((x) => x.start >= after - 1e-6 && pred(x.text))!
  const words: W[] = l.words.map((w) => {
    const syl = ((w as { syl?: number[][] }).syl ?? [[w.start, w.end]]).map(([a, b]) => [sh(a!), sh(b!)] as [number, number])
    return { w: w.w, t0: sh(w.start), t1: sh(w.end), syl }
  })
  return { text: l.text, t0: sh(l.start), t1: sh(l.end), words }
}
export const PROMPT = lineOf((s) => s.startsWith('ChatGPT'), T0 - 0.05)
export const HOOK = lineOf((s) => s.startsWith("I'm upping"), PROMPT.t1 + T0 - 0.05)

export const BEATS = audio.beats.map(sh)
export const DOWNBEATS = audio.downbeats.map(sh)
const lastBefore = (xs: number[], t: number) => xs.filter((x) => x < t - 1e-6).at(-1)!
const firstFrom = (xs: number[], t: number) => xs.find((x) => x >= t - 0.01)!
/** ⏎ lands on the downbeat that opens the chorus (the first downbeat during the last prompt word). */
export const ENTER = firstFrom(DOWNBEATS, PROMPT.words.at(-1)!.t0)
/** Cut to the hook on the last beat before its first word. */
export const CUT = lastBefore(BEATS, HOOK.words[0]!.t0)
/** End on the beat that closes "P(doom)". */
export const END = firstFrom(BEATS, HOOK.t1)
export const KICKS = audio.onsets.kick.map(([t, s]) => [sh(t!), s!] as [number, number]).filter(([t]) => t > -1 && t < END + 1)

const ENV_RATE = 100
export const env = (name: 'rms' | 'low' | 'vocal' | 'drums', t: number) => {
  const xs = audio[name] as number[]
  const i = Math.max(0, Math.min(xs.length - 1, Math.round((t + T0) * ENV_RATE)))
  return xs[i]!
}
/** Sum of exponentially decaying kicks before t. */
export const kickPulse = (t: number, decay = 0.12) => {
  let s = 0
  for (const [k, a] of KICKS) if (t >= k && t - k < decay * 6) s += a * Math.exp(-(t - k) / decay)
  return s
}

export const progress = (w: { t0: number; t1: number }, t: number) => clamp01((t - w.t0) / Math.max(1e-6, w.t1 - w.t0))

// ---- Glyph helpers
export function bbox(cmds: PathCmd[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const c of cmds) {
    if (c.type === 'Z') continue
    const pts: number[][] = [[c.x, c.y]]
    if (c.type === 'Q') pts.push([c.x1, c.y1])
    if (c.type === 'C') pts.push([c.x1, c.y1], [c.x2, c.y2])
    for (const [x, y] of pts) { x0 = Math.min(x0, x!); y0 = Math.min(y0, y!); x1 = Math.max(x1, x!); y1 = Math.max(y1, y!) }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}
export const inkBox = (gl: Glyphs, lay: TextLayout) => bbox(gl.path(lay))

/** Spark: hot core, short tail along (dx, dy), a few sputtering sparks keyed by frame. */
export function spark(g: CanvasRenderingContext2D, f: Frame, x: number, y: number, o: { r?: number; dx?: number; dy?: number; a?: number; seed?: string } = {}) {
  const { r = 9, dx = -1, dy = 0, a = 1, seed = 'spark' } = o
  if (a <= 0) return
  g.save()
  g.globalAlpha = a
  const tail = g.createLinearGradient(x, y, x + dx * r * 5, y + dy * r * 5)
  tail.addColorStop(0, rgba(C.ember, 0.9))
  tail.addColorStop(1, rgba(C.signal, 0))
  g.strokeStyle = tail
  g.lineWidth = r * 0.55
  g.lineCap = 'round'
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * r * 5, y + dy * r * 5); g.stroke()
  const halo = g.createRadialGradient(x, y, 0, x, y, r * 2.4)
  halo.addColorStop(0, rgba('#FFE2C4', 1))
  halo.addColorStop(0.18, rgba(C.ember, 0.95))
  halo.addColorStop(0.5, rgba(C.signal, 0.35))
  halo.addColorStop(1, rgba(C.signal, 0))
  g.fillStyle = halo
  g.beginPath(); g.arc(x, y, r * 2.4, 0, Math.PI * 2); g.fill()
  const rng = f.rng(seed)
  g.fillStyle = C.ember
  for (let i = 0; i < 5; i++) {
    const ang = rng.range(0, Math.PI * 2), d = rng.range(r * 0.8, r * 3.2), s = rng.range(0.8, 2.2)
    g.globalAlpha = a * rng.range(0.3, 1)
    g.fillRect(x + Math.cos(ang) * d - s / 2, y + Math.sin(ang) * d - s / 2, s, s)
  }
  g.restore()
}

/** Return key, drawn (the fonts have no ⏎): a keycap with a return arrow. */
export function returnKey(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, stroke: string, fill: string | null, lw = 1.5) {
  const h = size / 2
  g.save()
  if (fill) { g.fillStyle = fill; g.fillRect(cx - h, cy - h, size, size) }
  g.strokeStyle = stroke
  g.lineWidth = lw
  if (!fill) g.strokeRect(cx - h + 0.5, cy - h + 0.5, size - 1, size - 1)
  const u = size / 56
  g.strokeStyle = fill ? C.ink : stroke
  g.lineWidth = 2.6 * u
  g.lineJoin = 'miter'
  g.beginPath()
  g.moveTo(cx + 13 * u, cy - 14 * u)
  g.lineTo(cx + 13 * u, cy + 5 * u)
  g.lineTo(cx - 14 * u, cy + 5 * u)
  g.stroke()
  g.beginPath()
  g.moveTo(cx - 6 * u, cy - 3 * u)
  g.lineTo(cx - 14 * u, cy + 5 * u)
  g.lineTo(cx - 6 * u, cy + 13 * u)
  g.stroke()
  g.restore()
}
