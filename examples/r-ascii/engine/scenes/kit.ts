// Shared scene helpers: line timing by index, the capitalised-word slam, echoes, dialogs, scopes, rain.
import { type Rect, grad, mix, mul } from '../cells.ts'
import { bigText, fitHeight } from '../font.ts'
import { LINES, type Line } from '../song.ts'
import { hash, seeded } from '../rng.ts'
import { clamp01, flash, outBack, outCubic, outExpo, seg } from '../../motion.ts'
import type { Ctx } from '../types.ts'

export const T = (i: number) => LINES[i]!.t0
export const E = (i: number) => LINES[i]!.t1
export const N = (i: number) => LINES[i]!.next
export const word = (i: number) => LINES[i]!.en
/** The capitalised line whose window contains t, among line indices [a, b]. */
export function hitAt(t: number, a: number, b: number): Line | null {
  let r: Line | null = null
  for (let i = a; i <= b; i++) { const l = LINES[i]!; if (l.caps && t >= l.t0 && t < l.next + 0.02) r = l }
  return r
}
/** Line index in [a, b] that is current at t (start ≤ t), or -1. */
export function curIn(t: number, a: number, b: number): number {
  let r = -1
  for (let i = a; i <= b; i++) if (LINES[i]!.t0 <= t) r = i
  return r
}

/** Draw `fn` at a few earlier times first, dimmed — motion trails that stay a pure function of t. */
export function echo(x: Ctx, n: number, dt: number, fn: (t: number, k: number) => void) {
  for (let k = n; k >= 1; k--) fn(x.t - k * dt, 1 - k / (n + 1))
  fn(x.t, 1)
}

/** The capitalised word slams into rect r: scale-in, RGB-split echoes, slice offsets, then holds. */
export function slam(x: Ctx, r: Rect, l: Line, o: { pal?: readonly number[]; maxH?: number; y?: number; style?: 'block' | 'ramp' | 'outline'; text?: string; out?: number } = {}) {
  const t = x.t, lt = t - l.t0
  if (lt < 0) return
  const text = o.text ?? l.en
  const pal = o.pal ?? x.pal
  const h0 = fitHeight(text, r.w - 4, o.maxH ?? Math.max(4, r.h * 0.42))
  const k = outExpo(clamp01(lt / 0.18))
  const scale = 1 + 1.6 * (1 - k)
  const outK = o.out ?? 1
  const h = h0 * scale
  const cy = o.y ?? r.y + r.h / 2
  const cx = r.x + r.w / 2
  const sl = x.rng('slam:' + l.i)
  const cuts = Array.from({ length: 6 }, () => [sl.range(0, 1), sl.range(-1, 1)] as const)
  const shake = flash(t, l.t0 + 0.02, 0.12) * 3
  const warp = (wx: number, wy: number): [number, number] => {
    const v = (wy - (cy - h / 2)) / h
    let dx = 0
    for (const [p, d] of cuts) if (Math.abs(v - p) < 0.06) dx += d * (2 + 10 * x.G) * (1 - k * 0.7)
    return [dx + shake * Math.sin(wy * 3.1 + t * 50), 0]
  }
  // split echoes
  if (k < 1 || x.G > 0.3) {
    const s = 1 + 2 * (1 - k) + x.G
    bigText(x.c, text, { x: cx + s, y: cy, h, style: o.style ?? 'block', color: () => mul(0xff2050, 0.55 * outK), warp })
    bigText(x.c, text, { x: cx - s, y: cy, h, style: o.style ?? 'block', color: () => mul(0x20d0ff, 0.55 * outK), warp })
  }
  bigText(x.c, text, {
    x: cx, y: cy, h, style: o.style ?? 'block', warp,
    color: (u, v, cx2, cy2) => {
      const g = grad(pal, 0.55 + 0.45 * (1 - v) - 0.1 * hash(cx2 * 7 + cy2, Math.floor(t * 12)))
      return mul(mix(g, 0xffffff, flash(t, l.t0, 0.1) * 0.8), outK)
    },
  })
}

export function dialog(x: Ctx, r: Rect, title: string, body: string[], col: number, o: { buttons?: string[]; icon?: string; bg?: number } = {}) {
  const { c } = x
  c.fill(r, ' ', 0, o.bg ?? 0x0c0608)
  c.box(r, col, undefined, 'double')
  c.fill({ x: r.x + 1, y: r.y, w: r.w - 2, h: 1 }, ' ', 0, col)
  c.pen = 1
  c.text(r.x + 2, r.y, ` ${title} `.slice(0, r.w - 4), 0x05080b, col)
  c.pen = 0
  c.text(r.x + r.w - 5, r.y, '[x]', 0x05080b, col)
  const ix = o.icon ? 6 : 2
  if (o.icon) c.text(r.x + 2, r.y + 2, o.icon, col)
  body.forEach((s, i) => { if (r.y + 2 + i < r.y + r.h - 2) c.text(r.x + ix, r.y + 2 + i, s.slice(0, r.w - ix - 2), 0xe0e6ea) })
  if (o.buttons) {
    let bx = r.x + r.w - 2
    for (const b of [...o.buttons].reverse()) { bx -= b.length + 4; c.text(bx, r.y + r.h - 2, `[ ${b} ]`, col) }
  }
}

/** Oscilloscope trace of fn(u) for u in 0..1 across r, values in -1..1. */
export function scope(x: Ctx, r: Rect, fn: (u: number) => number, col: number, amp = 0.8) {
  const { c } = x
  let py = NaN
  for (let i = 0; i < r.w; i++) {
    const v = fn(i / (r.w - 1))
    const y = r.y + r.h / 2 - v * amp * (r.h / 2)
    if (!Number.isNaN(py) && Math.abs(y - py) > 1) c.line(r.x + i - 1, py, r.x + i, y, mul(col, 0.7), '│')
    c.put(r.x + i, y, Math.abs(y - py) < 0.3 ? '─' : y < py ? '╱' : '╲', col)
    py = y
  }
}

/** Falling columns of glyphs (code rain) over r. */
export function rain(x: Ctx, r: Rect, o: { speed?: number; density?: number; glyphs?: string; col: (v: number) => number; seed?: number }) {
  const { c, t } = x
  const g = o.glyphs ?? '01アイウエオカキクケコサシスセソ<>{}[]=+*#$'
  const narrow = [...g].filter((s) => s.charCodeAt(0) < 0x2e80)
  const sp = o.speed ?? 12, den = o.density ?? 0.5
  for (let cx = r.x; cx < r.x + r.w; cx++) {
    const s = o.seed ?? 3
    if (hash(cx, s) > den) continue
    const v = sp * (0.5 + hash(cx, s + 1))
    const L = 6 + Math.floor(hash(cx, s + 2) * 18)
    const span = r.h + L
    const head = ((t * v + hash(cx, s + 3) * span) % span)
    for (let k = 0; k < L; k++) {
      const y = Math.floor(r.y + head - k)
      if (y < r.y || y >= r.y + r.h) continue
      const ch = narrow[Math.floor(hash(cx * 131 + y, Math.floor(t * 8 + k)) * narrow.length)]!
      c.put(cx, y, ch, k === 0 ? 0xeaffee : o.col(1 - k / L))
    }
  }
}

/** A seeded word list for logs. */
export function logLine(k: number, words: string[], tpl: (r: ReturnType<typeof seeded>, w: string) => string) {
  const r = seeded(k * 31 + 7)
  return tpl(r, r.pick(words))
}

/** Count-up progress bar row with label. */
export function progress(x: Ctx, px: number, py: number, w: number, label: string, v: number, col: number) {
  x.c.text(px, py, label.padEnd(14).slice(0, 14), 0x8a96a0)
  x.c.bar(px + 15, py, w - 22, v, col, 0x1a2228)
  x.c.text(px + w - 6, py, `${Math.floor(clamp01(v) * 100)}%`.padStart(4), v >= 1 ? col : 0xa0aab2)
}

export { clamp01, flash, outBack, outCubic, outExpo, seg, mix, mul, grad }

/** Late-bound scene registry, so a scene can replay another without an import cycle. */
export const REG: { scenes: Record<string, import('../types.ts').Scene> | null } = { scenes: null }
