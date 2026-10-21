// annotate: information design over a picture (a rendered plate, footage, a 3D scene): leader-line
// callouts that follow tracked points, source badges with a confidence grade, a chapter bar,
// lower thirds, a wipe between two pictures and bars on a log axis. Everything is set from
// progress values you derive from `f`, so it stays a pure function of time.
//
//   mount(ctx) {
//     const plate = await ctx.plate('build/plates/tray')
//     const o = overlay(ctx.root, ctx.stage)
//     const gpu = callout(o, { title: 'B300 GPU × 4', sub: 'under the copper cold plates', cite: { grade: 'H', source: 'NVIDIA DGX guide' }, at: { x: 1180, y: 300 } })
//     const lt = lowerThird(o, { title: '液冷', body: '冷却液经快接头进出…', cite: { grade: 'H', source: 'Lenovo GB300 manual' } })
//     return { plate, gpu, lt }
//   },
//   render(f, s) {
//     s.gpu.update(s.plate.track('gpu0', f), seg(f.lt, 1, 2), seg(f.lt, 6, 6.5))
//     s.lt.update(seg(f.lt, 2, 3), seg(f.lt, 7, 7.5))
//   }

import { clamp01, lerp, outCubic } from '@cueframe/recipes/motion.js'

const NS = 'http://www.w3.org/2000/svg'

/** Colours and type; change them per piece. */
export const A = {
  ink: '#f4f1ea',
  dim: 'rgba(244,241,234,.66)',
  faint: 'rgba(244,241,234,.32)',
  line: 'rgba(244,241,234,.78)',
  accent: '#d8b46a',
  shade: 'rgba(6,7,9,.62)',
  /** Soft dark halo under type, so labels hold over a busy picture. */
  halo: '0 1px 2px rgba(0,0,0,.55), 0 0 14px rgba(0,0,0,.45)',
  font: '"Noto Sans SC", "Inter", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
}

/** Confidence grades for source badges; replace the legend with your own. */
export const GRADES: Record<string, string> = {
  H: 'official or vendor documentation',
  R: 'reported by press or analysts',
  E: 'our estimate from the sources',
}

export interface Overlay {
  /** Full-stage SVG for lines, under the labels. */
  svg: SVGSVGElement
  /** Full-stage layer for labels. */
  layer: HTMLDivElement
  w: number
  h: number
}

export interface Point { x: number; y: number; visible?: boolean }

export interface Cite { grade: string; source: string }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, style: Partial<CSSStyleDeclaration> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  Object.assign(e.style, style)
  if (text !== undefined) e.textContent = text
  parent.appendChild(e)
  return e
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, parent: Element, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  parent.appendChild(e)
  return e
}

/** An SVG line layer and a label layer over the whole stage, above what the scene already holds. */
export function overlay(root: HTMLElement, stage: { w: number; h: number }): Overlay {
  const box = { position: 'absolute', left: '0', top: '0', width: `${stage.w}px`, height: `${stage.h}px`, pointerEvents: 'none' }
  const s = document.createElementNS(NS, 'svg')
  s.setAttribute('viewBox', `0 0 ${stage.w} ${stage.h}`)
  Object.assign(s.style, box, { overflow: 'visible' })
  root.appendChild(s)
  const layer = el('div', root, box)
  return { svg: s, layer, w: stage.w, h: stage.h }
}

/** A source badge: the grade in a filled square, then the source. Append it under any label. */
export function badge(parent: HTMLElement, c: Cite, size = 22): HTMLDivElement {
  const row = el('div', parent, { display: 'flex', alignItems: 'center', gap: `${size * 0.45}px`, marginTop: `${size * 0.5}px`, font: `${size}px/1.2 ${A.font}`, color: A.dim, whiteSpace: 'nowrap' })
  const grade = el('span', row, {
    display: 'inline-grid', placeItems: 'center', width: `${size * 1.05}px`, height: `${size * 1.05}px`, background: A.ink, color: '#111',
    font: `700 ${size * 0.7}px/1 ${A.mono}`, borderRadius: '2px', flex: 'none',
  }, c.grade)
  grade.title = GRADES[c.grade] ?? ''
  // The grade letter is an icon in its square, not text to read at length.
  grade.dataset.cfAudit = 'allow-small'
  el('span', row, {}, c.source)
  return row
}

export interface CalloutSpec {
  title: string
  sub?: string
  cite?: Cite
  /** Where the label's line end sits on the stage (its left or right edge, at the title's middle). */
  at: { x: number; y: number }
  /** Which side of `at` the text sits on (default: away from the point). */
  side?: 'left' | 'right'
  size?: number
}

export interface Callout {
  root: HTMLDivElement
  /**
   * `p`: the point (from `plate.track`, or any stage point); `k`: 0..1 drawing in (line, then
   * dot, then text); `out`: 0..1 leaving; `at`: this frame's label position, when it moves with
   * the picture (default `spec.at`). Hidden while the point is not visible.
   */
  update(p: Point, k: number, out?: number, at?: { x: number; y: number }): void
}

/**
 * The leader from a label to its point. The text block spans [x - pad - w, x - pad] (side left)
 * or [x + pad, x + pad + w] (side right), from `top` down `h`. The line leaves from the block's
 * side that faces the point: `at` itself, the far end of the block when the point lies beyond the
 * text, or below/above the block when the point is under or over the text; it never crosses the
 * text. A point inside the block gets no line.
 */
export function leaderPath(p: Point, at: { x: number; y: number }, side: 'left' | 'right', block: { w: number; h: number; top: number }, pad = 12) {
  const { x, y } = at
  const b0 = side === 'left' ? x - pad - block.w : x + pad
  const b1 = side === 'left' ? x - pad : x + pad + block.w
  // A point inside the text block gets no leader (it would cross the text): only its dot.
  if (p.x >= b0 && p.x <= b1 && p.y >= block.top && p.y <= block.top + block.h) return { d: '', len: 0, b0, b1, start: { x: p.x, y: p.y } }
  if (p.x >= b0 - pad && p.x <= b1 + pad) {
    const sy = p.y > y ? block.top + block.h + 6 : block.top - 6
    const sx = Math.min(Math.max(p.x, b0), b1)
    return { d: `M${sx},${sy} L${p.x},${p.y}`, len: Math.hypot(p.x - sx, p.y - sy), b0, b1, start: { x: sx, y: sy } }
  }
  const x0 = side === 'left' && p.x < b0 ? b0 - pad : side === 'right' && p.x > b1 ? b1 + pad : x
  // A short level stub off the label, level on to an elbow, then 45° into the point (straight
  // from the stub when the point is steeper than that).
  const dir = Math.sign(p.x - x0) || 1
  const stub = x0 + dir * Math.min(28, Math.abs(p.x - x0))
  const ex = Math.abs(p.x - stub) > Math.abs(p.y - y) ? p.x - dir * Math.abs(p.y - y) : stub
  return { d: `M${x0},${y} L${stub},${y} L${ex},${y} L${p.x},${p.y}`, len: Math.abs(ex - x0) + Math.hypot(p.x - ex, p.y - y), b0, b1, start: { x: x0, y } }
}

/** A label with a leader line: label edge → elbow → a ringed dot on the point. */
export function callout(o: Overlay, spec: CalloutSpec): Callout {
  const size = spec.size ?? 26
  const g = svg('g', o.svg)
  const path = svg('path', g, { fill: 'none', stroke: A.line, 'stroke-width': 1.5, 'stroke-linejoin': 'round' })
  const ring = svg('circle', g, { r: 7, fill: 'none', stroke: A.ink, 'stroke-width': 1.5 })
  const dot = svg('circle', g, { r: 2.6, fill: A.ink })
  const root = el('div', o.layer, { position: 'absolute', top: '0', left: '0', whiteSpace: 'nowrap', textShadow: A.halo })
  el('div', root, { font: `600 ${size}px/1.15 ${A.font}`, color: A.ink }, spec.title)
  // Secondary lines stay at audit's 22 px floor for video.
  if (spec.sub) el('div', root, { font: `${Math.max(22, size * 0.72)}px/1.3 ${A.font}`, color: A.dim, marginTop: `${size * 0.15}px` }, spec.sub)
  if (spec.cite) badge(root, spec.cite, Math.max(22, size * 0.62))
  const side = spec.side ?? null
  return {
    root,
    update(p, k, out = 0, at = spec.at) {
      // Hidden while the point is hidden, off the stage (beyond a margin) or not a number.
      const M = 40
      const placed = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(at.x) && Number.isFinite(at.y)
      const on = placed && (p.visible ?? true) && k > 0 && p.x >= -M && p.x <= o.w + M && p.y >= -M && p.y <= o.h + M
      g.style.opacity = on ? String(1 - clamp01(out)) : '0'
      if (!on) {
        root.style.opacity = '0'
        return
      }
      const { x, y } = at
      const pad = 12
      // The text sits away from the point unless the spec says otherwise.
      const s = side ?? (p.x < x ? 'right' : 'left')
      // The text block spans [x - pad - w, x - pad] (left) or [x + pad, x + pad + w] (right). The
      // leader leaves from the block's side that faces the point: `at`, the far end of the block
      // when the point lies beyond the text, or below/above it when the point is under the text.
      // Measured at the origin: a shrink-to-fit box left where the last frame put it can be
      // narrower near the stage edge, which would make this frame depend on the one before.
      root.style.left = '0px'
      const { d, len, b0 } = leaderPath(p, at, s, { w: root.offsetWidth, h: root.offsetHeight, top: y - size * 0.6 }, pad)
      const draw = outCubic(clamp01(k / 0.6))
      path.setAttribute('d', d)
      path.setAttribute('stroke-dasharray', `${len} ${len}`)
      path.setAttribute('stroke-dashoffset', String(len * (1 - draw)))
      const pop = outCubic(clamp01((k - 0.45) / 0.3))
      ring.setAttribute('cx', String(p.x)); ring.setAttribute('cy', String(p.y)); ring.setAttribute('r', String(7 * pop))
      dot.setAttribute('cx', String(p.x)); dot.setAttribute('cy', String(p.y)); dot.setAttribute('r', String(2.6 * pop))
      const t = outCubic(clamp01((k - 0.55) / 0.45))
      // Whole pixels: halo-blurred type at fractional positions is rastered differently
      // depending on what was painted before (check determinism found it on the r-gb300 replica).
      root.style.left = `${Math.round(b0)}px`
      root.style.top = `${Math.round(y - size * 0.6)}px`
      root.style.textAlign = s === 'left' ? 'right' : 'left'
      root.style.transform = `translateX(${(1 - t) * (s === 'left' ? 16 : -16)}px)`
      root.style.opacity = String(t * (1 - clamp01(out)))
    },
  }
}

export interface LowerThirdSpec {
  title: string
  body?: string
  cite?: Cite
  /** Bottom-left corner of the block (default: 96 px from the left, 120 px from the bottom). */
  x?: number
  y?: number
  size?: number
  /** Body wraps at this width (default 640). */
  width?: number
}

/** A title, an optional body and badge at the bottom left, with a soft shade behind for legibility. */
export function lowerThird(o: Overlay, spec: LowerThirdSpec): { root: HTMLDivElement; update(k: number, out?: number): void } {
  const size = spec.size ?? 52
  const shade = el('div', o.layer, {
    position: 'absolute', left: '0', top: `${o.h * 0.45}px`, width: `${o.w * 0.75}px`, height: `${o.h * 0.55}px`,
    background: `radial-gradient(120% 90% at 0% 100%, ${A.shade}, transparent 70%)`,
  })
  const root = el('div', o.layer, { position: 'absolute', left: `${spec.x ?? 96}px`, bottom: `${o.h - (spec.y ?? o.h - 120)}px`, width: `${spec.width ?? 640}px`, textShadow: A.halo })
  const title = el('div', root, { font: `700 ${size}px/1.15 ${A.font}`, color: A.ink, whiteSpace: 'nowrap' }, spec.title)
  const body = spec.body ? el('div', root, { font: `${Math.max(22, size * 0.5)}px/1.45 ${A.font}`, color: A.dim, marginTop: `${size * 0.22}px` }, spec.body) : null
  const cite = spec.cite ? badge(root, spec.cite, Math.max(22, size * 0.34)) : null
  return {
    root,
    update(k, out = 0) {
      const gone = clamp01(out)
      shade.style.opacity = String(clamp01(k * 2) * (1 - gone))
      const parts = [title, body, cite].filter((x): x is HTMLDivElement => x !== null)
      parts.forEach((p, i) => {
        const t = outCubic(clamp01((k - i * 0.18) / 0.5))
        p.style.opacity = String(t * (1 - gone))
        p.style.transform = `translateY(${(1 - t) * 14}px)`
      })
    },
  }
}

/** Top-left chapter bar: one dash per chapter, the current one long, then its number and name. */
export function chapterBar(o: Overlay, chapters: readonly string[], x = 64, y = 46): { root: HTMLDivElement; update(current: number, k?: number): void } {
  const root = el('div', o.layer, { position: 'absolute', left: `${x}px`, top: `${y}px`, display: 'flex', alignItems: 'center', gap: '10px', font: `22px/1 ${A.mono}`, color: A.dim, letterSpacing: '.08em', textShadow: A.halo })
  // Chrome: it sits in the chrome margin (audit chromeMargin), like a deck's header.
  root.dataset.cfAudit = 'chrome'
  const dashes = chapters.map(() => el('span', root, { display: 'inline-block', height: '1.5px', background: A.faint }))
  const label = el('span', root, { marginLeft: '8px', color: A.ink, font: `600 24px/1 ${A.font}`, letterSpacing: '.04em' })
  return {
    root,
    update(current, k = 1) {
      dashes.forEach((d, i) => {
        const on = i === current
        d.style.width = `${on ? lerp(14, 54, outCubic(clamp01(k))) : 14}px`
        d.style.background = on ? A.ink : A.faint
      })
      label.textContent = `${String(current + 1).padStart(2, '0')}  ${chapters[current] ?? ''}`
      label.style.opacity = String(clamp01(k))
    },
  }
}

/**
 * Wipe between two stacked elements (`top` over the other): `top` shows left of `x` (0..1 of the
 * stage width), with a thin bright divider.
 */
export function wipe(o: Overlay, top: HTMLElement): { update(x: number): void } {
  const line = el('div', o.layer, { position: 'absolute', top: '0', width: '2px', height: `${o.h}px`, background: A.ink, boxShadow: `0 0 18px ${A.ink}` })
  return {
    update(x) {
      const px = clamp01(x) * o.w
      top.style.clipPath = `inset(0 ${o.w - px}px 0 0)`
      line.style.left = `${px - 1}px`
      line.style.opacity = x > 0 && x < 1 ? '1' : '0'
    },
  }
}

export interface LogBar { label: string; sub?: string; value: number; highlight?: boolean; text?: string }

/**
 * Horizontal bars on a log axis that grow in turn, with value labels: `update(k)` where bar i
 * grows over k ∈ [i/n, (i+1)/n]. Ticks at each decade between `min` and `max`.
 */
export function logBars(o: Overlay, rows: readonly LogBar[], spec: { x: number; y: number; w: number; min: number; max: number; row?: number; labelW?: number; unit?: string }): { root: HTMLDivElement; update(k: number, out?: number): void } {
  if (!(spec.min > 0) || !Number.isFinite(spec.max) || !(spec.max > spec.min)) throw new Error(`logBars: needs 0 < min < max (got ${spec.min}, ${spec.max})`)
  const row = spec.row ?? 64
  const lw = spec.labelW ?? 220
  const root = el('div', o.layer, { position: 'absolute', left: `${spec.x}px`, top: `${spec.y}px`, width: `${spec.w}px` })
  const span = Math.log10(spec.max) - Math.log10(spec.min)
  const at = (v: number) => lw + ((Math.log10(Math.max(v, spec.min)) - Math.log10(spec.min)) / span) * (spec.w - lw)
  for (let d = Math.ceil(Math.log10(spec.min)); d <= Math.floor(Math.log10(spec.max)); d++) {
    const v = 10 ** d
    const t = el('div', root, { position: 'absolute', left: `${at(v)}px`, top: '-34px', height: `${rows.length * row + 34}px`, borderLeft: `1px dashed ${A.faint}` })
    el('div', t, { position: 'absolute', left: '-40px', width: '80px', textAlign: 'center', top: '-8px', font: `22px/1 ${A.mono}`, color: A.dim },
      v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}k` : String(v))
  }
  if (spec.unit) el('div', root, { position: 'absolute', left: '0', top: '-44px', font: `22px/1 ${A.mono}`, color: A.dim, letterSpacing: '.08em' }, spec.unit)
  const bars = rows.map((r, i) => {
    const y = i * row
    const lab = el('div', root, { position: 'absolute', left: '0', top: `${y}px`, width: `${lw - 24}px` })
    el('div', lab, { font: `600 24px/1.1 ${A.font}`, color: r.highlight ? A.accent : A.ink }, r.label)
    if (r.sub) el('div', lab, { font: `22px/1.25 ${A.font}`, color: A.dim, marginTop: '2px' }, r.sub)
    const bar = el('div', root, { position: 'absolute', left: `${lw}px`, top: `${y + 9}px`, height: r.highlight ? '6px' : '3px', background: r.highlight ? A.accent : A.ink })
    const val = el('div', root, { position: 'absolute', top: `${y}px`, font: `${r.highlight ? 700 : 400} ${r.highlight ? 28 : 22}px/1.2 ${A.mono}`, color: r.highlight ? A.accent : A.dim, whiteSpace: 'nowrap' })
    return { r, lab, bar, val }
  })
  return {
    root,
    update(k, out = 0) {
      const n = bars.length
      root.style.opacity = String(1 - clamp01(out))
      bars.forEach(({ r, lab, bar, val }, i) => {
        const t = outCubic(clamp01(k * n - i))
        const end = at(r.value)
        // Grow along the log axis, so the value read at the bar's tip is right all the way.
        const cur = Math.exp(lerp(Math.log(spec.min), Math.log(r.value), t))
        bar.style.width = `${Math.max(0, at(cur) - lw)}px`
        lab.style.opacity = String(clamp01(k * n - i + 0.6))
        val.style.left = `${end + 12}px`
        val.style.opacity = String(clamp01((k * n - i - 0.7) / 0.3))
        val.textContent = r.text ?? r.value.toLocaleString('en-US')
      })
    },
  }
}
