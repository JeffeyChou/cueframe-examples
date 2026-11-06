// The cast and set of 雨停了, drawn as ink densities on three plates (teal, yellow, pink):
// `ink(teal, yellow, pink)`. Flat shapes, no outlines; tints in steps of 20/40/60/100 %.
import { ink } from '../../../kits/print.js'
import { mulberry } from '../../../kits/svg.js'

type G = CanvasRenderingContext2D

export const T = (a: number) => ink(a, 0, 0)
export const Y = (a: number) => ink(0, a, 0)
export const P = (a: number) => ink(0, 0, a)

export function rect(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

export function disc(g: G, x: number, y: number, r: number, c: string): void {
  g.fillStyle = c
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}

export interface House { x: number; w: number; h: number; roof: 0 | 1 | 2; tint: number; windows: [number, number][] }

/** A row of houses, the same every frame (seeded). */
export function street(seed: number, x0: number, x1: number): House[] {
  const r = mulberry(seed)
  const out: House[] = []
  for (let x = x0; x < x1;) {
    const w = 150 + Math.floor(r() * 4) * 40
    const h = 260 + Math.floor(r() * 5) * 60
    const windows: [number, number][] = []
    const cols = Math.floor((w - 40) / 60)
    for (let i = 0; i < cols; i++) for (let j = 0; j < Math.floor((h - 80) / 90); j++) if (r() < 0.55) windows.push([24 + i * 60, 50 + j * 90])
    out.push({ x, w, h, roof: Math.floor(r() * 3) as 0 | 1 | 2, tint: [0.4, 0.6, 0.6, 0.8][Math.floor(r() * 4)]!, windows })
    x += w + 14 + Math.floor(r() * 3) * 24
  }
  return out
}

/** Houses standing on `ground`; `lit` 0..1 lights the windows on the yellow plate (green where it meets teal). */
export function houses(g: G, row: House[], ground: number, lit: number, tint = 1): void {
  for (const h of row) {
    const top = ground - h.h
    g.fillStyle = T(h.tint * tint)
    g.beginPath()
    g.moveTo(h.x, ground)
    g.lineTo(h.x, top)
    if (h.roof === 1) g.lineTo(h.x + h.w / 2, top - 70)
    else if (h.roof === 2) { g.lineTo(h.x + h.w * 0.7, top); g.lineTo(h.x + h.w * 0.7, top - 50); g.lineTo(h.x + h.w * 0.85, top - 50); g.lineTo(h.x + h.w * 0.85, top) }
    g.lineTo(h.x + h.w, top)
    g.lineTo(h.x + h.w, ground)
    g.fill()
    if (lit <= 0) continue
    for (const [i, [wx, wy]] of h.windows.entries()) {
      if ((i * 7 + h.w) % 10 >= lit * 10) continue
      g.fillStyle = 'rgb(0,0,0)'
      g.fillRect(h.x + wx - 3, top + wy - 3, 34, 50)
      g.fillStyle = ink(0, 1, 0)
      g.fillRect(h.x + wx, top + wy, 28, 44)
    }
  }
}

/** Rain on the teal plate: slanted strokes falling, stepped on twos by the caller's `t`. */
export function rain(g: G, w: number, h: number, t: number, amount: number, seed = 5): void {
  if (amount <= 0) return
  const r = mulberry(seed)
  g.strokeStyle = T(1)
  g.lineCap = 'round'
  const n = Math.round(260 * amount)
  for (let i = 0; i < n; i++) {
    const x = r() * (w + 300), sp = 1500 + r() * 500, len = 30 + r() * 30
    const y = ((r() * h + t * sp) % (h + 200)) - 100
    const dx = -0.22 * (y + 100)
    g.lineWidth = 1.5 + r() * 1.2
    g.beginPath()
    g.moveTo(x + dx, y)
    g.lineTo(x + dx - 0.22 * len, y + len)
    g.stroke()
  }
}

/** Puddles on the street: flat ellipses that hold the sky's colour; rings when it rains. */
export function puddles(g: G, xs: readonly number[], y: number, c: string, rings: number, t: number): void {
  for (const [i, x] of xs.entries()) {
    const w = 120 + (i % 3) * 50
    g.fillStyle = c
    g.beginPath()
    g.ellipse(x, y + (i % 2) * 40, w, 14 + (i % 3) * 4, 0, 0, Math.PI * 2)
    g.fill()
    if (rings <= 0) continue
    g.strokeStyle = 'rgb(0,0,0)'
    g.lineWidth = 2.5
    for (let k = 0; k < 2; k++) {
      const ph = (t * 1.7 + i * 0.37 + k * 0.5) % 1
      g.globalAlpha = rings * (1 - ph)
      g.beginPath()
      g.ellipse(x + ((i * 53 + k * 31) % 80) - 40, y + (i % 2) * 40, 8 + ph * 40, 2 + ph * 8, 0, 0, Math.PI * 2)
      g.stroke()
    }
    g.globalAlpha = 1
  }
}

export interface Walker {
  /** Walk cycle phase in steps (on twos from the caller). */
  step: number
  /** 0 = umbrella up, 1 = down and furled. */
  furl: number
  /** 0..1: the free hand turned out, feeling for rain. */
  palm: number
  /** Ink of the umbrella canopy. */
  canopy: string
}

/** A walker under an umbrella, feet at (0, 0), facing right, about 300 px tall. Body teal, skin a light pink tint. */
export function walker(g: G, w: Walker): void {
  const s = Math.sin(w.step * Math.PI), c = Math.cos(w.step * Math.PI)
  const bob = -Math.abs(s) * 6
  g.save()
  g.translate(0, bob)
  // legs
  g.fillStyle = T(1)
  for (const k of [1, -1]) {
    const a = k * s * 0.42
    g.save()
    g.translate(0, -120)
    g.rotate(a)
    g.fillRect(-11, 0, 22, 116)
    g.fillRect(-11, 108, 34, 12)
    g.restore()
  }
  // coat
  g.beginPath()
  g.moveTo(-40, -110)
  g.lineTo(-30, -235)
  g.lineTo(32, -235)
  g.lineTo(44, -110)
  g.closePath()
  g.fill()
  // head in profile: skin a light tint of the palest ink, hair over the crown and back, one eye
  disc(g, 2, -264, 27, P(0.2))
  g.fillStyle = T(1)
  g.beginPath()
  g.moveTo(-26, -250)
  g.arc(2, -264, 29, Math.PI * 0.85, Math.PI * 1.9)
  g.quadraticCurveTo(0, -268, -8, -246)
  g.closePath()
  g.fill()
  disc(g, 18, -264, 3.5, T(1))
  // umbrella: closes overhead (furl 0 → 0.5), then swings down to hang from the hand like a cane
  const close = Math.min(1, w.furl * 2), swing = Math.max(0, w.furl * 2 - 1)
  const hx = 30 - 4 * swing, hy = -252 + 112 * swing
  g.strokeStyle = T(1)
  g.lineWidth = 16
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(14, -222)
  g.lineTo(hx, hy)
  g.stroke()
  g.save()
  g.translate(hx, hy)
  g.rotate(0.08 * c * (1 - w.furl) + swing * (Math.PI - 0.5))
  g.fillStyle = T(1)
  g.fillRect(-3, -170, 6, 184)
  g.fillStyle = w.canopy
  g.beginPath()
  if (close < 0.85) {
    const r = 170 * (1 - close), top = -170, rim = -140 + 90 * close
    g.moveTo(-r - 6, rim)
    g.quadraticCurveTo(-r * 0.6, top, 0, top - 4)
    g.quadraticCurveTo(r * 0.6, top, r + 6, rim)
    for (let i = 3; i >= 0; i--) {
      const x = -r - 6 + (i * (2 * r + 12)) / 4
      g.quadraticCurveTo(x + (r + 6) / 4, rim - 20 * (1 - close), x, rim)
    }
  } else {
    g.moveTo(0, -174)
    g.lineTo(14, -72)
    g.lineTo(3, -52)
    g.lineTo(-3, -52)
    g.lineTo(-14, -72)
    g.closePath()
  }
  g.fill()
  g.restore()
  // free hand: out and palm up when feeling for rain
  g.save()
  g.translate(-22, -220)
  g.rotate(0.2 - 1.15 * w.palm)
  g.fillStyle = T(1)
  g.fillRect(-8, 0, 16, 92)
  disc(g, 0, 96, 11, P(0.2))
  g.restore()
  g.restore()
}

/** Crop marks and a registration target, printed on every plate so misregistration shows. */
export function marks(g: G, x: number, y: number, w: number, h: number): void {
  g.strokeStyle = ink(1, 1, 1)
  g.lineWidth = 2
  const m = 24, l = 40
  for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]] as const) {
    g.beginPath()
    g.moveTo(cx + sx * m, cy)
    g.lineTo(cx + sx * (m + l), cy)
    g.moveTo(cx, cy + sy * m)
    g.lineTo(cx, cy + sy * (m + l))
    g.stroke()
  }
  for (const tx of [x + w / 2]) {
    const ty = y - 60
    g.beginPath()
    g.arc(tx, ty, 16, 0, Math.PI * 2)
    g.moveTo(tx - 28, ty)
    g.lineTo(tx + 28, ty)
    g.moveTo(tx, ty - 28)
    g.lineTo(tx, ty + 28)
    g.stroke()
  }
}
