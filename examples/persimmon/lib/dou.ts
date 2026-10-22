// Dou (豆), a bean with a sprout: a 2D rig drawn with brushFrame. Flat wash, an ink outline that boils, drawn
// key views instead of 3D turns, faces from parts, emotions that act. Everything is a pure function of its
// options; the scene computes them from time.
import type { BrushFrame } from '@brushframe/core'
import { clamp01, hash, lerp, outBack } from '@cueframe/recipes/motion.js'
import { envelope, snappy } from '../../../kits/acting.js'

export type P = [number, number]
export type View = 'front' | 'q' | 'side'
export type Eyes = 'dot' | 'wide' | 'spark' | 'happy' | 'closed' | 'sad' | 'narrow' | 'swirl'
export type Mouth = 'none' | 'smile' | 'grin' | 'o' | 'O' | 'frown' | 'flat' | 'wobble'
export type Emote = 'none' | 'bang' | 'stars' | 'sweat' | 'hearts'

export const PAL = {
  ink: '#2B2233', body: '#F2E6CC', shade: '#D9C7A6', rose: '#E07A8A', sap: '#6E9F58', sapDk: '#4E7A3E',
  gloom: '#7C86B8', cream: '#FFF6E4', persimmon: '#E8642C', persimmonDk: '#B8441C',
}

export interface DouOptions {
  /** Ground point between the feet, world px; `u` is the size unit (the body is 10u wide, 7u tall). */
  x: number; y: number; u: number
  dx?: number; dy?: number
  /** Squash (> 0) or stretch (< 0) about the feet, keeping the volume. */
  sq?: number
  rot?: number
  view?: View
  /** Face to the left. */
  flip?: boolean
  eyes?: Eyes; mouth?: Mouth
  lookX?: number; lookY?: number
  /** 0..1 closes the eyes from any shape (blinks, squints before a take). */
  squint?: number
  blush?: number
  gloom?: number
  /** Arm angles in rad: 0 = out, + = up. */
  aL?: number; aR?: number
  /** Leg phase for walks (rad). */
  walk?: number
  /** Sprout lean in rad (follow-through) and droop 0..1. */
  sprout?: number; droop?: number
  emote?: Emote; emoteK?: number; emoteAge?: number
  /** Called in body space (front-view units, origin at the feet) after the body, to hold a prop. */
  hold?: (b: BrushFrame, u: number) => void
  /** Boil frame (12 per second) and a key unique to this character. */
  boil: number; key: string
  /** Outline weight scale (smaller in close-ups). */
  sw?: number
}

const WIDTH: Record<View, number> = { front: 1, q: 0.93, side: 0.84 }
const FACE: Record<View, number> = { front: 0, q: 1.5, side: 2.7 }

/** A stable jitter in [-a, a] for boil frame `bf`. */
const jit = (key: string, i: number, bf: number, a: number) => {
  let h = 2166136261
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (hash(i * 31 + bf * 977, h >>> 0) * 2 - 1) * a
}
const boiled = (pts: P[], key: string, bf: number, a: number): P[] => pts.map(([x, y], i) => [x + jit(key, 2 * i, bf, a), y + jit(key, 2 * i + 1, bf, a)])
const closed = (pts: P[]): P[] => [...pts, pts[0]!]

/** A rounded bean: flatter at the bottom, domed on top. */
export function beanPts(w: number, h: number, n = 36): P[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI
    const c = Math.cos(a), s = Math.sin(a)
    const e = s < 0 ? 0.95 : 0.7
    return [w * Math.sign(c) * Math.abs(c) ** e, -h / 2 - (h / 2) * Math.sign(s) * Math.abs(s) ** (s < 0 ? 1 : 0.5)] as P
  })
}
export const ellPts = (cx: number, cy: number, rx: number, ry: number, n = 20, rot = 0): P[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI, c = Math.cos(a) * rx, s = Math.sin(a) * ry
    return [cx + c * Math.cos(rot) - s * Math.sin(rot), cy + c * Math.sin(rot) + s * Math.cos(rot)] as P
  })
/** A capsule from a to b, `r` wide. */
function capsule(a: P, b: P, r: number, n = 8): P[] {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  const out: P[] = []
  for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 + (i / n) * Math.PI; out.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]) }
  for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 + (i / n) * Math.PI; out.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]) }
  return out
}
export function starPts(cx: number, cy: number, r: number, inner = 0.45, n = 5, rot = -Math.PI / 2): P[] {
  return Array.from({ length: 2 * n }, (_, i) => {
    const a = rot + (i * Math.PI) / n, rr = i % 2 ? r * inner : r
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as P
  })
}
export function heartPts(cx: number, cy: number, r: number, n = 28): P[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI
    return [cx + r * 0.06 * 16 * Math.sin(t) ** 3, cy - r * 0.06 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))] as P
  })
}

/** One shape: flat wash and a boiling ink outline, keyed per boil frame so still things hold for 2 frames. */
export function shape(b: BrushFrame, pts: P[], o: { key: string; bf: number; wash?: string; op?: number; ink?: string | null; sw?: number; boil?: number }) {
  const a = o.boil ?? 1.1
  const p = boiled(pts, o.key, o.bf, a)
  if (o.wash) {
    b.id(`${o.key}/w@${o.bf}`)
    b.noStroke()
    b.wash(o.wash, o.op ?? 255)
    b.polygon(p)
    b.noWash()
  }
  if (o.ink !== null) {
    b.id(`${o.key}/i@${o.bf}`)
    b.set('pen', o.ink ?? PAL.ink, o.sw ?? 1.6)
    b.spline(closed(p), 0.5)
  }
}
export function inkLine(b: BrushFrame, pts: P[], o: { key: string; bf: number; sw?: number; ink?: string; curve?: number; boil?: number }) {
  b.id(`${o.key}@${o.bf}`)
  b.set('pen', o.ink ?? PAL.ink, o.sw ?? 1.6)
  b.spline(boiled(pts, o.key, o.bf, o.boil ?? 0.9), o.curve ?? 0.5)
}

function eye(b: BrushFrame, kind: Eyes, x: number, y: number, u: number, o: { lx: number; ly: number; squint: number; side: number; key: string; bf: number; sw: number }) {
  const k = `${o.key}/eye${o.side}`
  const open = 1 - clamp01(o.squint)
  const ex = x + o.lx * 0.28 * u, ey = y + o.ly * 0.28 * u
  if (kind === 'happy' || (open < 0.25 && kind !== 'swirl')) {
    const up = kind === 'happy' ? -1 : 1
    inkLine(b, [[ex - 0.5 * u, ey], [ex, ey + up * 0.42 * u], [ex + 0.5 * u, ey]], { key: k, bf: o.bf, sw: o.sw * 1.5 })
    return
  }
  if (kind === 'closed') { inkLine(b, [[ex - 0.5 * u, ey], [ex, ey + 0.3 * u], [ex + 0.5 * u, ey]], { key: k, bf: o.bf, sw: o.sw * 1.5 }); return }
  if (kind === 'swirl') {
    const pts: P[] = Array.from({ length: 22 }, (_, i) => { const a = i * 0.62, r = 0.08 * u + i * 0.026 * u; return [x + r * Math.cos(a), y + r * Math.sin(a)] })
    inkLine(b, pts, { key: k, bf: o.bf, sw: o.sw * 1.2 })
    return
  }
  const big = kind === 'wide' ? 1.3 : 1
  const rx = 0.42 * u * big, ry = 0.62 * u * big * open * (kind === 'narrow' ? 0.7 : 1)
  shape(b, ellPts(ex, ey, rx, ry, 16), { key: k, bf: o.bf, wash: PAL.ink, ink: null })
  if (open > 0.6) {
    const hx = ex - rx * 0.35, hy = ey - ry * 0.4
    if (kind === 'spark') shape(b, starPts(hx, hy, 0.26 * u * big), { key: `${k}/hl`, bf: o.bf, wash: PAL.cream, ink: null, boil: 0.3 })
    else shape(b, ellPts(hx, hy, 0.13 * u * big, 0.15 * u * big, 10), { key: `${k}/hl`, bf: o.bf, wash: PAL.cream, ink: null, boil: 0.3 })
  }
  // lids: sad droops at the outside, narrow (determined) cuts the top flat
  if (kind === 'sad') inkLine(b, [[ex - o.side * 0.65 * u, ey - 0.95 * u], [ex + o.side * 0.55 * u, ey - 0.55 * u]], { key: `${k}/lid`, bf: o.bf, sw: o.sw * 1.3 })
  if (kind === 'narrow') inkLine(b, [[ex - o.side * 0.7 * u, ey - 1.15 * u], [ex + o.side * 0.45 * u, ey - 0.8 * u]], { key: `${k}/brow`, bf: o.bf, sw: o.sw * 1.6 })
}

function mouth(b: BrushFrame, kind: Mouth, x: number, y: number, u: number, key: string, bf: number, sw: number) {
  const k = `${key}/mouth`
  switch (kind) {
    case 'none': return
    case 'smile': inkLine(b, [[x - 0.6 * u, y - 0.1 * u], [x, y + 0.35 * u], [x + 0.6 * u, y - 0.1 * u]], { key: k, bf, sw: sw * 1.3 }); return
    case 'frown': inkLine(b, [[x - 0.55 * u, y + 0.3 * u], [x, y - 0.05 * u], [x + 0.55 * u, y + 0.3 * u]], { key: k, bf, sw: sw * 1.3 }); return
    case 'flat': inkLine(b, [[x - 0.45 * u, y + 0.1 * u], [x + 0.45 * u, y + 0.05 * u]], { key: k, bf, sw: sw * 1.3 }); return
    case 'wobble': inkLine(b, Array.from({ length: 9 }, (_, i) => [x - 0.6 * u + i * 0.15 * u, y + 0.12 * u * Math.sin(i * 1.7)] as P), { key: k, bf, sw: sw * 1.2 }); return
    case 'o': shape(b, ellPts(x, y + 0.1 * u, 0.22 * u, 0.26 * u, 12), { key: k, bf, wash: PAL.ink, ink: null }); return
    case 'O': shape(b, ellPts(x, y + 0.2 * u, 0.36 * u, 0.48 * u, 14), { key: k, bf, wash: PAL.ink, ink: null }); return
    case 'grin': {
      const d: P[] = [[x - 0.75 * u, y - 0.15 * u], [x + 0.75 * u, y - 0.15 * u], [x + 0.45 * u, y + 0.5 * u], [x, y + 0.65 * u], [x - 0.45 * u, y + 0.5 * u]]
      shape(b, d, { key: k, bf, wash: PAL.ink, ink: null, boil: 0.5 })
      shape(b, ellPts(x, y + 0.42 * u, 0.32 * u, 0.15 * u, 10), { key: `${k}/t`, bf, wash: PAL.rose, ink: null, boil: 0.3 })
    }
  }
}

function emote(b: BrushFrame, kind: Emote, x: number, y: number, u: number, k: number, age: number, key: string, bf: number, sw: number) {
  if (kind === 'none' || k <= 0) return
  const s = outBack(clamp01(k), 2.2)
  const ek = `${key}/emote`
  if (kind === 'bang') {
    const h = 2.6 * u * s
    shape(b, [[x - 0.38 * u * s, y - h], [x + 0.38 * u * s, y - h], [x + 0.12 * u * s, y - 0.75 * u * s], [x - 0.12 * u * s, y - 0.75 * u * s]], { key: ek, bf, wash: PAL.persimmonDk, sw })
    shape(b, ellPts(x, y - 0.2 * u * s, 0.24 * u * s, 0.24 * u * s, 10), { key: `${ek}/dot`, bf, wash: PAL.persimmonDk, sw })
  } else if (kind === 'stars') {
    for (let i = 0; i < 3; i++) {
      const a = age * 5 + (i * 2 * Math.PI) / 3
      shape(b, starPts(x + Math.cos(a) * 2.6 * u, y + Math.sin(a) * 0.7 * u, 0.55 * u * s, 0.45, 5, a), { key: `${ek}/${i}`, bf, wash: '#F2C14E', sw: sw * 0.8 })
    }
  } else if (kind === 'sweat') {
    const dy = 0.4 * u * Math.min(1, age)
    shape(b, [[x, y - 0.6 * u * s + dy], ...ellPts(x, y + 0.15 * u * s + dy, 0.35 * u * s, 0.4 * u * s, 14).slice(0, 11)], { key: ek, bf, wash: '#9CC6E4', sw: sw * 0.8 })
  } else if (kind === 'hearts') {
    for (let i = 0; i < 2; i++) {
      const rise = ((age * 0.6 + i * 0.5) % 1)
      const hx = x + (i ? 1.6 : -1.2) * u + Math.sin(age * 3 + i) * 0.3 * u, hy = y - rise * 2.2 * u
      shape(b, heartPts(hx, hy, (1 + 0.25 * i) * u * s * (1 - 0.4 * rise)), { key: `${ek}/${i}`, bf, wash: PAL.rose, sw: sw * 0.8 })
    }
  }
}

/** Draws Dou. Body space: front-view units with the origin at the feet, x right, y down. */
export function dou(b: BrushFrame, o: DouOptions) {
  const u = o.u, view = o.view ?? 'front', dir = o.flip ? -1 : 1, bf = o.boil, sw = o.sw ?? 1.6
  const sq = o.sq ?? 0
  const sx = (1 + sq) * WIDTH[view], sy = 1 / (1 + sq)
  const key = o.key
  b.push()
  b.translate(o.x + (o.dx ?? 0) * u, o.y + (o.dy ?? 0) * u)
  b.rotate(o.rot ?? 0)

  // contact shadow stays on the ground: it shrinks as Dou rises
  const lift = Math.max(0, -(o.dy ?? 0))
  shape(b, ellPts(0, 0.15 * u - (o.dy ?? 0) * u, 4.6 * u * sx / (1 + lift * 0.15), 0.7 * u / (1 + lift * 0.15), 18), { key: `${key}/shadow`, bf, wash: '#000000', op: 40, ink: null, boil: 0.4 })

  const W = 5 * u * sx, H = 7 * u * sy, legH = 1.1 * u
  const top = -legH - H
  const cy = -legH - H / 2

  // legs (behind the body): a trot swings them in opposite phase
  for (const side of [-1, 1]) {
    const ph = (o.walk ?? 0) + (side > 0 ? Math.PI : 0)
    const swing = o.walk === undefined ? 0 : Math.sin(ph) * 0.9 * u
    const raise = o.walk === undefined ? 0 : Math.max(0, Math.cos(ph)) * 0.45 * u
    const lx = (view === 'side' ? side * 0.9 * u : side * 2 * u * sx) + swing * dir
    shape(b, capsule([lx, -legH - 0.2 * u], [lx + swing * 0.15 * dir, -0.45 * u - raise], 0.62 * u), { key: `${key}/leg${side}`, bf, wash: PAL.shade, sw })
  }

  // the body, with a shade on the side away from the light (upper left)
  const body = beanPts(W, H).map(([x, y]) => [x, y - legH] as P)
  shape(b, body, { key: `${key}/body`, bf, wash: PAL.body, ink: null })
  const shade = body.filter(([x, y]) => x > W * 0.15 || y > cy + H * 0.28).map(([x, y]) => [x - W * 0.06, y - H * 0.03] as P)
  if (shade.length > 3) shape(b, shade, { key: `${key}/shade`, bf, wash: PAL.shade, op: 110, ink: null, boil: 0.6 })
  if ((o.gloom ?? 0) > 0) shape(b, body.filter(([, y]) => y < cy - H * 0.22), { key: `${key}/gloom`, bf, wash: PAL.gloom, op: Math.round(80 * clamp01(o.gloom!)), ink: null, boil: 0.6 })
  shape(b, body, { key: `${key}/outline`, bf, ink: PAL.ink, sw: sw * 1.25 })
  if ((o.gloom ?? 0) > 0.3) for (const [i, gx] of [-1.2, 0, 1.2].entries()) inkLine(b, [[gx * u, top + 0.5 * u], [gx * u, top + (1.2 + 0.5 * clamp01(o.gloom!)) * u]], { key: `${key}/gl${i}`, bf, sw: sw * 0.9 })

  // arms: nubs from the shoulders; the far arm hides in side view
  const shoulderY = cy + 0.4 * u
  for (const side of [-1, 1]) {
    if (view === 'side' && side * dir < 0) continue
    const a = side < 0 ? (o.aL ?? -0.5) : (o.aR ?? -0.5)
    // side view: a short nub on the near side that swings fore and aft with the walk
    const sx0 = view === 'side' ? dir * 0.15 * W : side * (W - 0.6 * u)
    const len = view === 'side' ? 1.1 * u : 1.9 * u
    const ax = view === 'side' ? sx0 + dir * Math.cos(a) * 0.6 * len : sx0 + side * Math.cos(a) * len
    const ay = view === 'side' ? shoulderY + 0.8 * len : shoulderY - Math.sin(a) * len
    shape(b, capsule([sx0, shoulderY], [ax, ay], 0.6 * u), { key: `${key}/arm${side}`, bf, wash: PAL.body, sw })
  }

  // face
  const fx = FACE[view] * u * dir
  const eyeY = cy - 0.9 * u
  const lx = (o.lookX ?? 0) * dir, ly = o.lookY ?? 0
  const sides = view === 'side' ? [1] : [-1, 1]
  for (const side of sides) {
    const spread = view === 'front' ? 1.75 : view === 'q' ? 1.45 : 0
    const ex = fx + side * spread * u * (view === 'q' && side * dir < 0 ? 0.8 : 1)
    eye(b, o.eyes ?? 'dot', ex, eyeY, u * (view === 'q' && side * dir < 0 ? 0.88 : 1), { lx, ly, squint: o.squint ?? 0, side: side * dir, key, bf, sw })
  }
  if ((o.blush ?? 0) > 0) for (const side of sides) {
    const bx = fx + side * (view === 'front' ? 2.9 : 2.4) * u
    shape(b, ellPts(bx, eyeY + 1.1 * u, 0.7 * u, 0.36 * u, 14), { key: `${key}/blush${side}`, bf, wash: PAL.rose, op: Math.round(170 * clamp01(o.blush!)), ink: null, boil: 0.4 })
  }
  mouth(b, o.mouth ?? 'none', fx + (view === 'side' ? 0.6 * u * dir : 0), eyeY + 1.45 * u, u, key, bf, sw)

  // the sprout: a stem and two leaves that lean with follow-through and droop when sad
  const lean = (o.sprout ?? 0) + (o.droop ?? 0) * 0.5 * dir
  const st: P = [0, top + 0.25 * u]
  const tip: P = [st[0] + Math.sin(lean) * 2 * u, st[1] - Math.cos(lean) * 2 * u * (1 - 0.35 * (o.droop ?? 0))]
  inkLine(b, [st, [lerp(st[0], tip[0], 0.4), lerp(st[1], tip[1], 0.55)], tip], { key: `${key}/stem`, bf, sw: sw * 1.3, ink: PAL.sapDk })
  for (const side of [-1, 1]) {
    const a = lean + side * (1.05 + 0.45 * (o.droop ?? 0))
    shape(b, ellPts(tip[0] + Math.sin(a) * 0.85 * u, tip[1] - Math.cos(a) * 0.85 * u, 0.95 * u, 0.42 * u, 16, a - Math.PI / 2), { key: `${key}/leaf${side}`, bf, wash: PAL.sap, sw: sw * 0.9 })
  }

  if (o.hold) o.hold(b, u)
  emote(b, o.emote ?? 'none', fx * 0.6 + 4.2 * u * dir, top - 0.4 * u, u, o.emoteK ?? 1, o.emoteAge ?? 0, key, bf, sw)
  b.pop()
}

// Emotions: a face, a colour and an idle, all from time. `emotions()` acts a change: a squint just before the
// key (anticipation), the new face under it, a take sized to the new mood, the emote popping in.
interface Mood { eyes: Eyes; mouth: Mouth; blush?: number; gloom?: number; droop?: number; take: number; emote?: Emote; idle: (t: number) => { dy?: number; sq?: number; rot?: number; aL?: number; aR?: number } }
const BEAT = 60 / 96
export const MOODS: Record<string, Mood> = {
  neutral: { eyes: 'dot', mouth: 'none', take: 0.3, idle: (t) => ({ sq: 0.015 * Math.sin((2 * Math.PI * t) / 3.2) }) },
  curious: { eyes: 'dot', mouth: 'o', take: 0.5, idle: (t) => ({ rot: 0.04 * Math.sin(t * 1.4) }) },
  surprised: { eyes: 'wide', mouth: 'O', take: 1.2, emote: 'bang', idle: () => ({ aL: 0.5, aR: 0.5 }) },
  excited: { eyes: 'spark', mouth: 'grin', blush: 0.5, take: 0.8, idle: (t) => { const p = Math.abs(Math.sin((Math.PI * t) / BEAT)); return { dy: -0.6 * p, sq: 0.06 - 0.12 * p, aL: 0.6 + 0.4 * p, aR: 0.6 + 0.4 * p } } },
  determined: { eyes: 'narrow', mouth: 'flat', take: 0.4, idle: (t) => ({ sq: 0.02 * Math.sin(t * 9) }) },
  sad: { eyes: 'sad', mouth: 'frown', gloom: 0.8, droop: 1, take: 0.5, emote: 'sweat', idle: (t) => ({ sq: 0.06, rot: 0.03 * Math.sin(t * 1.1), aL: -1.1, aR: -1.1 }) },
  dizzy: { eyes: 'swirl', mouth: 'wobble', take: 0.9, emote: 'stars', idle: (t) => ({ rot: 0.1 * Math.sin(t * 6) }) },
  joy: { eyes: 'happy', mouth: 'grin', blush: 0.9, take: 0.9, emote: 'hearts', idle: (t) => { const p = Math.abs(Math.sin((Math.PI * t) / BEAT)); return { dy: -0.35 * p, sq: 0.05 - 0.08 * p } } },
}

export type Key = [at: number, mood: keyof typeof MOODS, over?: Partial<DouOptions>]

/** The acted state at t for a list of [time, mood, overrides] keys (sorted). */
export function emotions(t: number, keys: Key[]): Partial<DouOptions> {
  let i = 0
  while (i + 1 < keys.length && t >= keys[i + 1]![0]) i++
  const [at, name, over] = keys[i]!
  const m = MOODS[name]!
  const next = keys[i + 1]
  // squint into the next key and out of this one
  const sIn = next ? clamp01(1 - (next[0] - t) / 0.09) : 0
  const sOut = clamp01(1 - (t - at) / 0.1)
  const squint = i > 0 ? Math.max(sIn, sOut * 0.9) : sIn
  const take = i > 0 ? m.take * envelope(t, at, { in: 0.12, out: 0.4 }, snappy) : 0
  const idle = m.idle(t - at)
  const age = t - at
  return {
    eyes: m.eyes, mouth: m.mouth, blush: m.blush ?? 0, gloom: (m.gloom ?? 0) * clamp01(age / 0.5), droop: (m.droop ?? 0) * clamp01(age / 0.6),
    dy: (idle.dy ?? 0) - 0.5 * take, sq: (idle.sq ?? 0) - 0.12 * take, rot: idle.rot ?? 0,
    aL: idle.aL ?? -0.5, aR: idle.aR ?? -0.5, squint,
    emote: m.emote ?? 'none', emoteK: clamp01(age / 0.25), emoteAge: age,
    ...over,
  }
}
