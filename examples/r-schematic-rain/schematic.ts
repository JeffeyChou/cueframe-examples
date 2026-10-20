// Technical/schematic overlay in Canvas2D, after ComfyUI-Schematic (detection circles, connections,
// coordinate labels, crosshair frame, tangent chain, pixelation zone, corner slate).
// cueframe: copied into the project; no schematic recipe exists.

export interface Pt { id: string; x: number; y: number; r: number; s: number }

export const INK = 'rgba(255,255,255,0.86)'
export const FAINT = 'rgba(255,255,255,0.42)'
export const MONO = '"JetBrains Mono", monospace'

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

export function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, size = 13, color = INK, align: CanvasTextAlign = 'left') {
  g.font = `400 ${size}px ${MONO}`
  g.fillStyle = color
  g.textAlign = align
  g.textBaseline = 'middle'
  g.fillText(text, x, y)
}

/** Circles with centre dots and coordinate labels; `age` seconds since the scan, staggered by rank. */
export function circles(g: CanvasRenderingContext2D, pts: Pt[], age: number) {
  g.lineWidth = 1.2
  pts.forEach((p, i) => {
    const k = ease((age - i * 0.018) / 0.16)
    if (k <= 0) return
    g.strokeStyle = INK
    g.beginPath()
    g.arc(p.x, p.y, p.r * (0.6 + 0.4 * k), 0, Math.PI * 2)
    g.globalAlpha = k
    g.stroke()
    g.fillStyle = INK
    g.beginPath()
    g.arc(p.x, p.y, 2.2, 0, Math.PI * 2)
    g.fill()
    if (k > 0.6) label(g, `${Math.round(p.x)},${Math.round(p.y)}`, p.x + p.r + 6, p.y, 13, FAINT)
    g.globalAlpha = 1
  })
}

/** Straight lines between every pair closer than `dist`, drawn on from the first point. */
export function connections(g: CanvasRenderingContext2D, pts: Pt[], dist: number, age: number) {
  const k = ease(age / 0.25)
  if (k <= 0) return
  g.strokeStyle = FAINT
  g.lineWidth = 0.9
  g.beginPath()
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i]!, b = pts[j]!
    if (Math.hypot(a.x - b.x, a.y - b.y) >= dist) continue
    g.moveTo(a.x, a.y)
    g.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)
  }
  g.stroke()
}

export function crosshair(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, box: number) {
  g.strokeStyle = FAINT
  g.lineWidth = 1
  g.setLineDash([8, 7])
  g.beginPath()
  g.moveTo(0, cy); g.lineTo(w, cy)
  g.moveTo(cx, 0); g.lineTo(cx, h)
  g.stroke()
  g.strokeRect(cx - box / 2, cy - box / 2, box, box)
  g.setLineDash([])
  g.strokeStyle = INK
  g.lineWidth = 1.3
  g.beginPath()
  for (let a = 0; a < 4; a++) {
    const t = (a * Math.PI) / 4
    g.moveTo(cx - Math.cos(t) * 16, cy - Math.sin(t) * 16)
    g.lineTo(cx + Math.cos(t) * 16, cy + Math.sin(t) * 16)
  }
  g.stroke()
}

/** Tangent chain of circles from (cx, cy) along `angle`, with markers and labels at the joints. */
export function chain(g: CanvasRenderingContext2D, cx: number, cy: number, r0: number, angle: number, n: number, ratio: number, grow: number) {
  const dx = Math.cos(angle), dy = Math.sin(angle)
  const cs: [number, number, number][] = [[cx, cy, r0]]
  for (const sgn of [1, -1]) {
    let c = cs[0]!
    for (let i = 0; i < (n - 1) / 2; i++) {
      const nr = c[2] * ratio
      c = [c[0] + sgn * dx * (c[2] + nr), c[1] + sgn * dy * (c[2] + nr), nr]
      cs.push(c)
    }
  }
  const shown = Math.ceil(cs.length * ease(grow))
  g.strokeStyle = FAINT
  g.lineWidth = 1
  for (let i = 0; i < shown; i++) {
    const [x, y, r] = cs[i]!
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.stroke()
    if (i === 0) continue
    // joint with the previous circle on its side
    const [px, py, pr] = i === 1 || i === (cs.length + 1) / 2 ? cs[0]! : cs[i - 1]!
    const jx = px + ((x - px) * pr) / (pr + r), jy = py + ((y - py) * pr) / (pr + r)
    g.fillStyle = INK
    g.beginPath()
    g.arc(jx, jy, 4, 0, Math.PI * 2)
    g.fill()
    label(g, `${i} → ${Math.round(jx)} – ${Math.round(jy)}`, jx + 9, jy, 12, INK)
  }
}

/** Mosaic of whatever is under (x, y, w, h), with outline and a coordinate label. */
export function pixelZone(g: CanvasRenderingContext2D, tmp: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cell: number) {
  const cw = Math.max(1, Math.round(w / cell)), ch = Math.max(1, Math.round(h / cell))
  const dpr = g.canvas.width / g.canvas.clientWidth || 1
  tmp.canvas.width = cw
  tmp.canvas.height = ch
  tmp.imageSmoothingEnabled = true
  tmp.drawImage(g.canvas, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, cw, ch)
  g.save()
  g.imageSmoothingEnabled = false
  g.drawImage(tmp.canvas, 0, 0, cw, ch, x, y, w, h)
  g.restore()
  g.strokeStyle = INK
  g.lineWidth = 1
  g.strokeRect(x, y, w, h)
  label(g, `${Math.round(x + w / 2)},${Math.round(y + h / 2)}`, x + w / 2, y + h / 2, 12, INK, 'center')
}

export function slate(g: CanvasRenderingContext2D, w: number, h: number, tl: string, tr: string, bl: string, br: string) {
  const m = 56
  label(g, tl, m, m, 15)
  label(g, tr, w - m, m, 15, INK, 'right')
  label(g, bl, m, h - m, 15)
  label(g, br, w - m, h - m, 15, INK, 'right')
}
