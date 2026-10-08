// Character grid, xterm-256 palette and drawing helpers shared by the chrome and the visuals.

export const CW = 12
export const CH = 22
export const FONT = 'JBM'

const LV = [0, 95, 135, 175, 215, 255]
const BASE16 = [
  [0, 0, 0], [205, 0, 0], [0, 205, 0], [205, 205, 0], [0, 0, 238], [205, 0, 205], [0, 205, 205], [229, 229, 229],
  [127, 127, 127], [255, 0, 0], [0, 255, 0], [255, 255, 0], [92, 92, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
]
export function rgb256(i: number): [number, number, number] {
  if (i < 16) return BASE16[i] as [number, number, number]
  if (i < 232) {
    const k = i - 16
    return [LV[Math.floor(k / 36)], LV[Math.floor(k / 6) % 6], LV[k % 6]]
  }
  const v = 8 + (i - 232) * 10
  return [v, v, v]
}
export const CSS = Array.from({ length: 256 }, (_, i) => {
  const [r, g, b] = rgb256(i)
  return `rgb(${r},${g},${b})`
})

export const C = {
  dim: 238, faint: 236, mid: 244, text: 250, white: 255, frame: 240,
  cyan: 51, teal: 37, blue: 33, green: 46, lime: 118, amber: 214, orange: 208, red: 196, magenta: 201, pink: 213,
  yellow: 226, violet: 99,
}
export const RAMP_CYAN = [236, 238, 24, 30, 37, 44, 51, 87, 123, 159, 195, 231]
export const RAMP_AMBER = [236, 52, 88, 130, 166, 172, 208, 214, 220, 221, 229, 231]
export const RAMP_GREEN = [236, 22, 28, 34, 40, 46, 82, 118, 154, 157, 194, 231]
export const RAMP_MAG = [236, 53, 89, 125, 161, 162, 199, 201, 207, 213, 219, 231]
export const ramp = (r: number[], v: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(v * (r.length - 1))))]

export interface Rect { x: number; y: number; w: number; h: number }

export class Grid {
  ch: string[]
  fg: Uint8Array
  bg: Uint8Array
  bgOn: Uint8Array
  clip: Rect
  constructor(readonly cols: number, readonly rows: number) {
    const n = cols * rows
    this.ch = new Array(n).fill(' ')
    this.fg = new Uint8Array(n)
    this.bg = new Uint8Array(n)
    this.bgOn = new Uint8Array(n)
    this.clip = { x: 0, y: 0, w: cols, h: rows }
  }
  clear() {
    this.ch.fill(' ')
    this.fg.fill(0)
    this.bgOn.fill(0)
    this.clip = { x: 0, y: 0, w: this.cols, h: this.rows }
  }
  inClip(x: number, y: number) {
    const c = this.clip
    return x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h
  }
  put(x: number, y: number, ch: string, fg: number, bg?: number) {
    x = Math.round(x); y = Math.round(y)
    if (!this.inClip(x, y)) return
    const i = y * this.cols + x
    this.ch[i] = ch
    this.fg[i] = fg
    if (bg !== undefined) { this.bg[i] = bg; this.bgOn[i] = 1 }
  }
  get(x: number, y: number) {
    return this.ch[y * this.cols + x]
  }
  text(x: number, y: number, s: string, fg: number, bg?: number) {
    let k = 0
    for (const c of s) this.put(x + k++, y, c, fg, bg)
    return k
  }
  fill(r: Rect, ch: string, fg: number, bg?: number) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.put(x, y, ch, fg, bg)
  }
  box(r: Rect, fg: number, title?: string, tfg = C.text, heavy = false) {
    const [h, v, a, b, c, d] = heavy ? ['━', '┃', '┏', '┓', '┗', '┛'] : ['─', '│', '┌', '┐', '└', '┘']
    const x1 = r.x + r.w - 1, y1 = r.y + r.h - 1
    for (let x = r.x + 1; x < x1; x++) { this.put(x, r.y, h, fg); this.put(x, y1, h, fg) }
    for (let y = r.y + 1; y < y1; y++) { this.put(r.x, y, v, fg); this.put(x1, y, v, fg) }
    this.put(r.x, r.y, a, fg); this.put(x1, r.y, b, fg); this.put(r.x, y1, c, fg); this.put(x1, y1, d, fg)
    if (title) { this.put(r.x + 1, r.y, '┤', fg); const n = this.text(r.x + 2, r.y, title, tfg); this.put(r.x + 2 + n, r.y, '├', fg) }
  }
  /** Line in cell space; chars follow the on-screen slope unless `ch` is given. */
  line(x0: number, y0: number, x1: number, y1: number, fg: number, ch?: string) {
    const c = ch ?? slopeChar(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    for (let k = 0; k <= n; k++) this.put(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, c, fg)
  }
}

export function slopeChar(dx: number, dy: number) {
  const a = Math.atan2(-dy * CH, dx * CW)
  let d = ((a * 180) / Math.PI + 180) % 180
  if (d < 22.5 || d >= 157.5) return '─'
  if (d < 67.5) return '╱'
  if (d < 112.5) return '│'
  return '╲'
}
export function slopeAscii(dx: number, dy: number) {
  const c = slopeChar(dx, dy)
  return c === '─' ? '-' : c === '╱' ? '/' : c === '│' ? '|' : '\\'
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const fract = (v: number) => v - Math.floor(v)
export function hash(n: number) {
  let h = Math.imul(n | 0, 0x27d4eb2d) ^ 0x9e3779b9
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export const hex = (n: number, w: number) => (n >>> 0).toString(16).toUpperCase().padStart(w, '0').slice(-w)
export const fx = (v: number, w: number, d: number) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(d).padStart(w, '0')

// 5x5 block font for big readouts.
const G5: Record<string, string> = {
  'A': '.###.#...#######...##...#',
  'B': '####.#...#####.#...#####.',
  'C': '.#####....#....#.....####',
  'D': '####.#...##...##...#####.',
  'E': '######....####.#....#####',
  'F': '######....####.#....#....',
  'G': '.#####....#..###...#.###.',
  'H': '#...##...#######...##...#',
  'I': '#####..#....#....#..#####',
  'L': '#....#....#....#....#####',
  'M': '#...###.###.#.##...##...#',
  'N': '#...###..##.#.##..###...#',
  'O': '.###.#...##...##...#.###.',
  'P': '####.#...#####.#....#....',
  'R': '####.#...#####.#..#.#...#',
  'S': '.#####.....###.....#####.',
  'T': '#####..#....#....#....#..',
  'U': '#...##...##...##...#.###.',
  'X': '#...#.#.#...#...#.#.#...#',
  'Y': '#...#.#.#...#....#....#..',
  'V': '#...##...##...#.#.#...#..',
  '0': '.###.#..###.#.###..#.###.',
  '1': '..#...##....#....#...###.',
  '2': '####.....#.###.#....#####',
  '3': '####.....#.###.....#####.',
  '4': '#..#.#..#.#####...#....#.',
  '5': '######....####.....#####.',
  '6': '.###.#....####.#...#.###.',
  '7': '#####....#...#...#....#..',
  '8': '.###.#...#.###.#...#.###.',
  '9': '.###.#...#.####....#.###.',
  '=': '.....#####.....#####.....',
  '.': '......................#..',
  '-': '..........#####..........',
  ' ': '.........................',
  '>': '#.....##.....##.##..#....',
}
export const BIG_W = 6
/** Draws text in the 5x5 font; `shade(x, y)` picks the glyph char per lit cell. */
export function big(g: Grid, x: number, y: number, s: string, fg: (cx: number, cy: number) => number,
  shade: (cx: number, cy: number) => string = () => '█') {
  let k = 0
  for (const c of s) {
    const p = G5[c] ?? G5[' ']
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      if (p[j * 5 + i] === '#') g.put(x + k * BIG_W + i, y + j, shade(k * BIG_W + i, j), fg(k * BIG_W + i, j))
    }
    k++
  }
  return k * BIG_W - 1
}

export interface V3 { x: number; y: number; z: number }
export function rot(p: V3, ax: number, ay: number, az = 0): V3 {
  let { x, y, z } = p
  let c = Math.cos(ax), s = Math.sin(ax)
  ;[y, z] = [y * c - z * s, y * s + z * c]
  c = Math.cos(ay); s = Math.sin(ay)
  ;[x, z] = [x * c + z * s, -x * s + z * c]
  c = Math.cos(az); s = Math.sin(az)
  ;[x, y] = [x * c - y * s, x * s + y * c]
  return { x, y, z }
}
/** Perspective projection into cell space around the rect centre; `k` is px per world unit. */
export function project(p: V3, V: Rect, k: number, cam = 4.2) {
  const w = cam / (cam - p.z)
  return { x: V.x + V.w / 2 + (p.x * k * w) / CW, y: V.y + V.h / 2 - (p.y * k * w) / CH, w }
}
