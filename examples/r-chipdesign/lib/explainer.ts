// explainer: the chrome of a narrated explainer, built from script.json (cueframe/docs/design/explainer.md).
// export const chrome = explainer({ script, cues: CUES, theme: { accent: '#38d6e8', sans: SANS } })
// timeline({ words, scenes: [bg, ...content, chrome], fonts: [{ ..., glyphs: glyphsOf(words, chromeText(script)) }] })
// Script: lines[].title ("text **keyword**" or "**keyword**{warm}"; missing = keep the previous,
// "" = none), lines[].eyebrow, chapters[] { from, n, title, en, short, code, card } and show.
// Every swap is a layout change of keys (continuity): the old text leaves, then the new arrives.

import { cue, scene, type Frame, type MountContext, type Motion } from '@cueframe/core'
import { subtitles, type SubtitleOptions } from '@cueframe/recipes/subtitles.js'
import { parseTitle, THEME, type Theme } from './theme.js'

export interface ScriptChapter { from: string; n?: string; title: string; en?: string; short?: string; code?: string; card?: number }
export interface ScriptLine { id: string; title?: string; eyebrow?: string; pad?: number; at?: number }
export interface ExplainerScript { show?: string; chapters?: readonly ScriptChapter[]; lines: readonly ScriptLine[] }

export { parseTitle, THEME, type Role, type Span, type Theme } from './theme.js'

export interface Head { eyebrow: string; title: string }
/** A chapter takes effect at `at`; its card shows in the silence before that, from `cardAt` to `at`. */
export interface PlannedChapter extends ScriptChapter { at: number; cardAt: number }
/**
 * One layout of the chrome: the line in force, its headline (−1: none), chapter and showing card
 * (−1: none), and the chapter the road map shows (the last card's).
 */
export interface State { at: number; line: number; head: number; chapter: number; card: number; road: number }
export interface Plan {
  heads: Head[]
  chapters: PlannedChapter[]
  states: State[]
  /** Headline slot keys: `slots[k][s]` is the headline slot s holds in state k (−1: none). */
  slots: number[][]
  /** Per state, motion by key name (without the scene prefix). */
  motion: Record<string, Motion>[]
  /** Key names, and whether each is shown in a state. */
  keys: string[]
  shown(key: string, k: number): boolean
  warnings: string[]
}

export interface PlanOptions {
  lead?: number; swap?: number; card?: number
  /** When a line's voice ends (words.json); without it, `scene.<id>.end − pad` (pad 0.3 by default, as tts). */
  voiceEnd?: (id: string) => number | undefined
}

const finite = (v: number, what: string) => {
  if (!(typeof v === 'number' && Number.isFinite(v) && v >= 0)) throw new Error(`explainer: ${what} must be a finite number ≥ 0 (got ${v})`)
  return v
}

/** The chrome's states and motions over time, from the script and the cue table: pure, no DOM. */
export function plan(script: ExplainerScript, cues: Readonly<Record<string, number>>, o: PlanOptions = {}): Plan {
  const lead = finite(o.lead ?? 0.25, 'lead')
  const swap = finite(o.swap ?? 0.25, 'swap')
  const cardDefault = finite(o.card ?? 3.5, 'card')
  const total = cues.total
  if (!(typeof total === 'number' && Number.isFinite(total) && total > 0)) throw new Error(`explainer: cue "total" must be a finite number > 0 (got ${total})`)
  const lines = script.lines
  if (!lines?.length) throw new Error('explainer: the script has no lines')
  const index = new Map<string, number>()
  const starts = lines.map((l, i) => {
    if (index.has(l.id)) throw new Error(`explainer: line id "${l.id}" is used twice`)
    index.set(l.id, i)
    for (const f of ['title', 'eyebrow'] as const) if (l[f] !== undefined && typeof l[f] !== 'string') throw new Error(`explainer: line "${l.id}": ${f} must be a string`)
    const t = cues[`scene.${l.id}.start`]
    if (!(typeof t === 'number' && Number.isFinite(t))) throw new Error(`explainer: no cue scene.${l.id}.start (is build/cues.json current?)`)
    return t
  })
  starts.forEach((t, i) => { if (i && t < starts[i - 1]!) throw new Error(`explainer: line "${lines[i]!.id}" starts before "${lines[i - 1]!.id}"`) })
  const at = starts.map((t, i) => (i === 0 ? 0 : Math.max(0, t - lead)))

  const chapters: PlannedChapter[] = []
  let last = -1
  for (const c of script.chapters ?? []) {
    if (typeof c.title !== 'string' || !c.title) throw new Error(`explainer: chapter from "${c.from}" needs a title`)
    for (const f of ['n', 'en', 'short', 'code'] as const) if (c[f] !== undefined && typeof c[f] !== 'string') throw new Error(`explainer: chapter "${c.title}": ${f} must be a string`)
    const i = index.get(c.from)
    if (i === undefined) throw new Error(`explainer: chapter "${c.title}" starts at unknown line "${c.from}"`)
    if (i <= last) throw new Error(`explainer: chapter "${c.title}" (from "${c.from}") is out of order or shares its line`)
    last = i
    finite(c.card ?? cardDefault, `chapter "${c.title}": card`)
    chapters.push({ ...c, at: at[i]!, cardAt: at[i]! })
  }
  const warnings: string[] = []
  chapters.forEach((c, j) => {
    c.cardAt = Math.max(0, c.at - (c.card ?? cardDefault), chapters[j - 1]?.at ?? 0)
    const len = c.at - c.cardAt
    const prev = lines[index.get(c.from)! - 1]
    if (!prev) {
      if (c.card) warnings.push(`explainer: chapter "${c.title}" starts at the first line, so there is no silence before it for a card`)
      return
    }
    const end = cues[`scene.${prev.id}.end`]
    const pad = prev.pad ?? 0.3
    const voice = o.voiceEnd?.(prev.id) ?? (end === undefined ? undefined : end - pad)
    if (len > 0 && voice !== undefined && c.cardAt < voice - 1e-6) {
      // tts makes a slot max(min, voice + pad) long and starts the next line where it ends, so a
      // pad of card + lead leaves the card's length of silence whatever min is.
      const up = (x: number) => (Math.ceil(x * 100 - 1e-6) / 100).toFixed(2)
      const card = c.card ?? cardDefault
      const fix = lines[index.get(c.from)!]!.at !== undefined
        ? `line "${c.from}" is pinned with "at"; move it to at least ${up(voice + card + lead)} s`
        : `give "${prev.id}" a pad of at least ${up(card + lead)} s`
      warnings.push(`explainer: the card of chapter "${c.title}" starts at ${c.cardAt.toFixed(2)} s, while line "${prev.id}" speaks until ${voice.toFixed(2)} s; ${fix}`)
    }
  })
  const chapterOf = lines.map((_, i) => {
    let j = -1
    chapters.forEach((c, k) => { if (index.get(c.from)! <= i) j = k })
    return j
  })

  const heads: Head[] = []
  const headIndex = new Map<string, number>()
  let title = ''
  let eyebrow = ''
  const lineHead = lines.map((l) => {
    if (l.title !== undefined) title = l.title
    if (l.eyebrow !== undefined) eyebrow = l.eyebrow
    if (!title) return -1
    parseTitle(title)
    const k = `${eyebrow}\u0000${title}`
    if (!headIndex.has(k)) { headIndex.set(k, heads.length); heads.push({ eyebrow, title }) }
    return headIndex.get(k)!
  })

  const times = [...new Set([0, ...at, ...chapters.flatMap((c) => [c.cardAt, c.at])])].filter((t) => t >= 0 && t < total).sort((a, b) => a - b)
  const states: State[] = []
  for (const t of times) {
    let line = 0
    at.forEach((a, i) => { if (a <= t) line = i })
    const card = chapters.findIndex((c) => c.cardAt <= t && t < c.at)
    const p = states.at(-1)
    const s: State = { at: t, line, head: lineHead[line]!, chapter: chapterOf[line]!, card, road: card >= 0 ? card : p?.road ?? -1 }
    if (p && p.head === s.head && p.chapter === s.chapter && p.card === s.card) continue
    states.push(s)
  }
  const headShown = (s: State) => (s.card < 0 ? s.head : -1)

  // Headline slots: a slot takes a new text only after its last text has fully left.
  const held: number[] = []
  const free: number[] = []
  const visible: number[] = []      // per state, the slot shown (−1)
  const slots = states.map((s, k) => {
    const h = headShown(s)
    const prev = k ? visible[k - 1]! : -1
    let v = -1
    if (h >= 0) {
      v = held.indexOf(h)
      if (v < 0) v = held.findIndex((_, i) => i !== prev && free[i]! <= s.at)
      if (v < 0) { v = held.length; held.push(-1); free.push(0) }
      held[v] = h
    }
    if (prev >= 0 && prev !== v) free[prev] = s.at + swap
    visible.push(v)
    return [...held]
  })
  const width = held.length
  for (const row of slots) while (row.length < width) row.push(-1)

  const keys = [
    ...held.map((_, i) => `head-${i}`), ...chapters.map((_, j) => `tag-${j}`),
    ...chapters.flatMap((c, j) => (c.at > c.cardAt ? [`card-${j}`] : [])),
    ...(chapters.some((c) => c.at > c.cardAt) ? ['shade', 'road', 'fill'] : []),
  ]
  const shown = (key: string, k: number): boolean => {
    const s = states[k]!
    const [kind, n] = key.split('-') as [string, string | undefined]
    if (kind === 'head') return visible[k] === Number(n)
    if (kind === 'tag') return s.card < 0 && s.chapter === Number(n)
    if (kind === 'card') return s.card === Number(n)
    if (kind === 'fill') return true
    return s.card >= 0
  }

  // Motion: what becomes shown waits for what leaves; anything else keeps its running motion.
  const busy = new Map<string, number>()
  const motion = states.map((s, k) => {
    const m: Record<string, Motion> = {}
    if (!k) return m
    const prev = states[k - 1]!
    for (const key of keys) {
      const b = busy.get(key) ?? 0
      if (key === 'fill' && s.road !== prev.road) { m[key] = { delay: 2 * swap + 0.2, dur: 0.8 }; busy.set(key, s.at + 2 * swap + 1) }
      else if (shown(key, k) && !shown(key, k - 1)) { m[key] = { delay: swap, dur: swap }; busy.set(key, s.at + 2 * swap) }
      else if (!shown(key, k) && shown(key, k - 1)) { m[key] = { delay: 0, dur: swap }; busy.set(key, s.at + swap) }
      else m[key] = { delay: Math.max(0, b - s.at), dur: 0 }
    }
    return m
  })

  lines.forEach((l, i) => { if (starts[i]! >= total) warnings.push(`explainer: line "${l.id}" starts at or after total (${total} s)`) })
  states.forEach((s, k) => {
    const v = visible[k]!
    if (!k || v < 0 || visible[k - 1] === v) return
    let m = k + 1
    while (m < states.length && visible[m] === v) m++
    const len = (states[m]?.at ?? total) - s.at
    const where = `headline "${heads[s.head]!.title}" (line "${lines[s.line]!.id}")`
    if (len < swap) warnings.push(`explainer: ${where} lasts ${len.toFixed(2)} s, less than swap (${swap} s): it never shows`)
    else if (len < 2 * swap) warnings.push(`explainer: ${where} lasts ${len.toFixed(2)} s: it never finishes arriving (2 × swap = ${2 * swap} s)`)
  })
  chapters.forEach((c) => {
    const len = c.at - c.cardAt
    if (len > 0 && len < 2 * swap + 1) warnings.push(`explainer: the card of chapter "${c.title}" lasts ${len.toFixed(2)} s; the road map's fill needs ${2 * swap + 1} s`)
  })
  return { heads, chapters, states, slots, motion, keys, shown, warnings }
}

/** Every string the chrome draws, markup stripped, for a font subset next to glyphsOf(words). */
export function chromeText(script: ExplainerScript, o: { show?: string } = {}): string {
  const plain = (s: string) => parseTitle(s).map((x) => x.text).join('')
  return [
    o.show ?? script.show ?? '',
    ...script.lines.flatMap((l) => [plain(l.title ?? ''), l.eyebrow ?? '']),
    ...(script.chapters ?? []).flatMap((c) => [c.n ?? '', c.title, c.en ?? '', c.short ?? '', c.code ?? '', `CHAPTER ${c.n ?? ''}`]),
    'CHAPTER 0123456789',
  ].join('\n')
}

export interface Box { x: number; y: number; w: number; h: number }
const BASE = 1920

/** Where the chrome draws, author-facing: keep content clear of `top`, `head` (while a headline shows), `subtitles`, `card` (while a card shows). */
export function regions(stage: { w: number; h: number }, o: { subtitles?: SubtitleOptions | false } = {}): { top: Box; head: Box; subtitles: Box; card: Box } {
  const k = stage.w / BASE
  const sub = o.subtitles === false ? null : o.subtitles ?? {}
  const size = (sub?.size ?? 38) * 1.9
  const sw = sub?.width ?? stage.w - 320
  return {
    top: { x: 0, y: 0, w: stage.w, h: 96 * k },
    head: { x: 110 * k, y: 112 * k, w: stage.w - 220 * k, h: 100 * k },
    subtitles: sub ? { x: (stage.w - sw) / 2, y: (sub.y ?? Math.round(stage.h * 0.9)) - size / 2, w: sw, h: size } : { x: 0, y: 0, w: 0, h: 0 },
    card: { x: 110 * k, y: stage.h * 0.3, w: stage.w - 220 * k, h: stage.h * 0.7 - 120 * k },
  }
}

/**
 * The script's chapters for `timeline({ chapters })`: id `n` (else `code`, else the index), the
 * title, and the time the chapter's card starts (its first line when it has no card), so a chapter
 * export opens on its card.
 */
export function scriptChapters(script: ExplainerScript, cues: Readonly<Record<string, number>>, o: PlanOptions = {}): { id: string; title: string; at: number }[] {
  return plan(script, cues, o).chapters.map((c, i) => ({ id: c.n ?? c.code ?? String(i + 1), title: c.title, at: Math.min(c.cardAt, c.at) }))
}

export interface ExplainerOptions extends PlanOptions {
  id?: string
  script: ExplainerScript
  /** The cue table the timeline uses: reads scene.<line>.start and total. */
  cues: Readonly<Record<string, number>>
  theme?: Partial<Theme>
  /** Options for subtitles.ts (needs timeline({ words })), or false. */
  subtitles?: SubtitleOptions | false
  show?: string
}

export function explainer(o: ExplainerOptions) {
  const theme: Theme = { ...THEME, ...o.theme }
  const id = o.id ?? 'chrome'
  return scene({
    id,
    at: 0,
    end: cue('total'),
    layer: 'overlay',
    mount(ctx: MountContext) {
      const p = plan(o.script, o.cues, { ...o, voiceEnd: o.voiceEnd ?? ((line) => { try { return ctx.data.words(line).line?.end } catch { return undefined } }) })
      for (const m of p.warnings) ctx.warn(m)
      const { w, h } = ctx.stage
      const k = w / BASE
      const px = (n: number) => `${Math.round(n * k * 100) / 100}px`
      const R = regions(ctx.stage, o)
      const root = ctx.root
      const el = (parent: Element, css: Partial<CSSStyleDeclaration>, text?: string) => {
        const e = document.createElement('div')
        Object.assign(e.style, { position: 'absolute', ...css })
        if (text !== undefined) e.textContent = text
        parent.append(e)
        return e
      }
      const els = new Map<string, HTMLElement>()
      const key = (e: HTMLElement, name: string) => { e.dataset.xp = name; els.set(name, ctx.key(e, `${id}-${name}`)); return e }

      const bar = el(root, { left: '0', top: '0', height: px(3), width: '0', background: theme.accent, boxShadow: `0 0 ${px(12)} ${theme.accent}` })
      const show = o.show ?? o.script.show
      if (show) el(root, { right: px(72), top: px(42), font: `500 ${px(18)} ${theme.mono}`, color: theme.dim, letterSpacing: '.2em' }, show).dataset.cfAudit = 'chrome'

      p.chapters.forEach((c, j) => {
        const tag = key(el(root, { left: px(72), top: px(40), display: 'flex', gap: px(14), alignItems: 'center', font: `500 ${px(20)} ${theme.sans}`, color: theme.dim, whiteSpace: 'nowrap' }), `tag-${j}`)
        tag.dataset.cfAudit = 'chrome'
        if (c.n) el(tag, { position: 'static', background: theme.accent, color: '#001218', font: `700 ${px(18)} ${theme.mono}`, padding: `${px(2)} ${px(8)}`, borderRadius: px(3) }, c.n)
        el(tag, { position: 'static' }, c.title)
      })
      // Headline slots: the text is set per layout; the box does not depend on it.
      const slots = p.slots[0]!.map((_, i) => {
        const head = key(el(root, { left: `${R.head.x}px`, top: `${R.head.y}px`, width: `${R.head.w}px`, height: `${R.head.h}px` }), `head-${i}`)
        const brow = el(head, { left: '0', top: '0', font: `500 ${px(15)} ${theme.mono}`, color: theme.dim, letterSpacing: '.3em', whiteSpace: 'nowrap' })
        const line = el(head, { left: '0', top: px(24), font: `700 ${px(54)} ${theme.sans}`, color: theme.text, letterSpacing: '.02em', whiteSpace: 'nowrap' })
        return { brow, line, text: -2 }
      })
      const setHead = (slot: (typeof slots)[number], hd: number) => {
        if (slot.text === hd) return
        slot.text = hd
        const head = p.heads[hd]
        slot.brow.textContent = head?.eyebrow ?? ''
        slot.line.replaceChildren(...parseTitle(head?.title ?? '', theme).map((s) => {
          const x = document.createElement('span')
          x.textContent = s.text
          if (s.color) x.style.color = s.color
          return x
        }))
      }

      // Chapter cards: a shade over the content, the card, and the road map with its fill.
      const N = p.chapters.length
      const road = { x: 110 * k, y: h - 230 * k, w: w - 220 * k }
      const nodeX = (j: number) => (N > 1 ? (road.w * Math.max(0, j)) / (N - 1) : 0)
      let fill: HTMLElement | null = null
      let nodes: { dot: HTMLElement; label: HTMLElement; code: HTMLElement }[] = []
      if (p.keys.includes('road')) {
        key(el(root, { inset: '0', background: theme.shade }), 'shade')
        p.chapters.forEach((c, j) => {
          if (!p.keys.includes(`card-${j}`)) return
          const card = key(el(root, { left: px(110), top: `${Math.round(h * 0.3)}px`, width: `${w - 220 * k}px`, height: px(360) }), `card-${j}`)
          if (c.n) el(card, { left: '0', top: '0', font: `700 ${px(120)}/1 ${theme.mono}`, color: theme.accent, textShadow: `0 0 ${px(24)} ${theme.accent}66` }, c.n)
          el(card, { left: px(4), top: px(134), font: `500 ${px(18)} ${theme.mono}`, color: theme.dim, letterSpacing: '.4em' }, `CHAPTER ${c.n ?? j + 1}`)
          el(card, { left: '0', top: px(176), font: `700 ${px(72)} ${theme.sans}`, color: theme.text, whiteSpace: 'nowrap' }, c.title)
          if (c.en) el(card, { left: px(4), top: px(280), font: `500 ${px(18)} ${theme.mono}`, color: theme.dim, letterSpacing: '.3em' }, c.en)
          el(card, { left: '0', top: px(324), width: px(360), height: px(2), background: theme.accent })
        })
        const map = key(el(root, { left: `${road.x}px`, top: `${road.y}px`, width: `${road.w}px`, height: px(80) }), 'road')
        el(map, { left: '0', top: px(39), width: `${road.w}px`, height: px(2), background: theme.faint })
        nodes = p.chapters.map((c, j) => {
          const x = nodeX(j)
          const dot = el(map, { left: `${x - 7 * k}px`, top: px(33), width: px(14), height: px(14), borderRadius: '50%', boxSizing: 'border-box', border: `${px(2)} solid` })
          // The end nodes' labels align inward, so they stay inside the road's width.
          const align = j === 0 ? 'left' : j === N - 1 ? 'right' : 'center'
          const at = align === 'left' ? x : align === 'right' ? x - 200 * k : x - 100 * k
          const label = el(map, { left: `${at}px`, width: px(200), top: '0', textAlign: align, font: `600 ${px(20)} ${theme.sans}`, whiteSpace: 'nowrap' }, c.short ?? c.title)
          const code = el(map, { left: `${at}px`, width: px(200), top: px(58), textAlign: align, font: `500 ${px(14)} ${theme.mono}`, letterSpacing: '.15em', whiteSpace: 'nowrap' }, `${c.n ?? ''} ${c.code ?? ''}`.trim())
          return { dot, label, code }
        })
        fill = key(el(map, { left: '0', top: px(38), height: px(4), background: theme.accent, boxShadow: `0 0 ${px(10)} ${theme.accent}` }), 'fill')
      }

      const ids = p.states.map((_, i) => `s${i}`)
      const apply = (layout: string) => {
        const i = ids.indexOf(layout)
        const s = p.states[i]!
        for (const [name, e] of els) e.style.opacity = p.shown(name, i) ? '1' : '0'
        slots.forEach((slot, v) => setHead(slot, p.slots[i]![v]!))
        if (fill) fill.style.width = `${Math.max(2 * k, nodeX(s.road))}px`
        nodes.forEach((n, j) => {
          const c = j < s.road ? theme.text : j === s.road ? theme.accent : theme.dim
          n.dot.style.borderColor = j <= s.road ? c : theme.faint
          n.dot.style.background = j <= s.road ? c : '#000'
          n.label.style.color = c
          n.code.style.color = j === s.road ? theme.accent : theme.dim
        })
      }
      const prefixed = (m: Record<string, Motion>) => Object.fromEntries(Object.entries(m).map(([n, v]) => [`${id}-${n}`, v]))
      ctx.layouts(p.states.map((s, i) => ({ id: ids[i]!, at: s.at, motion: prefixed(p.motion[i]!) })), apply)

      const draw = o.subtitles === false ? null : subtitles(ctx, { font: 'Noto Sans SC', size: 38, color: theme.text, ...o.subtitles })
      return { bar, draw, w, total: o.cues.total! }
    },
    render(f: Frame, s) {
      s.bar.style.width = `${(s.w * Math.min(1, f.t / s.total)).toFixed(1)}px`
      s.draw?.(f)
    },
  })
}
