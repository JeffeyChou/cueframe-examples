// Shared look, worlds and timing of the slice. Visual times come from the narration (cues, words)
// and the bed's beat grid; worlds and layer art are seeded, built once in mount.
import { seeded } from '@cueframe/core'
import { follow } from '@cueframe/recipes/camera.js'
import cueTable from './build/cues.json'
export { said } from '@cueframe/recipes/subtitles.js'
export { seg, outCubic, inOutCubic, outBack, clamp01, lerp } from '@cueframe/recipes/motion.js'

export const CUES: Record<string, number> = cueTable
export const start = (id: string) => CUES[`scene.${id}.start`]!
export const end = (id: string) => CUES[`scene.${id}.end`]!

export const BPM = 120
export const BEAT = 60 / BPM
/** First beat at or after t (the bed starts on beat 0 at t = 0). */
export const onBeat = (t: number) => Math.ceil(t / BEAT - 1e-6) * BEAT

export const SANS = '"Noto Sans SC", sans-serif'
export const MONO = '"Plex Mono", "Noto Sans SC", ui-monospace, monospace'
export const C = { bg: '#0b1020', stone: '#8f95a3', stoneHi: '#c9ced8', stoneLo: '#565c6b', glow: '#ffe9a0', gold: '#c9a54a', text: '#eef1f6', body: '#f2a08f', eye: '#2b1622' }

export function el<K extends keyof HTMLElementTagNameMap>(parent: Element, tag: K, style: Partial<CSSStyleDeclaration> = {}, text?: string) {
  const e = document.createElement(tag)
  Object.assign(e.style, { position: 'absolute', ...style })
  if (text !== undefined) e.textContent = text
  parent.append(e)
  return e
}

// ── Layers of the board, top to bottom ────────────────────────────────────────────────────────
export type Kind = 'signal' | 'gnd' | 'pwr'
export interface Layer { name: string; kind: Kind; color: string; hat: string; seed: number }
export const LAYERS: Layer[] = [
  { name: 'F.Cu', kind: 'signal', color: '#3ff0b0', hat: '#ffd23f', seed: 11 },
  { name: 'In1.Cu', kind: 'gnd', color: '#1f9e86', hat: '#5ad1ff', seed: 12 },
  { name: 'In2.Cu', kind: 'signal', color: '#ff4f86', hat: '#ff7a5c', seed: 13 },
  { name: 'In3.Cu', kind: 'signal', color: '#9b6bff', hat: '#9cff6b', seed: 14 },
  { name: 'In4.Cu', kind: 'pwr', color: '#7a3fd6', hat: '#ffffff', seed: 15 },
  { name: 'In5.Cu', kind: 'gnd', color: '#2f8f3f', hat: '#ff5ad1', seed: 16 },
  { name: 'In6.Cu', kind: 'signal', color: '#9cff3f', hat: '#3fa0ff', seed: 17 },
  { name: 'In7.Cu', kind: 'signal', color: '#4fb0ff', hat: '#ffb03f', seed: 18 },
  { name: 'In8.Cu', kind: 'gnd', color: '#2a62c9', hat: '#e04040', seed: 19 },
  { name: 'B.Cu', kind: 'signal', color: '#ffab2e', hat: '#6b4fff', seed: 20 },
]

// ── Pixel sprites ─────────────────────────────────────────────────────────────────────────────
const SPRITE = [
  '...hhhhh...',
  '..hhhhhhh..',
  '.HHHHHHHHH.',
  '..bbbbbbb..',
  '.bbbbbbbbb.',
  'bbbebbbebbb',
  'bbbebbbebbb',
  'bbbbbbbbbbb',
  '.bbbbbbbbb.',
  '.b.b...b.b.',
]
export const SPRITE_W = 11
export const SPRITE_H = 10

/** A rider: pixel art at `px` per pixel, centred on (x, y), feet bobbing with t. */
export function sprite(g: CanvasRenderingContext2D, x: number, y: number, px: number, hat: string, t: number, look = 0) {
  const ox = Math.round(x - (SPRITE_W * px) / 2)
  const oy = Math.round(y - (SPRITE_H * px) / 2 + (Math.sin(t * 9) > 0 ? 0 : px))
  const hatDark = shade(hat, -0.25)
  for (let r = 0; r < SPRITE.length; r++) {
    const row = SPRITE[r]!
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.') continue
      let col = C.body
      let cc = c
      if (ch === 'h') col = hat
      else if (ch === 'H') col = hatDark
      else if (ch === 'e') { col = C.eye; cc = c + look }
      if (r === 9 && Math.sin(t * 9 + c) > 0.6) continue // legs paddle
      g.fillStyle = col
      g.fillRect(ox + cc * px, oy + r * px, px, px)
    }
  }
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}

/** A grey pixel "stone" (a pad seen as an obstacle): a bevelled blob of `px` pixels. */
const STONE = ['.###.', '#####', '#####', '.###.']
export function stone(g: CanvasRenderingContext2D, x: number, y: number, px: number, big = false) {
  const rows = big ? ['..####..', '.######.', '########', '########', '.######.', '..####..'] : STONE
  const w = rows[0]!.length
  const ox = Math.round(x - (w * px) / 2), oy = Math.round(y - (rows.length * px) / 2)
  rows.forEach((row, r) => {
    for (let c = 0; c < w; c++) {
      if (row[c] !== '#') continue
      g.fillStyle = r === 0 || (row[c - 1] !== '#' && r < rows.length / 2) ? C.stoneHi : r === rows.length - 1 || row[c + 1] !== '#' ? C.stoneLo : C.stone
      g.fillRect(ox + c * px, oy + r * px, px, px)
    }
  })
}

// ── A routing world: a bus of parallel traces with 45° bends, stones beside it ────────────────
export interface Pt { x: number; y: number }
export interface World {
  path: Pt[]           // centreline, 45° multiples
  lens: number[]       // cumulative length at each vertex
  total: number
  lanes: Pt[][]        // offset polylines, one per trace, vertex for vertex with `path`
  stones: { x: number; y: number; big: boolean }[]
  color: string
  hat: string
  speed: number        // px per second
  t0: number           // world time at which the bus starts
}

const DIRS: Pt[] = [{ x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 }, { x: -1, y: -1 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }]

export function world(seed: number, color: string, hat: string, o: { lanes?: number; gap?: number; speed?: number; t0?: number } = {}): World {
  const rnd = seeded(seed)
  const nl = o.lanes ?? 4, gap = o.gap ?? 20
  // Wander mostly east, turning by 45° at a time, never back on itself.
  const path: Pt[] = [{ x: 0, y: 0 }]
  let d = 0
  for (let i = 0; i < 40; i++) {
    const turn = i === 0 ? 0 : rnd() < 0.75 ? (rnd() < 0.5 ? 1 : -1) : 0
    d = [7, 0, 1].includes((d + turn + 8) % 8) ? (d + turn + 8) % 8 : 0
    const L = 110 + rnd() * 200
    const p = path[path.length - 1]!
    const u = DIRS[d]!
    const n = Math.hypot(u.x, u.y)
    path.push({ x: p.x + (u.x / n) * L, y: p.y + (u.y / n) * L })
  }
  const lens = [0]
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y))
  const lanes: Pt[][] = []
  for (let k = 0; k < nl; k++) lanes.push(offset(path, (k - (nl - 1) / 2) * gap))
  // Stones on a jittered grid, kept off the bus; a boulder where the bus would have gone straight on.
  const stones: World['stones'] = []
  const minX = -600, maxX = path[path.length - 1]!.x + 600
  const ys = path.map((p) => p.y)
  const minY = Math.min(...ys) - 700, maxY = Math.max(...ys) + 700
  for (let x = minX; x < maxX; x += 92) for (let y = minY; y < maxY; y += 92) {
    const sx = x + (rnd() - 0.5) * 40, sy = y + (rnd() - 0.5) * 40
    if (rnd() < 0.35) continue
    if (distToPath(path, sx, sy) < (nl * gap) / 2 + 34) continue
    stones.push({ x: sx, y: sy, big: false })
  }
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1]!, b = path[i]!, c = path[i + 1]!
    const ux = b.x - a.x, uy = b.y - a.y, n = Math.hypot(ux, uy)
    const turned = Math.abs((ux / n) * (c.y - b.y) - (uy / n) * (c.x - b.x)) > 1
    if (!turned) continue
    const bx = b.x + (ux / n) * 120, by = b.y + (uy / n) * 120
    if (distToPath(path, bx, by) > (nl * gap) / 2 + 40) stones.push({ x: bx, y: by, big: true })
  }
  return { path, lens, total: lens[lens.length - 1]!, lanes, stones, color, hat, speed: o.speed ?? 260, t0: o.t0 ?? 0 }
}

function offset(path: Pt[], d: number): Pt[] {
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)]!, b = path[Math.min(path.length - 1, i + 1)]!
    const n1 = norm(i > 0 ? sub(p, a) : sub(b, p)), n2 = norm(i < path.length - 1 ? sub(b, p) : sub(p, a))
    const m = norm({ x: -(n1.y + n2.y), y: n1.x + n2.x })
    const cos = m.x * -n1.y + m.y * n1.x
    return { x: p.x + (m.x * d) / cos, y: p.y + (m.y * d) / cos }
  })
}
const sub = (a: Pt, b: Pt) => ({ x: a.x - b.x, y: a.y - b.y })
const norm = (v: Pt) => { const n = Math.hypot(v.x, v.y) || 1; return { x: v.x / n, y: v.y / n } }

function distToPath(path: Pt[], x: number, y: number): number {
  let best = Infinity
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!
    const vx = b.x - a.x, vy = b.y - a.y
    const k = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)))
    best = Math.min(best, Math.hypot(a.x + vx * k - x, a.y + vy * k - y))
  }
  return best
}

/** Segment index and fraction at centreline length s. */
function at(w: World, s: number): [number, number] {
  let i = 1
  while (i < w.lens.length - 1 && w.lens[i]! < s) i++
  return [i, (s - w.lens[i - 1]!) / (w.lens[i]! - w.lens[i - 1]!)]
}
const mix = (a: Pt, b: Pt, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })

/** Where the head of lane k (or the centreline, k = -1) is at length s. */
export function headAt(w: World, s: number, k = -1): Pt {
  const [i, f] = at(w, Math.max(0, s))
  const line = k < 0 ? w.path : w.lanes[k]!
  return mix(line[i - 1]!, line[i]!, f)
}
export const lengthAt = (w: World, t: number) => Math.max(0, (t - w.t0) * w.speed)

/** The camera: the head smoothed over the last 1.3 s (a pure function of t), so turns swing the rider on screen. */
export const cameraAt = (w: World, t: number): Pt =>
  follow((u) => headAt(w, lengthAt(w, u)), t, { window: 1.17, taps: 10, lead: { x: 160, y: 0 } })

/**
 * Draw world `w` at time t into rect r of g: the camera follows the head, `zoom` scales the world
 * (1 = native). Stones, traces drawn up to the head, glowing heads, the rider.
 */
export function drawWorld(g: CanvasRenderingContext2D, w: World, t: number, r: { x: number; y: number; w: number; h: number }, zoom: number, riderPx = 7, bg: string = C.bg) {
  let rider: { x: number; y: number; look: number } | undefined
  g.save()
  g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip()
  g.fillStyle = bg; g.fillRect(r.x, r.y, r.w, r.h)
  const cam = cameraAt(w, t)
  g.translate(r.x + r.w / 2, r.y + r.h / 2); g.scale(zoom, zoom); g.translate(-cam.x, -cam.y)
  const hw = r.w / 2 / zoom + 60, hh = r.h / 2 / zoom + 60
  const px = 6
  for (const s of w.stones) {
    if (Math.abs(s.x - cam.x) > hw || Math.abs(s.y - cam.y) > hh) continue
    stone(g, s.x, s.y, s.big ? 12 : px, s.big)
  }
  // The chip the bus leaves from, pins on its right edge.
  if (Math.abs(cam.x + 140) < hw + 200) {
    g.fillStyle = '#1a2033'; g.fillRect(-300, -180, 270, 360)
    g.strokeStyle = '#2c3550'; g.lineWidth = 4; g.strokeRect(-300, -180, 270, 360)
    g.fillStyle = C.gold
    for (let k = -8; k < 8; k++) g.fillRect(-36, (k + 0.5) * 20 - 4, 36, 8)
  }
  const L = lengthAt(w, t)
  if (L > 0) {
    const [i, f] = at(w, L)
    g.lineWidth = 4; g.lineJoin = 'miter'; g.strokeStyle = w.color
    for (const lane of w.lanes) {
      g.beginPath(); g.moveTo(lane[0]!.x, lane[0]!.y)
      for (let j = 1; j < i; j++) g.lineTo(lane[j]!.x, lane[j]!.y)
      const h = mix(lane[i - 1]!, lane[i]!, f)
      g.lineTo(h.x, h.y); g.stroke()
    }
    g.save()
    g.shadowColor = C.glow; g.shadowBlur = 18; g.fillStyle = C.glow
    for (let k = 0; k < w.lanes.length; k++) { const h = headAt(w, L, k); g.beginPath(); g.arc(h.x, h.y, 6, 0, Math.PI * 2); g.fill() }
    g.restore()
    // Sparks thrown back from the heads, positions keyed on length so any frame draws the same.
    const head = headAt(w, L)
    const back = headAt(w, L - 30)
    for (let k = 0; k < 6; k++) {
      const a = (Math.sin((L * 0.05 + k * 1.7) * 3.1) * 0.5 + 0.5) * Math.PI * 2
      const rr = 10 + ((L * 0.7 + k * 23) % 30)
      g.fillStyle = `rgba(255,233,160,${(1 - rr / 40).toFixed(3)})`
      g.fillRect(back.x + Math.cos(a) * rr - 2, back.y + Math.sin(a) * rr - 2, 4, 4)
    }
    rider = { x: head.x, y: head.y, look: head.x - back.x >= 0 ? 1 : -1 }
  }
  g.restore()
  // The rider keeps a readable size when the world is zoomed out (pixel art stays on whole pixels).
  if (rider && riderPx > 0) {
    const sx = r.x + r.w / 2 + (rider.x - cam.x) * zoom, sy = r.y + r.h / 2 + (rider.y - cam.y) * zoom
    g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip()
    sprite(g, sx, sy - (SPRITE_H * riderPx) / 2 - 6, riderPx, w.hat, t, rider.look)
    g.restore()
  }
}

// ── Layer artwork: seeded copper for each layer, drawn once ───────────────────────────────────
export const ART_W = 900, ART_H = 600
const artCache = new Map<string, HTMLCanvasElement>()

/** The copper of one layer as a canvas (ART_W × ART_H): routed buses, or a pour with antipads. */
export function layerArt(L: Layer): HTMLCanvasElement {
  const hit = artCache.get(L.name)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = ART_W; cv.height = ART_H
  const g = cv.getContext('2d')!
  const rnd = seeded(L.seed * 7919)
  g.fillStyle = '#0a0e1a'; g.fillRect(0, 0, ART_W, ART_H)
  const vias: Pt[] = []
  for (let i = 0; i < 140; i++) vias.push({ x: 40 + rnd() * (ART_W - 80), y: 40 + rnd() * (ART_H - 80) })
  if (L.kind === 'signal') {
    g.strokeStyle = L.color; g.lineWidth = 2.2; g.lineJoin = 'miter'
    for (let b = 0; b < 26; b++) {
      let x = rnd() * ART_W, y = rnd() * ART_H, d = Math.floor(rnd() * 8)
      const n = 2 + Math.floor(rnd() * 5)
      const pts: Pt[] = [{ x, y }]
      for (let s = 0; s < 5; s++) {
        d = (d + (rnd() < 0.5 ? 1 : -1) + 8) % 8
        const u = DIRS[d]!, len = 40 + rnd() * 160, m = Math.hypot(u.x, u.y)
        x += (u.x / m) * len; y += (u.y / m) * len
        pts.push({ x, y })
      }
      for (let k = 0; k < n; k++) {
        const lane = offset(pts, (k - (n - 1) / 2) * 7)
        g.beginPath(); lane.forEach((p, j) => (j ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke()
      }
    }
    // Footprints: pad rows of a few parts.
    g.fillStyle = L.color
    for (let c = 0; c < 9; c++) {
      const cx = 60 + rnd() * (ART_W - 120), cy = 60 + rnd() * (ART_H - 120), n = 4 + Math.floor(rnd() * 10)
      for (let k = 0; k < n; k++) { g.fillRect(cx + k * 9, cy, 5, 12); g.fillRect(cx + k * 9, cy + 34, 5, 12) }
    }
  } else {
    g.fillStyle = L.color; g.globalAlpha = 0.85; g.fillRect(18, 18, ART_W - 36, ART_H - 36); g.globalAlpha = 1
    if (L.kind === 'pwr') { // split planes
      g.strokeStyle = '#0a0e1a'; g.lineWidth = 8
      g.beginPath(); g.moveTo(ART_W * 0.42, 18); g.lineTo(ART_W * 0.42, ART_H * 0.55); g.lineTo(ART_W - 18, ART_H * 0.55); g.stroke()
      g.beginPath(); g.moveTo(18, ART_H * 0.7); g.lineTo(ART_W * 0.3, ART_H * 0.7); g.lineTo(ART_W * 0.42, ART_H * 0.55); g.stroke()
    }
    // Speckle, like a pour's thermal relief at a glance.
    g.fillStyle = 'rgba(0,0,0,0.22)'
    for (let i = 0; i < 1600; i++) g.fillRect(rnd() * ART_W, rnd() * ART_H, 2, 2)
  }
  for (const v of vias) {
    g.fillStyle = '#0a0e1a'; g.beginPath(); g.arc(v.x, v.y, L.kind === 'signal' ? 5 : 8, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#c8ccd6'; g.beginPath(); g.arc(v.x, v.y, 3, 0, Math.PI * 2); g.fill()
  }
  g.strokeStyle = shade(L.color, -0.2); g.lineWidth = 4; g.strokeRect(2, 2, ART_W - 4, ART_H - 4)
  artCache.set(L.name, cv)
  return cv
}

/** Shared via positions (the same seed on every layer): where the stack is drilled through. */
export function viaPoints(n: number): Pt[] {
  const rnd = seeded(4242)
  const out: Pt[] = []
  for (let i = 0; i < n; i++) out.push({ x: 80 + rnd() * (ART_W - 160), y: 60 + rnd() * (ART_H - 120) })
  return out
}

// ── The split: 1 → 2 → 4 → 8 → 10 panels, then ten portrait tiles ─────────────────────────────
export interface Rect { x: number; y: number; w: number; h: number }
export const W = 1920, H = 1080

export function grid(n: number, inset = 0): Rect[] {
  const [cols, rows] = n === 1 ? [1, 1] : n === 2 ? [2, 1] : n === 4 ? [2, 2] : n === 8 ? [4, 2] : [5, 2]
  const out: Rect[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push({ x: (c * W) / cols + inset, y: (r * H) / rows + inset, w: W / cols - 2 * inset, h: H / rows - 2 * inset })
  }
  return out
}
/** The ten tiles of the layer reveal: portrait, with room for subtitles below. */
export const TILE_W = 267, TILE_H = 400, TILE_GAP = 44
export function tiles(): Rect[] {
  const x0 = (W - (5 * TILE_W + 4 * TILE_GAP)) / 2
  const out: Rect[] = []
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) out.push({ x: x0 + c * (TILE_W + TILE_GAP), y: 64 + r * (TILE_H + 40), w: TILE_W, h: TILE_H })
  return out
}
export const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k })
