// Execution (twelve hits, a countdown, one more), the second chorus (lock-on, rewind, cage),
// Love (textbook, REPL, the heart equation, a raymarched heart), Decay and the Finale.
import { type Rect, grad, hsl, luma, mix, mul, rgb } from '../cells.ts'
import { bigText, fitHeight } from '../font.ts'
import { Cam, PAL, TAU, type V3, dot3, field, norm3, rampCh, ring, rotX, rotY, warp } from '../gfx.ts'
import { hash, noise1, seeded } from '../rng.ts'
import { ACTS, END, LINES, type ActId } from '../song.ts'
import { caret, inCubic, inOutCubic, spring, typed } from '../../motion.ts'
import type { Ctx, Scene } from '../types.ts'
import { REG, T, clamp01, curIn, dialog, echo, flash, hitAt, outCubic, outExpo, seg, slam } from './kit.ts'

const RED = PAL.red

// ── execution ───────────────────────────────────────────────────────────────────────────────────

function wall(x: Ctx, r: Rect, text: string, k: number) {
  const { c, t } = x
  const s = ` ${text} //`
  for (let y = r.y; y < r.y + r.h; y++) {
    const dir = y % 2 ? 1 : -1
    const off = Math.floor(t * (18 + (y % 5) * 6) * dir + y * 7)
    for (let i = 0; i < r.w; i++) {
      const ch = s[(((i + off) % s.length) + s.length) % s.length]!
      if (ch !== ' ') c.put(r.x + i, y, ch, mul(y % 3 === 0 ? 0xff3030 : 0x801010, 0.35 + 0.65 * k))
    }
  }
}
function reticle(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  const R = r.h * (0.48 - 0.25 * outExpo(k))
  ring(c, cx, cy, R, (a) => (Math.sin(a * 12 + t * 8) > 0 ? 0xff3030 : 0x501010), 0, TAU, '█')
  ring(c, cx, cy, R * 0.6, () => 0xffffff, t * 3, t * 3 + TAU * 0.8, '·')
  c.line(r.x, cy, cx - R * c.aspect * 0.7, cy, 0xff3030, '━'); c.line(cx + R * c.aspect * 0.7, cy, r.x + r.w, cy, 0xff3030, '━')
  c.line(cx, r.y, cx, cy - R * 0.7, 0xff3030, '┃'); c.line(cx, cy + R * 0.7, cx, r.y + r.h, 0xff3030, '┃')
  c.text(cx + R * c.aspect * 0.7 + 2, cy - 2, `LOCK ${(k * 100).toFixed(0)}%`, 0xffffff)
}
function tunnel(x: Ctx, r: Rect) {
  const { c, t } = x
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  for (let k = 0; k < 10; k++) {
    const z = ((k + t * 3) % 10) / 10
    const s = z * z * 1.2
    const w = Math.round(r.w * s), h = Math.round(r.h * s)
    if (w < 4) continue
    c.box({ x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h }, mix(0x200404, 0xff3030, z), undefined, 'heavy')
  }
}

export const execution: Scene = {
  pal: RED,
  dock: () => 1,
  glitch: (x) => 0.25 + 0.55 * x.kick + 0.2 * seg(x.t, T(98), T(104)),
  title: (x) => `exec://${(LINES[curIn(x.t, 86, 104)]?.en ?? '').toLowerCase()}.bin`,
  readouts: (x) => [['hits', String(Math.max(0, Math.min(12, curIn(x.t, 86, 97) - 85)))], ['count', x.t >= T(98) && x.t < T(104) ? String(curIn(x.t, 98, 103) - 97) : '-'], ['target', 'me'], ['mercy', 'null']],
  log: (k) => `EXEC 0x${(k * 40503 >>> 0).toString(16).slice(-5)} KILL -9`,
  view(x, V) {
    const { c, t } = x
    const i = curIn(t, 86, 104)
    const l = LINES[i]!
    const lt = t - l.t0
    if (i >= 98 && i <= 103) {
      // countdown: giant digit, the spoken word underneath, a six-segment ring
      const n = i - 97
      c.fill(V, ' ', 0, n % 2 ? 0x180000 : 0x000000)
      const cx = V.x + V.w / 2, cy = V.y + V.h / 2
      const R = V.h * 0.44
      for (let s = 0; s < 6; s++) ring(c, cx, cy, R, () => (s < n ? mix(0xff3030, 0xffffff, s === n - 1 ? flash(t, l.t0, 0.15) : 0) : 0x300808), -Math.PI / 2 + (s * TAU) / 6 + 0.05, -Math.PI / 2 + ((s + 1) * TAU) / 6 - 0.05, '█')
      const s = 1 + 0.6 * (1 - outExpo(clamp01(lt / 0.12)))
      bigText(c, String(n), { x: cx, y: cy - 1, h: Math.min(V.h * 0.5, 18) * s, style: 'block', color: (_u, v) => mix(0xffffff, 0xff3030, v) })
      bigText(c, l.en, { x: cx, y: cy + V.h * 0.32, h: 3, style: 'block', color: () => 0xff8080 })
      return
    }
    const k = i - 86
    const mode = k % 4
    if (mode === 0) wall(x, V, l.en, 1 - lt)
    else if (mode === 1) { c.fill(V, ' ', 0, mul(0xff2020, 0.15 + 0.6 * Math.exp(-lt * 6))); reticle(x, V, clamp01(lt / 0.5)) }
    else if (mode === 2) tunnel(x, V)
    else { wall(x, V, l.en, 0.5); reticle(x, V, clamp01(lt / 0.4)) }
    if (i === 104) { tunnel(x, V); reticle(x, V, clamp01(lt / 0.6)) }
    const inv = mode === 1 && lt < 0.12
    const ys = [0.5, 0.3, 0.7, 0.5]
    const big = k % 3 === 2
    const band: Rect = big ? V : { x: V.x, y: Math.round(V.y + V.h * ys[k % 4]! - V.h * 0.25), w: V.w, h: Math.round(V.h * 0.5) }
    slam(x, band, l, { pal: inv ? [0, 0, 0, 0x000000, 0x200000] : RED, maxH: big ? 22 : 11, style: k % 5 === 3 ? 'outline' : 'block', out: 1 })
    // bullet holes accumulate through the run
    for (let h = 0; h < Math.min(40, (k + 1) * 3); h++) {
      const r = seeded(h * 7 + 3)
      const hx = V.x + r() * V.w, hy = V.y + r() * V.h
      c.text(Math.round(hx) - 1, Math.round(hy), '(*)', mix(0xffffff, 0x804040, clamp01((t - T(86 + Math.floor(h / 3))) * 2)))
    }
  },
}

// ── chorus 2 ────────────────────────────────────────────────────────────────────────────────────

const TARGETS = (() => { const r = seeded('targets'); return Array.from({ length: 16 }, (_, i) => ({ u: 0.08 + r() * 0.84, v: 0.12 + r() * 0.76, i })) })()

function targets(x: Ctx, r: Rect, a: number, b: number) {
  const { c, t } = x
  TARGETS.forEach((p, k) => {
    const px = r.x + p.u * r.w, py = r.y + p.v * r.h
    const hitT = a + ((b - a) * k) / TARGETS.length
    const dead = t >= hitT
    if (!dead) {
      const lock = clamp01(1 - (hitT - t) / 0.6)
      const R = 4 - 3 * lock
      c.text(Math.round(px), Math.round(py), '◉', 0xffffff)
      ring(c, px, py, R, () => (lock > 0 ? mix(0x601010, 0xff3030, lock) : 0x401010), 0, TAU, lock > 0.9 ? '█' : '·')
      c.text(Math.round(px) + 3, Math.round(py) - 1, `obj_${k.toString(16)}`, 0x9a6a6a)
    } else {
      const age = t - hitT
      if (age < 0.4) ring(c, px, py, 1 + age * 20, () => mul(0xffc0a0, 1 - age / 0.4), 0, TAU, '*')
      c.text(Math.round(px), Math.round(py), '✕', 0x803030)
    }
  })
}

function rewind(x: Ctx, r: Rect) {
  const { c, t } = x
  const lt = t - T(111)
  const list: [ActId, number][] = [['love', 0], ['vibrate', 108], ['switch', 96], ['organic', 82], ['chorus', 63], ['current', 56], ['geometry', 38], ['title', 25]]
  const k = Math.min(list.length - 1, Math.floor(lt * 3.2))
  const [id, at0] = list[k]!
  if (id !== 'love') {
    const sc = REG.scenes![id]!
    const a = ACTS.find((q) => q.id === id)!
    const y: Ctx = { ...x, t: at0 - lt * 2, act: a, lt: at0 - a.t0, pal: sc.pal ?? x.pal, accent: a.accent }
    sc.view?.(y, r)
  }
  for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
    const q = j * c.cols + i, l = luma(c.fg[q]!) * 255
    c.fg[q] = rgb(l * 0.8, l * 0.9, l * 1.2 + 20)
  }
  // VHS tracking band rolling upwards
  const band = r.y + r.h - ((lt * 30) % (r.h + 6))
  for (let j = 0; j < 3; j++) for (let i = r.x; i < r.x + r.w; i++) if (hash(i * 3 + j, x.frame) < 0.6) c.put(i, band + j, hash(i, x.frame + j) < 0.5 ? '▀' : '▄', 0xd0d8ff)
  c.text(r.x + 2, r.y + 1, ` ◀◀ REWIND  ×${(4 + lt * 6).toFixed(1)} `, 0x05080b, 0xd0d8ff)
  c.text(r.x + r.w - 22, r.y + r.h - 2, `-${(lt * 37).toFixed(2)}s`, 0xd0d8ff)
}

function cage(x: Ctx, r: Rect, k: number) {
  const { c } = x
  const drop = outExpo(k)
  for (let i = r.x + 3; i < r.x + r.w; i += 7) {
    const bot = r.y + Math.round(r.h * drop * (0.9 + 0.1 * Math.sin(i)))
    for (let y = r.y; y < bot; y++) { c.put(i, y, '║', 0xc0c8d0); c.put(i + 1, y, '▌', 0x40484f) }
  }
  if (k > 0.5) for (const f of [0.15, 0.85]) {
    const y = Math.round(r.y + r.h * f)
    for (let i = r.x; i < r.x + r.w * outExpo((k - 0.5) * 2); i++) c.put(i, y, i % 7 === 3 ? '╬' : '═', 0xc0c8d0)
  }
}

export const chorus2: Scene = {
  pal: [0x0c0204, 0x4a0a18, 0xc0203a, 0xff3a6a, 0xffe0e8],
  dock: (x) => { const i = curIn(x.t, 105, 115); return i >= 114 ? 1 - seg(x.t, T(114), T(114) + 0.6) : 1 },
  glitch: (x) => 0.2 + 0.3 * x.kick + 0.3 * seg(x.t, T(111), T(114)) * (1 - seg(x.t, T(114), T(114) + 0.2)),
  title: (x) => (curIn(x.t, 105, 115) >= 111 && curIn(x.t, 105, 115) < 114 ? 'vcr://memory' : 'exec://targets'),
  readouts: (x) => [['targets', String(TARGETS.filter((_, k) => x.t < T(105) + ((T(108) - T(105)) * k) / TARGETS.length).length)], ['want', 'you'], ['back', x.t >= T(111) && x.t < T(114) ? 'seeking' : 'no'], ['cage', x.t >= T(114) ? 'LOCKED' : 'open']],
  log: (k) => (k % 4 ? `seek -${(k * 0.37).toFixed(2)}s` : 'WARN cannot rewind time'),
  view(x, V) {
    const { c, t } = x
    const i = curIn(t, 105, 115)
    if (i <= 107) targets(x, V, T(105) + 0.2, T(107) + 0.4)
    else if (i <= 110) {
      targets(x, V, -1, 0)
      const cx = V.x + V.w / 2, cy = V.y + V.h / 2
      field(c, V, (u, v, px, py) => { const d = Math.abs(u) - (v + 1) * 0.2; if (d < 0) c.put(px, py, hash(px * 7 + py, x.frame) < 0.3 ? '·' : ' ', 0x806060, mix(0x1a0606, 0x401010, (v + 1) / 2)) })
      c.text(cx - 2, cy + V.h * 0.3, '◉ me', 0xffffff)
    } else if (i <= 113) rewind(x, V)
    else {
      field(c, V, (u, v, px, py) => { if (hash(px * 13 + py, 5) < 0.06) c.put(px, py, '·', 0x402028) })
      c.text(V.x + V.w / 2 - 2, V.y + V.h / 2, '> me', 0xffffff)
    }
    const h = hitAt(t, 105, 115)
    if (h) slam(x, V, h, { pal: RED, maxH: 10, out: 1 - 0.6 * seg(t, h.t0 + 0.45, h.t0 + 0.7) })
  },
  over(x) {
    if (x.t >= T(114)) cage(x, x.D, seg(x.t, T(114), T(115) + 0.8))
  },
}

// ── love ────────────────────────────────────────────────────────────────────────────────────────

const PINK = PAL.pink
const BOOK = [
  ['§7  On Loving Properly', '', '7.1  Definitions', 'Let H be a heart and Y a set of', 'persons. A love is a map', '    L : H → Y', 'that is total, monotone, and', 'survives every exception.', '', 'Exercise 7.1.3  Show that L is', 'not computable in finite time.'],
  ['7.2  Attention', '', 'attention(t) = ∫ care(τ) dτ', '', 'Lemma. attention diverges', 'iff the loop never yields.', '', 'Proof. Left to the reader,', 'who has left.  ∎'],
  ['7.3  Error handling', '', 'try { love() }', 'catch (e) { love() }', 'finally { love() }', '', 'Note: this handler does', 'not terminate.'],
]
const QA: [string, string][] = [
  ['typeof love', '"function"'], ['love.length', 'Infinity'], ['love === love', 'true'], ['love()', 'Promise { <pending> }'],
  ['you in world', 'false'], ['me.trapped', 'true'], ['Object.freeze(love)', 'TypeError: cannot freeze'], ['love.toString()', '"[native code]"'],
]

function book(x: Ctx, r: Rect) {
  const { c, t } = x
  const lt = t - T(116)
  const page = Math.min(BOOK.length - 1, Math.floor(lt / 0.95))
  const flip = (lt / 0.95) % 1
  const pw = Math.min(56, Math.floor(r.w / 2) - 4), ph = Math.min(r.h - 4, 18)
  const bx = Math.round(r.x + r.w / 2), by = r.y + Math.round((r.h - ph) / 2)
  const draw = (R: Rect, lines: string[], dim: number) => {
    c.fill(R, ' ', 0, mix(0x140810, 0x2a1420, dim))
    c.box(R, mix(0x5a2a40, PINK[3]!, dim * 0.6))
    lines.forEach((s, i) => { if (i < R.h - 2) c.text(R.x + 2, R.y + 1 + i, s.slice(0, R.w - 4), i === 0 ? PINK[3]! : mix(0x6a5060, 0xf0e0e8, dim)) })
  }
  draw({ x: bx - pw - 1, y: by, w: pw, h: ph }, BOOK[Math.max(0, page - 1)] ?? BOOK[0]!, 0.7)
  draw({ x: bx + 1, y: by, w: pw, h: ph }, BOOK[page]!, 1)
  if (flip < 0.3 && page > 0) {
    const w = Math.round(pw * Math.abs(Math.cos((flip / 0.3) * Math.PI)))
    const R = flip < 0.15 ? { x: bx + 1, y: by - 1, w, h: ph + 2 } : { x: bx - w - 1, y: by - 1, w, h: ph + 2 }
    if (w > 2) { c.fill(R, '░', 0x3a2030, 0x1a0c14); c.box(R, PINK[2]!) }
  }
  c.line(bx, by, bx, by + ph - 1, PINK[2]!, '┃')
}

function repl(x: Ctx, r: Rect) {
  const { c, t } = x
  const lt = t - T(119)
  const W = Math.min(r.w - 4, 70)
  r = { x: Math.round(r.x + (r.w - W) / 2), y: r.y + 2, w: W, h: r.h - 4 }
  c.fill(r, ' ', 0, 0x0e0610)
  c.box(r, PINK[2]!, 'love-repl', 'round')
  let y = r.y + 1
  c.text(r.x + 2, y++, 'love-repl 1.0  (type .help)', 0x6a5060)
  for (let k = 0; k < QA.length; k++) {
    const at = k * 0.42
    if (lt < at) break
    const [q, a] = QA[k]!
    const n = typed(t, T(119) + at, q.length, 50)
    c.text(r.x + 2, y, '> ', PINK[3]!); c.text(r.x + 4, y++, q.slice(0, n), 0xffffff)
    if (n >= q.length && lt > at + 0.25) c.text(r.x + 4, y++, a, a.startsWith('TypeError') ? 0xff6a6a : 0xffc0d8)
    if (y > r.y + r.h - 2) break
  }
  if (caret(t, 2)) c.put(r.x + 4, y, '█', PINK[3]!)
}

/** (x²+y²−1)³ − x²y³ = 0, typed, then traced over axes across the viewport. */
function equation(x: Ctx, r: Rect) {
  const { c, t } = x
  const lt = t - T(122)
  const eq = '(x² + y² − 1)³ − x²y³ = 0'
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + 2
  const S = r.h * 0.33
  for (let i = r.x; i < r.x + r.w; i++) c.put(i, cy, i % 4 ? '─' : '┼', 0x3a2030)
  for (let j = r.y; j < r.y + r.h; j++) c.put(cx, j, '│', 0x3a2030)
  // parametric heart for the trace: x = sin³θ, y = (13cosθ − 5cos2θ − 2cos3θ − cos4θ)/16
  const k = seg(t, T(122) + 0.4, T(123) + 0.2, inOutCubic)
  const N = 600
  for (let s = 0; s < N * k; s++) {
    const th = (s / N) * TAU
    const hx = Math.sin(th) ** 3, hy = (13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) / 16
    c.put(cx + hx * S * 1.2 * c.aspect, cy - hy * S * 1.2, '█', mix(PINK[2]!, 0xffffff, s / N > k - 0.03 ? 1 : 0))
  }
  const n = typed(t, T(122), [...eq].length, 18)
  c.pen = 1
  c.text(Math.round(cx - eq.length / 2), r.y + 2, [...eq].slice(0, n).join(''), 0xffffff)
  c.pen = 0
  c.text(r.x + 2, r.y + r.h - 2, `θ = ${(k * TAU).toFixed(3)} rad   area = π·(1.000)   solved: ${k >= 1 ? 'yes' : '…'}`, PINK[3]!)
}

/** Raymarched implicit heart: sign-change search along the ray, gradient normals. */
function heart3d(x: Ctx, r: Rect, o: { scale: number; spin: number; beat: number; cage: number }) {
  const { c, t } = x
  const F = (p: V3) => {
    const X = p[0] / o.scale, Y = -p[1] / o.scale, Z = p[2] / o.scale
    const a = X * X + 2.25 * Z * Z + Y * Y - 1
    return a * a * a - X * X * Y * Y * Y - 0.1125 * Z * Z * Y * Y * Y
  }
  const L = norm3([-0.5, -0.6, -0.7])
  field(c, r, (u, v, px, py) => {
    const rd = norm3([u, v, 1.6])
    const ro: V3 = [0, 0, -3.2]
    const P = (s: number): V3 => rotY([ro[0] + rd[0] * s, ro[1] + rd[1] * s, ro[2] + rd[2] * s], o.spin)
    let prev = F(P(1.6)), hitS = -1
    for (let i = 1; i <= 40; i++) {
      const s = 1.6 + i * 0.08
      const f = F(P(s))
      if (f < 0 && prev >= 0) { hitS = s; break }
      prev = f
    }
    if (hitS < 0) {
      if (o.cage > 0) {
        const d = Math.hypot(u, v * 1.1 + 0.15)
        const bars = Math.abs(Math.sin(Math.atan2(v, u) * 8 + t * 0.5))
        if (Math.abs(d - (0.9 + 0.05 * o.beat)) < 0.03 * o.cage + 0.005 || (bars < 0.06 && d < 0.95 && d > 0.15)) c.put(px, py, '#', mix(0x401020, PINK[3]!, o.cage))
      }
      return
    }
    let a = hitS - 0.08, b = hitS
    for (let k = 0; k < 5; k++) { const m = (a + b) / 2; if (F(P(m)) < 0) b = m; else a = m }
    const p = P(b), e = 0.01
    const n = norm3([F([p[0] + e, p[1], p[2]]) - F([p[0] - e, p[1], p[2]]), F([p[0], p[1] + e, p[2]]) - F([p[0], p[1] - e, p[2]]), F([p[0], p[1], p[2] + e]) - F([p[0], p[1], p[2] - e])])
    const nr = rotY(n, -o.spin)
    const dif = Math.max(0, dot3(nr, L)), spec = Math.max(0, dot3(nr, norm3([L[0] - rd[0], L[1] - rd[1], L[2] - rd[2]]))) ** 20
    const s = clamp01(0.1 + 0.7 * dif + 0.7 * spec)
    c.put(px, py, rampCh(s, ' .:-=+*#%@'), mix(hsl(0.96, 0.95, 0.3 + 0.45 * s), 0xffffff, spec * 0.8 + 0.3 * o.beat * s))
  })
}

export const love: Scene = {
  pal: PINK,
  dock: (x) => { const i = curIn(x.t, 116, 127); return i >= 122 ? 1 : 0.35 },
  glitch: (x) => 0.15 + 0.35 * flash(x.t, T(118), 0.2) + 0.35 * flash(x.t, T(127), 0.3),
  title: (x) => ['read://love.alg/ch7', 'repl://love', 'plot://heart.eq', 'render://heart.obj'][Math.min(3, Math.floor((curIn(x.t, 116, 127) - 116) / 3))]!,
  readouts: (x) => [['subject', 'love'], ['studied', `${Math.min(100, Math.floor((x.t - T(116)) * 9))}h`], ['answers', `${Math.max(0, Math.min(QA.length, Math.floor((x.t - T(119)) / 0.42) + 1))}/${QA.length}`], ['bpm(heart)', (72 + 40 * x.kick).toFixed(0)], ['free', x.t >= T(124) ? 'you' : '—'], ['trapped', x.t >= T(125) ? 'me' : '—']],
  log: (k) => `eval love[${k % 128}] -> ${k % 5 ? 'pending' : 'WARN no return'}`,
  bg(x) {
    const { c, t, D } = x
    for (let i = 0; i < 26; i++) {
      const r = seeded(i * 5 + 1)
      const px = D.x + r() * D.w, py = D.y + D.h - ((t * (2 + r() * 3) + r() * D.h) % D.h)
      c.put(px, py, r() < 0.5 ? '♥' : '·', mul(PINK[3]!, 0.25 + 0.2 * r()))
    }
  },
  view(x, V) {
    const { c, t } = x
    const i = curIn(t, 116, 127)
    if (i <= 118) book(x, V)
    else if (i <= 121) repl(x, V)
    else if (i <= 123) equation(x, V)
    else {
      const final = t >= T(127)
      const beat = x.kick
      const sc = final ? 1.05 + 0.3 * seg(t, T(127), T(127) + 4, outCubic) + 0.1 * beat : 0.95 + 0.06 * beat
      heart3d(x, V, { scale: sc, spin: (t - T(124)) * 0.9, beat, cage: seg(t, T(125), T(126) + 0.5) * (final ? 1 - seg(t, T(127), T(127) + 1) : 1) })
      if (t >= T(125) && !final) c.text(Math.round(V.x + V.w / 2 - 2), Math.round(V.y + V.h / 2), '> me', 0xffffff)
      if (final) {
        const k = seg(t, T(127) + 0.5, LINES[127]!.t1)
        field(c, V, (u, v, px, py) => {
          if (c.get(px, py) !== ' ') return
          const a = Math.atan2(v, u), d = Math.hypot(u, v)
          if (Math.sin(a * 24 + t) > 0.85 - 0.3 * k && d > 0.8) c.put(px, py, '·', mul(PINK[3]!, 0.3 + 0.4 * beat))
        })
      }
    }
    const h = hitAt(t, 116, 127)
    if (h) {
      // the melisma: letters ride a wave for the length of the note
      const lt = t - h.t0
      const ww = (wx: number, wy: number): [number, number] => [0, Math.sin(wx * 0.18 - lt * 9) * 1.2 * clamp01(lt * 3)]
      const hh = fitHeight(h.en, V.w * 0.9, i === 127 ? 9 : 7)
      const y = i >= 124 ? V.y + V.h * 0.82 : V.y + V.h * 0.2
      echo(x, 2, 0.06, (te, kk) => bigText(c, h.en, { x: V.x + V.w / 2, y, h: hh, style: 'block', warp: (a, b) => { const r = ww(a, b); return [r[0], r[1] + Math.sin(a * 0.18 - (te - h.t0) * 9) * 0] }, color: (u, v) => mul(mix(grad(PINK, 0.55 + 0.45 * (1 - v)), 0xffffff, flash(t, h.t0, 0.15)), kk) }))
    }
  },
}

// ── decay & finale ──────────────────────────────────────────────────────────────────────────────

const DUST = (() => { const r = seeded('dust'); return Array.from({ length: 420 }, () => { const th = r() * TAU; const hx = Math.sin(th) ** 3, hy = (13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) / 16; const s = Math.sqrt(r()); return { x: hx * s, y: hy * s, d: r(), v: r() } }) })()

export const decay: Scene = {
  pal: PINK,
  dock: (x) => 1 - seg(x.t, x.act.t0 + 3, x.act.t1 - 2, inOutCubic),
  wm: (x, ws) => {
    const ids = ['sys', 'mem', 'insp', 'trace'] as const
    ids.forEach((id, k) => { ws[id].on = seg(x.t, x.act.t0 + 3 + k * 1.2, x.act.t0 + 3.6 + k * 1.2) })
  },
  glitch: (x) => 0.2 + 0.45 * seg(x.t, x.act.t1 - 3, x.act.t1) ** 2,
  title: () => 'restore://world.exe',
  readouts: (x) => [['restore', `${Math.floor(x.p * 100)}%`], ['heart', 'dissolved'], ['you', 'null'], ['me', 'running']],
  log: (k) => (k % 3 ? `restore block ${k} ok` : `WARN block ${k} missing: you`),
  view(x, V) {
    const { c, t } = x
    const lt = t - x.act.t0
    const cx = V.x + V.w / 2, cy = V.y + V.h / 2, S = V.h * 0.36
    for (const p of DUST) {
      const go = clamp01(lt / 6 - p.d * 0.5)
      const px = cx + p.x * S * c.aspect + noise1(t * 0.7 + p.d * 9, 3) * go * 8, py = cy - p.y * S - go * go * V.h * (0.6 + p.v)
      if (py < V.y) continue
      c.put(px, py, go > 0.5 ? '·' : go > 0.2 ? '*' : '♥', mix(PINK[3]!, 0x3a2030, go))
    }
    const build = seg(t, x.act.t1 - 3.5, x.act.t1)
    if (build > 0) warp(c, V, t, 1 + build * 14, Math.floor(180 * build), (z) => mix(0xffffff, 0xff3030, z / 4), 21)
  },
}

export const finale: Scene = {
  pal: RED,
  dock: () => 1,
  glitch: (x) => (x.t < Math.min(LINES[128]!.t1, END - 3.6) ? 0.5 + 0.5 * x.kick : -0.15),
  title: () => 'exec://world.exe',
  readouts: () => [['process', 'me'], ['signal', 'SIGKILL'], ['exit', '0']],
  log: (k) => `shutdown: stopping service ${k % 12}`,
  view(x, V) {
    const { c, t } = x
    const l = LINES[128]!
    const end1 = Math.min(l.t1, END - 3.6)
    if (t < end1) {
      tunnel(x, V)
      wall(x, V, l.en, 0.4 * (1 - seg(t, end1 - 1, end1)))
      slam(x, V, l, { pal: RED, maxH: 16 })
      return
    }
    const lt = t - end1
    const msgs = ['[  OK  ] Stopped heart.sys', '[  OK  ] Stopped lyric.io', '[  OK  ] Unmounted /sim', '[  OK  ] Reached target: Power-Off', '', 'world.execute(me); → exit code 0']
    msgs.forEach((s, k) => { if (lt > k * 0.25) c.text(V.x + 4, V.y + 2 + k, s, k === msgs.length - 1 ? 0xffffff : 0x8a96a0) })
    if (lt > 1.6) c.text(V.x + 4, V.y + 10, 'music: Mili — world.execute(me);    visuals: ascii, cell by cell', 0x56626c)
  },
}
void Cam; void rotX; void spring; void inCubic; void dialog; void ACTS
