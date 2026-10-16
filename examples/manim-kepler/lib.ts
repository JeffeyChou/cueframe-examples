import type { Frame, MountContext } from '@cueframe/core'
import { createMorph, mathjaxRenderer, renderFormula, type MathMorph } from '@texmorph/mathjax'
import { M, smooth } from '../../recipes/manim.js'
export { glyphsOf, said } from '../../recipes/subtitles.js'
import cueTable from './build/cues.json'

/** Narration cues (seconds); `CUES['scene.k1.start']`. */
export const CUES: Record<string, number> = cueTable

export { M }
export const W = 1920
export const H = 1080
export const CJK = 'Noto Sans SC'
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const seg = (t: number, a: number, b: number, ease: (x: number) => number = smooth) => ease(b > a ? (t - a) / (b - a) : t >= a ? 1 : 0)
export const fade = (t: number, a: number, b: number, d = 0.5) => Math.min(seg(t, a, a + d), 1 - seg(t, b - d, b))

/**
 * Colour by role in TeX: `\gold{A}`, `\teal{}`, `\red{}`, `\green{}`, and `\strike{x}` (a red
 * cancel line over white x). Expanded here: a `#` in a MathJax macro body reads as a parameter.
 */
const ROLE: Record<string, string> = { gold: M.gold, teal: M.teal, red: M.red, green: M.green }
export function tx(src: string): string {
  let out = ''
  let i = 0
  const re = /\\(gold|teal|red|green|strike)\{/g
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 1
    let j = re.lastIndex
    for (; j < src.length && depth; j++) depth += src[j] === '{' ? 1 : src[j] === '}' ? -1 : 0
    const body = tx(src.slice(re.lastIndex, j - 1))
    out += src.slice(i, m.index) + (m[1] === 'strike'
      ? `{\\color{${M.red}}{\\cancel{\\color{${M.white}}{${body}}}}}`
      : `{\\color{${ROLE[m[1]!]}}{${body}}}`)
    i = j
    re.lastIndex = j
  }
  return out + src.slice(i)
}
export const tex = mathjaxRenderer()

export function el<K extends keyof HTMLElementTagNameMap>(parent: Element, tag: K, style: Partial<CSSStyleDeclaration> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  Object.assign(e.style, style)
  if (text !== undefined) e.textContent = text
  parent.append(e)
  return e
}

/** Logical px per CSS px of the scene root (the stage may be scaled on screen). */
const scaleOf = (ctx: MountContext) => ctx.root.getBoundingClientRect().width / ctx.stage.w || 1

/** A static formula centred on a point: labels such as A, B, \vec r. */
export async function label(ctx: MountContext, parent: HTMLElement, latex: string, o: { size?: number; color?: string } = {}) {
  const box = el(parent, 'div', { position: 'absolute', left: '0', top: '0', fontSize: `${o.size ?? 44}px`, color: o.color ?? M.white, whiteSpace: 'nowrap' })
  await renderFormula(tex, box, { latex: tx(latex) })
  const r = box.getBoundingClientRect()
  const s = scaleOf(ctx)
  const w = r.width / s
  const h = r.height / s
  return {
    el: box,
    w, h,
    /** Centre at (x, y), with opacity and scale. */
    set(x: number, y: number, opacity = 1, scale = 1) {
      box.style.transform = `translate(${(x - w / 2).toFixed(2)}px, ${(y - h / 2).toFixed(2)}px) scale(${scale})`
      box.style.display = opacity <= 0 ? 'none' : ''
      box.style.opacity = String(opacity)
    },
  }
}

export interface Chain {
  el: HTMLElement
  /** Draw at time t: appear at `times[0]`, morph i runs over [times[i+1], times[i+1] + dur]. */
  render(t: number, opacity?: number): void
}

/**
 * A derivation: steps[0] writes on at times[0] (left-to-right reveal), then each step morphs into
 * the next with texmorph at times[1..]. Anchored at (x, y) by `align` of the formula box.
 */
export async function chain(ctx: MountContext, parent: HTMLElement, steps: readonly string[], times: readonly number[], o: { x: number; y: number; size?: number; align?: 'left' | 'center'; dur?: number; write?: number }): Promise<Chain> {
  if (times.length !== steps.length) throw new Error(`chain: ${steps.length} steps need ${steps.length} times, got ${times.length}`)
  const { size = 60, align = 'left', dur = 1.1, write = 0.9 } = o
  const wrap = el(parent, 'div', { position: 'absolute', left: `${o.x}px`, top: `${o.y}px`, color: M.white })
  const hosts: HTMLElement[] = []
  const morphs: MathMorph[] = []
  const widths: number[] = []
  const s = scaleOf(ctx)
  const measure = (host: HTMLElement, cls: string) => {
    const c = host.querySelector(`.${cls} mjx-container`) ?? host.querySelector('mjx-container')
    return c ? c.getBoundingClientRect().width / s : 0
  }
  if (steps.length === 1) {
    const host = el(wrap, 'div', { position: 'absolute', left: '0', top: '0', fontSize: `${size}px`, whiteSpace: 'nowrap', transform: 'translateY(-50%)', willChange: 'transform' })
    await renderFormula(tex, host, { latex: tx(steps[0]!) })
    hosts.push(host)
    widths.push(measure(host, 'none'))
  }
  for (let i = 0; i + 1 < steps.length; i++) {
    const host = el(wrap, 'div', { position: 'absolute', left: '0', top: '0', fontSize: `${size}px`, whiteSpace: 'nowrap', transform: 'translateY(-50%)', willChange: 'transform' })
    const m = await createMorph(host, { latex: tx(steps[i]!) }, { latex: tx(steps[i + 1]!) }, { renderer: tex })
    hosts.push(host)
    morphs.push(m)
    const bad = m.diagnostics.find((d) => d.severity === 'error')
    if (bad) throw new Error(`chain: ${steps[i]} → ${steps[i + 1]}: ${bad.code} ${JSON.stringify(bad.message)}`)
    if (i === 0) widths.push(measure(host, 'texmorph-source'))
    widths.push(measure(host, 'texmorph-target'))
  }
  const place = (host: HTMLElement, w: number) => {
    host.style.left = align === 'center' ? `${(-w / 2).toFixed(2)}px` : '0px'
  }
  return {
    el: wrap,
    render(t, opacity = 1) {
      const shown = t >= times[0]! && opacity > 0
      wrap.style.display = shown ? '' : 'none'
      if (!shown) return
      wrap.style.opacity = String(opacity)
      let k = 0
      for (let i = 1; i < times.length; i++) if (t >= times[i]!) k = i
      // k = index of the last morph that has started (morph k-1 runs from step k-1 to k).
      hosts.forEach((h, i) => { h.style.display = (morphs.length ? i === Math.max(0, k - 1) : i === 0) ? '' : 'none' })
      const host = hosts[Math.max(0, k - 1)]!
      if (morphs.length) {
        const p = k === 0 ? 0 : clamp01((t - times[k]!) / dur)
        morphs[Math.max(0, k - 1)]!.render(p)
        const e = smooth(p)
        const a = widths[Math.max(0, k - 1)]!
        const b = widths[Math.max(0, k - 1) + 1]!
        place(host, k === 0 ? widths[0]! : a + (b - a) * e)
      } else place(host, widths[0]!)
      const wp = seg(t, times[0]!, times[0]! + write, (x) => x)
      host.style.clipPath = wp >= 1 ? '' : `inset(-60% ${((1 - wp) * 100).toFixed(2)}% -60% -10%)`
    },
  }
}

