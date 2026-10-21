// beatcut: a rhythm cut ("卡点") from beats and drum hits, and the window grammar drawn on it
// (kits/README.md). Plain data in, Canvas2D out: hits are `{ t, kind, s }` (hits.json,
// `ctx.data.hits()`, or your own list), pictures are any `Paint` (a frame source's `draw`, `cover`
// over an image or canvas).
//
//   const SHOTS = cutList({ dur, beats, hits: tiers(hits), every: 2 })   // module scope
//   const s = shotAt(SHOTS, f.t)                                          // render
//   drawWindow(g, 'pip', { stage, shot: s, t: f.t, frame: f.frame, base, insert, grade: DUO.cobalt })

import { seeded, type Rng } from '@cueframe/core'

/** A drum hit; `tier` (from `tiers`) ranks it: 0 accents (cuts, big changes), 1 ticks (small changes). Untiered hits count as 0. */
export interface Hit { t: number; kind: string; s: number; tier?: number }
export interface Shot {
  i: number
  /** Cut time and the next cut (or `dur`), seconds. */
  at: number
  end: number
  /** Hits inside the shot, more than `guard` after its cut and before its end. */
  hits: Hit[]
}
/** Which hits count: tiers up to `tier`, these kinds, at least `min` strong. */
export interface HitSel { tier?: number; kinds?: readonly string[]; min?: number }

export interface TierRule { kinds?: readonly string[]; min?: number }

/**
 * Ranks hits into tiers: the first rule a hit meets is its tier, hits meeting none are dropped.
 * The default maps kicks and snares from 0.5 to tier 0 (cuts and big changes) and any other hit
 * from 0.2 to tier 1 (ticks: small changes).
 */
export function tiers(hits: readonly Hit[], rules: readonly TierRule[] = [{ kinds: ['kick', 'snare'], min: 0.5 }, { min: 0.2 }]): Hit[] {
  const out: Hit[] = []
  for (const h of hits) {
    const tier = rules.findIndex((r) => (!r.kinds || r.kinds.includes(h.kind)) && h.s >= (r.min ?? 0))
    if (tier >= 0) out.push({ ...h, tier })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** The hits `sel` keeps, in order. */
export function select(hits: readonly Hit[], sel: HitSel = {}): Hit[] {
  return hits.filter((h) => (sel.tier === undefined || (h.tier ?? 0) <= sel.tier) && (!sel.kinds || sel.kinds.includes(h.kind)) && h.s >= (sel.min ?? -Infinity))
}

/** An envelope for "since the last hit": 1 on the hit, decaying exponentially over `decay` s, 0 before (since < 0). */
export function pulse(since: number, decay = 0.18): number {
  return since < 0 || !Number.isFinite(since) ? 0 : Math.exp(-since / decay)
}
export interface Rect { x: number; y: number; w: number; h: number }
export interface Circle { cx: number; cy: number; r: number }
export type Shape = Rect | Circle
export interface Size { w: number; h: number }
/** Stage px = `o + source px × s` (the fit a frame source's `draw` returns). */
export interface Fit { sx: number; sy: number; ox: number; oy: number }
/** Draws a picture covering `r`. */
export type Paint = (g: CanvasRenderingContext2D, r: Rect) => void

export interface CutOptions {
  dur: number
  beats: readonly number[]
  /** Hits: tier 0 (or untiered) ones are snapped to; all of them land in the shots' `hits`. */
  hits?: readonly Hit[]
  /**
   * A cut every `every` beats (default 2), counted from the start: 0, or the grid's first beat
   * when the grid starts later, as in `cutSections`.
   */
  every?: number
  /**
   * Phrasing instead of `every`: beats per shot, cycled (e.g. `[4, 2, 1, 1, 2, 4]`: a hold, then a
   * burst). Fractions cut between beats (`0.5`: on the off-beat, snapped like any beat cut).
   */
  pattern?: readonly number[]
  /** Whole beats to skip before the first beat cut (default 0). */
  phase?: number
  /** Move a cut to the strongest hit within this many seconds of its beat (default 0.06). */
  snap?: number
  /** Shortest shot, seconds (default 0.8). */
  min?: number
  /** No beat cut in the last `tail` seconds (default 0.6). */
  tail?: number
  /** Forced cuts, kept whatever `min` says; beat cuts closer than `min` to one are dropped. */
  at?: readonly number[]
  /** Hits this close to a cut belong to it, not to the shot (default 0.04). */
  guard?: number
  /** Ranges `[from, to)` with no beat cut (a still before a drop); cut at `to` with `at`. */
  holds?: readonly (readonly [number, number])[]
}

const fin = (what: string, n: number) => {
  if (!Number.isFinite(n)) throw new Error(`beatcut: ${what} is not a finite number (${n})`)
  return n
}

/** The cut rule of one range, in absolute seconds: beats `i < hi` of `beats` lie before `to`. */
interface RangeRule {
  from: number
  to: number
  beats: readonly number[]
  hi: number
  accents: readonly Hit[]
  every?: number
  pattern?: readonly number[]
  phase?: number
  snap: number
  min: number
  tail: number
  forced: readonly number[]
  holds: readonly (readonly [number, number])[]
}

/**
 * The start's position on the beat grid, in beats (beat `i` at `beats[i]`): a start within `snap`
 * of a beat is that beat, one between beats is interpolated, one before the first beat counts from
 * the first beat, one after the last is extrapolated by the last beat interval.
 */
function gridPos(beats: readonly number[], t: number, snap: number): number {
  if (!beats.length) return 0
  let i = 0
  while (i + 1 < beats.length && beats[i + 1]! <= t) i++
  const a = fin('beat', beats[i]!)
  const b = beats[i + 1] ?? a + (i > 0 ? a - beats[i - 1]! : 0)
  const near = [i, i + 1].filter((k) => k < beats.length && Math.abs(beats[k]! - t) <= snap)
  if (near.length) return near.reduce((k, m) => (Math.abs(beats[m]! - t) < Math.abs(beats[k]! - t) ? m : k))
  if (t < a || !(b > a)) return i
  return i + (t - a) / (b - a)
}

/**
 * The cut times of one range, from `from` (always a cut), sorted. Beat marks lie at
 * `x0 + phase + cumulative pattern` (or every `every` beats), `x0` being `from` on the grid; each
 * mark is timed by the grid and snapped to the strongest accent within `snap`.
 */
function rangeCuts(r: RangeRule): number[] {
  const every = Math.max(1, Math.round(r.every ?? 2))
  const phase = Math.max(0, Math.round(r.phase ?? 0))
  const held = (t: number) => r.holds.some(([a, b]) => t >= a && t < b)
  const forced = [...new Set(r.forced.map((t) => fin('at', t)))].filter((t) => t > r.from && t < r.to).sort((a, b) => a - b)

  if (r.pattern && (!r.pattern.length || r.pattern.some((n) => !(n > 0)))) throw new Error('beatcut: pattern needs beat counts > 0')
  const beatAt = (x: number) => {
    const i = Math.min(Math.floor(x), r.beats.length - 1), f = x - i
    const a = fin('beat', r.beats[i]!)
    if (f === 0) return a
    const b = r.beats[i + 1] ?? a + (i > 0 ? a - r.beats[i - 1]! : 0)
    return a + (b - a) * f
  }
  const x0 = gridPos(r.beats, r.from, r.snap)
  const marks: number[] = []
  if (r.pattern) for (let x = x0 + phase, j = 0; x < r.hi; x += r.pattern[j++ % r.pattern.length]!) marks.push(x)
  else for (let x = x0 + phase; x < r.hi; x += every) marks.push(x)
  // the start is a cut already; its own mark is no second one
  if (marks[0] === x0) marks.shift()

  const beatCuts: number[] = []
  for (const x of marks) {
    const b = beatAt(x)
    let best: Hit | undefined
    for (const h of r.accents) {
      if (Math.abs(h.t - b) > r.snap) continue
      if (!best || h.s > best.s || (h.s === best.s && Math.abs(h.t - b) < Math.abs(best.t - b))) best = h
    }
    beatCuts.push(best ? best.t : b)
  }

  const cuts = [r.from, ...forced]
  const near = (t: number) => cuts.some((c) => Math.abs(c - t) < r.min)
  for (const t of beatCuts) if (t > r.from && r.to - t >= r.tail && !held(t) && !near(t)) cuts.push(t)
  return cuts.sort((a, b) => a - b)
}

const sortHits = (hits: readonly Hit[] | undefined) => [...(hits ?? [])].sort((a, b) => a.t - b.t)
const accentsOf = (hits: readonly Hit[]) => hits.filter((h) => (h.tier ?? 0) === 0)
const shotHits = (hits: readonly Hit[], at: number, end: number, guard: number) => hits.filter((h) => h.t > at + guard && h.t < end - guard)

/** Shots from a beat grid: one cut every `every` beats, snapped to hits, spaced, plus forced cuts. */
export function cutList(o: CutOptions): Shot[] {
  const dur = fin('dur', o.dur)
  const guard = o.guard ?? 0.04
  const hits = sortHits(o.hits)
  const cuts = rangeCuts({
    from: 0, to: dur, beats: o.beats, hi: o.beats.length, accents: accentsOf(hits),
    every: o.every, pattern: o.pattern, phase: o.phase,
    snap: o.snap ?? 0.06, min: o.min ?? 0.8, tail: o.tail ?? 0.6, forced: o.at ?? [], holds: o.holds ?? [],
  })
  return cuts.map((at, i) => {
    const end = cuts[i + 1] ?? dur
    return { i, at, end, hits: shotHits(hits, at, end, guard) }
  })
}

/** One section's cut rule; `cuts` and `holds` are seconds from the section's start. */
export interface Section {
  id: string
  /** Start and end, seconds; sections are contiguous and sorted. */
  at: number
  end: number
  /**
   * Beats per shot (`every`, or `pattern` cycled), counted from the section start, which is always
   * a cut: an off-beat start (a syncopated kick) puts its marks off the beat too, and a start
   * within `snap` of a beat counts as that beat.
   */
  every?: number
  pattern?: readonly number[]
  /** Whole beats to skip before the first beat cut, counted from the section start. */
  phase?: number
  /** Forced cuts, seconds from the section's start. */
  cuts?: readonly number[]
  /** Ranges `[from, to)` without a beat cut, seconds from the section's start. */
  holds?: readonly (readonly [number, number])[]
  min?: number
  tail?: number
  snap?: number
  guard?: number
}
export interface SectionShot extends Shot {
  /** The section's id, the shot's index in it and the number of shots in it. */
  section: string
  n: number
  of: number
}
export interface SectionCutOptions {
  beats: readonly number[]
  hits?: readonly Hit[]
  /** When given, the sections must cover `[0, dur]`. */
  dur?: number
  /** Defaults for every section (a section's own value wins); built-in defaults as in `cutList`. */
  every?: number
  pattern?: readonly number[]
  min?: number
  tail?: number
  snap?: number
  guard?: number
}

const EPS = 1e-6

function checkSections(sections: readonly Section[], dur: number | undefined): void {
  if (!sections.length) throw new Error('beatcut: cutSections needs at least one section')
  const ids = new Set<string>()
  sections.forEach((s, k) => {
    const name = `section "${s.id}"`
    if (ids.has(s.id)) throw new Error(`beatcut: two sections are called "${s.id}"`)
    ids.add(s.id)
    fin(`${name} at`, s.at)
    fin(`${name} end`, s.end)
    if (!(s.end > s.at)) throw new Error(`beatcut: ${name} ends at ${s.end} s, not after its start ${s.at} s`)
    const len = s.end - s.at
    for (const c of s.cuts ?? []) {
      fin(`${name} cut`, c)
      if (c < 0 || c > len) throw new Error(`beatcut: ${name} has a cut at ${c} s, outside its 0..${+len.toFixed(6)} s (cuts are seconds from the section's start)`)
    }
    const prev = sections[k - 1]
    if (!prev) return
    const d = s.at - prev.end
    if (d > EPS) throw new Error(`beatcut: gap of ${+d.toFixed(6)} s between section "${prev.id}" (ends ${prev.end} s) and "${s.id}" (starts ${s.at} s)`)
    if (d < -EPS) throw new Error(`beatcut: section "${s.id}" (starts ${s.at} s) overlaps "${prev.id}" (ends ${prev.end} s); sections must be sorted and contiguous`)
  })
  if (dur !== undefined) {
    fin('dur', dur)
    const first = sections[0]!, last = sections.at(-1)!
    if (Math.abs(first.at) > EPS) throw new Error(`beatcut: the first section "${first.id}" starts at ${first.at} s, not 0`)
    if (Math.abs(last.end - dur) > EPS) throw new Error(`beatcut: the last section "${last.id}" ends at ${last.end} s, not at dur ${dur} s`)
  }
}

/**
 * Shots for a piece cut in sections, each with its own rule: every section start is a cut, beat
 * cuts count beats from the section start (its position on the grid, interpolated between beats), snap only to accents inside the section, and keep
 * `tail` clear of the section's end. Shots are numbered across the piece (`i`) and in their section
 * (`n` of `of`); their hits are taken by absolute time.
 */
export function cutSections(sections: readonly Section[], o: SectionCutOptions): SectionShot[] {
  checkSections(sections, o.dur)
  const hits = sortHits(o.hits)
  const accents = accentsOf(hits)
  const out: SectionShot[] = []
  for (const [k, s] of sections.entries()) {
    // a contiguous boundary is the previous section's end, so no sliver of time is lost to rounding
    const at = k ? sections[k - 1]!.end : s.at
    let hi = 0
    while (hi < o.beats.length && o.beats[hi]! < s.end) hi++
    const pattern = s.pattern ?? (s.every === undefined ? o.pattern : undefined)
    const cuts = rangeCuts({
      from: at, to: s.end, beats: o.beats, hi,
      accents: accents.filter((h) => h.t >= at && h.t < s.end),
      every: s.every ?? o.every, pattern, phase: s.phase,
      snap: s.snap ?? o.snap ?? 0.06, min: s.min ?? o.min ?? 0.8, tail: s.tail ?? o.tail ?? 0.6,
      forced: (s.cuts ?? []).map((c) => at + c),
      holds: (s.holds ?? []).map(([a, b]) => [at + a, at + b] as const),
    })
    const guard = s.guard ?? o.guard ?? 0.04
    cuts.forEach((c, n) => {
      const end = cuts[n + 1] ?? s.end
      out.push({ i: out.length, at: c, end, hits: shotHits(hits, c, end, guard), section: s.id, n, of: cuts.length })
    })
  }
  return out
}

/** The section showing at `t` (the first before its start, the last after its end): its id, span and shots. */
export function sectionAt(shots: readonly SectionShot[], t: number): { id: string; at: number; end: number; shots: SectionShot[] } {
  const s = shotAt(shots, t) as SectionShot
  const all = shots.slice(s.i - s.n, s.i - s.n + s.of)
  return { id: s.section, at: all[0]!.at, end: all.at(-1)!.end, shots: all }
}

/** The shot showing at `t` (the first before 0). */
export function shotAt(shots: readonly Shot[], t: number): Shot {
  if (shots.length === 0) throw new Error('beatcut: shotAt on an empty cut list')
  let lo = 0, hi = shots.length - 1
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1
    if (shots[m]!.at <= t) lo = m
    else hi = m - 1
  }
  return shots[lo]!
}

/**
 * The last selected hit of the shot at or before `t` (default: tier 0, the accents): its index `k`
 * among the selected (−1 before the first) and the seconds since it (or the cut).
 */
export function hitIn(shot: Shot, t: number, sel: HitSel = { tier: 0 }): { k: number; since: number; hit: Hit | null } {
  const hs = select(shot.hits, sel)
  let k = -1
  for (let i = 0; i < hs.length; i++) if (hs[i]!.t <= t) k = i
  const hit = k < 0 ? null : hs[k]!
  return { k, since: t - (hit ? hit.t : shot.at), hit }
}

/** A generator seeded per shot and hit: the same window for the same hit on every frame. */
export function hitRng(shot: Shot, k: number, salt: string | number = 0): Rng {
  return seeded(`beatcut:${shot.i}:${k}:${salt}`)
}

// ---- geometry --------------------------------------------------------------------------------

/** Cover-fit a `w × h` picture into `r`. */
export function coverFit(w: number, h: number, r: Rect): Fit {
  const s = Math.max(r.w / w, r.h / h)
  return { sx: s, sy: s, ox: r.x + (r.w - w * s) / 2, oy: r.y + (r.h - h * s) / 2 }
}

/** A `Paint` that cover-fits an image (any `CanvasImageSource` of `w × h`), with an optional pan in source px and zoom. */
export function cover(img: CanvasImageSource, w: number, h: number, o: { dx?: number; dy?: number; zoom?: number } = {}): Paint {
  return (g, r) => {
    const fit = coverFit(w, h, r)
    const s = fit.sx * (o.zoom ?? 1)
    // the source window that lands on r, kept inside the picture
    const sw = Math.min(w, r.w / s), sh = Math.min(h, r.h / s)
    const cx = w / 2 + (o.dx ?? 0), cy = h / 2 + (o.dy ?? 0)
    const sx = Math.max(0, Math.min(w - sw, cx - sw / 2)), sy = Math.max(0, Math.min(h - sh, cy - sh / 2))
    g.drawImage(img, sx, sy, sw, sh, r.x, r.y, r.w, r.h)
  }
}

/** A window inside the stage: width and height as stage fractions, centre spread about the middle. */
export function windowRect(rng: Rng, stage: Size, o: { w?: [number, number]; h?: [number, number]; spread?: [number, number] } = {}): Rect {
  const [w0, w1] = o.w ?? [0.19, 0.55], [h0, h1] = o.h ?? [0.28, 0.67], [sx, sy] = o.spread ?? [0.27, 0.24]
  const w = stage.w * rng.range(w0, w1), h = stage.h * rng.range(h0, h1)
  const cx = stage.w * (0.5 + (rng() - 0.5) * sx), cy = stage.h * (0.5 + (rng() - 0.5) * sy)
  return { x: Math.max(0, Math.min(stage.w - w, cx - w / 2)), y: Math.max(0, Math.min(stage.h - h, cy - h / 2)), w, h }
}

/** `from` opened towards the full stage; `p` 0..1 (ease it yourself). */
export function growRect(from: Rect, stage: Size, p: number): Rect {
  const k = Math.max(0, Math.min(1, p))
  return { x: from.x * (1 - k), y: from.y * (1 - k), w: from.w + (stage.w - from.w) * k, h: from.h + (stage.h - from.h) * k }
}

/** A thin vertical strip: width and height as stage fractions. */
export function sliver(rng: Rng, stage: Size, o: { w?: [number, number]; h?: [number, number] } = {}): Rect {
  const [w0, w1] = o.w ?? [0.03, 0.08], [h0, h1] = o.h ?? [0.6, 1]
  const w = stage.w * rng.range(w0, w1), h = stage.h * rng.range(h0, h1)
  return { x: rng.range(0.1, 0.9) * stage.w - w / 2, y: (stage.h - h) * rng(), w, h }
}

/** The part of the stage beyond a cut line that alternates by `k` between `at` fractions. */
export function split(stage: Size, k: number, o: { at?: readonly number[]; axis?: 'x' | 'y' } = {}): Rect {
  const at = o.at ?? [0.68, 0.32]
  const f = at[((k % at.length) + at.length) % at.length]!
  return o.axis === 'y' ? { x: 0, y: stage.h * f, w: stage.w, h: stage.h * (1 - f) } : { x: stage.w * f, y: 0, w: stage.w * (1 - f), h: stage.h }
}

/**
 * Full stage and a centred box (`box` of the stage, default 0.5), switching every `every` hits
 * (default 1): `n` is the number of hits so far (`hitIn(...).k + 1`), so 0 is full and the first
 * hit boxes it. Switch on hits, never per frame: a per-frame letterbox is a strobe (a
 * photosensitivity hazard, WCAG 2.3.1).
 */
export function letterbox(stage: Size, n: number, o: { box?: number; every?: number } = {}): Rect {
  const boxed = Math.floor(n / Math.max(1, o.every ?? 1)) % 2 === 1
  if (!boxed) return { x: 0, y: 0, w: stage.w, h: stage.h }
  const b = o.box ?? 0.5
  return { x: (stage.w * (1 - b)) / 2, y: (stage.h * (1 - b)) / 2, w: stage.w * b, h: stage.h * b }
}

const isCircle = (s: Shape): s is Circle => 'r' in s
function trace(g: CanvasRenderingContext2D, s: Shape) {
  g.beginPath()
  if (isCircle(s)) g.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
  else g.rect(s.x, s.y, s.w, s.h)
}
const boundsOf = (s: Shape): Rect => (isCircle(s) ? { x: s.cx - s.r, y: s.cy - s.r, w: s.r * 2, h: s.r * 2 } : s)

// ---- drawing ---------------------------------------------------------------------------------

/** Two inks a picture is graded to: shadows to `dark`, highlights towards `light`. */
export interface Duotone { dark: string; light: string; contrast?: number }
export const DUO = {
  cobalt: { dark: '#04122a', light: '#4f86e8' },
  ice: { dark: '#04122a', light: '#c9d6ee' },
  steel: { dark: '#0a1424', light: '#9fb6d8' },
  ember: { dark: '#3a0c00', light: '#ff5a1e', contrast: 1.3 },
  mono: { dark: '#0a0a0a', light: '#e8e8e8' },
} satisfies Record<string, Duotone>

/** Paints `paint` over `rect` graded to a duotone (grey, contrast, multiply by light, screen by dark). */
export function duotone(g: CanvasRenderingContext2D, paint: Paint, rect: Rect, d: Duotone): void {
  g.save()
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'
  g.filter = `grayscale(1) contrast(${d.contrast ?? 1.15})`
  paint(g, rect)
  g.filter = 'none'
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = d.light
  g.fillRect(rect.x, rect.y, rect.w, rect.h)
  g.globalCompositeOperation = 'screen'
  g.fillStyle = d.dark
  g.fillRect(rect.x, rect.y, rect.w, rect.h)
  g.restore()
}

/** A colour block over what is drawn: `color` blend, then soft light in the same colour. */
export function tint(g: CanvasRenderingContext2D, shape: Shape, color: string): void {
  g.save()
  g.globalAlpha = 1
  g.fillStyle = color
  trace(g, shape)
  g.globalCompositeOperation = 'color'
  g.fill()
  g.globalCompositeOperation = 'soft-light'
  g.fill()
  g.restore()
}

/** Runs `draw` clipped to `shape`. */
export function within(g: CanvasRenderingContext2D, shape: Shape, draw: () => void): void {
  g.save()
  trace(g, shape)
  g.clip()
  draw()
  g.restore()
}

/** A rectangle's or circle's outline. */
export function outline(g: CanvasRenderingContext2D, shape: Shape, o: { color?: string; width?: number; dash?: number[] } = {}): void {
  g.save()
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'
  g.strokeStyle = o.color ?? 'rgba(255,255,255,0.9)'
  g.lineWidth = o.width ?? 2
  g.setLineDash(o.dash ?? [])
  trace(g, shape)
  g.stroke()
  g.restore()
}

const chromaScratch = new WeakMap<CanvasRenderingContext2D, [CanvasRenderingContext2D, CanvasRenderingContext2D]>()

/**
 * Chromatic aberration of what is drawn in `rect`: the red channel shifted −dx px and the blue +dx
 * px, green in place (a glitch on a kick: `chroma(g, full, 10 * pulse(since))`). It shifts and
 * never brightens, so it cannot strobe. Below half a pixel it does nothing. Reads this canvas only.
 */
export function chroma(g: CanvasRenderingContext2D, rect: Rect, dx: number): void {
  if (!(Math.abs(dx) >= 0.5)) return
  const m = g.getTransform()
  const w = Math.max(1, Math.round(rect.w * m.a)), h = Math.max(1, Math.round(rect.h * m.d))
  let pair = chromaScratch.get(g)
  if (!pair) {
    const mk = () => document.createElement('canvas').getContext('2d')!
    pair = [mk(), mk()]
    chromaScratch.set(g, pair)
  }
  const [src, ch] = pair
  for (const c of pair) {
    if (c.canvas.width !== w) c.canvas.width = w
    if (c.canvas.height !== h) c.canvas.height = h
    c.setTransform(1, 0, 0, 1, 0, 0)
  }
  src.globalCompositeOperation = 'copy'
  src.drawImage(g.canvas, rect.x * m.a + m.e, rect.y * m.d + m.f, w, h, 0, 0, w, h)
  g.save()
  g.globalAlpha = 1
  g.filter = 'none'
  g.beginPath()
  g.rect(rect.x, rect.y, rect.w, rect.h)
  g.clip()
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = '#000'
  g.fillRect(rect.x, rect.y, rect.w, rect.h)
  g.globalCompositeOperation = 'lighter'
  for (const [color, off] of [['#ff0000', -dx], ['#00ff00', 0], ['#0000ff', dx]] as const) {
    ch.globalCompositeOperation = 'copy'
    ch.drawImage(src.canvas, 0, 0)
    ch.globalCompositeOperation = 'multiply'
    ch.fillStyle = color
    ch.fillRect(0, 0, w, h)
    g.drawImage(ch.canvas, 0, 0, w, h, rect.x + off, rect.y, rect.w, rect.h)
  }
  g.restore()
}

export type WindowKind = 'tint' | 'pip' | 'grow' | 'sliver' | 'circle' | 'split' | 'letterbox' | 'outline'
export const WINDOW_KINDS: readonly WindowKind[] = ['tint', 'pip', 'grow', 'sliver', 'circle', 'split', 'letterbox', 'outline']

export interface WindowOptions {
  stage: Size
  shot: Shot
  t: number
  /** Unused since `letterbox` switches on hits; kept for callers that pass it. */
  frame?: number
  /** The shot's own footage and the one shown in windows (default: the base). */
  base: Paint
  insert?: Paint
  grade: Duotone
  insertGrade?: Duotone
  /** The complementary grade of `split` (default ember). */
  alt?: Duotone
  /** Colour block of `tint` and `grow` (default cobalt blue). */
  accent?: string
  /** Seconds before the shot's end that `grow` opens over (default 0.5). */
  grow?: number
  /** Seconds a `sliver` stays after its hit (default 0.2). */
  hold?: number
  /** Seconds into the shot before `letterbox` starts switching on hits (default 0). */
  delay?: number
  bg?: string
  salt?: string | number
  /** The hits that move the window (default tier 0). */
  sel?: HitSel
}

/**
 * Draws a shot: the background, the graded base and its window. The window moves on every hit of
 * the shot (seeded per hit). Returns the window's bounds (null when none shows) and the hit state.
 */
export function drawWindow(g: CanvasRenderingContext2D, kind: WindowKind, o: WindowOptions): { rect: Rect | null; k: number; since: number } {
  const { stage, shot, t } = o
  const full: Rect = { x: 0, y: 0, w: stage.w, h: stage.h }
  const { k, since } = hitIn(shot, t, o.sel)
  const rng = hitRng(shot, k, o.salt ?? kind)
  const insert = o.insert ?? o.base
  const ig = o.insertGrade ?? o.grade
  const accent = o.accent ?? '#0b5cff'
  g.save()
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = o.bg ?? '#000'
  g.fillRect(0, 0, stage.w, stage.h)
  g.restore()

  if (kind === 'letterbox') {
    const r = t - shot.at >= (o.delay ?? 0) ? letterbox(stage, k + 1) : full
    duotone(g, o.base, r, o.grade)
    return { rect: r, k, since }
  }
  duotone(g, o.base, full, o.grade)
  const win = windowRect(rng, stage)
  switch (kind) {
    case 'tint':
      tint(g, win, accent)
      return { rect: win, k, since }
    case 'outline':
      outline(g, win)
      return { rect: win, k, since }
    case 'pip':
      if (k < 0) return { rect: null, k, since }
      within(g, win, () => duotone(g, insert, full, ig))
      return { rect: win, k, since }
    case 'grow': {
      const left = shot.end - t, span = o.grow ?? 0.5
      const p = left < span ? 1 - left / span : 0
      const r = growRect(win, stage, p * p * (3 - 2 * p))
      within(g, r, () => { duotone(g, insert, full, ig); tint(g, r, accent) })
      return { rect: r, k, since }
    }
    case 'sliver': {
      if (k < 0 || since >= (o.hold ?? 0.2)) return { rect: null, k, since }
      const n = 1 + Math.floor(rng() * 3)
      const strips = Array.from({ length: n }, () => sliver(rng, stage))
      for (const r of strips) within(g, r, () => duotone(g, insert, full, ig))
      return { rect: strips[0]!, k, since }
    }
    case 'circle': {
      if (k < 0) return { rect: null, k, since }
      const c: Circle = { cx: stage.w / 2, cy: stage.h / 2, r: Math.min(stage.w, stage.h) * 0.24 }
      const flash: Duotone = { dark: ig.light, light: '#ffffff', contrast: ig.contrast }
      within(g, c, () => duotone(g, insert, full, k % 2 ? flash : ig))
      return { rect: boundsOf(c), k, since }
    }
    case 'split': {
      const r = split(stage, Math.max(0, k))
      within(g, r, () => duotone(g, o.base, full, o.alt ?? DUO.ember))
      return { rect: r, k, since }
    }
  }
}
