// Block-letter banners sampled from a JetBrains Mono ExtraBold coverage atlas (build/glyphs.json),
// with inverse-mapped warps so text can zoom, skew, wave, shatter and extrude in cell space.
import atlas from '../build/glyphs.json' with { type: 'json' }
import { Cells } from './cells.ts'

const AT = atlas as { w: number; h: number; glyphs: Record<string, string> }
export const GW = AT.w, GH = AT.h
/** Cap-height window inside the atlas rows. */
const CAP0 = 2, CAP1 = 40
const GLYPH = new Map<string, Uint8Array>()
for (const [c, b64] of Object.entries(AT.glyphs)) GLYPH.set(c, Uint8Array.from(atob(b64), (x) => x.charCodeAt(0)))

/** Coverage 0..1 of `text` at atlas coordinates (px across the string, py in cap units 0..1). */
export function coverage(text: string, px: number, py: number): number {
  if (py < 0 || py >= 1 || px < 0) return 0
  const k = Math.floor(px / GW)
  if (k >= text.length) return 0
  const g = GLYPH.get(text[k]!)
  if (!g) return 0
  const x = Math.floor(px - k * GW), y = Math.floor(CAP0 + py * (CAP1 - CAP0))
  return g[y * GW + x]! / 255
}

export interface TextOpts {
  /** centre in cells */
  x: number; y: number
  /** cap height in rows */
  h: number
  style?: 'block' | 'ramp' | 'outline' | 'dots'
  color: (u: number, v: number, x: number, y: number) => number
  bg?: number
  /** horizontal stretch factor (1 = font proportions) */
  sx?: number
  /** extra px between letters (atlas units) */
  track?: number
  /** inverse warp in cell space: given cell (x, y) return source offset in cells */
  warp?: (x: number, y: number) => [number, number]
  /** reveal fraction left to right */
  reveal?: number
  /** italic shear (cells per row) */
  shear?: number
  glyphs?: string
}
const RAMP = ' .:-=+*#%@'

/** Width in cells of a banner at cap height h. */
export const textWidth = (text: string, h: number, sx = 1, track = 0) => (text.length * (GW + track) * h * 2 * sx) / (CAP1 - CAP0)

export function bigText(c: Cells, text: string, o: TextOpts) {
  const sx = o.sx ?? 1, track = o.track ?? 0
  const scale = (CAP1 - CAP0) / (o.h * c.aspect)      // atlas px per cell width unit
  const W = text.length * (GW + track)
  const wc = (W / scale) * sx                         // width in cells
  const x0 = o.x - wc / 2, y0 = o.y - o.h / 2
  const style = o.style ?? 'block'
  const reveal = o.reveal ?? 1
  const pad = o.warp ? 6 : 1
  const xa = Math.floor(x0 - pad - Math.abs(o.shear ?? 0) * o.h), xb = Math.ceil(x0 + wc + pad + Math.abs(o.shear ?? 0) * o.h)
  const ya = Math.floor(y0 - (o.warp ? 3 : 0)), yb = Math.ceil(y0 + o.h + (o.warp ? 3 : 0))
  const sample = (cx: number, cy: number) => {
    let sx0 = cx, sy0 = cy
    if (o.warp) { const [dx, dy] = o.warp(cx, cy); sx0 += dx; sy0 += dy }
    if (o.shear) sx0 += (sy0 - o.y) * o.shear
    const u = (sx0 - x0) / wc, v = (sy0 - y0) / o.h
    if (u < 0 || u >= reveal || v < 0 || v >= 1) return 0
    const px = u * W, k = Math.floor(px / (GW + track)), lx = px - k * (GW + track)
    if (lx >= GW) return 0
    return coverage(text, k * GW + lx, v)
  }
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    if (!c.inside(x, y)) continue
    const u = (x + 0.5 - x0) / wc, v = (y + 0.5 - y0) / o.h
    if (style === 'block') {
      const a = sample(x + 0.5, y + 0.25), b = sample(x + 0.5, y + 0.75)
      const ta = a > 0.45, tb = b > 0.45
      if (!ta && !tb) continue
      c.put(x, y, ta && tb ? '█' : ta ? '▀' : '▄', o.color(u, v, x, y), o.bg)
    } else if (style === 'ramp' || style === 'dots') {
      const a = (sample(x + 0.3, y + 0.3) + sample(x + 0.7, y + 0.3) + sample(x + 0.3, y + 0.7) + sample(x + 0.7, y + 0.7)) / 4
      if (a < 0.08) continue
      const ch = style === 'dots' ? (a > 0.6 ? '●' : a > 0.3 ? '•' : '·') : RAMP[Math.min(9, Math.max(1, Math.round(a * 9)))]!
      c.put(x, y, ch, o.color(u, v, x, y), o.bg)
    } else {
      const m = sample(x + 0.5, y + 0.5) > 0.45
      if (!m) continue
      const e = sample(x - 0.5, y + 0.5) > 0.45 && sample(x + 1.5, y + 0.5) > 0.45 && sample(x + 0.5, y - 0.5) > 0.45 && sample(x + 0.5, y + 1.5) > 0.45
      if (!e) c.put(x, y, o.glyphs ? o.glyphs[(x * 7 + y * 3) % o.glyphs.length]! : '▓', o.color(u, v, x, y), o.bg)
    }
  }
  return { x0, y0, w: wc, h: o.h }
}

/** A banner that fits `maxW` cells: returns the cap height to use (rows), capped at maxH. */
export const fitHeight = (text: string, maxW: number, maxH: number, sx = 1, track = 0) =>
  Math.max(2, Math.min(maxH, (maxW * (CAP1 - CAP0)) / (text.length * (GW + track) * 2 * sx)))
