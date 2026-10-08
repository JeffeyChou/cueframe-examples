import type { Rng } from '@cueframe/core'
import { CH, CSS, CW, FONT, type Grid } from './lib.js'

const HOT = [196, 201, 51, 226, 46, 93, 214]
const BLOCKS = '█▓▒░'
const SHADES: Record<string, number> = { '█': 1, '▓': 0.62, '▒': 0.38, '░': 0.18 }
const LOWER = '▁▂▃▄▅▆▇'

/** Cell-level corruption: colour spans, block rectangles, stray glyphs. Rows >= `keep` are left alone. */
export function corrupt(g: Grid, G: number, r: Rng, slow: Rng, keep: number) {
  const nc = Math.floor(G * G * 22 + G * 5)
  for (let k = 0; k < nc; k++) {
    const y = r.int(0, keep - 1), x0 = r.int(0, g.cols - 1), len = r.int(4, 44)
    const col = r.pick(HOT)
    const bg = r() < 0.3 ? r.pick([52, 53, 17, 22]) : -1
    for (let x = x0; x < Math.min(g.cols, x0 + len); x++) {
      const i = y * g.cols + x
      if (g.ch[i] !== ' ') g.fg[i] = col
      if (bg >= 0) { g.bg[i] = bg; g.bgOn[i] = 1 }
    }
  }
  // block corruption persists for a few frames (slow rng)
  const nb = Math.floor(G * 4 + (slow() < G * 0.6 ? 2 : 0))
  for (let k = 0; k < nb; k++) {
    const w = slow.int(2, 24), h = slow.int(1, 3)
    const x0 = slow.int(0, g.cols - w), y0 = slow.int(0, keep - h)
    const col = slow.pick([196, 201, 51, 240, 245, 214, 93])
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (r() < 0.2) continue
      const i = y * g.cols + x
      g.ch[i] = BLOCKS[Math.floor(r() * 4)]
      g.fg[i] = r() < 0.15 ? r.pick(HOT) : col
    }
  }
  const ns = Math.floor(G * 120)
  for (let k = 0; k < ns; k++) {
    const i = r.int(0, keep * g.cols - 1)
    if (g.ch[i] === ' ' && r() < 0.6) continue
    g.ch[i] = r.pick(['#', '%', '&', '@', '$', '?', '░', '▒', '0', '1'])
  }
}

/** Draws the grid: bg runs as rects, then one glyph per cell. */
export function drawGrid(c: CanvasRenderingContext2D, g: Grid, w: number, h: number) {
  c.fillStyle = '#030604'
  c.fillRect(0, 0, w, h)
  c.textBaseline = 'middle'
  c.font = `20px ${FONT}`
  for (let y = 0; y < g.rows; y++) {
    const row = y * g.cols
    let x = 0
    while (x < g.cols) {
      if (!g.bgOn[row + x]) { x++; continue }
      const b = g.bg[row + x]
      let e = x
      while (e < g.cols && g.bgOn[row + e] && g.bg[row + e] === b) e++
      c.fillStyle = CSS[b]
      c.fillRect(x * CW, y * CH, (e - x) * CW, CH)
      x = e
    }
    let cur = -1
    for (let x = 0; x < g.cols; x++) {
      const ch = g.ch[row + x]
      if (ch === ' ') continue
      const col = g.fg[row + x]
      if (col !== cur) { c.fillStyle = CSS[col]; cur = col }
      const sh = SHADES[ch]
      if (sh !== undefined) {
        c.globalAlpha = sh
        c.fillRect(x * CW, y * CH, CW, CH)
        c.globalAlpha = 1
        if (sh < 1) c.fillText(ch, x * CW, y * CH + CH / 2 + 1)
        continue
      }
      const lo = LOWER.indexOf(ch)
      if (lo >= 0) {
        const hh = Math.round(((lo + 1) / 8) * CH)
        c.fillRect(x * CW + 1, y * CH + CH - hh, CW - 2, hh)
        continue
      }
      c.fillText(ch, x * CW, y * CH + CH / 2 + 1)
    }
  }
}

/** Composites the grid canvas onto the screen with row displacement, slices, ghosts, split and glow. */
export function composite(c: CanvasRenderingContext2D, src: HTMLCanvasElement, sc: number, G: number, r: Rng, slow: Rng,
  rows: number, keep: number, w: number, h: number) {
  c.globalCompositeOperation = 'source-over'
  c.globalAlpha = 1
  c.fillStyle = '#020403'
  c.fillRect(0, 0, w, h)
  // row displacement, in bands
  const dx = new Float32Array(rows)
  const nb = Math.floor(G * 5 + (slow() < 0.15 + G * 0.4 ? 1 : 0))
  for (let k = 0; k < nb; k++) {
    const y0 = slow.int(0, keep - 1), n = slow.int(1, 5), d = slow.range(-1, 1) * (10 + 110 * G)
    for (let y = y0; y < Math.min(keep, y0 + n); y++) dx[y] += d
  }
  for (let y = 0; y < keep; y++) if (r() < 0.015 + 0.12 * G) dx[y] += r.range(-1, 1) * (4 + 40 * G)
  for (let y = 0; y < rows; y++) {
    c.drawImage(src, 0, y * CH * sc, w * sc, CH * sc, Math.round(dx[y]), y * CH, w, CH)
    if (dx[y] !== 0) {
      // wrap the displaced row around like a lost hsync
      c.drawImage(src, 0, y * CH * sc, w * sc, CH * sc, Math.round(dx[y]) - Math.sign(dx[y]) * w, y * CH, w, CH)
    }
  }
  // fine pixel slices
  const ns = Math.floor(G * 7)
  for (let k = 0; k < ns; k++) {
    const y = r.int(0, keep * CH - 20), hh = r.int(2, 16), d = r.range(-1, 1) * (20 + 220 * G)
    c.drawImage(src, 0, y * sc, w * sc, hh * sc, d, y, w, hh)
  }
  // ghost rows
  const ng = Math.floor(G * 3 + slow() * 1.6)
  for (let k = 0; k < ng; k++) {
    const sy = slow.int(0, keep - 1), ty = Math.max(0, Math.min(keep - 1, sy + slow.pick([-3, -2, -1, 1, 2, 3])))
    c.globalAlpha = 0.22 + 0.25 * slow()
    c.drawImage(src, 0, sy * CH * sc, w * sc, CH * sc, slow.range(-30, 30), ty * CH, w, CH)
  }
  c.globalAlpha = 1
  // colour split and phosphor glow
  c.globalCompositeOperation = 'lighter'
  c.globalAlpha = 0.1
  c.drawImage(src, 0, 0, w * sc, keep * CH * sc, -2, -1, w, keep * CH)
  c.drawImage(src, 0, 0, w * sc, keep * CH * sc, 2, 1, w, keep * CH)
  if (G > 0.35) {
    c.globalAlpha = Math.min(0.35, (G - 0.35) * 0.4)
    const s = 3 + G * 6
    c.drawImage(src, 0, 0, w * sc, keep * CH * sc, s, 0, w, keep * CH)
  }
  c.globalAlpha = 1
  c.globalCompositeOperation = 'source-over'
}

export function makeScan(w: number, h: number, sc: number) {
  const cv = document.createElement('canvas')
  cv.width = Math.round(w * sc); cv.height = Math.round(h * sc)
  const c = cv.getContext('2d')!
  c.setTransform(sc, 0, 0, sc, 0, 0)
  for (let y = 0; y < h; y += 3) {
    c.fillStyle = 'rgba(0,0,0,0.42)'
    c.fillRect(0, y + 2, w, 1)
  }
  for (let y = 0; y < h; y += CH) {
    c.fillStyle = 'rgba(0,0,0,0.18)'
    c.fillRect(0, y, w, 1)
  }
  const v = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.6)')
  c.fillStyle = v
  c.fillRect(0, 0, w, h)
  return cv
}

export function crtPass(c: CanvasRenderingContext2D, scan: HTMLCanvasElement, t: number, G: number, r: Rng, w: number, h: number) {
  // rolling phosphor band
  const by = (((t * 0.42) % 1.25) - 0.15) * h
  const gr = c.createLinearGradient(0, by - 90, 0, by + 90)
  gr.addColorStop(0, 'rgba(120,255,200,0)')
  gr.addColorStop(0.5, 'rgba(120,255,200,0.055)')
  gr.addColorStop(1, 'rgba(120,255,200,0)')
  c.globalCompositeOperation = 'lighter'
  c.fillStyle = gr
  c.fillRect(0, by - 90, w, 180)
  c.globalCompositeOperation = 'source-over'
  c.drawImage(scan, 0, 0, w, h)
  // flicker and occasional bright scan row
  c.fillStyle = `rgba(0,0,0,${(r() * 0.05 + 0.02 * G).toFixed(3)})`
  c.fillRect(0, 0, w, h)
  if (r() < 0.25 + G * 0.5) {
    c.globalCompositeOperation = 'lighter'
    c.fillStyle = `rgba(160,255,230,${(0.04 + 0.08 * G).toFixed(3)})`
    c.fillRect(0, r.int(0, h), w, r.int(1, 3))
    c.globalCompositeOperation = 'source-over'
  }
}
