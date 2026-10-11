import { C, MONO, SANS, TONE, type Tone } from './theme.js'

const NS = 'http://www.w3.org/2000/svg'

function svgEl(tag: string, attrs: Record<string, string | number>, parent?: Element, text?: string): SVGElement {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (text !== undefined) e.textContent = text
  parent?.appendChild(e)
  return e
}

function root(w: number, h: number): SVGSVGElement {
  const s = svgEl('svg', { viewBox: `0 0 ${w} ${h}` }) as SVGSVGElement
  Object.assign(s.style, { display: 'block', width: '100%', maxWidth: `${w * 1.4}px`, height: 'auto' })
  s.style.overflow = 'visible'
  return s
}

export interface BarRow { label: string; bars: { v: number; tone: Tone; text?: string }[] }

/** Horizontal (grouped) bars. */
export function bars(o: { rows: BarRow[]; max: number; width: number; labelW?: number; barH?: number; gap?: number; font?: number }): SVGSVGElement {
  const labelW = o.labelW ?? 300
  const barH = o.barH ?? 34
  const gap = o.gap ?? 22
  const font = o.font ?? 24
  const plotW = o.width - labelW - 190
  const rowH = (r: BarRow) => r.bars.length * (barH + 6) - 6
  const h = o.rows.reduce((a, r) => a + rowH(r) + gap, 0) - gap
  const s = root(o.width, h)
  let y = 0
  for (const r of o.rows) {
    const rh = rowH(r)
    svgEl('text', { x: labelW - 18, y: y + rh / 2, 'text-anchor': 'end', 'dominant-baseline': 'central', 'font-family': SANS, 'font-size': font, fill: C.ink }, s, r.label)
    r.bars.forEach((b, i) => {
      const by = y + i * (barH + 6)
      const w = Math.max(2, (b.v / o.max) * plotW)
      svgEl('rect', { x: labelW, y: by, width: w, height: barH, rx: 4, fill: TONE[b.tone].fg, 'fill-opacity': b.tone === 'stock' ? 0.55 : 0.9 }, s)
      svgEl('text', { x: labelW + w + 12, y: by + barH / 2, 'dominant-baseline': 'central', 'font-family': MONO, 'font-size': font - 2, fill: TONE[b.tone].fg, 'font-weight': 700 }, s, b.text ?? String(b.v))
    })
    y += rh + gap
  }
  return s
}

export interface Series { name: string; tone: Tone; ys: (number | null)[]; dash?: boolean }

/** Line chart over categorical x positions, optional log y. */
export function lines(o: {
  xs: string[]; series: Series[]; width: number; height: number; ymin: number; ymax: number; log?: boolean
  yticks: number[]; yfmt?: (v: number) => string; xlabel?: string; ylabel?: string; legend?: 'right' | 'none'
  marks?: { x: number; label: string }[]
}): SVGSVGElement {
  const s = root(o.width, o.height)
  const L = 110
  const R = o.legend === 'none' ? 30 : 330
  const T = 20
  const B = 70
  const pw = o.width - L - R
  const ph = o.height - T - B
  const f = (v: number) => (o.log ? Math.log10(v) : v)
  const Y = (v: number) => T + ph - ((f(v) - f(o.ymin)) / (f(o.ymax) - f(o.ymin))) * ph
  const X = (i: number) => L + (o.xs.length === 1 ? pw / 2 : (i / (o.xs.length - 1)) * pw)
  const fmt = o.yfmt ?? ((v: number) => String(v))
  for (const t of o.yticks) {
    svgEl('line', { x1: L, x2: L + pw, y1: Y(t), y2: Y(t), stroke: C.line, 'stroke-width': 1.5 }, s)
    svgEl('text', { x: L - 14, y: Y(t), 'text-anchor': 'end', 'dominant-baseline': 'central', 'font-family': MONO, 'font-size': 20, fill: C.dim }, s, fmt(t))
  }
  o.xs.forEach((x, i) => {
    svgEl('text', { x: X(i), y: T + ph + 34, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 21, fill: C.dim }, s, x)
  })
  if (o.xlabel) svgEl('text', { x: L + pw / 2, y: o.height - 2, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': 21, fill: C.faint }, s, o.xlabel)
  if (o.ylabel) svgEl('text', { x: 0, y: T - 4, 'font-family': SANS, 'font-size': 21, fill: C.faint }, s, o.ylabel)
  for (const m of o.marks ?? []) {
    svgEl('line', { x1: X(m.x), x2: X(m.x), y1: T, y2: T + ph, stroke: C.faint, 'stroke-width': 2, 'stroke-dasharray': '6 6' }, s)
    svgEl('text', { x: X(m.x) + 10, y: T + 18, 'font-family': SANS, 'font-size': 20, fill: C.dim }, s, m.label)
  }
  o.series.forEach((sr, k) => {
    const col = TONE[sr.tone].fg
    let d = ''
    let pen = false
    // Missing points are skipped; the line connects the measured ones.
    sr.ys.forEach((v, i) => {
      if (v === null) return
      d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `
      pen = true
    })
    svgEl('path', { d, fill: 'none', stroke: col, 'stroke-width': 5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...(sr.dash ? { 'stroke-dasharray': '10 9' } : {}) }, s)
    sr.ys.forEach((v, i) => {
      if (v !== null) svgEl('circle', { cx: X(i), cy: Y(v), r: 7, fill: C.panel, stroke: col, 'stroke-width': 4 }, s)
    })
    if (o.legend !== 'none') {
      const ly = T + 20 + k * 42
      svgEl('line', { x1: L + pw + 40, x2: L + pw + 84, y1: ly, y2: ly, stroke: col, 'stroke-width': 5, ...(sr.dash ? { 'stroke-dasharray': '10 9' } : {}) }, s)
      svgEl('text', { x: L + pw + 96, y: ly, 'dominant-baseline': 'central', 'font-family': SANS, 'font-size': 22, fill: col, 'font-weight': 600 }, s, sr.name)
    }
  })
  return s
}

/** Number line with quantization levels -q..q around zero. */
export function levels(o: { q: number; width: number; maxAt?: number }): SVGSVGElement {
  const h = 170
  const s = root(o.width, h)
  const L = 60
  const pw = o.width - 2 * L
  const mid = 70
  const X = (k: number) => L + ((k + o.q + 0.5) / (2 * o.q + 1)) * pw
  svgEl('line', { x1: L - 20, x2: L + pw + 20, y1: mid, y2: mid, stroke: C.ink, 'stroke-width': 3 }, s)
  for (let k = -o.q; k <= o.q; k++) {
    const zero = k === 0
    svgEl('line', { x1: X(k), x2: X(k), y1: mid - (zero ? 26 : 18), y2: mid + (zero ? 26 : 18), stroke: zero ? C.ink : C.fin, 'stroke-width': zero ? 4 : 4 }, s)
    svgEl('text', { x: X(k), y: mid + 58, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 24, fill: zero ? C.ink : C.dim }, s, k === 0 ? '0' : k > 0 ? `+${k}` : String(k))
  }
  const span = X(1) - X(0)
  svgEl('path', { d: `M${X(0)} ${mid - 38} L${X(0)} ${mid - 46} L${X(1)} ${mid - 46} L${X(1)} ${mid - 38}`, fill: 'none', stroke: C.sdp, 'stroke-width': 2.5 }, s)
  svgEl('text', { x: X(0) + span / 2, y: mid - 56, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 22, fill: C.sdp }, s, 'step')
  const mx = X(o.q) + span * (o.maxAt ?? -0.2)
  svgEl('circle', { cx: mx, cy: mid, r: 10, fill: C.fin }, s)
  svgEl('text', { x: mx, y: mid - 30, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 22, fill: C.fin, 'font-weight': 700 }, s, 'max|y|')
  svgEl('text', { x: L + pw + 20, y: h - 6, 'text-anchor': 'end', 'font-family': SANS, 'font-size': 20, fill: C.faint }, s, 'k = round(y / step), stored in W bits')
  return s
}
