// A truecolor character-cell buffer shared by the terminal player and the canvas renderer.
// Colours are packed 0xRRGGBB; bg -1 means "nothing painted". Wide (CJK) glyphs take two cells,
// the second holding '' as a continuation marker.

export interface Rect { x: number; y: number; w: number; h: number }

export const rgb = (r: number, g: number, b: number) =>
  (Math.max(0, Math.min(255, Math.round(r))) << 16) | (Math.max(0, Math.min(255, Math.round(g))) << 8) | Math.max(0, Math.min(255, Math.round(b)))
export const R = (c: number) => (c >> 16) & 255
export const G = (c: number) => (c >> 8) & 255
export const B = (c: number) => c & 255
export const mix = (a: number, b: number, k: number) => rgb(R(a) + (R(b) - R(a)) * k, G(a) + (G(b) - G(a)) * k, B(a) + (B(b) - B(a)) * k)
export const mul = (c: number, k: number) => rgb(R(c) * k, G(c) * k, B(c) * k)
export const add = (a: number, b: number) => rgb(R(a) + R(b), G(a) + G(b), B(a) + B(b))
export const luma = (c: number) => (0.2126 * R(c) + 0.7152 * G(c) + 0.0722 * B(c)) / 255
export const hex = (s: string) => parseInt(s.replace('#', ''), 16)
/** h in turns, s and l in 0..1. */
export function hsl(h: number, s: number, l: number): number {
  h = ((h % 1) + 1) % 1
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return rgb(f(0) * 255, f(8) * 255, f(4) * 255)
}
/** Sample a gradient of stops by v in 0..1. */
export function grad(stops: readonly number[], v: number): number {
  const x = Math.max(0, Math.min(1, v)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  return mix(stops[i]!, stops[i + 1]!, x - i)
}

export function isWide(c: string): boolean {
  const u = c.codePointAt(0) ?? 0
  return (u >= 0x1100 && u <= 0x115f) || (u >= 0x2e80 && u <= 0xa4cf && u !== 0x303f) || (u >= 0xac00 && u <= 0xd7a3) ||
    (u >= 0xf900 && u <= 0xfaff) || (u >= 0xfe30 && u <= 0xfe4f) || (u >= 0xff00 && u <= 0xff60) || (u >= 0xffe0 && u <= 0xffe6)
}
export const strWidth = (s: string) => { let w = 0; for (const c of s) w += isWide(c) ? 2 : 1; return w }

export class Cells {
  cols: number
  rows: number
  ch: string[]
  fg: Int32Array
  bg: Int32Array
  /** attribute bits per cell: 1 = bold */
  at: Uint8Array
  /** attribute written by put() */
  pen = 0
  clip: Rect
  /** Pixel aspect of one cell (height / width); 2 is a typical terminal. */
  aspect = 2
  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    this.ch = new Array(cols * rows).fill(' ')
    this.fg = new Int32Array(cols * rows)
    this.bg = new Int32Array(cols * rows).fill(-1)
    this.at = new Uint8Array(cols * rows)
    this.clip = { x: 0, y: 0, w: cols, h: rows }
  }
  clear() {
    this.ch.fill(' '); this.fg.fill(0); this.bg.fill(-1); this.at.fill(0)
    this.pen = 0
    this.unclip()
  }
  unclip() { this.clip = { x: 0, y: 0, w: this.cols, h: this.rows } }
  inside(x: number, y: number) {
    const k = this.clip
    return x >= k.x && y >= k.y && x < k.x + k.w && y < k.y + k.h
  }
  /** Break a wide pair that cell i belongs to, so a narrow write cannot leave half a glyph. */
  private split(i: number) {
    const x = i % this.cols
    if (this.ch[i] === '' && x > 0) { this.ch[i - 1] = ' '; this.ch[i] = ' ' }
    else if (x + 1 < this.cols && this.ch[i + 1] === '') this.ch[i + 1] = ' '
  }
  put(x: number, y: number, c: string, fg: number, bg?: number) {
    x = Math.round(x); y = Math.round(y)
    if (!this.inside(x, y)) return
    const i = y * this.cols + x
    this.split(i)
    if (isWide(c)) {
      if (!this.inside(x + 1, y)) return
      this.split(i + 1)
      this.ch[i + 1] = ''; this.fg[i + 1] = fg; this.at[i + 1] = this.pen
      if (bg !== undefined) this.bg[i + 1] = bg
    }
    this.ch[i] = c; this.fg[i] = fg; this.at[i] = this.pen
    if (bg !== undefined) this.bg[i] = bg
  }
  /** Background only. */
  paint(x: number, y: number, bg: number) {
    x = Math.round(x); y = Math.round(y)
    if (this.inside(x, y)) this.bg[y * this.cols + x] = bg
  }
  get(x: number, y: number) { return this.ch[y * this.cols + x] }
  /** Writes a string; wide glyphs advance two cells. Returns the width used. */
  text(x: number, y: number, s: string, fg: number, bg?: number): number {
    let k = 0
    for (const c of s) { this.put(x + k, y, c, fg, bg); k += isWide(c) ? 2 : 1 }
    return k
  }
  fill(r: Rect, c: string, fg: number, bg?: number) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.put(x, y, c, fg, bg)
  }
  box(r: Rect, fg: number, title?: string, style: 'light' | 'heavy' | 'double' | 'round' = 'light', titleFg?: number) {
    const set = { light: '─│┌┐└┘', heavy: '━┃┏┓┗┛', double: '═║╔╗╚╝', round: '─│╭╮╰╯' }[style]
    const [h, v, a, b, c, d] = [...set]
    const x1 = r.x + r.w - 1, y1 = r.y + r.h - 1
    for (let x = r.x + 1; x < x1; x++) { this.put(x, r.y, h!, fg); this.put(x, y1, h!, fg) }
    for (let y = r.y + 1; y < y1; y++) { this.put(r.x, y, v!, fg); this.put(x1, y, v!, fg) }
    this.put(r.x, r.y, a!, fg); this.put(x1, r.y, b!, fg); this.put(r.x, y1, c!, fg); this.put(x1, y1, d!, fg)
    if (title && r.w > 6) this.text(r.x + 2, r.y, ` ${title} `.slice(0, r.w - 4), titleFg ?? fg)
  }
  /** Line in cell space; the glyph follows the on-screen slope unless `c` is given. */
  line(x0: number, y0: number, x1: number, y1: number, fg: number, c?: string) {
    const g = c ?? this.slope(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    if (n > 4000) return
    for (let k = 0; k <= n; k++) this.put(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, g, fg)
  }
  slope(dx: number, dy: number): string {
    const d = ((Math.atan2(-dy * this.aspect, dx) * 180) / Math.PI + 180) % 180
    return d < 22.5 || d >= 157.5 ? '─' : d < 67.5 ? '╱' : d < 112.5 ? '│' : '╲'
  }
  /** Horizontal bar with eighth-block precision. */
  bar(x: number, y: number, w: number, v: number, fg: number, track = 0x262626) {
    const e = Math.round(Math.max(0, Math.min(1, v)) * w * 8)
    for (let i = 0; i < w; i++) {
      const k = Math.max(0, Math.min(8, e - i * 8))
      this.put(x + i, y, k === 0 ? '·' : ' ▏▎▍▌▋▊▉█'[k]!, k === 0 ? track : fg)
    }
  }
  /** Multiplies the colours inside a rect (both fg and painted bg). */
  shade(r: Rect, k: number) {
    for (let y = Math.max(0, r.y); y < Math.min(this.rows, r.y + r.h); y++)
      for (let x = Math.max(0, r.x); x < Math.min(this.cols, r.x + r.w); x++) {
        const i = y * this.cols + x
        this.fg[i] = mul(this.fg[i]!, k)
        if (this.bg[i]! >= 0) this.bg[i] = mul(this.bg[i]!, k)
      }
  }
}
