// hud: instruments for an explainer (cueframe/docs/design/hud.md), built in mount and drawn by set() in
// render. Colours come by role from the theme the explainer chrome uses.
//
//   const ui = hud({ sans: SANS, mono: MONO })
//   const c = ui.code(ctx.root, { lines: SRC, keywords: ['always', 'posedge'] })   // mount
//   c.set({ typed: (f.t - T.type) * 11, caret: caret(f.t) })                       // render

import { parseTitle, ROLES, THEME, type Role, type Theme } from './theme.js'

const r2 = (n: number) => Math.round(n * 100) / 100
const fin = (what: string, n: number) => {
  if (!Number.isFinite(n)) throw new Error(`hud: ${what} is not a finite number (${n})`)
  return n
}

/** An arc's SVG path, from `from` to `to` in turns clockwise from 12 o'clock ('' when empty). */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const span = to - from
  if (span <= 1e-6) return ''
  const pt = (a: number) => {
    const t = 2 * Math.PI * a - Math.PI / 2
    return `${r2(cx + r * Math.cos(t))} ${r2(cy + r * Math.sin(t))}`
  }
  if (span >= 1 - 1e-6) return `M${pt(from)} A${r} ${r} 0 1 1 ${pt(from + 0.5)} A${r} ${r} 0 1 1 ${pt(from)}`
  return `M${pt(from)} A${r} ${r} 0 ${span > 0.5 ? 1 : 0} 1 ${pt(to)}`
}

/** Roles over fractions of `max`, half-open `[from, to)`; ±Infinity allowed. */
export interface Zone { from: number; to: number; role: Role }

/** Validates zones: `from < to`, no two overlapping (adjacent ones are fine). */
export function checkZones(zones: readonly Zone[]): void {
  for (const z of zones) if (Number.isNaN(z.from) || Number.isNaN(z.to) || !(z.from < z.to)) throw new Error(`hud: zone ${z.role} [${z.from}, ${z.to}) is empty or not a number`)
  const sorted = [...zones].sort((p, q) => p.from - q.from)
  for (let i = 1; i < sorted.length; i++) if (sorted[i]!.from < sorted[i - 1]!.to) throw new Error(`hud: zones ${sorted[i - 1]!.role} and ${sorted[i]!.role} overlap`)
}

/** The role for `value`: the zone holding the raw value / max, else `role`. */
export function zoneRole(value: number, max: number, zones: readonly Zone[] | undefined, role: Role): Role {
  const k = value / max
  return zones?.find((z) => k >= z.from && k < z.to)?.role ?? role
}

/** Each part's drawn arc in turns, as one clockwise sweep (0–1) over the total. */
export function donutArcs(values: readonly number[], sweep: number): { from: number; to: number }[] {
  const total = values.reduce((a, v) => a + v, 0)
  if (!(total > 0) || values.some((v) => !(v >= 0))) throw new Error(`hud: donut values must be ≥ 0 with a total > 0 (${values.join(', ')})`)
  const s = Math.max(0, Math.min(1, fin('donut sweep', sweep)))
  let at = 0
  return values.map((v) => {
    const from = at / total
    at += v
    return { from, to: Math.max(from, Math.min(at / total, s)) }
  })
}

export interface GanttSpan { from: number; to: number; role?: Role; text?: string }
export interface GanttRow { label: string; spans: readonly GanttSpan[] }

/** Validates a Gantt chart's spans against its range. */
export function checkGantt(rows: readonly GanttRow[], range: readonly [number, number]): void {
  const [a, b] = range
  if (!(a < b)) throw new Error(`hud: gantt range [${a}, ${b}] is empty`)
  for (const r of rows) for (const s of r.spans) if (!(s.from < s.to && s.from >= a && s.to <= b)) throw new Error(`hud: gantt span [${s.from}, ${s.to}] of "${r.label}" must have from < to within [${a}, ${b}]`)
}

/** Each span drawn up to the axis value `upto`: x and width over `width`, and whether it is whole. */
export function ganttBars(rows: readonly GanttRow[], range: readonly [number, number], upto: number, width: number) {
  const [a, b] = range
  const u = Math.max(a, Math.min(b, fin('gantt upto', upto)))
  const x = (v: number) => ((v - a) / (b - a)) * width
  return rows.map((r) => r.spans.map((s) => ({ x: r2(x(s.from)), w: r2(Math.max(0, x(Math.min(s.to, u)) - x(s.from))), whole: u >= s.to })))
}

// Code: every character at its own column, so the layout never depends on the font.
export type Tok = readonly [string, Role?]
export interface CodeOptions {
  lines: readonly string[] | readonly (readonly Tok[])[]
  /** Words shown in `warm`. */
  keywords?: readonly string[]
  /** Identifiers shown in `accent`. */
  idents?: readonly string[]
  /** Start of a line comment, shown in `dim` (default `//`). */
  comment?: string
  /** Font size; a column is 0.6 × size and a row 1.6 × size (default 30). */
  size?: number
  /** Columns of text (default: the longest line + 2). */
  cols?: number
  /** Line numbers in a gutter (default true). */
  numbers?: boolean
}
export interface CodeChar { ch: string; col: number; wide: boolean; role?: Role }
export interface CodeLayout {
  rows: CodeChar[][]
  /** Columns per row. */
  widths: number[]
  size: number; cw: number; lh: number; pad: number
  /** Gutter width in px (0 without numbers). */
  gutter: number
  w: number; h: number
}

const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/

/** Splits a line into tokens: comments, keywords, identifiers and numbers by role. */
export function tokenize(line: string, o: Pick<CodeOptions, 'keywords' | 'idents' | 'comment'> = {}): Tok[] {
  const kw = new Set(o.keywords ?? [])
  const id = new Set(o.idents ?? [])
  const comment = o.comment ?? '//'
  const out: Tok[] = []
  const push = (text: string, role?: Role) => {
    const last = out.at(-1)
    if (last && last[1] === role) out[out.length - 1] = role ? [last[0] + text, role] : [last[0] + text]
    else out.push(role ? [text, role] : [text])
  }
  let i = 0
  while (i < line.length) {
    if (comment && line.startsWith(comment, i)) { push(line.slice(i), 'dim'); break }
    const word = /^[A-Za-z_$][\w$]*/.exec(line.slice(i))
    if (word) {
      const w = word[0]
      push(w, kw.has(w) ? 'warm' : id.has(w) ? 'accent' : undefined)
      i += w.length
      continue
    }
    const num = /^\d+('[bdhoBDHO][\da-fA-FxzXZ_]+)?(\.\d+)?/.exec(line.slice(i))
    if (num) { push(num[0], 'good'); i += num[0].length; continue }
    push(line[i]!)
    i++
  }
  return out
}

export function codeLayout(o: CodeOptions): CodeLayout {
  const size = o.size ?? 30
  const [cw, lh, pad] = [0.6 * size, 1.6 * size, 0.8 * size]
  const toks = o.lines.map((l, i) => {
    const text = typeof l === 'string' ? l : l.map((t) => t[0]).join('')
    if (/[\t\r\n]/.test(text)) throw new Error(`hud: code line ${i + 1} has a tab or a line break; give one string per line, spaces for indents`)
    return typeof l === 'string' ? tokenize(l, o) : l
  })
  const rows = toks.map((line) => {
    const chars: CodeChar[] = []
    let col = 0
    for (const [text, role] of line) for (const ch of Array.from(text)) {
      const wide = WIDE.test(ch)
      chars.push({ ch, col, wide, role })
      col += wide ? 2 : 1
    }
    return chars
  })
  const widths = rows.map((r) => (r.length ? r.at(-1)!.col + (r.at(-1)!.wide ? 2 : 1) : 0))
  const cols = o.cols ?? Math.max(0, ...widths) + 2
  const gutter = o.numbers === false ? 0 : (String(rows.length).length + 2.5) * cw
  return { rows, widths, size, cw, lh, pad, gutter, w: r2(2 * pad + gutter + cols * cw), h: r2(2 * pad + rows.length * lh) }
}

/** How many characters show on each row, and where the caret stands (row, column). */
export function typedAt(l: CodeLayout, typed: number): { shown: number[]; caret: { row: number; col: number } } {
  let left = typed === Infinity ? Infinity : Math.max(0, Math.floor(fin('code typed', typed)))
  let caret: { row: number; col: number } | null = null
  const after = (r: CodeChar[], k: number) => (k ? r[k - 1]!.col + (r[k - 1]!.wide ? 2 : 1) : 0)
  const shown = l.rows.map((r, i) => {
    const k = Math.max(0, Math.min(r.length, left))
    if (!caret && (left <= r.length || i === l.rows.length - 1)) caret = { row: i, col: after(r, k) }
    left -= r.length + 1
    return k
  })
  return { shown, caret: caret ?? { row: 0, col: 0 } }
}

// Timing diagrams: a lane shows `cycles` clock periods from cycle `phase`.
export type WaveKind = 'clock' | 'bits' | 'bus'
export type WaveData = (i: number) => string | number | boolean

export interface BusCell { x0: number; x1: number; value: string; cutL: boolean; cutR: boolean }

/** A lane's levels or bus cells over [phase, phase + cycles], in px of a `width` × `height` lane. */
export function wavePath(kind: WaveKind, data: WaveData | undefined, phase: number, cycles: number, width: number, height: number): { path: string; cells: BusCell[] } {
  fin('wave phase', phase)
  const px = (c: number) => r2(Math.max(0, Math.min(width, ((c - phase) / cycles) * width)))
  const [hi, lo, mid] = [r2(height * 0.2), r2(height * 0.8), r2(height / 2)]
  const first = Math.floor(phase)
  const last = Math.ceil(phase + cycles)
  if (kind === 'bus') {
    if (!data) throw new Error('hud: a bus lane needs data')
    const cells: BusCell[] = []
    for (let i = first; i < last; i++) {
      const d = data(i)
      if (typeof d === 'boolean' || (typeof d === 'number' && !Number.isFinite(d))) throw new Error(`hud: bus data(${i}) is ${String(d)}, not a string or a finite number`)
      const v = String(d)
      const c = cells.at(-1)
      if (c && c.value === v) { c.x1 = px(i + 1); continue }
      cells.push({ x0: px(i), x1: px(i + 1), value: v, cutL: i < phase, cutR: false })
    }
    for (const c of cells) c.cutR = c.x1 >= width
    const e = Math.min(8, width / cycles / 4)
    const path = cells.map((c) => {
      const [l, r] = [c.cutL ? 0 : e, c.cutR ? 0 : e]
      return `M${c.x0} ${mid}L${r2(c.x0 + l)} ${hi}H${r2(c.x1 - r)}L${c.x1} ${mid}L${r2(c.x1 - r)} ${lo}H${r2(c.x0 + l)}Z`
    }).join('')
    return { path, cells }
  }
  if (kind === 'bits' && !data) throw new Error('hud: a bits lane needs data')
  // Level runs over the window, then one path with vertical edges where the level changes.
  const runs: [number, number, boolean][] = []
  const add = (a: number, b: number, high: boolean) => {
    const [x0, x1] = [px(a), px(b)]
    if (x1 <= x0) return
    const r = runs.at(-1)
    if (r && r[2] === high) r[1] = x1
    else runs.push([x0, x1, high])
  }
  for (let i = first; i < last; i++) {
    if (kind === 'clock') { add(i, i + 0.5, true); add(i + 0.5, i + 1, false) }
    else {
      const v = data!(i)
      if (v !== 0 && v !== 1 && v !== true && v !== false) throw new Error(`hud: bits data(${i}) is ${JSON.stringify(v)}, not 0, 1, false or true`)
      add(i, i + 1, v === 1 || v === true)
    }
  }
  const path = runs.map(([x0, x1, h], j) => `${j ? 'V' : `M${x0} `}${h ? hi : lo}H${x1}`).join('')
  return { path, cells: [] }
}

/** A number in 万 / 亿 / 万亿, with `digits` decimals and trailing zeros dropped: 1.2e11 → 1200亿. */
export function cjk(v: number, digits = 1): string {
  fin('cjk value', v)
  const units: [number, string][] = [[1, ''], [1e4, '万'], [1e8, '亿'], [1e12, '万亿']]
  const trim = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s)
  for (let i = 0; i < units.length; i++) {
    const [u, name] = units[i]!
    const s = (Math.abs(v) / u).toFixed(digits)
    if (Number(s) < 1e4 || i === units.length - 1) return `${v < 0 && Number(s) !== 0 ? '-' : ''}${trim(s)}${name}`
  }
  return String(v)
}

/** Characters values can produce: add to the font subset with the source text. */
export const HUD_GLYPHS = '0123456789.,+-−%×万亿'

// The kit: instruments built in mount, drawn by set() in render.

export interface Box { x: number; y: number; w: number; h: number }
/** `inner`, a box inside `outer`'s origin, in `outer`'s coordinates. */
export const inside = (outer: Box, inner: Box): Box => ({ x: outer.x + inner.x, y: outer.y + inner.y, w: inner.w, h: inner.h })

export interface Instrument<S> {
  el: HTMLDivElement
  /** Where the root stands in its parent. */
  box: Box
  /** Natural size (a dial's viewBox; a frame's box). */
  size: { w: number; h: number }
  set(s?: S): void
}

const SVG = 'http://www.w3.org/2000/svg'
type Attrs = Record<string, string | number>
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent: Element, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (text !== undefined) e.textContent = text
  parent.append(e)
  return e
}
function div(parent: Element, css: Partial<CSSStyleDeclaration>, text?: string): HTMLDivElement {
  const e = document.createElement('div')
  Object.assign(e.style, { position: 'absolute', ...css })
  if (text !== undefined) e.textContent = text
  parent.append(e)
  return e
}
/** Sets an attribute only when it changes. */
function at(e: Element, name: string, v: string | number) {
  const s = String(v)
  if (e.getAttribute(name) !== s) e.setAttribute(name, s)
}
function txt(e: Element, s: string) {
  if (e.textContent !== s) e.textContent = s
}
const place = (b: Box): Partial<CSSStyleDeclaration> => ({ left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` })
/** Estimated columns of a value: two for an East Asian wide character. */
const columns = (s: string) => Array.from(s).reduce((n, ch) => n + (WIDE.test(ch) ? 2 : 1), 0)
const hex2 = (a: number) => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')

export interface HudOptions {
  /** Multiplies frames' fixed sizes (panel header, tag text): `ctx.stage.w / 1920` off 1080p. */
  scale?: number
}

export interface PanelOptions { eyebrow?: string; title?: string; role?: Role; pad?: number; box?: Box }
export interface TagOptions { role?: Role; solid?: boolean; box?: { x: number; y: number } }
export interface CounterOptions { label?: string; unit?: string; digits?: number; format?: (v: number) => string; align?: 'start' | 'middle'; max?: number; zones?: readonly Zone[]; role?: Role; box?: Box }
export interface MeterOptions { shape: 'ring' | 'bar'; max?: number; label?: string; unit?: string; digits?: number; format?: (v: number) => string; zones?: readonly Zone[]; role?: Role; box?: Box }
export interface DonutPart { label: string; value: number; role?: Role }
export interface DonutOptions { parts: readonly DonutPart[]; hole?: number; legend?: boolean; box?: Box }
export interface GanttOptions { rows: readonly GanttRow[]; range: readonly [number, number]; ticks?: readonly { at: number; label: string }[]; box?: Box }
type PerCell<T> = T | readonly T[] | ((i: number) => T)
export interface GridOptions { cols: number; rows: number; cell?: readonly [number, number]; gap?: number; labels?: readonly string[]; role?: Role; box?: Box }
export interface CodeDialOptions extends CodeOptions { role?: Role; box?: Box }
export interface Signal { name: string; kind: WaveKind; data?: WaveData; role?: Role }
export interface WaveOptions { signals: readonly Signal[]; cycles?: number; box?: Box }

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const DONUT_ROLES: readonly Role[] = ['accent', 'warm', 'good', 'alert', 'dim']

export function hud(partial: Partial<Theme> = {}, o: HudOptions = {}) {
  const t: Theme = { ...THEME, ...partial }
  for (const name of [...ROLES, 'faint'] as const) {
    const c = t[name]
    if (!HEX.test(c)) throw new Error(`hud: theme.${name} must be #rgb or #rrggbb (the kit appends alpha), not "${c}"`)
    if (c.length === 4) t[name] = `#${[...c.slice(1)].map((h) => h + h).join('')}`
  }
  const k = o.scale ?? 1
  const px = (n: number) => `${r2(n * k)}px`
  const tone = (r: Role, a = 1) => (a >= 1 ? t[r] : t[r] + hex2(a))
  const fail = (what: string, m: string): never => { throw new Error(`hud.${what}: ${m}`) }
  const num = (what: string, v: number) => (Number.isFinite(v) ? v : fail(what, `${v} is not a finite number`))

  /** A dial: a root at its box, an SVG of its natural size inside, centred with `meet`. */
  function dial(parent: Element, w: number, h: number, box?: Box) {
    const b = box ?? { x: 0, y: 0, w: w * k, h: h * k }
    const el = div(parent, place(b))
    const root = svg('svg', { viewBox: `0 0 ${r2(w)} ${r2(h)}`, preserveAspectRatio: 'xMidYMid meet', width: '100%', height: '100%' }, el)
    Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'visible' })
    return { el, root, box: b, size: { w, h } }
  }
  /** Compresses a static text into `room`, up to 15 %, else throws. */
  function fitStatic(what: string, e: SVGTextElement, room: number) {
    const w = e.getComputedTextLength()
    if (w > room * 1.15) fail(what, `"${e.textContent}" is ${r2(w)} wide, more than its ${r2(room)}`)
    if (w > room) { e.setAttribute('textLength', String(r2(room))); e.setAttribute('lengthAdjust', 'spacingAndGlyphs') }
    return Math.min(w, room)
  }
  /** Compresses a value by its estimated width; `extra` is fixed text beside it. */
  function fitValue(e: SVGTextElement, value: string, size: number, extra: number, room: number) {
    const w = columns(value) * 0.6 * size + extra
    if (w > room) { at(e, 'textLength', r2(room)); at(e, 'lengthAdjust', 'spacingAndGlyphs') }
    else if (e.hasAttribute('textLength')) { e.removeAttribute('textLength'); e.removeAttribute('lengthAdjust') }
  }
  const formatter = (what: string, digits = 0, format?: (v: number) => string) => format ?? ((v: number) => {
    if (Math.abs(v) >= 1e21) fail(what, `${v} is too large for the default format; give a format`)
    return v.toFixed(digits)
  })
  const zoned = (what: string, max: number, zones?: readonly Zone[]) => {
    if (!(Number.isFinite(max) && max > 0)) fail(what, `max must be a finite number > 0 (${max})`)
    if (zones) checkZones(zones)
  }
  const mono = (size: number, weight = 600) => ({ 'font-family': t.mono, 'font-size': size, 'font-weight': weight, style: 'font-variant-numeric: tabular-nums' })
  const sans = (size: number, weight = 500) => ({ 'font-family': t.sans, 'font-size': size, 'font-weight': weight })

  function panel(parent: Element, po: PanelOptions = {}): Instrument<{ focus?: number; role?: Role }> & { body: HTMLDivElement; bodyIn(box: Box): Box } {
    const role0 = po.role ?? 'accent'
    const pad = (po.pad ?? 0) * k
    const head = po.eyebrow || po.title ? (16 + (po.eyebrow ? 20 : 0) + (po.title ? 34 : 0) + 8) * k : 0
    const el = div(parent, { boxSizing: 'border-box', background: t.surface, borderRadius: px(10), overflow: 'hidden', ...(po.box ? place(po.box) : {}) })
    if (po.eyebrow) div(el, { left: px(20), top: px(16), font: `500 ${px(14)}/${px(20)} ${t.mono}`, color: t.dim, letterSpacing: '.3em', whiteSpace: 'nowrap' }, po.eyebrow)
    if (po.title) div(el, { left: px(20), top: px(16 + (po.eyebrow ? 20 : 0)), font: `600 ${px(26)}/${px(34)} ${t.sans}`, color: t.text, whiteSpace: 'nowrap' }, po.title)
    const body = div(el, { left: `${pad}px`, right: `${pad}px`, top: `${head}px`, bottom: `${pad}px` })
    const p = {
      el, body,
      box: po.box ?? { x: 0, y: 0, w: 0, h: 0 },
      size: { w: po.box?.w ?? 0, h: po.box?.h ?? 0 },
      bodyIn: (b: Box): Box => ({ x: b.x + pad, y: b.y + head, w: b.w - 2 * pad, h: b.h - head - pad }),
      set(s: { focus?: number; role?: Role } = {}) {
        const f = Math.max(0, Math.min(1, num('panel focus', s.focus ?? 0)))
        const r = s.role ?? role0
        const shadow = `inset 0 0 0 ${px(1.5)} ${tone(r, 0.33 + 0.5 * f)}, 0 0 0 1px #0008, 0 0 ${px(28 + 20 * f)} ${tone(r, 0.13 + 0.27 * f)}, inset 0 0 ${px(24)} ${tone(r, 0.06)}`
        el.style.boxShadow = shadow
      },
    }
    p.set()
    return p
  }

  function tag(parent: Element, text: string, to: TagOptions = {}): Instrument<{ role?: Role; solid?: boolean }> {
    const el = div(parent, {
      left: px(0), top: px(0), ...(to.box ? { left: `${to.box.x}px`, top: `${to.box.y}px` } : {}),
      padding: `${px(4)} ${px(14)}`, borderRadius: '999px', whiteSpace: 'nowrap', font: `600 ${px(22)}/${px(30)} ${t.sans}`,
      boxSizing: 'border-box', textAlign: 'center',
    })
    const spans = parseTitle(text, t).map((s) => {
      const e = document.createElement('span')
      e.textContent = s.text
      el.append(e)
      return { e, color: s.color }
    })
    const g = {
      el, box: { x: to.box?.x ?? 0, y: to.box?.y ?? 0, w: 0, h: 0 }, size: { w: 0, h: 0 },
      set(s: { role?: Role; solid?: boolean } = {}) {
        const r = s.role ?? to.role ?? 'accent'
        const solid = s.solid ?? to.solid ?? false
        Object.assign(el.style, { background: solid ? t[r] : tone(r, 0.08), color: solid ? '#001218' : t[r], boxShadow: `inset 0 0 0 ${px(1.5)} ${tone(r, solid ? 1 : 0.55)}` })
        // On a solid tag every word is dark; keywords keep their colour on an outlined one.
        for (const s of spans) s.e.style.color = !solid && s.color ? s.color : ''
      },
    }
    g.set()
    return g
  }

  function counter(parent: Element, co: CounterOptions = {}): Instrument<number> {
    const [W, H] = [360, 120]
    if (co.zones && co.max === undefined) fail('counter', 'zones need max')
    zoned('counter', co.max ?? 1, co.zones)
    const d = dial(parent, W, H, co.box)
    const mid = co.align === 'middle'
    const x = mid ? W / 2 : 0
    const value = svg('text', { x, y: 52, 'text-anchor': mid ? 'middle' : 'start', 'dominant-baseline': 'central', ...mono(64, 700) }, d.root)
    // A counting value is a glimpse until it settles.
    value.dataset.cfAudit = 'allow-brief'
    const v = svg('tspan', {}, value)
    let unitW = 0
    if (co.unit) {
      svg('tspan', { dx: 10, ...sans(26), fill: t.dim }, value, co.unit)
      const probe = svg('text', sans(26), d.root, co.unit)
      unitW = fitStatic('counter', probe, W / 2) + 10
      probe.remove()
    }
    if (co.label) fitStatic('counter', svg('text', { x, y: 104, 'text-anchor': mid ? 'middle' : 'start', 'dominant-baseline': 'central', fill: t.dim, ...sans(22) }, d.root, co.label), W)
    const format = formatter('counter', co.digits, co.format)
    const c = {
      ...d,
      set(raw = 0) {
        const n = num('counter value', raw)
        const s = format(n)
        txt(v, s)
        const r = zoneRole(n, co.max ?? 1, co.zones, co.role ?? 'accent')
        at(v, 'fill', t[r])
        fitValue(value, s, 64, unitW, W)
      },
    }
    c.set()
    return c
  }

  function meter(parent: Element, mo: MeterOptions): Instrument<number> {
    const max = mo.max ?? 1
    zoned('meter', max, mo.zones)
    const ring = mo.shape === 'ring'
    if (!ring && mo.shape !== 'bar') fail('meter', `shape must be 'ring' or 'bar', not ${JSON.stringify(mo.shape)}`)
    const [W, H] = ring ? [240, 240] : [480, 72]
    const d = dial(parent, W, H, mo.box)
    const format = formatter('meter', mo.digits, mo.format)
    const [cx, cy, R, sw] = [120, 110, 86, 14]
    let fill: SVGPathElement | SVGRectElement
    let value: SVGTextElement
    let unitW = 0
    const unit = (e: SVGTextElement, size: number) => {
      if (!mo.unit) return
      svg('tspan', { dx: 6, ...sans(size), fill: t.dim }, e, mo.unit)
      const probe = svg('text', sans(size), d.root, mo.unit)
      unitW = fitStatic('meter', probe, W / 3) + 6
      probe.remove()
    }
    let v: SVGTSpanElement
    if (ring) {
      svg('circle', { cx, cy, r: R, fill: 'none', stroke: t.faint, 'stroke-width': sw }, d.root)
      fill = svg('path', { fill: 'none', 'stroke-width': sw }, d.root)
      value = svg('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...mono(46, 700) }, d.root)
      v = svg('tspan', {}, value)
      unit(value, 20)
      if (mo.label) fitStatic('meter', svg('text', { x: cx, y: 224, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: t.dim, ...sans(20) }, d.root, mo.label), W)
    } else {
      if (mo.label) fitStatic('meter', svg('text', { x: 0, y: 20, 'dominant-baseline': 'central', fill: t.dim, ...sans(22) }, d.root, mo.label), W * 0.6)
      value = svg('text', { x: W, y: 20, 'text-anchor': 'end', 'dominant-baseline': 'central', ...mono(26) }, d.root)
      v = svg('tspan', {}, value)
      unit(value, 18)
      svg('rect', { x: 0, y: 46, width: W, height: 12, rx: 6, fill: t.faint }, d.root)
      fill = svg('rect', { x: 0, y: 46, height: 12, rx: 6 }, d.root)
    }
    value.dataset.cfAudit = 'allow-brief'
    const m = {
      ...d,
      set(raw = 0) {
        const n = num('meter value', raw)
        const s = format(n)
        const frac = Math.max(0, Math.min(1, n / max))
        const c = t[zoneRole(n, max, mo.zones, mo.role ?? 'accent')]
        txt(v, s)
        at(v, 'fill', c)
        fitValue(value, s, ring ? 46 : 26, unitW, ring ? 2 * (R - sw) : W * 0.4)
        if (ring) { at(fill, 'd', arcPath(cx, cy, R, 0, frac)); at(fill, 'stroke', c) }
        else { at(fill, 'width', r2(W * frac)); at(fill, 'fill', c) }
      },
    }
    m.set()
    return m
  }

  function donut(parent: Element, dn: DonutOptions): Instrument<{ sweep?: number; focus?: number }> {
    const values = dn.parts.map((p) => p.value)
    donutArcs(values, 1)
    const hole = dn.hole ?? 0.6
    if (!(hole > 0 && hole < 1)) fail('donut', `hole must be in (0, 1), not ${hole}`)
    const legend = dn.legend ?? true
    if (legend && dn.parts.length > 6) fail('donut', `a legend holds at most 6 parts (${dn.parts.length})`)
    const d = dial(parent, legend ? 560 : 240, 240, dn.box)
    const [cx, cy, R] = [120, 120, 110]
    const sw = R * (1 - hole)
    const rm = R - sw / 2
    const roles = dn.parts.map((p, i) => p.role ?? DONUT_ROLES[i % DONUT_ROLES.length]!)
    svg('circle', { cx, cy, r: rm, fill: 'none', stroke: t.faint, 'stroke-width': sw, opacity: 0.35 }, d.root)
    const arcs = roles.map((r) => svg('path', { fill: 'none', stroke: t[r], 'stroke-width': r2(sw) }, d.root))
    if (legend) {
      const total = values.reduce((a, b) => a + b, 0)
      dn.parts.forEach((p, i) => {
        const y = cy + (i - (dn.parts.length - 1) / 2) * 36
        svg('rect', { x: 268, y: y - 8, width: 16, height: 16, rx: 3, fill: t[roles[i]!] }, d.root)
        const pct = svg('text', { x: 556, y, 'text-anchor': 'end', 'dominant-baseline': 'central', fill: t.dim, ...mono(20, 500) }, d.root, `${Math.round((p.value / total) * 100)}%`)
        fitStatic('donut', svg('text', { x: 296, y, 'dominant-baseline': 'central', fill: t.text, ...sans(20) }, d.root, p.label), 556 - 296 - pct.getComputedTextLength() - 12)
      })
    }
    const g = {
      ...d,
      set(s: { sweep?: number; focus?: number } = {}) {
        const f = s.focus ?? -1
        if (!(Number.isInteger(f) && f >= -1 && f < arcs.length)) fail('donut', `focus must be -1 or a part index, not ${f}`)
        donutArcs(values, num('donut sweep', s.sweep ?? 1)).forEach((a, i) => {
          at(arcs[i]!, 'd', arcPath(cx, cy, rm, a.from, a.to))
          at(arcs[i]!, 'stroke-width', r2(i === f ? sw * 1.2 : sw))
          at(arcs[i]!, 'opacity', f >= 0 && i !== f ? 0.35 : 1)
        })
      },
    }
    g.set()
    return g
  }

  function gantt(parent: Element, go: GanttOptions): Instrument<{ upto?: number; cursor?: boolean }> {
    checkGantt(go.rows, go.range)
    const [a, b] = go.range
    for (const tk of go.ticks ?? []) if (!(tk.at >= a && tk.at <= b)) fail('gantt', `tick ${tk.at} lies outside [${a}, ${b}]`)
    const [L, LANE, W] = [240, 44, 1200]
    const lanes = go.rows.length * LANE
    const d = dial(parent, W, lanes + (go.ticks?.length ? 32 : 0), go.box)
    const x = (v: number) => L + ((v - a) / (b - a)) * (W - L)
    const bars = go.rows.map((row, i) => {
      const y = i * LANE
      svg('line', { x1: L, x2: W, y1: y + LANE, y2: y + LANE, stroke: t.faint, 'stroke-width': 1 }, d.root)
      fitStatic('gantt', svg('text', { x: 0, y: y + LANE / 2, 'dominant-baseline': 'central', fill: t.text, ...sans(22) }, d.root, row.label), L - 16)
      return row.spans.map((s) => {
        const role = s.role ?? 'accent'
        const rect = svg('rect', { x: r2(x(s.from)), y: y + 9, height: 26, rx: 4, fill: t[role] }, d.root)
        const label = s.text ? svg('text', { x: r2((x(s.from) + x(s.to)) / 2), y: y + LANE / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#001218', ...mono(18) }, d.root, s.text) : null
        if (label) fitStatic('gantt', label, x(s.to) - x(s.from) - 8)
        return { rect, label }
      })
    })
    for (const tk of go.ticks ?? []) {
      svg('line', { x1: r2(x(tk.at)), x2: r2(x(tk.at)), y1: lanes, y2: lanes + 6, stroke: t.dim }, d.root)
      svg('text', { x: r2(x(tk.at)), y: lanes + 20, 'text-anchor': tk.at === a ? 'start' : tk.at === b ? 'end' : 'middle', 'dominant-baseline': 'central', fill: t.dim, ...mono(20, 500) }, d.root, tk.label)
    }
    const cursor = svg('line', { y1: 0, y2: lanes, stroke: t.text, 'stroke-width': 2 }, d.root)
    const g = {
      ...d,
      set(s: { upto?: number; cursor?: boolean } = {}) {
        const upto = num('gantt upto', s.upto ?? b)
        ganttBars(go.rows, go.range, upto, W - L).forEach((row, i) => row.forEach((bar, j) => {
          const e = bars[i]![j]!
          at(e.rect, 'width', bar.w)
          at(e.rect, 'display', bar.w > 0 ? 'inline' : 'none')
          if (e.label) at(e.label, 'display', bar.whole ? 'inline' : 'none')
        }))
        const cx = r2(x(Math.max(a, Math.min(b, upto))))
        at(cursor, 'x1', cx)
        at(cursor, 'x2', cx)
        at(cursor, 'display', s.cursor ? 'inline' : 'none')
      },
    }
    g.set()
    return g
  }

  function grid(parent: Element, go: GridOptions): Instrument<{ levels?: PerCell<number>; roles?: readonly Role[] | ((i: number) => Role) }> {
    if (!(Number.isInteger(go.cols) && go.cols > 0 && Number.isInteger(go.rows) && go.rows > 0)) fail('grid', `cols and rows must be positive integers (${go.cols} × ${go.rows})`)
    const n = go.cols * go.rows
    const [cw, ch] = go.cell ?? [48, 48]
    const gap = go.gap ?? 8
    if (go.labels && go.labels.length !== n) fail('grid', `labels has ${go.labels.length} entries for ${n} cells`)
    const d = dial(parent, go.cols * cw + (go.cols - 1) * gap, go.rows * ch + (go.rows - 1) * gap, go.box)
    const longest = Math.max(1, ...(go.labels ?? []).map(columns))
    const size = r2(Math.min(ch * 0.42, (cw * 0.84) / (longest * 0.6)))
    const cells = Array.from({ length: n }, (_, i) => {
      const [x, y] = [(i % go.cols) * (cw + gap), Math.floor(i / go.cols) * (ch + gap)]
      const rect = svg('rect', { x, y, width: cw, height: ch, rx: 4, 'stroke-width': 1.5 }, d.root)
      if (go.labels) svg('text', { x: x + cw / 2, y: y + ch / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: t.text, ...mono(size, 500) }, d.root, go.labels[i])
      return rect
    })
    const per = <T,>(what: string, v: PerCell<T> | undefined, i: number, dflt: T): T => {
      if (v === undefined) return dflt
      if (typeof v === 'function') return (v as (i: number) => T)(i)
      if (Array.isArray(v)) { if (v.length !== n) fail('grid', `${what} has ${v.length} entries for ${n} cells`); return v[i] as T }
      return v as T
    }
    const g = {
      ...d,
      set(s: { levels?: PerCell<number>; roles?: readonly Role[] | ((i: number) => Role) } = {}) {
        cells.forEach((rect, i) => {
          const lv = Math.max(0, Math.min(1, num('grid level', per('levels', s.levels, i, 0))))
          const r = per<Role>('roles', s.roles, i, go.role ?? 'accent')
          at(rect, 'fill', t[r])
          at(rect, 'fill-opacity', r2(lv))
          at(rect, 'stroke', lv > 0 ? t[r] : t.faint)
        })
      },
    }
    g.set()
    return g
  }

  function code(parent: Element, co: CodeDialOptions): Instrument<{ typed?: number; caret?: boolean; lit?: readonly number[] | ((row: number) => number) }> & { layout: CodeLayout; token(row: number, col: number, n: number): Box } {
    const l = codeLayout(co)
    const role = co.role ?? 'accent'
    const d = dial(parent, l.w, l.h, co.box)
    const x0 = l.pad + l.gutter
    const rows = l.rows.map((chars, i) => {
      const y = l.pad + i * l.lh
      const bar = svg('rect', { x: r2(x0 - 0.4 * l.cw), y: r2(y + 0.1 * l.lh), width: r2(d.size.w - x0 - l.pad + 0.4 * l.cw), height: r2(0.8 * l.lh), fill: t[role] }, d.root)
      const rule = svg('rect', { x: r2(x0 - 0.4 * l.cw), y: r2(y + 0.1 * l.lh), width: 3, height: r2(0.8 * l.lh), fill: t[role] }, d.root)
      if (co.numbers !== false) svg('text', { x: r2(x0 - 1.5 * l.cw), y: r2(y + l.lh / 2), 'text-anchor': 'end', 'dominant-baseline': 'central', fill: t.dim, ...mono(l.size, 500) }, d.root, String(i + 1))
      const els = chars.map((c) => (c.ch === ' ' ? null : svg('text', { x: r2(x0 + c.col * l.cw), y: r2(y + l.lh / 2), 'dominant-baseline': 'central', fill: c.role ? t[c.role] : t.text, ...mono(l.size, 500) }, d.root, c.ch)))
      return { bar, rule, els }
    })
    const caret = svg('rect', { width: r2(l.cw), height: r2(0.75 * l.lh), fill: t[role] }, d.root)
    const c = {
      ...d, layout: l,
      token(row: number, col: number, n: number): Box {
        if (!(Number.isInteger(row) && row >= 0 && row < l.rows.length)) fail('code', `token row ${row} is not a line (0–${l.rows.length - 1})`)
        if (!(col >= 0 && n >= 1)) fail('code', `token needs col ≥ 0 and n ≥ 1 (${col}, ${n})`)
        return { x: r2(x0 + col * l.cw), y: r2(l.pad + row * l.lh), w: r2(n * l.cw), h: r2(l.lh) }
      },
      set(s: { typed?: number; caret?: boolean; lit?: readonly number[] | ((row: number) => number) } = {}) {
        const typed = s.typed ?? Infinity
        if (typed !== Infinity) num('code typed', typed)
        const { shown, caret: cp } = typedAt(l, typed)
        rows.forEach((r, i) => {
          r.els.forEach((e, j) => { if (e) at(e, 'visibility', j < shown[i]! ? 'visible' : 'hidden') })
          const raw = typeof s.lit === 'function' ? s.lit(i) : (s.lit?.[i] ?? 0)
          const lv = Math.max(0, Math.min(1, num('code lit', raw)))
          at(r.bar, 'fill-opacity', r2(0.14 * lv))
          at(r.rule, 'fill-opacity', r2(lv))
        })
        at(caret, 'x', r2(x0 + cp.col * l.cw))
        at(caret, 'y', r2(l.pad + cp.row * l.lh + 0.125 * l.lh))
        at(caret, 'visibility', s.caret ? 'visible' : 'hidden')
      },
    }
    c.set()
    return c
  }

  function wave(parent: Element, wo: WaveOptions): Instrument<{ phase?: number; cursor?: number | null }> {
    const cycles = wo.cycles ?? 8
    if (!(cycles > 0 && Number.isFinite(cycles))) fail('wave', `cycles must be a finite number > 0 (${cycles})`)
    const [NAME, LANE, W] = [120, 56, 1000]
    const lw = W - NAME
    for (const s of wo.signals) if (s.kind !== 'clock' && !s.data) fail('wave', `signal "${s.name}" (${s.kind}) needs data`)
    const d = dial(parent, W, wo.signals.length * LANE, wo.box)
    // A scrolling diagram returns to earlier shapes every cycle by design.
    d.el.dataset.cfAudit = 'allow-motion'
    const lanesH = wo.signals.length * LANE
    const ticks = Array.from({ length: Math.ceil(cycles) + 1 }, () => svg('line', { y1: 0, y2: lanesH, stroke: t.faint, 'stroke-width': 1, 'stroke-dasharray': '2 4' }, d.root))
    const lanes = wo.signals.map((s, i) => {
      const role = s.role ?? 'accent'
      fitStatic('wave', svg('text', { x: 0, y: i * LANE + LANE / 2, 'dominant-baseline': 'central', fill: t.dim, ...mono(18) }, d.root, s.name), NAME - 12)
      const g = svg('g', { transform: `translate(${NAME} ${i * LANE})` }, d.root)
      const path = svg('path', { fill: s.kind === 'bus' ? tone(role, 0.1) : 'none', stroke: t[role], 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g)
      const labels = s.kind === 'bus' ? Array.from({ length: Math.ceil(cycles) + 1 }, () => svg('text', { y: LANE / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: t.text, ...mono(20) }, g)) : []
      return { s, path, labels }
    })
    const cursor = svg('line', { y1: 0, y2: lanesH, stroke: t.text, 'stroke-width': 2 }, d.root)
    const w = {
      ...d,
      set(st: { phase?: number; cursor?: number | null } = {}) {
        const phase = num('wave phase', st.phase ?? 0)
        ticks.forEach((e, j) => {
          const c = Math.ceil(phase) + j
          const x = r2(NAME + ((c - phase) / cycles) * lw)
          at(e, 'x1', x)
          at(e, 'x2', x)
          at(e, 'display', c < phase + cycles ? 'inline' : 'none')
        })
        for (const ln of lanes) {
          const { path, cells } = wavePath(ln.s.kind, ln.s.data, phase, cycles, lw, LANE)
          at(ln.path, 'd', path)
          ln.labels.forEach((e, j) => {
            const c = cells[j]
            const fits = c !== undefined && columns(c.value) * 0.6 * 20 + 12 <= c.x1 - c.x0
            at(e, 'display', fits ? 'inline' : 'none')
            at(e, 'x', c ? r2((c.x0 + c.x1) / 2) : 0)
            txt(e, c?.value ?? '')
          })
        }
        const cur = st.cursor ?? null
        const on = cur !== null && num('wave cursor', cur) >= phase && cur <= phase + cycles
        const cx = on ? r2(NAME + ((cur! - phase) / cycles) * lw) : 0
        at(cursor, 'x1', cx)
        at(cursor, 'x2', cx)
        at(cursor, 'display', on ? 'inline' : 'none')
      },
    }
    w.set()
    return w
  }

  return {
    theme: t,
    panel, tag, counter, meter, donut, gantt, grid, code, wave,
    /** The rect at (x, y) with width `w` (default natural) and the dial's aspect. */
    box(inst: { size: { w: number; h: number } }, x: number, y: number, w = inst.size.w * k): Box {
      return { x, y, w, h: r2((w * inst.size.h) / inst.size.w) }
    },
    /** A rect in the instrument's natural px, mapped into the stage box its root occupies (`meet`). */
    at(inst: { size: { w: number; h: number } }, r: Box, box: Box): Box {
      const { w, h } = inst.size
      const s = Math.min(box.w / w, box.h / h)
      const [ox, oy] = [box.x + (box.w - w * s) / 2, box.y + (box.h - h * s) / 2]
      return { x: ox + r.x * s, y: oy + r.y * s, w: r.w * s, h: r.h * s }
    },
  }
}
export type Hud = ReturnType<typeof hud>
