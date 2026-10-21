// schematic: a technical overlay over footage, after ComfyUI-Schematic's Overlay and Construction
// nodes (github.com/jeremieLouvaert/ComfyUI-Schematic, MIT, © 2026 Jeremie Louvaert; its placement,
// chain and weight rules reimplemented in Canvas2D): detection circles with "x,y" labels,
// connections, a dashed crosshair frame, a chain of circles with "n → x – y" joint labels, pixel
// zones, a ray pencil, a four-corner slate.
//
// The lattice look reads as live analysis instead: `BlockGrid` nodes on a block grid (smoothed,
// so they change slowly), straight `lattice` lines between them, `boxes` around `clusters` with
// float data, optical-flow `vectors`, "x,y" `dots` labels on a `labels` budget, and a few red and
// blue accents (`accentOf`, `rgbSplit`). Circles become rare: one faint `chain` at most.
// `analysis` draws that whole stack in one call and returns its labels.
//
// Marks come in three weight classes (datum / construct / fine). Drawers stroke their marks and
// return their labels; `labels` places every label of the frame at once, dropping any it cannot
// set clear of the others and of the safe margin, and declares the drawn ones to `f.audit.text`.
//
//   const st = style(f.stage, { palette: 'whiteOnDark', font: '"Hud Mono", monospace' })
//   const pts = pickPoints(cands, { max: 8, spacing: 110, seed: 'clip', keep: previousIds })
//   crosshair(g, cx, cy, st)
//   connections(g, pts, 220, age, st)
//   labels(g, [...detections(g, pts, age, st), ...slate(st, { tl: 'SCHEMATIC' })], st, { audit: f.audit })

import { seeded } from '@cueframe/core'

export interface Rect { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }
export interface XY { x: number; y: number }
/** A candidate point: from a track with a `score` channel, a detection pass, or data. */
export interface Cand { id?: string; x: number; y: number; score: number }
/** A picked point: radius from its score (normalised 0..1 to the best candidate). */
export interface Det { id: string; x: number; y: number; r: number; score: number }
/** Anything with `audit.text`'s signature (pass `f.audit`). */
export interface AuditSink { text(rect: Rect, label: string): void }

// ---- palettes, weights, style ----------------------------------------------------------------

export interface Palette { bg: string; ink: string }
export const PALETTES = {
  whiteOnDark: { bg: '#0a0a0a', ink: '#d8d8d8' },
  blackOnLight: { bg: '#f0eeea', ink: '#111111' },
  goldOnDark: { bg: '#111110', ink: '#c9a84c' },
  greenOnDark: { bg: '#080a08', ink: '#44cc66' },
} satisfies Record<string, Palette>
export type PaletteName = keyof typeof PALETTES

/** Stroke widths per 1000 px of the short side. Every mark is drawn at one of them. */
export const WEIGHTS = { datum: 1.9, construct: 1, fine: 0.55 } as const
export type Weight = keyof typeof WEIGHTS

/** Glitch accents: a few marks in red or blue among the ink. */
export interface Accents { red: string; blue: string }
export const ACCENTS: Accents = { red: '#ff2a3a', blue: '#2ad4ff' }
/** The colour of a mark: the palette's ink or one of the two accents. */
export type Tone = 'ink' | 'red' | 'blue'

export interface Style {
  w: number
  h: number
  bg: string
  ink: string
  accents: Accents
  /** Label font family, label size in px, safe margin in px. */
  font: string
  size: number
  margin: number
  /** px per weight unit (short side / 1000 × `weight`). */
  unit: number
  alpha: number
}

const HEX = /^#([0-9a-f]{6})$/i
function rgb(hex: string): [number, number, number] {
  const m = HEX.exec(hex)
  if (!m) throw new Error(`schematic: colours are #rrggbb, got "${hex}"`)
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * A style for `stage`: palette by name or `{ bg, ink }`, sizes scaled to the short side (1080 px
 * reference), glitch `accents` (default red #ff2a3a and blue #2ad4ff).
 */
export function style(stage: Size, o: { palette?: PaletteName | Palette; font?: string; size?: number; margin?: number; weight?: number; alpha?: number; accents?: Partial<Accents> } = {}): Style {
  const p = typeof o.palette === 'string' ? PALETTES[o.palette] : o.palette ?? PALETTES.whiteOnDark
  if (!p) throw new Error(`schematic: unknown palette "${String(o.palette)}" (${Object.keys(PALETTES).join(', ')})`)
  const accents = { ...ACCENTS, ...o.accents }
  rgb(p.bg); rgb(p.ink); rgb(accents.red); rgb(accents.blue)
  const cmin = Math.min(stage.w, stage.h)
  return {
    w: stage.w, h: stage.h, bg: p.bg, ink: p.ink, accents,
    font: o.font ?? 'monospace',
    size: o.size ?? Math.round((14 * cmin) / 1080),
    margin: o.margin ?? Math.round((64 * cmin) / 1080),
    unit: (cmin / 1000) * (o.weight ?? 1),
    alpha: o.alpha ?? 1,
  }
}

/** The ink (or an accent `tone`) at alpha `a` (times the style's alpha). */
export function ink(st: Style, a = 1, tone: Tone = 'ink'): string {
  const [r, g, b] = rgb(tone === 'ink' ? st.ink : st.accents[tone])
  return `rgba(${r},${g},${b},${+Math.max(0, Math.min(1, a * st.alpha)).toFixed(3)})`
}

/** A stable 0..1 hash of a string (FNV-1a, murmur3 finaliser): the same id gets the same value in every frame. */
export function hash01(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // murmur3's finaliser: short ids that differ in one character spread over the whole range
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/**
 * A stable accent for a small `share` of marks (default 0.1): by the hash of `id`, half of the
 * share red, half blue, the rest ink. A mark keeps its colour as long as it keeps its id.
 */
export function accentOf(id: string, share = 0.1): Tone {
  const u = hash01(`accent:${id}`)
  return u < share / 2 ? 'red' : u < share ? 'blue' : 'ink'
}

/**
 * A glitch on a mark: `draw(tone)` three times, the red copy offset by −dx px, the blue by +dx and
 * the `top` tone (default ink) on top, unshifted. Drive dx from a decaying pulse
 * (`6 * pulse(since)`); below a quarter pixel only the top copy is drawn.
 */
export function rgbSplit(g: CanvasRenderingContext2D, draw: (tone: Tone) => void, dx: number, o: { top?: Tone } = {}): void {
  if (Math.abs(dx) >= 0.25) {
    for (const [tone, off] of [['red', -dx], ['blue', dx]] as const) {
      g.save()
      g.translate(off, 0)
      draw(tone)
      g.restore()
    }
  }
  draw(o.top ?? 'ink')
}

/** A weight class in px. */
// float32 already: Canvas2D stores lineWidth as float32
export const lw = (st: Style, w: Weight) => Math.fround(Math.max(0.5, st.unit * WEIGHTS[w]))

const ease = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3
const r0 = (n: number) => Math.round(n)

function pen(g: CanvasRenderingContext2D, st: Style, w: Weight, a: number, dash: number[] = [], tone: Tone = 'ink') {
  g.strokeStyle = ink(st, a, tone)
  g.lineWidth = lw(st, w)
  g.setLineDash(dash)
  g.lineCap = 'butt'
}
function begin(g: CanvasRenderingContext2D) {
  g.save()
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'
  g.filter = 'none'
}

// ---- points ----------------------------------------------------------------------------------

export interface PickOptions {
  /** At most this many points (default 8), at least `spacing` px apart (default 100). */
  max?: number
  spacing?: number
  /** Radius range before jitter (default 10..44). */
  minR?: number
  maxR?: number
  seed?: string | number
  /** Drop candidates below this normalised score. */
  threshold?: number
  within?: Rect
  /** The previous selection's ids: those still valid stay, in their order. */
  keep?: readonly string[]
  /** With `keep`, at most this many kept points give way to better new ones (default 2). */
  swap?: number
}

const radius = (o: PickOptions, id: string, s: number) =>
  ((o.minR ?? 10) + ((o.maxR ?? 44) - (o.minR ?? 10)) * s) * (0.5 + seeded(`schematic:${o.seed ?? 0}:${id}`)())

/**
 * The node's placement rule: candidates by score (best first, ties in input order), each kept if
 * at least `spacing` from every kept one, up to `max`. Radius `(minR + (maxR − minR) × score) × jitter`,
 * jitter 0.5..1.5 seeded per point id, so a tracked point keeps its radius from frame to frame.
 * With `keep`, the previous points that are still candidates stay and only open slots, plus at most
 * `swap` of the weakest kept ones, go to new points: the overlay changes on a scan without starting over.
 */
export function pickPoints(cands: readonly Cand[], o: PickOptions = {}): Det[] {
  const max = o.max ?? 8, spacing = o.spacing ?? 100
  const best = cands.reduce((m, c) => Math.max(m, c.score), 0)
  const norm = best > 0 ? best : 1
  const inside = (c: Cand) => !o.within || (c.x >= o.within.x && c.y >= o.within.y && c.x <= o.within.x + o.within.w && c.y <= o.within.y + o.within.h)
  const all = cands.map((c, i) => ({ c, id: c.id ?? `#${i}`, i, s: c.score / norm }))
    .filter((e) => e.s >= (o.threshold ?? 0) && Number.isFinite(e.c.x) && Number.isFinite(e.c.y) && inside(e.c))
  const d2 = spacing * spacing
  const clear = (e: { c: Cand }, taken: readonly { c: Cand }[]) => !taken.some((p) => (p.c.x - e.c.x) ** 2 + (p.c.y - e.c.y) ** 2 < d2)
  type E = (typeof all)[number]

  const kept: E[] = []
  if (o.keep) {
    const byId = new Map(all.map((e) => [e.id, e]))
    for (const id of o.keep) {
      const e = byId.get(id)
      if (e && kept.length < max && !kept.includes(e) && clear(e, kept)) kept.push(e)
    }
  }
  const swap = o.keep ? Math.min(o.swap ?? 2, kept.length) : 0
  const fresh: E[] = []
  for (const e of [...all].sort((a, b) => b.s - a.s || a.i - b.i)) {
    if (fresh.length >= max - kept.length + swap) break
    if (!kept.includes(e) && clear(e, [...kept, ...fresh])) fresh.push(e)
  }
  // fill open slots, then let the best new points replace the weakest kept ones
  const open = Math.max(0, max - kept.length)
  const chosen = [...kept, ...fresh.slice(0, open)]
  const rest = fresh.slice(open)
  const weakest = [...kept].sort((a, b) => a.s - b.s || b.i - a.i)
  for (let n = 0; n < rest.length && n < weakest.length; n++) {
    if (rest[n]!.s <= weakest[n]!.s) break
    chosen[chosen.indexOf(weakest[n]!)] = rest[n]!
  }
  return chosen.map((e) => ({ id: e.id, x: e.c.x, y: e.c.y, r: radius(o, e.id, e.s), score: e.s }))
}

/** The points `ids` where the candidates are now (for a selection held between scans); missing ids are skipped. */
export function follow(ids: readonly string[], cands: readonly Cand[], o: PickOptions = {}): Det[] {
  const best = cands.reduce((m, c) => Math.max(m, c.score), 0) || 1
  const byId = new Map(cands.map((c, i) => [c.id ?? `#${i}`, c]))
  return ids.flatMap((id) => {
    const c = byId.get(id)
    return c ? [{ id, x: c.x, y: c.y, r: radius(o, id, c.score / best), score: c.score / best }] : []
  })
}

const scanCache = new Map<string, string[][]>()

/**
 * A selection that persists from scan to scan as a pure function of the scan index: scan `k` is
 * `step(k, ids of scan k − 1)`, computed from scan 0 up and memoised under `key` (one key per shot,
 * say). Scan 0 gets `keep` undefined. Returns the ids; place them each frame with `follow`.
 */
export function scanSelect(key: string, k: number, step: (k: number, keep: readonly string[] | undefined) => readonly Det[]): string[] {
  let list = scanCache.get(key)
  if (!list) scanCache.set(key, (list = []))
  for (let i = list.length; i <= Math.max(0, k); i++) list.push(step(i, i > 0 ? list[i - 1] : undefined).map((d) => d.id))
  return list[Math.max(0, k)]!
}

/** From `a` to `b` over `dur` s after a change (cubic ease-out): a focus that moves rather than jumps. */
export function glide(a: XY, b: XY, since: number, dur = 0.22): XY {
  const k = ease(since / dur)
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

/**
 * The dominant motion direction (radians) of points matched by id between `prev` and `now`,
 * weighted by distance moved: rain streaks, a bird's flight. Null when nothing moved more than `still` px.
 */
export function flowAngle(now: readonly { id?: string; x: number; y: number }[], prev: readonly { id?: string; x: number; y: number }[], still = 0.5): number | null {
  const before = new Map(prev.filter((p) => p.id !== undefined).map((p) => [p.id!, p]))
  let sx = 0, sy = 0, moved = false
  for (const p of now) {
    const q = p.id === undefined ? undefined : before.get(p.id)
    if (!q) continue
    const dx = p.x - q.x, dy = p.y - q.y
    if (Math.hypot(dx, dy) > still) moved = true
    sx += dx; sy += dy
  }
  return moved && Math.hypot(sx, sy) > 1e-9 ? Math.atan2(sy, sx) : null
}

/** How busy the overlay is, from 0 (calibrating: faint brackets, two or three points) to 1 (a drop). */
export interface Density { points: number; connect: number; alpha: number; labels: boolean; reticle: 'brackets' | 'cross'; chain: boolean; rays: boolean; zones: number }
export function density(d: number): Density {
  const k = Math.max(0, Math.min(1, d))
  return {
    points: Math.round(2 + 6 * k), connect: Math.round(120 + 100 * k), alpha: 0.45 + 0.55 * k,
    labels: k >= 0.25, reticle: k < 0.5 ? 'brackets' : 'cross', chain: k >= 0.5, rays: k >= 0.6, zones: k >= 0.7 ? 1 : 0,
  }
}

/**
 * Candidates from a picture: one per `block` px square, scored by ComfyUI-Schematic's "combined"
 * rule, luma contrast × (1 + |mean − 128| / 128). Run it in mount on `getImageData`.
 */
export function blockPoints(img: { width: number; height: number; data: ArrayLike<number> }, block = 21): Cand[] {
  const out: Cand[] = []
  const cols = Math.floor(img.width / block), rows = Math.floor(img.height / block)
  for (let by = 0; by < rows; by++) for (let bx = 0; bx < cols; bx++) {
    let s = 0, s2 = 0
    for (let y = by * block; y < (by + 1) * block; y++) for (let x = bx * block; x < (bx + 1) * block; x++) {
      const i = (y * img.width + x) * 4
      const l = 0.299 * img.data[i]! + 0.587 * img.data[i + 1]! + 0.114 * img.data[i + 2]!
      s += l; s2 += l * l
    }
    const n = block * block, m = s / n
    const c = Math.sqrt(Math.max(0, s2 / n - m * m))
    out.push({ id: `b${bx}_${by}`, x: bx * block + block / 2, y: by * block + block / 2, score: c * (1 + Math.abs(m - 128) / 128) })
  }
  return out
}

/** Every pair (i < j) closer than `dist`. */
export function pairs(pts: readonly XY[], dist: number): [number, number][] {
  const out: [number, number][] = []
  const d2 = dist * dist
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if ((pts[i]!.x - pts[j]!.x) ** 2 + (pts[i]!.y - pts[j]!.y) ** 2 < d2) out.push([i, j])
  }
  return out
}

// ---- block grids ---------------------------------------------------------------------------

/** `grid.json` (`cueframe-py footage --grid B`): cell (c, r) is centred at `(ox + (c + 0.5)·block, oy + (r + 0.5)·block)` plate px. */
export interface GridMeta {
  version?: number
  block: number
  cols: number
  rows: number
  ox: number
  oy: number
  frames: number
  w: number
  h: number
  /** The bytes, next to grid.json (default `grid.u8`). */
  file?: string
  score?: string
}
/** Plate px → canvas px: `o + px × s` (what a frame source's `draw` returns). */
export interface Fit { sx: number; sy: number; ox: number; oy: number }
/** A grid cell picked as a node, in canvas px; `age` in frames when `nodes` was asked for it. */
export interface GridNode { id: string; x: number; y: number; score: number; col: number; row: number; age?: number }

export interface NodeOptions {
  /** Temporal box average over frames k − smooth … k + smooth (default 2; clamped at the clip's ends). */
  smooth?: number
  /** Smoothed score 0..1 a cell needs (default 0.35). */
  threshold?: number
  /** At most this many nodes (default 24), at least `spacing` cells apart in column or row (default 2). */
  max?: number
  spacing?: number
  /** Plate px → canvas px (default identity). */
  fit?: Fit
  /** Only cells whose centre lands in this canvas rect. */
  within?: Rect
  /** Count each node's age: frames it has been a node, looking back at most this many (default 0: no age). */
  age?: number
  /** The first frame that counts for `age` (a shot's first frame: every node grows in on the cut). */
  from?: number
}

/**
 * A clip's block-score grid: `frames × rows × cols` bytes (frame-major, then row-major), the
 * combined score scaled to 0..255. Load it in mount (`BlockGrid.load('build/plates/rain')`) or build
 * one from your own analysis (`BlockGrid.synth`). `nodes` is pure and memoised.
 */
export class BlockGrid {
  readonly meta: GridMeta
  readonly bytes: Uint8Array
  private memo = new Map<string, Omit<GridNode, 'age'>[]>()

  constructor(meta: GridMeta, bytes: Uint8Array) {
    for (const k of ['block', 'cols', 'rows', 'frames', 'w', 'h'] as const) {
      if (!(Number.isInteger(meta[k]) && meta[k] > 0)) throw new Error(`schematic: grid.json needs a whole ${k} > 0, got ${String(meta[k])}`)
    }
    if (!Number.isFinite(meta.ox) || !Number.isFinite(meta.oy)) throw new Error('schematic: grid.json needs ox and oy')
    const n = meta.frames * meta.rows * meta.cols
    if (bytes.length !== n) throw new Error(`schematic: ${meta.file ?? 'grid.u8'} has ${bytes.length} bytes; grid.json says frames × rows × cols = ${n}`)
    this.meta = meta
    this.bytes = bytes
  }

  /** Reads `<dir>/grid.json` and its bytes from the project (the same paths as `ctx.frames(dir)`). */
  static async load(dir: string, io: { get: (url: string) => Promise<Response> } = { get: (u) => fetch(u) }): Promise<BlockGrid> {
    const base = `/${dir.replace(/^\.?\/+/, '').replace(/\/+$/, '')}/`
    const read = async (file: string) => {
      const res = await io.get(base + file)
      if (!res.ok) throw new Error(`schematic: ${base}${file} not found (${res.status}); run cueframe-py footage --grid`)
      return res
    }
    const meta = await (await read('grid.json')).json() as GridMeta
    return new BlockGrid(meta, new Uint8Array(await (await read(meta.file ?? 'grid.u8')).arrayBuffer()))
  }

  /** A grid from a score function `(k, col, row) → 0..1` (your own analysis, tests, generated pictures). */
  static synth(meta: GridMeta, score: (k: number, col: number, row: number) => number): BlockGrid {
    const bytes = new Uint8Array(meta.frames * meta.rows * meta.cols)
    let i = 0
    for (let k = 0; k < meta.frames; k++) for (let r = 0; r < meta.rows; r++) for (let c = 0; c < meta.cols; c++) {
      bytes[i++] = Math.round(255 * Math.max(0, Math.min(1, score(k, c, r) || 0)))
    }
    return new BlockGrid(meta, bytes)
  }

  get frames(): number { return this.meta.frames }
  get cols(): number { return this.meta.cols }
  get rows(): number { return this.meta.rows }

  private frame(k: number) { return Math.max(0, Math.min(this.meta.frames - 1, Math.round(k))) }

  /** Sum of the bytes of cell `i` (row-major) over frames k − s … k + s, each clamped to the clip. */
  private sum(k: number, i: number, s: number): number {
    const per = this.meta.rows * this.meta.cols
    let t = 0
    for (let j = -s; j <= s; j++) t += this.bytes[this.frame(k + j) * per + i]!
    return t
  }

  /** Cell (c, r)'s score 0..1 at frame k (rounded, clamped), averaged over ±`smooth` frames. */
  score(k: number, c: number, r: number, smooth = 0): number {
    if (c < 0 || r < 0 || c >= this.meta.cols || r >= this.meta.rows) return 0
    const s = Math.max(0, Math.round(smooth))
    return this.sum(k, r * this.meta.cols + c, s) / (255 * (2 * s + 1))
  }

  /** Cell (c, r)'s centre in plate px, or in canvas px through `fit`. */
  centre(c: number, r: number, fit?: Fit): XY {
    const x = this.meta.ox + (c + 0.5) * this.meta.block, y = this.meta.oy + (r + 0.5) * this.meta.block
    return fit ? { x: fit.ox + x * fit.sx, y: fit.oy + y * fit.sy } : { x, y }
  }

  /**
   * The nodes at frame k: cells whose smoothed score reaches `threshold`, best first (ties in
   * row-major order), each at least `spacing` cells from every kept one in column or row, up to
   * `max`. Ids are `c<col>_<row>`. Smoothing makes the set change slowly, so lines drawn between
   * nodes flow from frame to frame instead of flickering. With `age`, each node gets the number of
   * frames before k it has been a node without a break.
   */
  nodes(k: number, o: NodeOptions = {}): GridNode[] {
    const now = this.pick(this.frame(k), o)
    if (!(o.age && o.age > 0)) return now.map((n) => ({ ...n }))
    const from = o.from ?? 0
    return now.map((n) => {
      let age = 0
      for (let j = this.frame(k) - 1; j >= Math.max(from, this.frame(k) - o.age!); j--) {
        if (!this.pick(j, o).some((m) => m.id === n.id)) break
        age++
      }
      return { ...n, age }
    })
  }

  private pick(k: number, o: NodeOptions): Omit<GridNode, 'age'>[] {
    const s = Math.max(0, Math.round(o.smooth ?? 2))
    const thr = o.threshold ?? 0.35, max = o.max ?? 24, sp = Math.max(1, Math.round(o.spacing ?? 2))
    const fit = o.fit ?? { sx: 1, sy: 1, ox: 0, oy: 0 }
    const key = JSON.stringify([k, s, thr, max, sp, fit, o.within ?? null])
    const hit = this.memo.get(key)
    if (hit) return hit
    const { cols, rows } = this.meta
    const need = thr * 255 * (2 * s + 1)
    const cand: { i: number; t: number }[] = []
    for (let i = 0; i < cols * rows; i++) {
      const t = this.sum(k, i, s)
      if (t < need || t === 0) continue
      if (o.within) {
        const p = this.centre(i % cols, Math.floor(i / cols), fit), w = o.within
        if (p.x < w.x || p.y < w.y || p.x > w.x + w.w || p.y > w.y + w.h) continue
      }
      cand.push({ i, t })
    }
    cand.sort((a, b) => b.t - a.t || a.i - b.i)
    const blocked = new Uint8Array(cols * rows)
    const out: Omit<GridNode, 'age'>[] = []
    for (const { i, t } of cand) {
      if (out.length >= max) break
      if (blocked[i]) continue
      const c = i % cols, r = Math.floor(i / cols)
      for (let rr = Math.max(0, r - sp + 1); rr < Math.min(rows, r + sp); rr++) for (let cc = Math.max(0, c - sp + 1); cc < Math.min(cols, c + sp); cc++) blocked[rr * cols + cc] = 1
      const p = this.centre(c, r, fit)
      out.push({ id: `c${c}_${r}`, x: p.x, y: p.y, score: t / (255 * (2 * s + 1)), col: c, row: r })
    }
    if (this.memo.size > 512) this.memo.delete(this.memo.keys().next().value!)
    this.memo.set(key, out)
    return out
  }
}

/** A track position as `source.track` gives it: `visible: false` (outside the track's life, out of frame or occluded) counts as missing. */
export type TrackXY = XY & { visible?: boolean }

/** The sample's position, or null when it is missing, invisible or not finite. */
const usable = (p: TrackXY | null | undefined): XY | null =>
  p && p.visible !== false && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null

/**
 * Grid nodes carried by the picture's motion: each node moves by the mean displacement, since its
 * birth (k − age), of the tracked points that were within `radius` of it then (weighted by
 * closeness), capped at `cap` px. Grid cells stay the nodes' identity; the lattice glides with a
 * moving subject instead of sieving it, and hands over when the cell's score drops. Pure: `at(id, j)`
 * is a track's position at frame j (or null), e.g. through `source.track(id, j, fit)`. A track
 * counts only when both its samples (k − age and k) are usable: present, finite and not
 * `visible: false`, so a track born after the node, dead by k, or occluded at either end is left out.
 */
export function advect<N extends GridNode>(nodes: readonly N[], ids: readonly string[], k: number, at: (id: string, j: number) => TrackXY | null | undefined, o: { radius?: number; cap?: number } = {}): N[] {
  const radius = o.radius ?? 140, cap = o.cap ?? 240
  return nodes.map((n) => {
    const a = Math.round(n.age ?? 0)
    if (a <= 0) return n
    let sx = 0, sy = 0, sw = 0
    for (const id of ids) {
      const p0 = usable(at(id, k - a)), p1 = usable(at(id, k))
      if (!p0 || !p1) continue
      const d = Math.hypot(p0.x - n.x, p0.y - n.y)
      if (d > radius) continue
      const w = 1 - d / radius
      sx += (p1.x - p0.x) * w
      sy += (p1.y - p0.y) * w
      sw += w
    }
    if (sw === 0) return n
    let dx = sx / sw, dy = sy / sw
    const len = Math.hypot(dx, dy)
    if (len > cap) { dx *= cap / len; dy *= cap / len }
    return { ...n, x: n.x + dx, y: n.y + dy }
  })
}

/**
 * Positions over the last `len` frames, oldest first: `at(j)` for j = k − len … k, after the last
 * missing one (a KLT track through `source.track`). A sample that is null, not finite or
 * `visible: false` (before the track's birth, after its death, occluded) is missing, so a trail
 * starts after the latest gap and is empty when the point is not visible at k.
 */
export function trail(k: number, len: number, at: (j: number) => TrackXY | null | undefined): XY[] {
  const out: XY[] = []
  for (let j = k; j >= k - len; j--) {
    const p = usable(at(j))
    if (!p) break
    out.push({ x: p.x, y: p.y })
  }
  return out.reverse()
}

/** A group of nodes linked by grid adjacency; `id` is its first node's (smallest row, then column), stable while that node lives. */
export interface Cluster { id: string; nodes: GridNode[]; x: number; y: number; w: number; h: number; score: number }

/**
 * Single-link groups: two nodes belong together when they are at most `link` cells apart in
 * column and row (default 3). Groups smaller than `min` (default 2) are left out. Sorted by id.
 */
export function clusters(nodes: readonly GridNode[], link = 3, o: { min?: number } = {}): Cluster[] {
  const up = nodes.map((_, i) => i)
  const root = (i: number): number => (up[i] === i ? i : (up[i] = root(up[i]!)))
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i]!, b = nodes[j]!
    if (Math.abs(a.col - b.col) <= link && Math.abs(a.row - b.row) <= link) up[root(i)] = root(j)
  }
  const groups = new Map<number, GridNode[]>()
  nodes.forEach((n, i) => {
    const r = root(i)
    groups.set(r, [...(groups.get(r) ?? []), n])
  })
  const first = (a: GridNode, b: GridNode) => a.row - b.row || a.col - b.col
  return [...groups.values()].filter((g) => g.length >= (o.min ?? 2)).map((g) => {
    const ns = [...g].sort(first)
    const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y)
    const x = Math.min(...xs), y = Math.min(...ys)
    return { id: ns[0]!.id, nodes: ns, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, score: ns.reduce((m, n) => m + n.score, 0) / ns.length }
  }).sort((a, b) => first(a.nodes[0]!, b.nodes[0]!))
}

// ---- labels ----------------------------------------------------------------------------------

export interface Label {
  text: string
  x: number
  y: number
  align?: 'left' | 'right' | 'center'
  base?: 'top' | 'middle' | 'bottom'
  /** px; default the style's size. */
  size?: number
  alpha?: number
  /** Placed first (higher first); ties keep their order. */
  priority?: number
  /** Only at its own position, no alternates (slate corners). */
  fixed?: boolean
  /** Ink or an accent. */
  tone?: Tone
  /** With a `budget`: labels with an id compete for it, chosen by the id's hash, then `score`. */
  id?: string
  score?: number
}
export interface Placed extends Label { box: Rect; dx: number; dy: number }

/** Box of a label of width `w`, height `h` at its anchor. */
function boxAt(l: Label, w: number, h: number, dx: number, dy: number): Rect {
  const x = l.x + dx, y = l.y + dy
  const x0 = l.align === 'right' ? x - w : l.align === 'center' ? x - w / 2 : x
  const y0 = l.base === 'top' ? y : l.base === 'bottom' ? y - h : y - h / 2
  return { x: x0, y: y0, w, h }
}
const hits = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export interface PlaceOptions {
  stage: Size
  margin: number
  size: number
  measure: (text: string, size: number) => number
  pad?: number
  avoid?: readonly Rect[]
  /**
   * At most this many labels with an `id` per frame. They are placed after every label without
   * one, in the order of their id's hash (then score), until `budget` are set: the same ids win
   * in every frame, so labels do not flicker between neighbours.
   */
  budget?: number
}

/**
 * The collision resolver: by priority, each label tries its own position, then above, below, right,
 * left; it takes the first box clear of the margin and of every placed box (and `avoid`), or is
 * dropped. Dropping thins the annotation exactly where the geometry is densest. A text repeated
 * near the same anchor is dropped too. Pure; `measure` gives a text's width at a size.
 */
export function placeLabels(items: readonly Label[], o: PlaceOptions): { placed: Placed[]; dropped: Label[] } {
  const pad = o.pad ?? 1.6
  const taken: Rect[] = [...(o.avoid ?? [])]
  const placed: Placed[] = [], dropped: Label[] = []
  const budgeted = (l: Label) => o.budget !== undefined && l.id !== undefined
  const all = items.map((l, i) => ({ l, i, h: budgeted(l) ? hash01(`label:${l.id!}`) : 0 }))
  const order = [
    ...all.filter((e) => !budgeted(e.l)).sort((a, b) => (b.l.priority ?? 0) - (a.l.priority ?? 0) || a.i - b.i),
    ...all.filter((e) => budgeted(e.l)).sort((a, b) => a.h - b.h || (b.l.score ?? 0) - (a.l.score ?? 0) || a.i - b.i),
  ]
  let spent = 0
  const m = o.margin
  const seen = new Map<string, XY[]>()
  for (const { l } of order) {
    if (budgeted(l) && spent >= o.budget!) { dropped.push(l); continue }
    // the same text near the same anchor (a chain centre on a detection) is set once
    const twins = seen.get(l.text) ?? []
    const near = 4 * (l.size ?? o.size)
    if (twins.some((p) => Math.abs(p.x - l.x) < near && Math.abs(p.y - l.y) < near)) { dropped.push(l); continue }
    seen.set(l.text, [...twins, { x: l.x, y: l.y }])
    const size = l.size ?? o.size
    const w = o.measure(l.text, size), h = size
    const tries: [number, number][] = l.fixed ? [[0, 0]] : [[0, 0], [0, -h - 3], [0, h + 3], [6, 0], [-6, 0], [0, -2 * h - 5], [10, -h - 3]]
    let done = false
    for (const [dx, dy] of tries) {
      const b = boxAt(l, w, h, dx, dy)
      const p = { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad }
      if (b.x < m || b.y < m || b.x + b.w > o.stage.w - m || b.y + b.h > o.stage.h - m) continue
      if (taken.some((r) => hits(p, r))) continue
      taken.push(p)
      placed.push({ ...l, box: b, dx, dy })
      if (budgeted(l)) spent++
      done = true
      break
    }
    if (!done) dropped.push(l)
  }
  return { placed, dropped }
}

/** Places and draws a frame's labels (see `placeLabels`, `budget` included) and declares each drawn one to `audit`. */
export function labels(g: CanvasRenderingContext2D, items: readonly Label[], st: Style, o: { audit?: AuditSink; margin?: number; avoid?: readonly Rect[]; budget?: number } = {}): { placed: Placed[]; dropped: Label[] } {
  begin(g)
  const measure = (text: string, size: number) => {
    g.font = `400 ${size}px ${st.font}`
    return g.measureText(text).width
  }
  const res = placeLabels(items, { stage: st, margin: o.margin ?? st.margin, size: st.size, measure, avoid: o.avoid, budget: o.budget })
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  for (const l of res.placed) {
    g.font = `400 ${l.size ?? st.size}px ${st.font}`
    g.fillStyle = ink(st, l.alpha ?? 1, l.tone)
    g.fillText(l.text, l.box.x, l.box.y + l.box.h / 2)
    o.audit?.text(l.box, l.text)
  }
  g.restore()
  return res
}

// ---- apparatus -------------------------------------------------------------------------------

/** Seconds since the points were picked: one for all, or per point (since each first appeared, for a kept selection). */
export type Age = number | ((p: Det, i: number) => number)
const ageOf = (age: Age, p: Det, i: number) => (typeof age === 'number' ? age : age(p, i))

/**
 * Detection circles: outline (fine, alpha by score), centre dot, an "x,y" label right of the
 * circle. Each grows in over `grow` s from its `age`, staggered by rank.
 */
export function detections(g: CanvasRenderingContext2D, pts: readonly Det[], age: Age, st: Style, o: { stagger?: number; grow?: number; shape?: 'circle' | 'square'; labels?: boolean } = {}): Label[] {
  const out: Label[] = []
  begin(g)
  pts.forEach((p, i) => {
    const k = ease((ageOf(age, p, i) - i * (o.stagger ?? 0.018)) / (o.grow ?? 0.16))
    if (k <= 0) return
    const r = p.r * (0.6 + 0.4 * k)
    pen(g, st, 'fine', (0.3 + 0.4 * p.score) * k)
    g.beginPath()
    if (o.shape === 'square') g.rect(p.x - r, p.y - r, r * 2, r * 2)
    else g.arc(p.x, p.y, r, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = ink(st, (0.7 + 0.3 * p.score) * k)
    g.beginPath()
    g.arc(p.x, p.y, Math.max(1.5, st.unit * 2.5), 0, Math.PI * 2)
    g.fill()
    if (k > 0.6 && o.labels !== false) out.push({ text: `${r0(p.x)},${r0(p.y)}`, x: p.x + p.r + st.size * 0.4, y: p.y, alpha: 0.75, priority: 1 + p.score, id: p.id, score: p.score })
  })
  g.restore()
  return out
}

/** Lines between every pair closer than `dist` (fine), each drawn on from the earlier point over `grow` s from the younger end's age. */
export function connections(g: CanvasRenderingContext2D, pts: readonly Det[], dist: number, age: Age, st: Style, o: { grow?: number; alpha?: number } = {}): void {
  begin(g)
  pen(g, st, 'fine', (o.alpha ?? 0.55))
  g.lineCap = 'round'
  g.beginPath()
  for (const [i, j] of pairs(pts, dist)) {
    const a = pts[i]!, b = pts[j]!
    const k = ease(Math.min(ageOf(age, a, i), ageOf(age, b, j)) / (o.grow ?? 0.25))
    if (k <= 0) continue
    g.moveTo(a.x, a.y)
    g.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)
  }
  g.stroke()
  g.restore()
}

/**
 * The reticle at (x, y). `cross`: a dashed full-frame cross, a dashed square about the focus and an
 * asterisk. `brackets`: four corner crop marks `box` px wide, and a centre tick. `scale` grows the
 * square or brackets (a kick pulse: `1 + 0.25 * pulse(since)`).
 */
export function crosshair(g: CanvasRenderingContext2D, x: number, y: number, st: Style, o: { mode?: 'cross' | 'brackets'; box?: number; star?: number; arms?: number; dash?: number; alpha?: number; scale?: number } = {}): void {
  const cmin = Math.min(st.w, st.h)
  const sc = o.scale ?? 1
  const d = o.dash ?? st.unit * 7
  begin(g)
  if (o.mode === 'brackets') {
    const b = (o.box ?? cmin * 0.075) * sc, h = b / 2, arm = b * 0.28
    pen(g, st, 'construct', o.alpha ?? 0.85)
    g.beginPath()
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      g.moveTo(x + sx * h, y + sy * (h - arm)); g.lineTo(x + sx * h, y + sy * h); g.lineTo(x + sx * (h - arm), y + sy * h)
    }
    const c = Math.max(4, b * 0.08)
    g.moveTo(x - c, y); g.lineTo(x + c, y)
    g.moveTo(x, y - c); g.lineTo(x, y + c)
    g.stroke()
    g.restore()
    return
  }
  const box = (o.box ?? cmin * 0.16) * sc, star = (o.star ?? cmin * 0.035) * sc
  pen(g, st, 'construct', o.alpha ?? 0.6, [d, d])
  g.beginPath()
  g.moveTo(0, y); g.lineTo(st.w, y)
  g.moveTo(x, 0); g.lineTo(x, st.h)
  g.rect(x - box / 2, y - box / 2, box, box)
  g.stroke()
  pen(g, st, 'construct', 0.9)
  g.beginPath()
  const n = o.arms ?? 3
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI
    g.moveTo(x - Math.cos(t) * star / 2, y - Math.sin(t) * star / 2)
    g.lineTo(x + Math.cos(t) * star / 2, y + Math.sin(t) * star / 2)
  }
  g.stroke()
  g.restore()
}

/**
 * A laser sweep across `area` (default the stage) at progress `p` 0..1 (drive it from a snare:
 * `since / 0.12`; nothing outside 0..1): a datum line with a fading trail behind it.
 */
export function scanline(g: CanvasRenderingContext2D, p: number, st: Style, o: { dir?: 'down' | 'up' | 'right' | 'left'; area?: Rect; trail?: number; alpha?: number } = {}): void {
  if (!(p >= 0 && p <= 1)) return
  const a = o.area ?? { x: 0, y: 0, w: st.w, h: st.h }
  const dir = o.dir ?? 'down'
  const vertical = dir === 'down' || dir === 'up'
  const span = vertical ? a.h : a.w
  const q = dir === 'up' || dir === 'left' ? 1 - p : p
  const at = (vertical ? a.y : a.x) + span * q
  const trail = (o.trail ?? 0.12) * span * (dir === 'up' || dir === 'left' ? 1 : -1)
  const alpha = (o.alpha ?? 0.9) * (1 - p * 0.4)
  begin(g)
  const grad = vertical ? g.createLinearGradient(0, at + trail, 0, at) : g.createLinearGradient(at + trail, 0, at, 0)
  grad.addColorStop(0, ink(st, 0))
  grad.addColorStop(1, ink(st, 0.18 * alpha))
  g.fillStyle = grad
  if (vertical) g.fillRect(a.x, Math.min(at, at + trail), a.w, Math.abs(trail))
  else g.fillRect(Math.min(at, at + trail), a.y, Math.abs(trail), a.h)
  pen(g, st, 'datum', alpha)
  g.beginPath()
  if (vertical) { g.moveTo(a.x, at); g.lineTo(a.x + a.w, at) } else { g.moveTo(at, a.y); g.lineTo(at, a.y + a.h) }
  g.stroke()
  g.restore()
}

/**
 * A small readout block at (x, y): one label per line, stacked, with a fine rule at its left. Every
 * `#` in a line is a digit seeded by (line, position, `tick`): pass a hat count and the digits
 * change on each hat.
 */
export function telemetry(g: CanvasRenderingContext2D, x: number, y: number, lines: readonly string[], tick: number, st: Style, o: { size?: number; alpha?: number } = {}): Label[] {
  const size = o.size ?? st.size, lh = Math.round(size * 1.35)
  const out = lines.map((line, i): Label => {
    let n = 0
    const text = line.replace(/#/g, () => String(Math.floor(seeded(`schematic:tel:${i}:${n++}:${tick}`)() * 10)))
    return { text, x: x + size * 0.7, y: y + i * lh, base: 'top', size, alpha: o.alpha ?? 0.85, priority: 50, fixed: true }
  })
  begin(g)
  pen(g, st, 'fine', 0.7)
  g.beginPath()
  g.moveTo(x, y); g.lineTo(x, y + lines.length * lh - (lh - size))
  g.stroke()
  g.restore()
  return out
}

export interface Ring { x: number; y: number; r: number }

/** Two circles' intersections (none when apart, nested or concentric). */
export function intersect(a: Ring, b: Ring): XY[] {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy)
  if (d === 0 || d > a.r + b.r || d < Math.abs(a.r - b.r)) return []
  const p = (a.r * a.r - b.r * b.r + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, a.r * a.r - p * p))
  const mx = a.x + (p * dx) / d, my = a.y + (p * dy) / d
  return [{ x: mx + (h * dy) / d, y: my - (h * dx) / d }, { x: mx - (h * dy) / d, y: my + (h * dx) / d }]
}

/**
 * The chain's geometry (the node's rule): a centre circle, then circles each centred on the previous
 * one's rim along ±`angle` (radians), shrinking by `ratio`; joints are the intersections of
 * consecutive circles in that order (centre, + side, − side).
 */
export function chainGeometry(x: number, y: number, r: number, angle: number, n: number, ratio: number): { rings: Ring[]; joints: XY[] } {
  const rings: Ring[] = n > 0 ? [{ x, y, r }] : []
  const dx = Math.cos(angle), dy = Math.sin(angle)
  for (const [sgn, count] of [[1, Math.floor((n - 1) / 2)], [-1, Math.floor(n / 2)]] as const) {
    let c = rings[0]!
    for (let i = 0; i < count; i++) {
      c = { x: c.x + sgn * dx * c.r, y: c.y + sgn * dy * c.r, r: c.r * ratio }
      rings.push(c)
    }
  }
  const joints: XY[] = []
  for (let i = 0; i + 1 < rings.length; i++) joints.push(...intersect(rings[i]!, rings[i + 1]!))
  return { rings, joints }
}

/**
 * The chain drawn: circles (construct), dashed centre ticks and dots, "x,y" centres, joint markers
 * labelled "n → x – y". `grow` 0..1 reveals it; `alpha` fades it (a faint construction: n 2–3, alpha 0.35).
 */
export function chain(g: CanvasRenderingContext2D, x: number, y: number, st0: Style, o: { r?: number; angle?: number; n?: number; ratio?: number; grow?: number; centres?: boolean; alpha?: number } = {}): Label[] {
  const st = o.alpha === undefined ? st0 : { ...st0, alpha: st0.alpha * o.alpha }
  const cmin = Math.min(st.w, st.h)
  const { rings } = chainGeometry(x, y, o.r ?? cmin * 0.18, o.angle ?? -Math.PI / 3, o.n ?? 7, o.ratio ?? 0.78)
  const shown = Math.ceil(rings.length * ease(o.grow ?? 1))
  const out: Label[] = []
  begin(g)
  for (let i = 0; i < shown; i++) {
    const c = rings[i]!
    pen(g, st, i === 0 ? 'datum' : 'construct', i === 0 ? 0.6 : 0.5)
    g.beginPath()
    g.arc(c.x, c.y, c.r, 0, Math.PI * 2)
    g.stroke()
    const arm = Math.max(8, c.r * 0.3), d = Math.max(1, st.unit * 4)
    pen(g, st, 'fine', 0.3, [d, d])
    g.beginPath()
    g.moveTo(c.x - arm, c.y); g.lineTo(c.x + arm, c.y)
    g.moveTo(c.x, c.y - arm); g.lineTo(c.x, c.y + arm)
    g.stroke()
    g.fillStyle = ink(st, 0.6)
    g.beginPath()
    g.arc(c.x, c.y, Math.max(1.5, st.unit * 2), 0, Math.PI * 2)
    g.fill()
    if (o.centres !== false) out.push({ text: `${r0(c.x)},${r0(c.y)}`, x: c.x + arm + st.size * 0.4, y: c.y, alpha: 0.7 * (o.alpha ?? 1), priority: 0.5 })
  }
  let n = 1
  for (let i = 0; i + 1 < shown; i++) {
    for (const p of intersect(rings[i]!, rings[i + 1]!)) {
      const mr = Math.max(3, st.unit * 4.5)
      g.fillStyle = ink(st, 1)
      g.beginPath()
      g.arc(p.x, p.y, mr, 0, Math.PI * 2)
      g.fill()
      out.push({ text: `${n} → ${r0(p.x)} – ${r0(p.y)}`, x: p.x + mr + st.size * 0.5, y: p.y, priority: 2, alpha: o.alpha })
      n++
    }
  }
  g.restore()
  return out
}

const scratch = new WeakMap<CanvasRenderingContext2D, CanvasRenderingContext2D>()

/**
 * A mosaic of what is already drawn on this canvas under (x, y, w, h), `cell` px cells, with an
 * outline, its centre's "x,y", an optional `tag` above it ("REGION_01") and a dashed leader to the
 * `target` point it reads. Reads this canvas only: DOM layers below it are not included, so call it
 * before drawing marks.
 */
export function pixelZone(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cell: number, st: Style, o: { outline?: boolean; label?: boolean; tag?: string; target?: XY } = {}): Label[] {
  const cw = Math.max(1, Math.round(w / cell)), ch = Math.max(1, Math.round(h / cell))
  let tmp = scratch.get(g)
  if (!tmp) {
    tmp = document.createElement('canvas').getContext('2d')!
    scratch.set(g, tmp)
  }
  if (tmp.canvas.width !== cw) tmp.canvas.width = cw
  if (tmp.canvas.height !== ch) tmp.canvas.height = ch
  const m = g.getTransform()
  tmp.setTransform(1, 0, 0, 1, 0, 0)
  tmp.globalCompositeOperation = 'copy'
  tmp.imageSmoothingEnabled = true
  tmp.imageSmoothingQuality = 'high'
  tmp.drawImage(g.canvas, x * m.a + m.e, y * m.d + m.f, w * m.a, h * m.d, 0, 0, cw, ch)
  begin(g)
  g.imageSmoothingEnabled = false
  g.drawImage(tmp.canvas, 0, 0, cw, ch, x, y, w, h)
  if (o.outline !== false) {
    pen(g, st, 'fine', 0.6)
    g.strokeRect(x, y, w, h)
  }
  const out: Label[] = []
  if (o.target) {
    // a leader from the nearest corner to the point the zone reads
    const cx = o.target.x < x + w / 2 ? x : x + w, cy = o.target.y < y + h / 2 ? y : y + h
    pen(g, st, 'fine', 0.6, [st.unit * 3, st.unit * 3])
    g.beginPath()
    g.moveTo(cx, cy); g.lineTo(o.target.x, o.target.y)
    g.stroke()
  }
  g.restore()
  if (o.tag) out.push({ text: o.tag, x, y: y - 4, base: 'bottom', priority: 3.5 })
  if (o.label !== false) out.push({ text: `${r0(x + w / 2)},${r0(y + h / 2)}`, x: x + w / 2, y: y + h / 2, align: 'center', priority: 3 })
  return out
}

/** Four corner labels at the safe margin (they take precedence over every other label). */
export function slate(st: Style, c: { tl?: string; tr?: string; bl?: string; br?: string }, o: { size?: number } = {}): Label[] {
  const m = st.margin, size = o.size ?? Math.round(st.size * 1.15)
  const at: [string | undefined, number, number, Label['align'], Label['base']][] = [
    [c.tl, m, m, 'left', 'top'], [c.tr, st.w - m, m, 'right', 'top'],
    [c.bl, m, st.h - m, 'left', 'bottom'], [c.br, st.w - m, st.h - m, 'right', 'bottom'],
  ]
  return at.filter((e) => e[0]).map(([text, x, y, align, base]) => ({ text: text!, x, y, align, base, size, priority: 100, fixed: true }))
}

/** Where a ray from (x, y) along (ux, uy) leaves the rectangle `r` (default the stage). */
export function edgeHit(x: number, y: number, ux: number, uy: number, r: Rect): XY {
  const ts: number[] = []
  if (Math.abs(ux) > 1e-12) ts.push((r.x - x) / ux, (r.x + r.w - x) / ux)
  if (Math.abs(uy) > 1e-12) ts.push((r.y - y) / uy, (r.y + r.h - y) / uy)
  const pos = ts.filter((t) => t > 1e-9)
  const t = pos.length ? Math.min(...pos) : 0
  return { x: x + ux * t, y: y + uy * t }
}

/**
 * A ray pencil (fine): `count` rays from `focus` through points spread over `pts` (those farther
 * than `clear`), each turned by a seeded jitter (radians), from `clear` px off the focus to the
 * frame edge, with its bearing (degrees clockwise from up) where it crosses the safe margin. `grow` 0..1 draws them on.
 */
export function rays(g: CanvasRenderingContext2D, focus: XY, pts: readonly XY[], st: Style, o: { count?: number; jitter?: number; clear?: number; seed?: string | number; grow?: number; bearings?: boolean; alpha?: number } = {}): Label[] {
  const clear = o.clear ?? Math.min(st.w, st.h) * 0.03
  // points on the focus give no direction
  const aim = pts.filter((p) => Math.hypot(p.x - focus.x, p.y - focus.y) > clear)
  const count = Math.min(o.count ?? aim.length, 64)
  if (count <= 0 || aim.length === 0) return []
  const k = ease(o.grow ?? 1)
  const stage = { x: 0, y: 0, w: st.w, h: st.h }
  const m = st.margin
  const safe = { x: m, y: m, w: st.w - 2 * m, h: st.h - 2 * m }
  const out: Label[] = []
  begin(g)
  pen(g, st, 'fine', o.alpha ?? 0.7)
  g.beginPath()
  for (let i = 0; i < count; i++) {
    const p = aim[Math.floor((count > 1 ? i / (count - 1) : 0) * (aim.length - 1))]!
    const d = Math.hypot(p.x - focus.x, p.y - focus.y)
    const j = (seeded(`schematic:ray:${o.seed ?? 0}:${i}`)() - 0.5) * 2 * (o.jitter ?? 0.04)
    const ax = (p.x - focus.x) / d, ay = (p.y - focus.y) / d
    const ux = ax * Math.cos(j) - ay * Math.sin(j), uy = ax * Math.sin(j) + ay * Math.cos(j)
    const e = edgeHit(focus.x, focus.y, ux, uy, stage)
    const sx = focus.x + ux * clear, sy = focus.y + uy * clear
    g.moveTo(sx, sy)
    g.lineTo(sx + (e.x - sx) * k, sy + (e.y - sy) * k)
    if (o.bearings === false || k < 1) continue
    const inside = focus.x > m && focus.y > m && focus.x < st.w - m && focus.y < st.h - m
    if (!inside) continue
    const q = edgeHit(focus.x, focus.y, ux, uy, safe)
    const deg = ((Math.atan2(ux, -uy) * 180) / Math.PI + 360) % 360
    const side = Math.abs(q.x - m) < 0.5 ? 'l' : Math.abs(q.x - (st.w - m)) < 0.5 ? 'r' : Math.abs(q.y - m) < 0.5 ? 't' : 'b'
    out.push({
      text: `${String(Math.round(deg) % 360).padStart(3, '0')}°`,
      x: q.x + (side === 'l' ? 4 : side === 'r' ? -4 : 6), y: q.y + (side === 't' ? 4 : side === 'b' ? -4 : 0),
      align: side === 'r' ? 'right' : 'left', base: side === 't' ? 'top' : side === 'b' ? 'bottom' : 'middle',
      alpha: 0.8, priority: 1.5,
    })
  }
  g.stroke()
  g.restore()
  return out
}

// ---- the lattice look: nodes on a block grid, straight connections, boxes, flow --------------

/** A lattice node: grid nodes, or any point (same column/row then means the same x/y). */
export type LatticeNode = XY & { id?: string; col?: number; row?: number; age?: number; score?: number }

/** An edge `lattice` drew: node indices, length in px, and whether it runs along a column or row. */
export interface Edge { a: number; b: number; d: number; ortho: boolean; tone: Tone }

/** The edges of a lattice: pairs closer than `dist`, shortest first (ties by ids), each node in at most `max` (default 4). */
export function latticeEdges(nodes: readonly LatticeNode[], dist: number, max = 4, accent = 0): Edge[] {
  const idOf = (n: LatticeNode, i: number) => n.id ?? `#${i}`
  const all: Edge[] = []
  for (const [a, b] of pairs(nodes, dist)) {
    const p = nodes[a]!, q = nodes[b]!
    const ortho = p.col !== undefined && q.col !== undefined && p.row !== undefined && q.row !== undefined
      ? p.col === q.col || p.row === q.row
      : Math.abs(p.x - q.x) < 0.5 || Math.abs(p.y - q.y) < 0.5
    const [ia, ib] = [idOf(p, a), idOf(q, b)].sort()
    all.push({ a, b, d: Math.hypot(p.x - q.x, p.y - q.y), ortho, tone: accentOf(`${ia}-${ib}`, accent) })
  }
  const key = (e: Edge) => [idOf(nodes[e.a]!, e.a), idOf(nodes[e.b]!, e.b)].sort().join('-')
  all.sort((x, y) => x.d - y.d || (key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0))
  const deg = new Array<number>(nodes.length).fill(0)
  return all.filter((e) => {
    if (deg[e.a]! >= max || deg[e.b]! >= max) return false
    deg[e.a]!++
    deg[e.b]!++
    return true
  })
}

export interface LatticeOptions {
  /** Pairs closer than this (canvas px) connect, at most `max` lines per node (default 4). */
  dist: number
  max?: number
  /** Frames a node's lines take to draw on from it (default 8; needs node `age`). */
  grow?: number
  alpha?: number
  /** Share of lines in an accent tone (default 0). */
  accent?: number
  /** Label this many of the longest column/row lines with their length (default 0). */
  lengths?: number
}

/**
 * Straight lines between nodes (`latticeEdges`): along a column or row in the construct weight,
 * diagonals in fine, a few in accent tones. Each half of a line is drawn on from its own node by
 * that node's age, so a new node reaches into the lattice while the old ones stay. Returns length
 * labels for the longest column/row lines (`lengths`).
 */
export function lattice(g: CanvasRenderingContext2D, nodes: readonly LatticeNode[], st: Style, o: LatticeOptions): Label[] {
  const edges = latticeEdges(nodes, o.dist, o.max ?? 4, o.accent ?? 0)
  const grow = Math.max(1, o.grow ?? 8)
  const reach = (n: LatticeNode) => (n.age === undefined ? 1 : ease((n.age + 1) / grow))
  const a0 = o.alpha ?? 0.7
  begin(g)
  for (const tone of ['ink', 'red', 'blue'] as const) for (const ortho of [true, false]) {
    const set = edges.filter((e) => e.tone === tone && e.ortho === ortho)
    if (!set.length) continue
    pen(g, st, ortho || tone !== 'ink' ? 'construct' : 'fine', tone !== 'ink' ? a0 * 1.2 : ortho ? a0 : a0 * 0.6, [], tone)
    g.beginPath()
    for (const e of set) {
      const p = nodes[e.a]!, q = nodes[e.b]!
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2
      const kp = reach(p), kq = reach(q)
      if (kp > 0) { g.moveTo(p.x, p.y); g.lineTo(p.x + (mx - p.x) * kp, p.y + (my - p.y) * kp) }
      if (kq > 0) { g.moveTo(q.x, q.y); g.lineTo(q.x + (mx - q.x) * kq, q.y + (my - q.y) * kq) }
    }
    g.stroke()
  }
  g.restore()
  const out: Label[] = []
  const long = edges.filter((e) => e.ortho && reach(nodes[e.a]!) >= 1 && reach(nodes[e.b]!) >= 1).sort((x, y) => y.d - x.d).slice(0, o.lengths ?? 0)
  for (const e of long) {
    const p = nodes[e.a]!, q = nodes[e.b]!
    const vertical = Math.abs(p.x - q.x) < Math.abs(p.y - q.y)
    out.push({
      text: e.d.toFixed(1), x: (p.x + q.x) / 2 + (vertical ? st.size * 0.5 : 0), y: (p.y + q.y) / 2 - (vertical ? 0 : st.size * 0.8),
      align: vertical ? 'left' : 'center', alpha: 0.6, priority: 0.8, tone: e.tone,
    })
  }
  return out
}

/**
 * Node marks: a small dot (or square) per node, in its accent tone when `accent` > 0, and an "x,y"
 * label with the node's id and score, so a `labels` budget keeps the same nodes labelled. Nodes with
 * an `age` grow in over `grow` frames.
 */
export function dots(g: CanvasRenderingContext2D, nodes: readonly LatticeNode[], st: Style, o: { size?: number; shape?: 'dot' | 'square'; alpha?: number; accent?: number; labels?: boolean; grow?: number } = {}): Label[] {
  const out: Label[] = []
  const size = o.size ?? Math.max(1.5, st.unit * 3)
  begin(g)
  nodes.forEach((n, i) => {
    const k = n.age === undefined ? 1 : ease((n.age + 1) / Math.max(1, o.grow ?? 6))
    const id = n.id ?? `#${i}`
    const tone = accentOf(id, o.accent ?? 0)
    g.fillStyle = ink(st, (o.alpha ?? 0.95) * k, tone)
    g.beginPath()
    if (o.shape === 'square') g.rect(n.x - size, n.y - size, size * 2, size * 2)
    else g.arc(n.x, n.y, size * (0.5 + 0.5 * k), 0, Math.PI * 2)
    g.fill()
    if (o.labels !== false && k >= 1) out.push({ text: `${r0(n.x)},${r0(n.y)}`, x: n.x + size + st.size * 0.45, y: n.y, alpha: 0.72, priority: 1, id, score: n.score ?? 0, tone })
  })
  g.restore()
  return out
}

export interface BoxOptions {
  /** Space around the group's node centres, px (default 2 × the label size). */
  pad?: number
  /** The text marker (default `<ID>  <score with 4 decimals>`). */
  label?: (c: Cluster, i: number) => string
  /** A group's tone (default `accentOf(id, accent)`). */
  tone?: (c: Cluster, i: number) => Tone
  accent?: number
  /** Corner tick length, px (default 1.4 × the label size). */
  tick?: number
  alpha?: number
  /** RGB split of accent boxes, px (a decaying pulse). */
  split?: number
}

/** A group's box: its nodes' bounds plus `pad`. */
export const boxOf = (c: Cluster, pad: number): Rect => ({ x: c.x - pad, y: c.y - pad, w: c.w + 2 * pad, h: c.h + 2 * pad })

/**
 * A rectangle around each group (fine), corner ticks (datum), a filled marker square at its top
 * corner (left, or right for a box right of the middle) and a text marker above it holding the group's data (`R03  0.8731  Δ+0.012`). Accent boxes
 * take `split` as an RGB split. Returns the text markers.
 */
export function boxes(g: CanvasRenderingContext2D, groups: readonly Cluster[], st: Style, o: BoxOptions = {}): Label[] {
  const pad = o.pad ?? st.size * 2, tick = o.tick ?? st.size * 1.4, a = o.alpha ?? 0.8
  const out: Label[] = []
  groups.forEach((c, i) => {
    const r = boxOf(c, pad)
    const tone = o.tone ? o.tone(c, i) : accentOf(c.id, o.accent ?? 0)
    const mark = Math.max(3, st.size * 0.42)
    // a box right of the middle carries its marker at its right corner, so the text stays inside the frame
    const right = r.x + r.w / 2 > st.w / 2
    const draw = (tn: Tone) => {
      begin(g)
      pen(g, st, 'fine', a * 0.7, [], tn)
      g.strokeRect(r.x, r.y, r.w, r.h)
      pen(g, st, 'datum', a, [], tn)
      g.beginPath()
      for (const [sx, sy] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
        const x = r.x + sx * r.w, y = r.y + sy * r.h, dx = sx ? -tick : tick, dy = sy ? -tick : tick
        g.moveTo(x + dx, y); g.lineTo(x, y); g.lineTo(x, y + dy)
      }
      g.stroke()
      g.fillStyle = ink(st, a, tn)
      g.fillRect(right ? r.x + r.w - mark : r.x, r.y - mark, mark, mark)
      g.restore()
    }
    if (tone !== 'ink' && o.split) rgbSplit(g, draw, o.split, { top: tone })
    else draw(tone)
    const text = o.label ? o.label(c, i) : `${c.id.toUpperCase()}  ${c.score.toFixed(4)}`
    const gap = mark + st.size * 0.4
    out.push({ text, x: right ? r.x + r.w - gap : r.x + gap, y: r.y - 2, align: right ? 'right' : 'left', base: 'bottom', priority: 4, alpha: 0.95, tone })
  })
  return out
}

/** An optical-flow trail: positions oldest first (`trail`). */
export interface Flow { id?: string; pts: readonly XY[] }

/**
 * Optical-flow trails: a short polyline per tracked point through its last `len` positions
 * (default 8), fading towards the tail, with a tick across the head. `gain` stretches each trail
 * away from its head (slow footage still reads as flow). A share `accent` of them is in an accent tone.
 */
export function vectors(g: CanvasRenderingContext2D, flows: readonly Flow[], st: Style, o: { len?: number; gain?: number; alpha?: number; accent?: number; tick?: number; still?: number } = {}): void {
  const len = o.len ?? 8, gain = o.gain ?? 1, a = o.alpha ?? 0.85, tick = o.tick ?? st.size * 0.5
  begin(g)
  g.lineCap = 'round'
  flows.forEach((fl, i) => {
    const pts = fl.pts.slice(-(len + 1))
    if (pts.length < 2) return
    const head = pts[pts.length - 1]!
    const at = (p: XY) => ({ x: head.x + (p.x - head.x) * gain, y: head.y + (p.y - head.y) * gain })
    const tail = at(pts[0]!)
    if (Math.hypot(head.x - tail.x, head.y - tail.y) < (o.still ?? 1)) return
    const tone = accentOf(fl.id ?? `#${i}`, o.accent ?? 0)
    for (let j = 1; j < pts.length; j++) {
      const p = at(pts[j - 1]!), q = at(pts[j]!)
      pen(g, st, 'fine', a * (j / (pts.length - 1)), [], tone)
      g.beginPath()
      g.moveTo(p.x, p.y); g.lineTo(q.x, q.y)
      g.stroke()
    }
    const prev = at(pts[pts.length - 2]!)
    const d = Math.hypot(head.x - prev.x, head.y - prev.y) || 1
    const nx = -(head.y - prev.y) / d, ny = (head.x - prev.x) / d
    pen(g, st, 'construct', a, [], tone)
    g.beginPath()
    g.moveTo(head.x - nx * tick, head.y - ny * tick); g.lineTo(head.x + nx * tick, head.y + ny * tick)
    g.stroke()
  })
  g.restore()
}

// ---- the whole analysis stack ----------------------------------------------------------------

/**
 * The score-weighted centre of a grid at frame k, through `fit`: every cell weighted by its score
 * (averaged over ±`smooth` frames, default 8) to the `power` (default 3). Heavily smoothed, it
 * drifts and never jumps; the grid's middle when every score is 0.
 */
export function gridCentroid(grid: BlockGrid, k: number, fit?: Fit, o: { smooth?: number; power?: number } = {}): XY {
  const s = o.smooth ?? 8, pw = o.power ?? 3
  let sx = 0, sy = 0, sw = 0
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    const w = grid.score(k, c, r, s) ** pw
    const p = grid.centre(c, r, fit)
    sx += p.x * w; sy += p.y * w; sw += w
  }
  return sw > 0 ? { x: sx / sw, y: sy / sw } : grid.centre(grid.cols / 2 - 0.5, grid.rows / 2 - 0.5, fit)
}

/** The music an analysis follows: band levels and hit pulses 0..1 (default 0), seconds since the last kick and snare (absent: no hit yet). */
export interface AnalysisMusic { low?: number; high?: number; kick?: number; kickSince?: number; snare?: number; snareSince?: number }

export interface AnalysisInput {
  grid: BlockGrid
  /** The grid's frame now and the shot's first frame (nodes age from it; tracks before it are ignored). */
  k: number
  k0: number
  /** Plate px → canvas px (what the frame source's `draw` returns) and the picture's rect on the canvas. */
  fit: Fit
  area: Rect
  /** How busy the analysis is, 0..1 (default 1). */
  density?: number
  /** The shot's index: the zone's tag number and the chain's cadence (default 0). */
  shot?: number
  /** Tracked points: `ids` move the nodes (`advect`), `flow` (default `ids`) draw the trails; `at(id, j)` is a track's canvas px at frame j, or null. */
  tracks?: { ids: readonly string[]; flow?: readonly string[]; at: (id: string, j: number) => XY | null | undefined }
  music?: AnalysisMusic
  /** A corner kept clear of nodes, where the telemetry goes (default bottom left; null: none). */
  readout?: Rect | null
  /** The pixel zone's tag before its number (default `REGION`: `REGION_04`). */
  tag?: string
  /** Prefixed to node ids, so two analyses in one frame keep apart in accents and the label budget. */
  prefix?: string
}

/** Numbers about the analysis, for telemetry. */
export interface AnalysisStats { nodes: number; edges: number; mean: number; threshold: number; flow: number; low: number; high: number }

/**
 * Each layer of `analysis`, `false` to leave it out. Defaults follow the music: the low band lowers
 * the threshold and stretches the lattice, the high band brightens the flow, a snare splits the boxes.
 */
export interface AnalysisOptions {
  /** `BlockGrid.nodes` (threshold 0.24 − 0.1·low, max 16 + 44·density, spacing 2, smooth 3, age 30), `inset` × the margin inside `area` (1.7); moved by the tracks unless `advect` is false. */
  nodes?: { smooth?: number; threshold?: number; max?: number; spacing?: number; age?: number; inset?: number; advect?: boolean | { radius?: number; cap?: number } }
  /** Clusters for boxes and the zone: `link` cells (3), at least `min` nodes (3), at most `size` (7), at most `w` × `h` of the area (0.3 × 0.4). */
  clusters?: { link?: number; min?: number; size?: number; w?: number; h?: number }
  /**
   * A pixel zone over the best node of the top cluster, from density `min` (0.7); `w`×`h` px (168 × 144)
   * in `cell` px cells (24), offset `dx`, `dy` from the node, kept inside the area and `inset`
   * margins (2.2) from the frame's edges. A zone larger than that room shrinks to it; with less
   * than a cell of room there is no zone.
   */
  zone?: false | { min?: number; w?: number; h?: number; cell?: number; dx?: number; dy?: number; inset?: number }
  /** A faint reticle on the centre: the nodes' mean (default) or the grid's `gridCentroid`; brackets below density 0.5; `pump` × kick grows it. */
  crosshair?: false | { centre?: 'nodes' | 'grid' | XY; mode?: 'cross' | 'brackets'; alpha?: number; pump?: number }
  /** One faint construction chain in shots where `shot % every === phase % every` (4, 1), drawn on over `grow` frames (15). */
  chain?: false | { every?: number; phase?: number; r?: number; angle?: number; alpha?: number; grow?: number; n?: number }
  /** On a kick, a dashed rectangle that opens from the centre (`speed` px/s) and fades over `dur` s (0.3), in `color` (the blue accent). */
  wave?: false | { color?: string; dur?: number; speed?: number; alpha?: number }
  /** `lattice`: dist (240 + 170·low) × zoom, max 5, grow 8, alpha 0.6 + 0.35·density, accent 0.08, lengths 2. */
  lattice?: false | { dist?: number; max?: number; grow?: number; alpha?: number; accent?: number; lengths?: number }
  /** `vectors` over `trail`s of `tracks.flow`: len 12, gain 4, accent 0.15, alpha 0.45 + 0.55·high. */
  flow?: false | { len?: number; gain?: number; alpha?: number; accent?: number }
  /** Boxes around the top `count` clusters (3 above density 0.7, else 2), in id order, with mean score, Δ over `delta` frames (4), n. */
  boxes?: false | { count?: number; pad?: number; accent?: number; split?: number; delta?: number; label?: (c: Cluster, d: { mean: number; delta: number }) => string }
  /** `dots`, with "x,y" labels from density 0.25. */
  dots?: false | { accent?: number; labels?: boolean; alpha?: number }
  /** A scanline over the area for `dur` s (0.15) after a snare. */
  scan?: false | { dur?: number; alpha?: number }
  /** Readout lines from density `min` (0.25) at `at` (in the readout); `lines` rewrites the defaults. */
  telemetry?: false | { min?: number; at?: XY; lines?: (s: AnalysisStats, def: string[]) => readonly string[] }
}

/** What `analyse` decides and `analysis` draws. */
export interface AnalysisPlan {
  nodes: GridNode[]
  /** Every cluster small enough to box, best first; `boxed` are the ones that get a box, in id order. */
  clusters: Cluster[]
  boxed: Cluster[]
  centre: XY
  edges: Edge[]
  flows: Flow[]
  zone: Rect | null
  chain: boolean
  /** The kick wave's rect and its alpha 0..1, or null. */
  wave: { rect: Rect; a: number } | null
  /** The scanline's progress 0..1, or null. */
  scan: number | null
  stats: AnalysisStats
  /** Telemetry labels (fixed, priority 50). */
  telemetry: Label[]
  /** The resolved numbers the drawers take. */
  dist: number
  zoom: number
}

const p2 = (n: number) => String(Math.floor(n)).padStart(2, '0')
const sgn = (v: number, d = 3) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`
const off = <T extends object>(o: T | false | undefined): o is false => o === false

/** The default readout corner: bottom left, clear of the slate's bottom-left label. */
export const readoutRect = (st: Style): Rect => ({ x: 0, y: st.h - st.margin - 190, w: st.margin + 300, h: 190 + st.margin })

/** Everything `analysis` draws, decided without a canvas: pure and deterministic for the same input. */
export function analyse(st: Style, input: AnalysisInput, o: AnalysisOptions = {}): AnalysisPlan {
  const { grid, k, k0, fit, area } = input
  const d = Math.max(0, Math.min(1, input.density ?? 1))
  const m = input.music ?? {}
  const low = m.low ?? 0, high = m.high ?? 0
  const zoom = area.w / st.w
  const on = <T extends object>(x: T | false | undefined): T | null => (off(x) ? null : (x ?? ({} as T)))
  const at = (id: string, j: number) => (j < k0 ? null : input.tracks?.at(id, j) ?? null)

  const no = o.nodes ?? {}
  const threshold = no.threshold ?? 0.24 - 0.1 * low
  const inset = st.margin * (no.inset ?? 1.7)
  const within: Rect = { x: area.x + inset, y: area.y + inset, w: area.w - 2 * inset, h: area.h - 2 * inset }
  let nodes: GridNode[] = grid.nodes(k, { smooth: no.smooth ?? 3, threshold, max: no.max ?? Math.round(16 + 44 * d), spacing: no.spacing ?? 2, fit, within, age: no.age ?? 30, from: k0 })
  if (input.tracks && no.advect !== false) nodes = advect(nodes, input.tracks.ids, k, at, typeof no.advect === 'object' ? no.advect : {})
  const ro = input.readout === undefined ? readoutRect(st) : input.readout
  if (ro) nodes = nodes.filter((n) => !(n.x >= ro.x && n.x < ro.x + ro.w && n.y > ro.y && n.y <= ro.y + ro.h))
  if (input.prefix) nodes = nodes.map((n) => ({ ...n, id: input.prefix + n.id }))

  const co = o.clusters ?? {}
  const ranked = clusters(nodes, co.link ?? 3, { min: co.min ?? 3 })
    .filter((c) => c.nodes.length <= (co.size ?? 7) && c.w < area.w * (co.w ?? 0.3) && c.h < area.h * (co.h ?? 0.4))
    .sort((a, b) => b.nodes.length - a.nodes.length || b.score - a.score)
  const bo = on(o.boxes)
  const boxed = bo ? ranked.slice(0, bo.count ?? (d > 0.7 ? 3 : 2)).sort((a, b) => (a.id < b.id ? -1 : 1)) : []

  let zone: Rect | null = null
  const zo = on(o.zone)
  if (zo && ranked[0] && d >= (zo.min ?? 0.7)) {
    const n0 = [...ranked[0].nodes].sort((a, b) => b.score - a.score)[0]!
    const pad = st.margin * (zo.inset ?? 2.2), cell = zo.cell ?? 24
    const x0 = Math.max(area.x, pad), y0 = Math.max(area.y, pad)
    const rw = Math.min(area.x + area.w, st.w - pad) - x0, rh = Math.min(area.y + area.h, st.h - pad) - y0
    if (rw >= cell && rh >= cell) {
      const w = Math.min(zo.w ?? 168, rw), h = Math.min(zo.h ?? 144, rh)
      const clamp = (v: number, lo: number, room: number, size: number) => Math.min(lo + room - size, Math.max(lo, v))
      zone = { x: clamp(n0.x + (zo.dx ?? -84), x0, rw, w), y: clamp(n0.y + (zo.dy ?? -72), y0, rh, h), w, h }
    }
  }

  const cho = on(o.crosshair)
  const want = cho?.centre ?? 'nodes'
  const centre: XY = typeof want === 'object' ? want
    : want === 'grid' ? gridCentroid(grid, k, fit)
      : nodes.length ? { x: nodes.reduce((a, n) => a + n.x, 0) / nodes.length, y: nodes.reduce((a, n) => a + n.y, 0) / nodes.length }
        : { x: area.x + area.w / 2, y: area.y + area.h / 2 }

  const ch = on(o.chain)
  const every = Math.max(1, ch?.every ?? 4)
  const shot = input.shot ?? 0
  const chain = !!ch && ((shot % every) + every) % every === (((ch.phase ?? 1) % every) + every) % every

  const wo = on(o.wave)
  let wave: AnalysisPlan['wave'] = null
  const dur = wo?.dur ?? 0.3
  if (wo && m.kickSince !== undefined && m.kickSince >= 0 && m.kickSince < dur) {
    const u = Math.min(st.w, st.h) / 1080
    const r = (60 + m.kickSince * (wo.speed ?? 2600)) * u
    wave = { rect: { x: centre.x - r, y: centre.y - r * 0.62, w: 2 * r, h: 2 * r * 0.62 }, a: 1 - m.kickSince / dur }
  }

  const lo = o.lattice || {}
  const dist = lo.dist ?? (240 + 170 * low) * zoom
  const edges = latticeEdges(nodes, dist, lo.max ?? 5, lo.accent ?? 0.08)

  const fo = on(o.flow)
  const len = fo?.len ?? 12
  const flows: Flow[] = fo && input.tracks ? (input.tracks.flow ?? input.tracks.ids).map((id) => ({ id, pts: trail(k, len, (j) => at(id, j)) })) : []

  const so = on(o.scan)
  const sp = so && m.snareSince !== undefined ? m.snareSince / (so.dur ?? 0.15) : null
  const scan = sp !== null && sp >= 0 && sp <= 1 ? sp : null

  const flowPx = flows.reduce((a, fl) => {
    const q = fl.pts
    return q.length > 1 ? a + Math.hypot(q[q.length - 1]!.x - q[q.length - 2]!.x, q[q.length - 1]!.y - q[q.length - 2]!.y) : a
  }, 0) / Math.max(1, flows.length)
  const stats: AnalysisStats = {
    nodes: nodes.length, edges: edges.length, mean: nodes.reduce((a, n) => a + n.score, 0) / Math.max(1, nodes.length),
    threshold, flow: flowPx, low, high,
  }
  const to = on(o.telemetry)
  let telemetry: Label[] = []
  if (to && d >= (to.min ?? 0.25)) {
    const def = [
      `NODES ${p2(stats.nodes)}  EDGES ${p2(stats.edges)}`,
      `μ ${stats.mean.toFixed(4)}  θ ${threshold.toFixed(3)}`,
      `FLOW ${flowPx.toFixed(2)} px/f`,
      `LOW ${low.toFixed(3)}  HIGH ${high.toFixed(3)}`,
    ]
    const lines = to.lines ? to.lines(stats, def) : def
    const pos = to.at ?? (ro ? { x: ro.x + st.margin, y: ro.y + 40 } : { x: st.margin, y: st.h - st.margin - 150 })
    const lh = Math.round(st.size * 1.35)
    telemetry = lines.map((text, i): Label => ({ text, x: pos.x + st.size * 0.7, y: pos.y + i * lh, base: 'top', alpha: 0.85, priority: 50, fixed: true }))
  }
  return { nodes, clusters: ranked, boxed, centre, edges, flows, zone, chain, wave, scan, stats, telemetry, dist, zoom }
}

/**
 * The live "vision analysis" overlay in one call, in drawing order: a pixel zone on the top
 * cluster, a crosshair on the centre, an optional faint chain, a kick wave, the lattice, flow
 * trails, boxes with live data (mean score, Δ, n), dots, a snare scanline and telemetry from the
 * analysis itself. Returns its labels (add the slate and your own, then call `labels` once) and
 * what it found. The drawers it calls stay available for a grammar of your own (`analyse` gives
 * the plan without drawing).
 *
 *   const a = analysis(g, st, { grid, k, k0, fit, area, density: d, tracks, music: { low, kick, kickSince } })
 *   labels(g, [...a.labels, ...slate(st, { tl: 'SCHEMATIC' })], st, { audit: f.audit, budget: 10 })
 */
export function analysis(g: CanvasRenderingContext2D, st: Style, input: AnalysisInput, o: AnalysisOptions = {}): AnalysisPlan & { labels: Label[] } {
  const p = analyse(st, input, o)
  const d = Math.max(0, Math.min(1, input.density ?? 1))
  const m = input.music ?? {}
  const out: Label[] = []
  const shot = input.shot ?? 0

  // the zone samples what is drawn, so it comes before every mark
  if (p.zone) {
    const zo = o.zone || {}
    out.push(...pixelZone(g, p.zone.x, p.zone.y, p.zone.w, p.zone.h, zo.cell ?? 24, st, { tag: `${input.tag ?? 'REGION'}_${p2(shot + 1)}`, label: false }))
  }
  if (o.crosshair !== false) {
    const c = o.crosshair ?? {}
    crosshair(g, p.centre.x, p.centre.y, st, { mode: c.mode ?? (d < 0.5 ? 'brackets' : 'cross'), alpha: c.alpha ?? 0.35, scale: p.zoom * (1 + (c.pump ?? 0.15) * (m.kick ?? 0)) })
  }
  if (p.chain && o.chain !== false) {
    const c = o.chain ?? {}
    out.push(...chain(g, p.centre.x, p.centre.y, st, { n: c.n ?? 2, r: (c.r ?? 300) * p.zoom, angle: c.angle ?? -0.6, alpha: c.alpha ?? 0.35, grow: (input.k - input.k0) / Math.max(1, c.grow ?? 15), centres: false }))
  }
  if (p.wave) {
    const w = o.wave || {}
    const u = Math.min(st.w, st.h) / 1080
    g.save()
    g.strokeStyle = w.color ?? st.accents.blue
    g.globalAlpha = (w.alpha ?? 0.55) * p.wave.a
    g.lineWidth = 1.5 * u
    g.setLineDash([10 * u, 8 * u])
    g.strokeRect(p.wave.rect.x, p.wave.rect.y, p.wave.rect.w, p.wave.rect.h)
    g.restore()
  }
  if (o.lattice !== false) {
    const l = o.lattice ?? {}
    out.push(...lattice(g, p.nodes, st, { dist: p.dist, max: l.max ?? 5, grow: l.grow ?? 8, alpha: l.alpha ?? 0.6 + 0.35 * d, accent: l.accent ?? 0.08, lengths: l.lengths ?? 2 }))
  }
  if (o.flow !== false && p.flows.length) {
    const fl = o.flow ?? {}
    vectors(g, p.flows, st, { len: fl.len ?? 12, gain: fl.gain ?? 4, accent: fl.accent ?? 0.15, alpha: fl.alpha ?? 0.45 + 0.55 * (m.high ?? 0) })
  }
  if (o.boxes !== false && p.boxed.length) {
    const b = o.boxes ?? {}
    const back = b.delta ?? 4
    const mean = (c: Cluster, kk: number) => c.nodes.reduce((a, n) => a + input.grid.score(kk, n.col, n.row, 3), 0) / c.nodes.length
    const data = (c: Cluster) => ({ mean: mean(c, input.k), delta: mean(c, input.k) - mean(c, input.k - back) })
    const label = b.label ?? ((c: Cluster, x: { mean: number; delta: number }) => `${c.id.toUpperCase().replace('_', '.')}  ${x.mean.toFixed(4)}  Δ${sgn(x.delta)}  n=${c.nodes.length}`)
    out.push(...boxes(g, p.boxed, st, { pad: b.pad ?? 26 * p.zoom, accent: b.accent ?? 0.34, split: b.split ?? 9 * (m.snare ?? 0), label: (c) => label(c, data(c)) }))
  }
  if (o.dots !== false) {
    const dt = o.dots ?? {}
    out.push(...dots(g, p.nodes, st, { accent: dt.accent ?? 0.1, labels: dt.labels ?? d >= 0.25, alpha: dt.alpha }))
  }
  if (p.scan !== null) scanline(g, p.scan, st, { area: input.area, alpha: (o.scan || {}).alpha ?? 0.5 })
  out.push(...p.telemetry)
  return { ...p, labels: out }
}
