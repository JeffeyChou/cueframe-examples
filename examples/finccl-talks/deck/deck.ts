import { scene, type SceneDef } from '@cueframe/core'
import { C, MONO, SANS, TONE, type Tone } from './theme.js'

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const ease = (x: number) => {
  const p = clamp01(x)
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2
}

/** Inline markup: **strong**, `code`, *em*. */
export function md(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/<(?!\/?(br|span|b|i)\b)/g, '&lt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, style: Partial<CSSStyleDeclaration> = {}, html?: string, parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  Object.assign(e.style, style)
  if (html !== undefined) e.innerHTML = html
  parent?.appendChild(e)
  return e
}

const CSS = `
.dk { font-family: ${SANS}; color: ${C.ink}; }
.dk b { font-weight: 700; color: ${C.fin}; }
.dk i { font-style: normal; color: ${C.dim}; }
.dk code { font-family: ${MONO}; font-size: 0.84em; background: ${C.soft}; border-radius: 5px; padding: 0.04em 0.28em; color: ${C.ink}; }
.dk table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
.dk th { text-align: left; font-weight: 600; color: ${C.dim}; border-bottom: 2px solid ${C.ink}; padding: 0.38em 0.6em; vertical-align: bottom; }
.dk td { border-bottom: 1px solid ${C.line}; padding: 0.42em 0.6em; vertical-align: top; }
.dk td.cont { border-top: none; }
.dk tr.hi td { background: ${C.finSoft}; }
.dk tr.sub td { color: ${C.dim}; }
.dk td.num, .dk th.num { text-align: right; white-space: nowrap; }
.dk ul { margin: 0; padding: 0; list-style: none; }
.dk li { position: relative; padding-left: 1.05em; margin: 0 0 0.5em; }
.dk li::before { content: ''; position: absolute; left: 0.1em; top: 0.52em; width: 0.38em; height: 0.38em; border-radius: 50%; background: ${C.fin}; }
.dk li li::before { background: none; border: 2px solid ${C.faint}; width: 0.3em; height: 0.3em; }
.dk li ul { margin-top: 0.35em; font-size: 0.86em; color: ${C.dim}; }
`

export interface BlockOpts { size?: number; flex?: string; width?: string; tone?: Tone }
export interface TableOpts extends BlockOpts {
  hi?: number[]
  sub?: number[]
  num?: number[]
  widths?: string[]
  /** Rows whose first cell is empty continue the previous row's group. */
  group?: boolean
}
export interface FlowNode { t: string; sub?: string; tone?: Tone }
export interface Segment { label: string; sub?: string; flex: number; tone?: Tone }

interface Item { el: HTMLElement | SVGElement; step: number }

export interface B {
  /** Starts the next build step: one more hold on this slide. */
  step(): void
  row(fn: (b: B) => void, o?: { gap?: number; align?: string; flex?: string }): void
  col(fn: (b: B) => void, o?: { gap?: number; flex?: string; width?: string }): void
  card(fn: (b: B) => void, o?: { tone?: Tone; flex?: string; title?: string; pad?: number }): void
  h(text: string, o?: BlockOpts): HTMLElement
  p(text: string, o?: BlockOpts): HTMLElement
  bullets(items: (string | [string, string[]])[], o?: BlockOpts): HTMLElement
  table(head: string[], rows: string[][], o?: TableOpts): HTMLElement
  stat(value: string, label: string, o?: BlockOpts): HTMLElement
  callout(text: string, o?: BlockOpts & { label?: string }): HTMLElement
  chips(items: [string, Tone][], o?: BlockOpts): HTMLElement
  flow(nodes: FlowNode[], o?: BlockOpts & { arrow?: string; vertical?: boolean }): HTMLElement
  segments(parts: Segment[], o?: BlockOpts & { height?: number }): HTMLElement
  code(text: string, o?: BlockOpts): HTMLElement
  src(text: string): HTMLElement
  add<E extends HTMLElement | SVGElement>(e: E): E
}

function builder(parent: HTMLElement, items: Item[], state: { step: number }, silent: boolean): B {
  const reg = <E extends HTMLElement | SVGElement>(e: E): E => {
    if (!silent) items.push({ el: e, step: state.step })
    return e
  }
  const box = (o: BlockOpts | undefined, extra: Partial<CSSStyleDeclaration> = {}) =>
    el('div', { fontSize: `${o?.size ?? 30}px`, lineHeight: '1.32', ...(o?.flex ? { flex: o.flex } : {}), ...(o?.width ? { width: o.width } : {}), ...extra }, undefined, parent)
  const container = (style: Partial<CSSStyleDeclaration>, fn: (b: B) => void, asItem = false) => {
    const c = el('div', style, undefined, parent)
    if (asItem) reg(c)
    fn(builder(c, items, state, silent || asItem))
    return c
  }
  const b: B = {
    step() { state.step++ },
    row(fn, o) { container({ display: 'flex', gap: `${o?.gap ?? 48}px`, alignItems: o?.align ?? 'stretch', ...(o?.flex ? { flex: o.flex } : {}) }, fn) },
    col(fn, o) {
      container({ display: 'flex', flexDirection: 'column', gap: `${o?.gap ?? 24}px`, minWidth: '0', ...(o?.flex ? { flex: o.flex } : {}), ...(o?.width ? { width: o.width, flex: 'none' } : {}) }, fn)
    },
    card(fn, o) {
      const t = TONE[o?.tone ?? 'ink']
      const pad = o?.pad ?? 28
      const c = el('div', {
        display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box', padding: `${pad - 4}px ${pad}px ${pad}px`,
        background: C.panel, border: `2px solid ${o?.tone ? t.fg : C.line}`, borderRadius: '14px', minWidth: '0',
        ...(o?.flex ? { flex: o.flex } : {}),
      }, undefined, parent)
      reg(c)
      if (o?.title) el('div', { font: `700 22px ${MONO}`, letterSpacing: '0.06em', textTransform: 'uppercase', color: o?.tone ? t.fg : C.dim }, md(o.title), c)
      fn(builder(c, items, state, true))
    },
    h(text, o) {
      const e = box({ size: 32, ...o }, { fontWeight: '700', color: o?.tone ? TONE[o.tone].fg : C.ink })
      e.innerHTML = md(text)
      return reg(e)
    },
    p(text, o) {
      const e = box(o, { color: o?.tone ? TONE[o.tone].fg : C.ink })
      e.innerHTML = md(text)
      return reg(e)
    },
    bullets(items, o) {
      const e = box(o)
      const ul = el('ul', {}, undefined, e)
      for (const it of items) {
        const [head, subs] = typeof it === 'string' ? [it, []] : it
        const li = el('li', {}, md(head), ul)
        if (subs.length) {
          const s = el('ul', {}, undefined, li)
          for (const x of subs) el('li', {}, md(x), s)
        }
      }
      return reg(e)
    },
    table(head, rows, o) {
      const e = box({ size: 25, ...o })
      const t = el('table', {}, undefined, e)
      const isNum = (s: string) => /^\**[-+~≈<>]?\s?[\d.]/.test(s.trim())
      const cols = head.length
      const numCols = o?.num ?? Array.from({ length: cols }, (_, j) => j).filter((j) => j > 0 && rows.filter((r) => r[j]).every((r) => !r[j] || isNum(r[j]!)))
      if (o?.widths) {
        const cg = el('colgroup', {}, undefined, t)
        for (const w of o.widths) el('col', { width: w }, undefined, cg)
      }
      const tr = el('tr', {}, undefined, el('thead', {}, undefined, t))
      head.forEach((h, j) => {
        const th = el('th', {}, md(h), tr)
        if (numCols.includes(j)) th.className = 'num'
      })
      const tb = el('tbody', {}, undefined, t)
      rows.forEach((r, i) => {
        const row = el('tr', {}, undefined, tb)
        if (o?.hi?.includes(i)) row.className = 'hi'
        else if (o?.sub?.includes(i)) row.className = 'sub'
        r.forEach((c, j) => {
          const td = el('td', {}, md(c), row)
          if (numCols.includes(j)) td.className = 'num'
          if (j === 0 && o?.group) {
            if (!c) td.style.borderBottom = `1px solid ${C.line}`
            const next = rows[i + 1]
            if (next && !next[0]) td.style.borderBottomColor = 'transparent'
          }
        })
      })
      return reg(e)
    },
    stat(value, label, o) {
      const t = TONE[o?.tone ?? 'fin']
      const e = box(o, { display: 'flex', flexDirection: 'column', gap: '6px' })
      el('div', { font: `700 ${o?.size ?? 76}px/1 ${SANS}`, color: t.fg, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }, md(value), e)
      el('div', { fontSize: '25px', color: C.dim, lineHeight: '1.3' }, md(label), e)
      return reg(e)
    },
    callout(text, o) {
      const t = TONE[o?.tone ?? 'fin']
      const e = box({ size: 29, ...o }, { background: t.bg, borderLeft: `8px solid ${t.fg}`, borderRadius: '6px', padding: '18px 26px' })
      if (o?.label) el('div', { font: `700 20px ${MONO}`, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.fg, marginBottom: '6px' }, md(o.label), e)
      el('div', {}, md(text), e)
      return reg(e)
    },
    chips(list, o) {
      const e = box({ size: 22, ...o }, { display: 'flex', gap: '14px', flexWrap: 'wrap' })
      for (const [txt, tone] of list) {
        el('span', { font: `600 ${o?.size ?? 22}px ${SANS}`, color: TONE[tone].fg, background: TONE[tone].bg, border: `1.5px solid ${TONE[tone].fg}`, borderRadius: '999px', padding: '6px 16px' }, md(txt), e)
      }
      return reg(e)
    },
    flow(nodes, o) {
      const v = o?.vertical
      const e = box({ size: 26, ...o }, { display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: 'stretch', gap: '0' })
      nodes.forEach((n, i) => {
        if (i > 0) el('div', { alignSelf: 'center', color: C.faint, font: `400 ${v ? 30 : 40}px ${SANS}`, padding: v ? '2px 0' : '0 14px' }, o?.arrow ?? (v ? '↓' : '→'), e)
        const t = TONE[n.tone ?? 'ink']
        const nb = el('div', {
          flex: '1 1 0', boxSizing: 'border-box', padding: '16px 20px', borderRadius: '12px', background: n.tone ? t.bg : C.panel,
          border: `2px solid ${n.tone ? t.fg : C.line}`, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center',
        }, undefined, e)
        el('div', { fontWeight: '700', color: n.tone ? t.fg : C.ink }, md(n.t), nb)
        if (n.sub) el('div', { fontSize: '0.8em', color: C.dim, lineHeight: '1.3' }, md(n.sub), nb)
      })
      return reg(e)
    },
    segments(parts, o) {
      const e = box({ size: 24, ...o }, { display: 'flex', height: `${o?.height ?? 120}px`, gap: '4px' })
      for (const s of parts) {
        const t = TONE[s.tone ?? 'ink']
        const sb = el('div', {
          flex: `${s.flex} 1 0`, background: t.bg, border: `2px solid ${t.fg}`, borderRadius: '8px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6px', boxSizing: 'border-box', minWidth: '0',
        }, undefined, e)
        el('div', { fontWeight: '700', color: t.fg }, md(s.label), sb)
        if (s.sub) el('div', { fontSize: '0.78em', color: C.dim }, md(s.sub), sb)
      }
      return reg(e)
    },
    code(text, o) {
      const e = box(o)
      el('pre', { margin: '0', font: `400 ${o?.size ?? 24}px/1.5 ${MONO}`, background: C.panel, border: `1.5px solid ${C.line}`, borderRadius: '10px', padding: '18px 24px', whiteSpace: 'pre' }, undefined, e).textContent = text
      return reg(e)
    },
    src(text) {
      const e = box({ size: 21 }, { color: C.faint, fontFamily: MONO })
      e.innerHTML = md(text)
      return reg(e)
    },
    add(e) {
      parent.appendChild(e)
      return reg(e)
    },
  }
  return b
}

export interface SlideDef {
  id: string
  /** Section label shown as the kicker; the deck groups the progress bar by it. */
  section: string
  title?: string
  layout?: 'normal' | 'title'
  /** Number of b.step() calls in build: each adds a hold. */
  steps?: number
  build(b: B, root: HTMLElement): void
}

export const slide = (d: SlideDef) => d

const HOLD0 = 0.85
const STEP = 0.7
const TAIL = 0.45
const OVERLAP = 0.35
const holdAt = (s: number) => HOLD0 + STEP * s

const MAX_ZOOM = 1.4

/** Largest zoom (≤ max, step 0.05) at which the content fits the body box. */
function fit(body: HTMLElement, inner: HTMLElement, max: number): void {
  const W = body.clientWidth
  const H = body.clientHeight
  if (!W || !H) return
  for (let z = max; z >= 1; z -= 0.05) {
    inner.style.width = `${W / z}px`
    inner.style.zoom = String(z)
    if (body.scrollHeight <= H + 1 && body.scrollWidth <= W + 1) return
  }
  inner.style.width = `${W}px`
  inner.style.zoom = '1'
}

let styled = false

function slideScene(d: SlideDef, index: number, steps: number, at: number): SceneDef {
  const holds = Array.from({ length: steps + 1 }, (_, s) => ({ id: steps === 0 ? d.id : `${d.id}-${s + 1}`, at: holdAt(s) }))
  return scene({
    id: d.id,
    at,
    dur: holdAt(steps) + TAIL,
    overlap: index === 0 ? 0 : OVERLAP,
    holds,
    mount(ctx) {
      if (!styled) {
        styled = true
        document.head.appendChild(el('style', {}, CSS))
      }
      Object.assign(ctx.root.style, { zIndex: '1' })
      const root = el('div', { position: 'absolute', inset: '0' }, undefined, ctx.root)
      root.className = 'dk'
      const items: Item[] = []
      const state = { step: 0 }
      let body: HTMLElement
      if (d.layout === 'title') {
        body = el('div', { position: 'absolute', left: '120px', right: '120px', top: '230px', bottom: '140px' }, undefined, root)
      } else {
        const kicker = el('div', { position: 'absolute', left: '96px', top: '68px', font: `700 22px ${MONO}`, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.fin }, md(d.section), root)
        const title = el('div', { position: 'absolute', left: '96px', right: '96px', top: '102px', font: `700 54px/1.12 ${SANS}`, letterSpacing: '-0.015em' }, md(d.title ?? ''), root)
        items.push({ el: kicker, step: 0 }, { el: title, step: 0 })
        body = el('div', { position: 'absolute', left: '96px', right: '96px', top: '200px', bottom: '110px' }, undefined, root)
      }
      const inner = el('div', { display: 'flex', flexDirection: 'column', gap: '26px' }, undefined, body)
      d.build(builder(inner, items, state, false), root)
      fit(body, inner, d.layout === 'title' ? 1 : MAX_ZOOM)
      if (state.step !== steps) throw new Error(`slide ${d.id}: build has ${state.step} steps, declared ${steps}`)
      return { root, items }
    },
    render(f, s) {
      const fin = ease(clamp01((f.tin - 0.3) / 0.7))
      const fout = 1 - ease(clamp01(f.tout * 1.6))
      s.root.style.opacity = String(index === 0 ? fout : Math.min(fin, fout))
      const seen = new Map<number, number>()
      for (const it of s.items) {
        const i = seen.get(it.step) ?? 0
        seen.set(it.step, i + 1)
        const a = (it.step === 0 ? 0.2 : holdAt(it.step - 1) + 0.05) + Math.min(i * 0.05, 0.25)
        const k = ease((f.lt - a) / 0.3)
        it.el.style.opacity = String(k)
        it.el.style.transform = `translateY(${(1 - k) * 14}px)`
      }
    },
  })
}

export interface DeckDef {
  name: string
  slides: SlideDef[]
}

/** Slide scenes plus one chrome scene (background, footer, section progress) spanning the deck. */
export function deck(d: DeckDef): SceneDef[] {
  const ids = new Set<string>()
  for (const s of d.slides) {
    if (ids.has(s.id)) throw new Error(`duplicate slide id ${s.id}`)
    ids.add(s.id)
  }
  const steps = d.slides.map((s) => s.steps ?? 0)
  const starts: number[] = []
  let t = 0
  d.slides.forEach((_, i) => {
    const dur = holdAt(steps[i]!) + TAIL
    const start = i === 0 ? 0 : t - OVERLAP
    starts.push(start)
    t = start + dur
  })
  const end = t
  const scenes = d.slides.map((s, i) => slideScene(s, i, steps[i]!, starts[i]!))
  const sections: { name: string; first: number; count: number }[] = []
  d.slides.forEach((s, i) => {
    const last = sections[sections.length - 1]
    if (last && last.name === s.section) last.count++
    else sections.push({ name: s.section, first: i, count: 1 })
  })
  const chrome = scene({
    id: 'chrome',
    at: 0,
    dur: end,
    mount(ctx) {
      Object.assign(ctx.root.style, { zIndex: '0', background: C.bg })
      const root = el('div', { position: 'absolute', inset: '0' }, undefined, ctx.root)
      root.className = 'dk'
      el('div', { position: 'absolute', left: '96px', bottom: '68px', font: `600 20px ${MONO}`, color: C.faint, letterSpacing: '0.06em' }, md(d.name), root)
      const counter = el('div', { position: 'absolute', right: '96px', bottom: '68px', font: `600 20px ${MONO}`, color: C.faint, fontVariantNumeric: 'tabular-nums' }, '', root)
      const bar = el('div', { position: 'absolute', left: '0', right: '0', bottom: '0', height: '8px', display: 'flex', gap: '3px' }, undefined, root)
      const segs = sections.map((s) => el('div', { flex: `${s.count} 1 0`, background: C.line }, undefined, bar))
      return { counter, segs }
    },
    render(f, s) {
      let i = 0
      while (i + 1 < starts.length && f.t >= starts[i + 1]! + OVERLAP / 2) i++
      s.counter.textContent = `${i + 1} / ${d.slides.length}`
      const cur = sections.findIndex((x) => i >= x.first && i < x.first + x.count)
      s.segs.forEach((e, j) => { e.style.background = j < cur ? C.faint : j === cur ? C.fin : C.line })
    },
  })
  // Chrome first: overlapProgress reads tout from the next scene in list order.
  return [chrome, ...scenes]
}
