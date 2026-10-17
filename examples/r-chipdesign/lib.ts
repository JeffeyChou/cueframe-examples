// Shared look, layout and timing of the slice. Every time comes from the narration (cues, words).
import type { MountContext } from '@cueframe/core'
import cueTable from './build/cues.json'
export { said } from '@cueframe/recipes/subtitles.js'
export { blocking } from '@cueframe/recipes/blocking.js'
export { seg, win, lerp, clamp01, outCubic, inOutCubic, outBack, typed, caret } from '@cueframe/recipes/motion.js'

export const CUES: Record<string, number> = cueTable
export const start = (id: string) => CUES[`scene.${id}.start`]!
export const end = (id: string) => CUES[`scene.${id}.end`]!

export const C = {
  bg: '#06080b',
  panel: 'rgba(12,20,26,0.88)',
  edge: '#1d3843',
  cyan: '#38d6e8',
  orange: '#ff8a3d',
  red: '#ff4766',
  green: '#3ee08f',
  text: '#e6eef2',
  dim: '#7b8a93',
  faint: '#3a4a52',
}
export const SANS = '"Noto Sans SC", sans-serif'
export const MONO = '"Plex Mono", "Noto Sans SC", ui-monospace, monospace'

export interface Rect { x: number; y: number; w: number; h: number }
export const lerpRect = (a: Rect, b: Rect, k: number): Rect =>
  ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k })
export const center = (cx: number, cy: number, w: number, h: number): Rect => ({ x: cx - w / 2, y: cy - h / 2, w, h })

export function el<K extends keyof HTMLElementTagNameMap>(parent: Element, tag: K, style: Partial<CSSStyleDeclaration> = {}, text?: string) {
  const e = document.createElement(tag)
  Object.assign(e.style, { position: 'absolute', ...style })
  if (text !== undefined) e.textContent = text
  parent.append(e)
  return e
}

/** Absolute box in stage px; `o` opacity, `s` scale about its centre. */
export function place(e: HTMLElement, r: Rect, o = 1, s = 1) {
  e.style.left = `${r.x.toFixed(2)}px`
  e.style.top = `${r.y.toFixed(2)}px`
  e.style.width = `${r.w.toFixed(2)}px`
  e.style.height = `${r.h.toFixed(2)}px`
  e.style.opacity = String(Math.max(0, Math.min(1, o)))
  e.style.transform = s === 1 ? '' : `scale(${s.toFixed(4)})`
}

export function panel(parent: Element, accent = C.cyan) {
  return el(parent, 'div', {
    boxSizing: 'border-box', background: C.panel, border: `1.5px solid ${accent}55`, borderRadius: '10px',
    boxShadow: `0 0 0 1px #0008, 0 0 28px ${accent}22, inset 0 0 24px ${accent}10`, overflow: 'hidden',
  })
}

/** "text with **keyword**" → spans, keyword in `accent`. */
export function rich(e: HTMLElement, src: string, accent = C.cyan) {
  e.replaceChildren()
  src.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (!part) return
    const s = document.createElement('span')
    const key = part.startsWith('**')
    s.textContent = key ? part.slice(2, -2) : part
    if (key) s.style.color = accent
    e.append(s)
  })
}

/** Inject the slice's stylesheet once. */
export function css(ctx: MountContext) {
  if (document.getElementById('chip-css')) return
  const s = document.createElement('style')
  s.id = 'chip-css'
  s.textContent = `
    .chip-code { font: 500 30px/1.6 ${MONO}; color: ${C.text}; white-space: pre; }
    .chip-code .ln { color: ${C.faint}; display: inline-block; width: 2.2em; }
    .chip-code .kw { color: ${C.orange}; } .chip-code .id { color: ${C.cyan}; } .chip-code .op { color: ${C.dim}; }
    .chip-label { font: 500 26px ${SANS}; color: ${C.text}; letter-spacing: .04em; }
    .chip-eyebrow { font: 500 15px ${MONO}; color: ${C.dim}; letter-spacing: .3em; }`
  ctx.root.append(s)
}

// The code panel (scene `code`) and the scenes that point at its tokens share this geometry.
export const CODE = { pad: 24, gutter: 66, cw: 18, lh: 48 }
export const PANEL_H = { x: 600, y: 300, w: 1000, h: 168 }
export const PANEL_R = { x: 110, y: 300, w: 700, h: 168 }
export const PANEL_D = { x: 1000, y: 330, w: 810, h: 360 }
/** Stage rect of `n` characters from column `col` on `row` of a code panel at `p`. */
export const token = (p: Rect, row: number, col: number, n: number): Rect =>
  ({ x: p.x + CODE.pad + CODE.gutter + col * CODE.cw, y: p.y + CODE.pad + row * CODE.lh, w: n * CODE.cw, h: CODE.lh })
