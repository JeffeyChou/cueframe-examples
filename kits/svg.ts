// Plain SVG helpers the style kits (comic.ts, bauhaus.ts) share: elements, a full-stage <svg>, a
// group placed by a pose, text, and a path's box measured in mount.

import type { MountContext } from '@cueframe/core'

export const NS = 'http://www.w3.org/2000/svg'
export type Attrs = Record<string, string | number>
export interface Box { x: number; y: number; w: number; h: number }
export const f2 = (n: number) => (Math.round(n * 100) / 100).toString()

export function el<K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Attrs = {}, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (text !== undefined) e.textContent = text
  parent.append(e)
  return e
}

/** A full-stage SVG in logical px, optionally on a background colour. */
export function stageSvg(ctx: Pick<MountContext, 'root' | 'stage'>, bg?: string): SVGSVGElement {
  const { w, h } = ctx.stage
  const svg = el(ctx.root as unknown as Element, 'svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h }) as SVGSVGElement
  Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', overflow: 'hidden' })
  if (bg) el(svg, 'rect', { width: w, height: h, fill: bg })
  return svg
}

/** The <defs> of the SVG that holds `parent`. */
export function defsOf(parent: Element): Element {
  const svg = parent instanceof SVGSVGElement ? parent : parent.closest('svg')
  if (!svg) throw new Error('svg: parent is not inside an <svg>')
  return svg.querySelector(':scope > defs') ?? svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild)
}

let clips = 0
/** A user-space clip path from path data; returns the `url(#…)` to put in `clip-path`. */
export function clipUrl(ctx: Pick<MountContext, 'id'>, parent: Element, d: string): { url: string; path: SVGPathElement } {
  const c = el(defsOf(parent), 'clipPath', { id: ctx.id(`kit-clip-${++clips}`), clipPathUnits: 'userSpaceOnUse' })
  const path = el(c, 'path', { d })
  return { url: `url(#${c.id})`, path }
}

export interface Pose { x: number; y: number; s?: number; sx?: number; sy?: number; rot?: number; o?: number }
/** Places a group whose local origin is its pivot. Set it every frame. */
export function place(g: SVGGElement, p: Pose) {
  g.dataset.cfAudit = 'allow-motion'
  const k = p.s ?? 1
  g.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${(p.rot ?? 0).toFixed(3)}) scale(${(k * (p.sx ?? 1)).toFixed(4)} ${(k * (p.sy ?? 1)).toFixed(4)})`)
  g.style.opacity = String(p.o ?? 1)
}

export interface TextOpts { size: number; font: string; weight?: number | string; fill?: string; anchor?: 'start' | 'middle' | 'end'; spacing?: number }
export function text(parent: Element, x: number, y: number, str: string, o: TextOpts): SVGTextElement {
  return el(parent, 'text', {
    x, y, 'font-size': o.size, 'font-family': o.font, 'font-weight': o.weight ?? 400, fill: o.fill ?? '#1E1E1E',
    'text-anchor': o.anchor ?? 'start', style: 'white-space: pre', ...(o.spacing ? { 'letter-spacing': o.spacing } : {}),
  }, str)
}

/** The box of path data, measured with a throwaway element (fonts and layout are ready in mount). */
export function bbox(parent: Element, d: string): Box {
  const p = el(parent, 'path', { d })
  const b = p.getBBox()
  p.remove()
  return { x: b.x, y: b.y, w: b.width, h: b.height }
}

export const rectD = (b: Box) => `M${f2(b.x)} ${f2(b.y)}H${f2(b.x + b.w)}V${f2(b.y + b.h)}H${f2(b.x)}Z`
export const ellipseD = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f2(cx - rx)} ${f2(cy)}A${f2(rx)} ${f2(ry)} 0 1 0 ${f2(cx + rx)} ${f2(cy)}A${f2(rx)} ${f2(ry)} 0 1 0 ${f2(cx - rx)} ${f2(cy)}Z`
export const polyD = (...pts: number[]) => pts.reduce((d, v, i) => d + (i % 2 ? ` ${f2(v)}` : `${i ? 'L' : 'M'}${f2(v)}`), '') + 'Z'

/** Mulberry32: a seeded generator for mount-time layout. */
export function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
