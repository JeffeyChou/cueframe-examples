// Small type and marks on the UI layer: the slate in the corners, a 16-step strip that ticks with
// the music, registration marks, brackets and labels. Logical px; white ink on black.
import type { Frame } from '@cueframe/core'
import type { Rect } from './look.js'

export const MONO = '"JetBrains Mono", monospace'
export const WIDE = '"Michroma", sans-serif'
export const INK = '#f2f2ee'
export const RED = '#ff2a3a'
export const BLUE = '#2b3bff'
export const GREY = 'rgba(242,242,238,0.55)'

export function text(g: CanvasRenderingContext2D, f: Frame, s: string, x: number, y: number, o: { size?: number; font?: string; color?: string; align?: CanvasTextAlign; track?: number; base?: CanvasTextBaseline; label?: string } = {}): Rect {
  const size = o.size ?? 15
  g.font = `${o.font === WIDE ? 400 : 500} ${size}px ${o.font ?? MONO}`
  g.fillStyle = o.color ?? INK
  g.textAlign = o.align ?? 'left'
  g.textBaseline = o.base ?? 'alphabetic'
  g.letterSpacing = `${o.track ?? 0.08 * size}px`
  g.fillText(s, x, y)
  const w = g.measureText(s).width
  g.letterSpacing = '0px'
  const x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x
  const r = { x: x0, y: y - size * 0.8, w, h: size }
  // report the box where it lands on the stage (rotated or translated type), in logical px
  const T = g.getTransform(), k = f.stage.scale || 1
  const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].map(([px, py]) => T.transformPoint({ x: px, y: py }))
  const xs = pts.map((p) => p.x / k), ys = pts.map((p) => p.y / k)
  f.audit.text({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }, o.label ?? s.slice(0, 24))
  return r
}

/** Corner registration marks around a rect. */
export function marks(g: CanvasRenderingContext2D, r: Rect, len = 14, color = INK, width = 1.5): void {
  g.strokeStyle = color
  g.lineWidth = width
  g.beginPath()
  for (const [x, y, dx, dy] of [[r.x, r.y, 1, 1], [r.x + r.w, r.y, -1, 1], [r.x, r.y + r.h, 1, -1], [r.x + r.w, r.y + r.h, -1, -1]] as const) {
    g.moveTo(x + dx * len, y)
    g.lineTo(x, y)
    g.lineTo(x, y + dy * len)
  }
  g.stroke()
}

/** "[ WORD ]" brackets around a rect. */
export function brackets(g: CanvasRenderingContext2D, r: Rect, color = INK, width = 1.5): void {
  g.strokeStyle = color
  g.lineWidth = width
  const l = Math.min(10, r.h / 3)
  g.beginPath()
  g.moveTo(r.x + l, r.y); g.lineTo(r.x, r.y); g.lineTo(r.x, r.y + r.h); g.lineTo(r.x + l, r.y + r.h)
  g.moveTo(r.x + r.w - l, r.y); g.lineTo(r.x + r.w, r.y); g.lineTo(r.x + r.w, r.y + r.h); g.lineTo(r.x + r.w - l, r.y + r.h)
  g.stroke()
}

export function hline(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, color = GREY, width = 1): void {
  g.strokeStyle = color
  g.lineWidth = width
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke()
}

export function vline(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, color = GREY, width = 1): void {
  g.strokeStyle = color
  g.lineWidth = width
  g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke()
}

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0')
export const timecode = (t: number, fps = 30) => `${pad(t / 60)}:${pad(t % 60)}:${pad((t % 1) * fps)}`

/**
 * The slate: title and section top left, timecode top right, caption bottom left, a 16-step strip
 * bottom right (the current sixteenth lit; accents in red on kicks).
 */
export function slate(g: CanvasRenderingContext2D, f: Frame, o: { section: string; caption: string; shot: number; sixteenth: number; kick: number; alpha?: number; light?: boolean }): void {
  const W = f.stage.w, H = f.stage.h, m = 72   // inside the 64 px safe area
  const ink = o.light ? '#141414' : INK, grey = o.light ? 'rgba(20,20,20,0.6)' : GREY
  g.globalAlpha = o.alpha ?? 1
  text(g, f, 'LOCOMOTION', m, m + 6, { font: WIDE, size: 15, track: 4, color: ink })
  text(g, f, o.section, m, m + 32, { size: 14, color: grey })
  text(g, f, timecode(f.t), W - m, m + 6, { size: 15, align: 'right', color: ink })
  text(g, f, `SHOT ${pad(o.shot + 1, 3)} · 140 BPM`, W - m, m + 32, { size: 14, color: grey, align: 'right' })
  text(g, f, o.caption, m, H - m, { size: 14, color: grey })
  const n = 16, s = 9, gap = 5, x0 = W - m - n * (s + gap) + gap, y0 = H - m - s
  for (let i = 0; i < n; i++) {
    const on = i === o.sixteenth
    g.fillStyle = on ? (o.kick > 0.3 ? RED : ink) : o.light ? 'rgba(20,20,20,0.18)' : 'rgba(242,242,238,0.18)'
    g.fillRect(x0 + i * (s + gap), y0, s, s)
  }
  g.globalAlpha = 1
}
