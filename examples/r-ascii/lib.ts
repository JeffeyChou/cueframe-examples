import type { Frame } from '@cueframe/core'
import lyrics from './data/lyrics.json'
import type { Grid } from './ascii-grid.js'
import { flash, hash, noise1, seg } from './motion.js'

/** Song time of narrative 0, and of the segment end. */
export const SONG0 = 29.709
export const SONG1 = 44.452
export const DUR = SONG1 - SONG0

export interface Line { i: number; t0: number; t1: number; en: string; zh: string; caps: boolean }
export const LINES: Line[] = lyrics
  .filter((l) => l.time >= SONG0 - 1e-6 && l.time < SONG1 - 1e-6)
  .map((l, i) => ({ i, t0: l.time - SONG0, t1: l.end - SONG0, en: l.en, zh: l.zh, caps: /^[A-Z ]+$/.test(l.en) }))

export type Kind = 'points' | 'circle' | 'sine' | 'limit'
export interface Section { kind: Kind; t0: number; t1: number; mid: number; hit: number; file: string; accent: number; ramp: number[] }
const KINDS: [Kind, string, number, number[]][] = [
  ['points', 'points.obj', 51, [17, 18, 24, 31, 38, 45, 51, 87, 123, 159, 195, 231]],
  ['circle', 'circle.geo', 214, [52, 88, 130, 136, 172, 178, 214, 220, 221, 222, 229, 231]],
  ['sine', 'sine.wav', 84, [22, 28, 34, 35, 41, 47, 83, 84, 120, 121, 157, 194]],
  ['limit', 'limit.inf', 201, [53, 54, 89, 90, 126, 127, 163, 164, 200, 201, 207, 219]],
]
/** Three lyric lines per section: lead line, "Then ...", the capitalised word. */
export const SECTIONS: Section[] = KINDS.map(([kind, file, accent, ramp], k) => ({
  kind, file, accent, ramp,
  t0: LINES[3 * k]!.t0, mid: LINES[3 * k + 1]!.t0, hit: LINES[3 * k + 2]!.t0,
  t1: k < 3 ? LINES[3 * k + 3]!.t0 : DUR,
}))

export const lineAt = (t: number) => {
  let i = 0
  while (i + 1 < LINES.length && t >= LINES[i + 1]!.t0) i++
  return LINES[i]!
}
export const sectionAt = (t: number) => {
  let i = 0
  while (i + 1 < SECTIONS.length && t >= SECTIONS[i + 1]!.t0) i++
  return SECTIONS[i]!
}

/** Glitch intensity over time: a calm base, kicks on every lyric, big hits on the capitalised words, a climb to the limit. */
export function intensity(t: number): number {
  let G = 0.12 + 0.07 * (noise1(t * 3, 5) + 1)
  for (const l of LINES) G += l.caps ? flash(t, l.t0, 0.22, 0.95) : flash(t, l.t0, 0.1, 0.4)
  const lim = SECTIONS[3]!
  G += 0.35 * seg(t, lim.t0, DUR) ** 2 + 0.6 * seg(t, DUR - 0.35, DUR)
  return Math.min(1.2, G)
}

/** Grid font and the layout of the program UI in cells (177 × 51 at 18 px). */
export const FONT = '18px "JBM"'
export const L = {
  left: { x: 0, y: 2, w: 38, h: 36 },
  view: { x: 38, y: 2, w: 100, h: 36 },
  right: { x: 138, y: 2, w: 39, h: 36 },
  track: { x: 0, y: 38, w: 177, h: 3 },
  caption: { x: 0, y: 41, w: 177, h: 9 },
  status: 50,
}

/** A drawing surface in pixel units inside a grid rect; (0, 0) is the rect centre. */
export class View {
  constructor(readonly g: Grid, readonly x: number, readonly y: number, readonly w: number, readonly h: number) {}
  get pw() { return this.w * this.g.cw }
  get ph() { return this.h * this.g.rh }
  cx(px: number) { return this.x + this.w / 2 + px / this.g.cw }
  cy(py: number) { return this.y + this.h / 2 + py / this.g.rh }
  put(px: number, py: number, c: string, fg: number, bg?: number) { this.g.put(this.cx(px), this.cy(py), c, fg, bg) }
  text(px: number, py: number, s: string, fg: number, bg?: number) { return this.g.text(Math.round(this.cx(px)), Math.round(this.cy(py)), s, fg, bg) }
  line(x0: number, y0: number, x1: number, y1: number, fg: number, c?: string) { this.g.line(this.cx(x0), this.cy(y0), this.cx(x1), this.cy(y1), fg, c) }
  /** Dashed line: every other cell. */
  dash(x0: number, y0: number, x1: number, y1: number, fg: number, c = '·') {
    const a = [this.cx(x0), this.cy(y0)], b = [this.cx(x1), this.cy(y1)]
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0]! - a[0]!), Math.abs(b[1]! - a[1]!))))
    for (let k = 0; k <= n; k += 2) this.g.put(a[0]! + ((b[0]! - a[0]!) * k) / n, a[1]! + ((b[1]! - a[1]!) * k) / n, c, fg)
  }
}

/** Cell-mask bitmaps of words, two vertical samples per cell, for block-letter banners. */
export interface Banner { cols: number; rows: number; on: Uint8Array }
export function banner(word: string, maxCols: number, maxRows: number, cw: number, rh: number): Banner {
  const sx = rh / 2 / cw
  const c = document.createElement('canvas')
  const g = c.getContext('2d', { willReadFrequently: true })!
  const px = Math.min(maxRows * 2 * 1.3, maxCols / (word.length * 0.6 * sx))
  const hpx = Math.ceil(px / 1.3)
  const wpx = Math.ceil(word.length * 0.6 * px * sx) + 2
  c.width = wpx; c.height = hpx
  g.setTransform(sx, 0, 0, 1, 0, 0)
  g.font = `800 ${px}px "JBM"`
  g.fillStyle = '#fff'
  g.textBaseline = 'alphabetic'
  g.fillText(word, 1 / sx, hpx * 0.96)
  const d = g.getImageData(0, 0, wpx, hpx).data
  const on = new Uint8Array(wpx * hpx)
  for (let i = 0; i < on.length; i++) on[i] = d[i * 4 + 3]! > 110 ? 1 : 0
  return { cols: wpx, rows: hpx + (hpx % 2), on: hpx % 2 ? Uint8Array.from([...on, ...new Uint8Array(wpx)]) : on }
}

/** Draws a banner at cell (x, y); `k` reveals columns left to right, `ramp` shades rows. */
export function drawBanner(g: Grid, b: Banner, x: number, y: number, ramp: number[], k: number, t: number) {
  const n = Math.floor(b.cols * k)
  for (let cy = 0; cy < b.rows / 2; cy++) {
    const sh = Math.round(3 * noise1(t * 14 + cy * 3.1, 9) * (1 - k))
    for (let cx = 0; cx < n; cx++) {
      const top = b.on[2 * cy * b.cols + cx]!, bot = b.on[(2 * cy + 1) * b.cols + cx]!
      if (!top && !bot) continue
      const col = ramp[Math.min(ramp.length - 1, Math.max(0, ramp.length - 1 - Math.floor((cy / (b.rows / 2)) * 5) - (hash(cx * 7 + cy, Math.floor(t * 12)) < 0.08 ? 4 : 0)))]!
      g.put(x + cx + sh, y + cy, top && bot ? '█' : top ? '▀' : '▄', col)
    }
  }
}

/** Cell-level damage before the CRT pass: shade blocks, palette-shifted rows, scrambled glyphs. */
export function corrupt(g: Grid, f: Frame, G: number) {
  const slow = f.rng(`blk:${Math.floor(f.frame / 2)}`)
  const r = f.rng('cell')
  const { cols, rows } = g
  const hot = [196, 201, 51, 226, 46, 214, 231]
  const nb = Math.floor(G * G * 14)
  for (let k = 0; k < nb; k++) {
    const w = slow.int(3, 30), h = slow.int(1, 3), x = slow.int(0, cols - w), y = slow.int(0, rows - h)
    const c = slow.pick(hot), sh = slow.pick(['█', '▓', '▒', '░'])
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const v = hash(xx * 31 + yy * 7, k + f.frame)
      g.put(xx, yy, v < 0.25 ? '█' : v < 0.5 ? '▓' : v < 0.75 ? sh : '░', c)
    }
  }
  const nr = Math.floor(G * 6)
  for (let k = 0; k < nr; k++) {
    const y = slow.int(0, rows), n = slow.int(1, 3), shift = slow.pick([36, 72, 108, 6, 1])
    for (let yy = y; yy < Math.min(rows, y + n); yy++) for (let x = 0; x < cols; x++) {
      const i = yy * cols + x, c = g.fg[i]!
      if (c >= 16 && c < 232) g.fg[i] = 16 + ((c - 16 + shift) % 216)
    }
  }
  const ns = Math.floor(G * 160)
  const junk = '#%&@$*+=?!/\\<>{}[]01'
  for (let k = 0; k < ns; k++) {
    const i = r.int(0, cols * rows)
    if (g.ch[i] !== ' ') { g.ch[i] = junk[r.int(0, junk.length)]!; if (r() < 0.4) g.fg[i] = r.pick(hot) }
  }
}

export const fmt = (v: number, d = 3, w = 7) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(d).padStart(w - 1, '0')
export const hex = (v: number, n = 4) => (Math.floor(v) >>> 0).toString(16).toUpperCase().padStart(n, '0').slice(-n)
