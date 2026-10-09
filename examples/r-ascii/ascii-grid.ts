// ascii-grid: a Canvas2D monospace cell grid with an ANSI-256 palette; block glyphs are drawn as rects.
// mount: const g = ctx.canvas('grid'); const grid = gridFor(g, ctx.stage, '20px "JetBrains Mono"')
// render: grid.clear(); grid.box({ x: 2, y: 1, w: 40, h: 10 }, 51, 'title'); grid.text(4, 3, 'hello', 250); flush(g, grid)
// Rebuild the cell contents every frame from f; the grid is a scratch buffer, not state.

import type { Stage } from '@cueframe/core'

const LV = [0, 95, 135, 175, 215, 255]
const BASE16 = [0x000000, 0xcd0000, 0x00cd00, 0xcdcd00, 0x0000ee, 0xcd00cd, 0x00cdcd, 0xe5e5e5,
  0x7f7f7f, 0xff0000, 0x00ff00, 0xffff00, 0x5c5cff, 0xff00ff, 0x00ffff, 0xffffff]

/** xterm-256 colour index → [r, g, b]. */
export function rgb256(i: number): [number, number, number] {
  if (i < 16) { const c = BASE16[i]!; return [c >> 16, (c >> 8) & 255, c & 255] }
  if (i < 232) { const k = i - 16; return [LV[Math.floor(k / 36)]!, LV[Math.floor(k / 6) % 6]!, LV[k % 6]!] }
  const v = 8 + (i - 232) * 10
  return [v, v, v]
}
export const ANSI = Array.from({ length: 256 }, (_, i) => `rgb(${rgb256(i).join(',')})`)
/** Nearest cube index for 0..1 rgb, handy for gradients: ansi(r, g, b). */
export const ansi = (r: number, g: number, b: number) =>
  16 + 36 * Math.round(Math.max(0, Math.min(1, r)) * 5) + 6 * Math.round(Math.max(0, Math.min(1, g)) * 5) + Math.round(Math.max(0, Math.min(1, b)) * 5)
/** Pick from a ramp of palette indices by v ∈ [0, 1]. */
export const ramp = (r: readonly number[], v: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(v * (r.length - 1))))]!

export interface Rect { x: number; y: number; w: number; h: number }

export class Grid {
  readonly ch: string[]
  readonly fg: Uint8Array
  readonly bg: Int16Array          // -1 = transparent
  clip: Rect
  constructor(readonly cols: number, readonly rows: number, readonly cw: number, readonly rh: number, readonly font: string) {
    this.ch = new Array(cols * rows).fill(' ')
    this.fg = new Uint8Array(cols * rows)
    this.bg = new Int16Array(cols * rows).fill(-1)
    this.clip = { x: 0, y: 0, w: cols, h: rows }
  }
  clear() {
    this.ch.fill(' '); this.fg.fill(0); this.bg.fill(-1)
    this.clip = { x: 0, y: 0, w: this.cols, h: this.rows }
  }
  put(x: number, y: number, c: string, fg: number, bg?: number) {
    x = Math.round(x); y = Math.round(y)
    const k = this.clip
    if (x < k.x || y < k.y || x >= k.x + k.w || y >= k.y + k.h) return
    const i = y * this.cols + x
    this.ch[i] = c; this.fg[i] = fg
    if (bg !== undefined) this.bg[i] = bg
  }
  /** Writes a string left to right; returns the number of cells used. */
  text(x: number, y: number, s: string, fg: number, bg?: number): number {
    let k = 0
    for (const c of s) this.put(x + k++, y, c, fg, bg)
    return k
  }
  fill(r: Rect, c: string, fg: number, bg?: number) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.put(x, y, c, fg, bg)
  }
  box(r: Rect, fg: number, title?: string, heavy = false) {
    const [h, v, a, b, c, d] = heavy ? '━┃┏┓┗┛' : '─│┌┐└┘'
    const x1 = r.x + r.w - 1, y1 = r.y + r.h - 1
    for (let x = r.x + 1; x < x1; x++) { this.put(x, r.y, h!, fg); this.put(x, y1, h!, fg) }
    for (let y = r.y + 1; y < y1; y++) { this.put(r.x, y, v!, fg); this.put(x1, y, v!, fg) }
    this.put(r.x, r.y, a!, fg); this.put(x1, r.y, b!, fg); this.put(r.x, y1, c!, fg); this.put(x1, y1, d!, fg)
    if (title) this.text(r.x + 2, r.y, ` ${title} `, fg)
  }
  /** Line in cell space; the glyph follows the on-screen slope unless `c` is given. */
  line(x0: number, y0: number, x1: number, y1: number, fg: number, c?: string) {
    const g = c ?? this.slope(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    for (let k = 0; k <= n; k++) this.put(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, g, fg)
  }
  slope(dx: number, dy: number): string {
    const d = (((Math.atan2(-dy * this.rh, dx * this.cw) * 180) / Math.PI) + 180) % 180
    return d < 22.5 || d >= 157.5 ? '─' : d < 67.5 ? '╱' : d < 112.5 ? '│' : '╲'
  }
  /** Horizontal bar of width `w` cells filled to v ∈ [0, 1] with eighth-block precision. */
  bar(x: number, y: number, w: number, v: number, fg: number, track = 236) {
    const e = Math.round(Math.max(0, Math.min(1, v)) * w * 8)
    for (let i = 0; i < w; i++) {
      const k = Math.max(0, Math.min(8, e - i * 8))
      this.put(x + i, y, k === 0 ? '░' : ' ▏▎▍▌▋▊▉█'[k]!, k === 0 ? track : fg)
    }
  }
}

/** A grid covering the stage, with cell size from the font's advance and `lineHeight`. */
export function gridFor(g: CanvasRenderingContext2D, stage: Pick<Stage, 'w' | 'h'>, font: string, lineHeight = 1.15): Grid {
  g.font = font
  const cw = g.measureText('M').width
  const px = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16)
  const rh = Math.round(px * lineHeight)
  return new Grid(Math.floor(stage.w / cw), Math.floor(stage.h / rh), cw, rh, font)
}

const SHADE: Record<string, number> = { '█': 1, '▓': 0.7, '▒': 0.45, '░': 0.2 }
const LOWER = '▁▂▃▄▅▆▇'
const LEFT = '▏▎▍▌▋▊▉'

/** Draws the grid: background runs, block glyphs as rects (gap-free), other glyphs as text. */
export function flush(g: CanvasRenderingContext2D, grid: Grid, background: string | null = '#05070a', ox = 0, oy = 0) {
  const { cols, rows, cw, rh } = grid
  if (background) { g.fillStyle = background; g.fillRect(ox, oy, cols * cw, rows * rh) }
  g.font = grid.font
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  for (let y = 0; y < rows; y++) {
    const py = oy + y * rh
    for (let x = 0; x < cols; ) {
      const b = grid.bg[y * cols + x]!
      let e = x + 1
      while (e < cols && grid.bg[y * cols + e] === b) e++
      if (b >= 0) { g.fillStyle = ANSI[b]!; g.fillRect(ox + x * cw, py, (e - x) * cw, rh) }
      x = e
    }
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const c = grid.ch[i]!
      if (c === ' ') continue
      const px = ox + x * cw
      g.fillStyle = ANSI[grid.fg[i]!]!
      const sh = SHADE[c]
      const lo = LOWER.indexOf(c)
      const le = LEFT.indexOf(c)
      if (sh !== undefined) { g.globalAlpha = sh; g.fillRect(px, py, cw + 0.5, rh + 0.5); g.globalAlpha = 1 }
      else if (lo >= 0) { const h = ((lo + 1) / 8) * rh; g.fillRect(px, py + rh - h, cw + 0.5, h) }
      else if (le >= 0) g.fillRect(px, py, ((le + 1) / 8) * cw, rh)
      else if (c === '▀') g.fillRect(px, py, cw + 0.5, rh / 2)
      else g.fillText(c, px, py + rh / 2 + 1)
    }
  }
}
