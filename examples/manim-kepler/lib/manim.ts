// manim: 3Blue1Brown-style vector geometry on SVG. A palette by role, a faint coordinate plane,
// and primitives whose geometry you set every frame (lines, arrows, polygons, dots, marks).
// const g = plane(ctx.root, ctx.stage, { step: 60 })
// const ab = line(g.svg, { color: M.white }); ab.set(A, B).draw(seg(f.t, at, at + 0.8, smooth))
// Everything is created in mount and updated in render, so frames render in any order.

export const M = {
  bg: '#070B12',
  white: '#ECEFF1',     // axioms: frames, axes, untouched symbols
  gold: '#F9D71C',      // the subject: swept areas, conclusions
  teal: '#58C4DD',      // fields and motion: velocity, trajectories
  blue: '#29ABCA',
  red: '#FF6B6B',       // constraints: forces, cancelled terms
  green: '#83C167',     // measures: heights, angles, time steps
  grey: '#888E99',
}

export type P = readonly [number, number]

const NS = 'http://www.w3.org/2000/svg'

export const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]]
export const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]]
export const mul = (a: P, k: number): P => [a[0] * k, a[1] * k]
export const mix = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
export const len = (a: P) => Math.hypot(a[0], a[1])
export const unit = (a: P): P => mul(a, 1 / (len(a) || 1))
export const cross = (a: P, b: P) => a[0] * b[1] - a[1] * b[0]
export const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1]
/** Area of the triangle abc (unsigned). */
export const area = (a: P, b: P, c: P) => Math.abs(cross(sub(b, a), sub(c, a))) / 2
/** Foot of the perpendicular from p onto the line through a and b. */
export const foot = (p: P, a: P, b: P): P => {
  const d = sub(b, a)
  return add(a, mul(d, dot(sub(p, a), d) / dot(d, d)))
}

/** Manim's default rate function: smooth ease in and out. */
export const smooth = (x: number) => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x
  return t * t * (3 - 2 * t)
}

export function svgEl<K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  parent.append(e)
  return e
}

const f2 = (n: number) => (Math.round(n * 100) / 100).toString()
const pts = (ps: readonly P[]) => ps.map((p) => `${f2(p[0])},${f2(p[1])}`).join(' ')

export interface Plane { svg: SVGSVGElement; grid: SVGGElement; layer(): SVGGElement }

/** Full-stage SVG with a faint grid (minor `step`, major every `major` lines) centred on `origin`. */
export function plane(root: HTMLElement, stage: { w: number; h: number }, o: { step?: number; major?: number; origin?: P; color?: string; axes?: boolean } = {}): Plane {
  const { step = 60, major = 4, origin = [stage.w / 2, stage.h / 2], color = M.blue, axes = false } = o
  const svg = svgEl(root as unknown as Element, 'svg', { width: stage.w, height: stage.h, viewBox: `0 0 ${stage.w} ${stage.h}` })
  Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', overflow: 'visible' })
  const grid = svgEl(svg, 'g', { 'data-cf-audit': 'allow-motion allow-overlap' })
  const lines = (horizontal: boolean) => {
    const n = horizontal ? stage.h : stage.w
    const c = horizontal ? origin[1] : origin[0]
    for (let k = Math.floor(-c / step); k <= Math.ceil((n - c) / step); k++) {
      const v = c + k * step
      const strong = k % major === 0
      svgEl(grid, 'line', horizontal
        ? { x1: 0, x2: stage.w, y1: v, y2: v }
        : { x1: v, x2: v, y1: 0, y2: stage.h })
        .setAttribute('style', `stroke:${color};stroke-width:${strong ? 1.6 : 1};opacity:${strong ? 0.32 : 0.16}`)
    }
  }
  lines(true)
  lines(false)
  if (axes) {
    svgEl(grid, 'line', { x1: 0, x2: stage.w, y1: origin[1], y2: origin[1], stroke: M.white, 'stroke-width': 2, opacity: 0.55 })
    svgEl(grid, 'line', { x1: origin[0], x2: origin[0], y1: 0, y2: stage.h, stroke: M.white, 'stroke-width': 2, opacity: 0.55 })
  }
  return { svg, grid, layer: () => svgEl(svg, 'g') }
}

export interface Stroke { color?: string; width?: number; dash?: string; opacity?: number }

/** A straight segment. `draw(p)` writes it on from a to b; `fade(o)` sets opacity. */
export function line(parent: Element, s: Stroke = {}) {
  const e = svgEl(parent, 'line', { stroke: s.color ?? M.white, 'stroke-width': s.width ?? 4, 'stroke-linecap': 'round' })
  if (s.dash) e.setAttribute('stroke-dasharray', s.dash)
  const api = {
    el: e,
    a: [0, 0] as P,
    b: [0, 0] as P,
    set(a: P, b: P) { api.a = a; api.b = b; return api },
    /** Show the part from a to a + p·(b − a). */
    draw(p: number, opacity = s.opacity ?? 1) {
      const q = mix(api.a, api.b, p < 0 ? 0 : p > 1 ? 1 : p)
      e.setAttribute('x1', f2(api.a[0])); e.setAttribute('y1', f2(api.a[1]))
      e.setAttribute('x2', f2(q[0])); e.setAttribute('y2', f2(q[1]))
      e.style.display = p <= 0 || opacity <= 0 ? 'none' : ''
      e.style.opacity = String(opacity)
      return api
    },
  }
  return api
}

/** An arrow from a to b with a filled head; the shaft stops at the head's base. */
export function arrow(parent: Element, s: Stroke & { head?: number } = {}) {
  const g = svgEl(parent, 'g')
  const color = s.color ?? M.white
  const shaft = svgEl(g, 'line', { stroke: color, 'stroke-width': s.width ?? 5, 'stroke-linecap': 'round' })
  if (s.dash) shaft.setAttribute('stroke-dasharray', s.dash)
  const head = svgEl(g, 'polygon', { fill: color })
  const api = {
    el: g,
    set(a: P, b: P, p = 1, opacity = s.opacity ?? 1) {
      const tip = mix(a, b, p < 0 ? 0 : p > 1 ? 1 : p)
      const d = sub(tip, a)
      const L = len(d)
      g.style.display = p <= 0 || L < 1 || opacity <= 0 ? 'none' : ''
      g.style.opacity = String(opacity)
      if (L < 1) return api
      const hl = Math.min(s.head ?? 22, L * 0.45)
      const u = unit(d)
      const n: P = [-u[1], u[0]]
      const base = sub(tip, mul(u, hl))
      shaft.setAttribute('x1', f2(a[0])); shaft.setAttribute('y1', f2(a[1]))
      shaft.setAttribute('x2', f2(base[0] + u[0])); shaft.setAttribute('y2', f2(base[1] + u[1]))
      head.setAttribute('points', pts([tip, add(base, mul(n, hl * 0.48)), sub(base, mul(n, hl * 0.48))]))
      return api
    },
  }
  return api
}

/** A filled polygon with an optional outline. */
export function poly(parent: Element, o: { fill?: string; alpha?: number; stroke?: string; width?: number } = {}) {
  const e = svgEl(parent, 'polygon', {
    fill: o.fill ?? M.gold, 'fill-opacity': o.alpha ?? 0.4,
    stroke: o.stroke ?? 'none', 'stroke-width': o.width ?? 3, 'stroke-linejoin': 'round',
  })
  return {
    el: e,
    set(ps: readonly P[], opacity = 1) {
      e.setAttribute('points', pts(ps))
      e.style.display = opacity <= 0 ? 'none' : ''
      e.style.opacity = String(opacity)
      return this
    },
  }
}

/** A polyline written on by length: `set(points, p)` shows the first p of its length. */
export function trail(parent: Element, s: Stroke = {}) {
  const e = svgEl(parent, 'polyline', { fill: 'none', stroke: s.color ?? M.teal, 'stroke-width': s.width ?? 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })
  if (s.dash) e.setAttribute('stroke-dasharray', s.dash)
  return {
    el: e,
    set(ps: readonly P[], p = 1, opacity = s.opacity ?? 1) {
      let total = 0
      for (let i = 1; i < ps.length; i++) total += len(sub(ps[i]!, ps[i - 1]!))
      let want = total * (p < 0 ? 0 : p > 1 ? 1 : p)
      const out: P[] = ps.length ? [ps[0]!] : []
      for (let i = 1; i < ps.length && want > 0; i++) {
        const l = len(sub(ps[i]!, ps[i - 1]!))
        out.push(l <= want ? ps[i]! : mix(ps[i - 1]!, ps[i]!, want / l))
        want -= l
      }
      e.setAttribute('points', pts(out))
      e.style.display = p <= 0 || opacity <= 0 ? 'none' : ''
      e.style.opacity = String(opacity)
      return this
    },
  }
}

export function circle(parent: Element, o: { r?: number; fill?: string; stroke?: string; width?: number } = {}) {
  const e = svgEl(parent, 'circle', { r: o.r ?? 8, fill: o.fill ?? M.white, stroke: o.stroke ?? 'none', 'stroke-width': o.width ?? 0 })
  return {
    el: e,
    set(c: P, opacity = 1, scale = 1) {
      e.setAttribute('cx', f2(c[0])); e.setAttribute('cy', f2(c[1]))
      e.setAttribute('r', f2((o.r ?? 8) * scale))
      e.style.display = opacity <= 0 || scale <= 0 ? 'none' : ''
      e.style.opacity = String(opacity)
      return this
    },
  }
}

/** A glowing body (the Sun): a radial-gradient halo under a solid core. */
export function star(parent: Element, id: string, o: { r?: number; core?: string; glow?: string } = {}) {
  const r = o.r ?? 18
  const defs = svgEl(parent, 'defs')
  const grad = svgEl(defs, 'radialGradient', { id })
  svgEl(grad, 'stop', { offset: '0', 'stop-color': o.glow ?? M.gold, 'stop-opacity': 0.55 })
  svgEl(grad, 'stop', { offset: '1', 'stop-color': o.glow ?? M.gold, 'stop-opacity': 0 })
  const g = svgEl(parent, 'g')
  const halo = svgEl(g, 'circle', { r: r * 3.2, fill: `url(#${id})` })
  const core = svgEl(g, 'circle', { r, fill: o.core ?? '#FFF4C2' })
  return {
    el: g,
    set(c: P, opacity = 1, scale = 1) {
      for (const e of [halo, core]) { e.setAttribute('cx', f2(c[0])); e.setAttribute('cy', f2(c[1])) }
      halo.setAttribute('r', f2(r * 3.2 * scale)); core.setAttribute('r', f2(r * scale))
      g.style.display = opacity <= 0 || scale <= 0 ? 'none' : ''
      g.style.opacity = String(opacity)
      return this
    },
  }
}

/** Right-angle mark at corner c between directions towards a and b. */
export function rightAngle(parent: Element, s: Stroke & { size?: number } = {}) {
  const e = svgEl(parent, 'polyline', { fill: 'none', stroke: s.color ?? M.green, 'stroke-width': s.width ?? 3 })
  return {
    el: e,
    set(c: P, a: P, b: P, opacity = 1) {
      const k = s.size ?? 20
      const u = mul(unit(sub(a, c)), k)
      const v = mul(unit(sub(b, c)), k)
      e.setAttribute('points', pts([add(c, u), add(add(c, u), v), add(c, v)]))
      e.style.display = opacity <= 0 ? 'none' : ''
      e.style.opacity = String(opacity)
      return this
    },
  }
}

/** Tick marks across segment ab (equal-length marks), `n` parallel ticks at its midpoint. */
export function ticks(parent: Element, n: number, s: Stroke & { size?: number } = {}) {
  const ls = Array.from({ length: n }, () => line(parent, { color: s.color ?? M.green, width: s.width ?? 3 }))
  return {
    set(a: P, b: P, opacity = 1) {
      const u = unit(sub(b, a))
      const nn: P = [-u[1], u[0]]
      const m = mix(a, b, 0.5)
      const k = s.size ?? 12
      ls.forEach((l, i) => {
        const c = add(m, mul(u, (i - (n - 1) / 2) * 8))
        l.set(add(c, mul(nn, k)), sub(c, mul(nn, k))).draw(1, opacity)
      })
      return this
    },
  }
}
