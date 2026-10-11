// Adapter that lets the original ANSI-256 geometry visuals draw into truecolor Cells.
import { Cells, rgb } from '../cells.ts'

const LV = [0, 95, 135, 175, 215, 255]
const BASE16 = [0x000000, 0xcd0000, 0x00cd00, 0xcdcd00, 0x0000ee, 0xcd00cd, 0x00cdcd, 0xe5e5e5, 0x7f7f7f, 0xff0000, 0x00ff00, 0xffff00, 0x5c5cff, 0xff00ff, 0x00ffff, 0xffffff]
export const C256 = Array.from({ length: 256 }, (_, i) => {
  if (i < 16) return BASE16[i]!
  if (i < 232) { const k = i - 16; return rgb(LV[Math.floor(k / 36)]!, LV[Math.floor(k / 6) % 6]!, LV[k % 6]!) }
  const v = 8 + (i - 232) * 10
  return rgb(v, v, v)
})
export const ramp = (r: readonly number[], v: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(v * (r.length - 1))))]!

export type Kind = 'points' | 'circle' | 'sine' | 'limit'
export interface Section { kind: Kind; t0: number; t1: number; mid: number; hit: number; file: string; accent: number; ramp: number[] }

/** Grid facade: cell size in the visuals' pixel units (they were tuned for 98×34 cells at 10.8×21 px). */
class GridFacade {
  c: Cells; cw: number; rh: number
  constructor(c: Cells, cw: number, rh: number) { this.c = c; this.cw = cw; this.rh = rh }
  put(x: number, y: number, ch: string, fg: number, bg?: number) { this.c.put(x, y, ch, C256[fg]!, bg === undefined ? undefined : C256[bg]) }
  text(x: number, y: number, s: string, fg: number, bg?: number) { return this.c.text(x, y, s, C256[fg]!, bg === undefined ? undefined : C256[bg]) }
  line(x0: number, y0: number, x1: number, y1: number, fg: number, ch?: string) { this.c.line(x0, y0, x1, y1, C256[fg]!, ch) }
  get cols() { return this.c.cols }
  get rows() { return this.c.rows }
  get ch() { return this.c.ch }
  bar(x: number, y: number, w: number, v: number, fg: number) { this.c.bar(x, y, w, v, C256[fg]!) }
  fill(r: { x: number; y: number; w: number; h: number }, ch: string, fg: number, bg?: number) { this.c.fill(r, ch, C256[fg]!, bg === undefined ? undefined : C256[bg]) }
  slope(dx: number, dy: number): string {
    const d = ((Math.atan2(-dy * this.rh, dx * this.cw) * 180) / Math.PI + 180) % 180
    return d < 22.5 || d >= 157.5 ? '─' : d < 67.5 ? '╱' : d < 112.5 ? '│' : '╲'
  }
}

export class View {
  g: GridFacade; x: number; y: number; w: number; h: number
  constructor(c: Cells, x: number, y: number, w: number, h: number) {
    const s = Math.min(w / 98, h / 34)
    this.g = new GridFacade(c, 10.8 / s, (10.8 / s) * c.aspect * (21 / 10.8) / 1.94)
    this.x = x; this.y = y; this.w = w; this.h = h
  }
  get pw() { return this.w * this.g.cw }
  get ph() { return this.h * this.g.rh }
  cx(px: number) { return this.x + this.w / 2 + px / this.g.cw }
  cy(py: number) { return this.y + this.h / 2 + py / this.g.rh }
  put(px: number, py: number, c: string, fg: number, bg?: number) { this.g.put(this.cx(px), this.cy(py), c, fg, bg) }
  text(px: number, py: number, s: string, fg: number, bg?: number) { return this.g.text(Math.round(this.cx(px)), Math.round(this.cy(py)), s, fg, bg) }
  line(x0: number, y0: number, x1: number, y1: number, fg: number, c?: string) { this.g.line(this.cx(x0), this.cy(y0), this.cx(x1), this.cy(y1), fg, c) }
  dash(x0: number, y0: number, x1: number, y1: number, fg: number, c = '·') {
    const a = [this.cx(x0), this.cy(y0)], b = [this.cx(x1), this.cy(y1)]
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0]! - a[0]!), Math.abs(b[1]! - a[1]!))))
    for (let k = 0; k <= n; k += 2) this.g.put(a[0]! + ((b[0]! - a[0]!) * k) / n, a[1]! + ((b[1]! - a[1]!) * k) / n, c, fg)
  }
}

export const fmt = (v: number, d = 3, w = 7) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(d).padStart(w - 1, '0')
export const hex = (v: number, n = 4) => (Math.floor(v) >>> 0).toString(16).toUpperCase().padStart(n, '0').slice(-n)
