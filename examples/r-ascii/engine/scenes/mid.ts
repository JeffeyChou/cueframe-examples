// Current (AC/DC scope, blindfold, vortex, time travel, double helix) and the first chorus
// (neural stimulation, raymarched blob, window cascade, Droste simulation).
import { type Rect, grad, hsl, mix, mul } from '../cells.ts'
import { bigText, fitHeight } from '../font.ts'
import { Cam, FINE, PAL, TAU, type V3, field, raymarch, rampCh, ring, rotX, rotY, warp } from '../gfx.ts'
import { hash, noise1, noise2, seeded } from '../rng.ts'
import { inOutCubic, spring } from '../../motion.ts'
import type { Ctx, Scene } from '../types.ts'
import { T, clamp01, curIn, dialog, echo, flash, hitAt, outCubic, outExpo, progress, seg, slam } from './kit.ts'

// ── current ─────────────────────────────────────────────────────────────────────────────────────

function lightning(x: Ctx, a: [number, number], b: [number, number], col: number, seed: number) {
  const r = seeded(seed)
  let pts: [number, number][] = [a, b]
  for (let k = 0; k < 5; k++) {
    const nx: [number, number][] = []
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i]!, q = pts[i + 1]!
      const d = Math.hypot(q[0] - p[0], (q[1] - p[1]) * 2)
      nx.push(p, [(p[0] + q[0]) / 2 + r.range(-1, 1) * d * 0.12, (p[1] + q[1]) / 2 + r.range(-1, 1) * d * 0.08])
    }
    nx.push(pts[pts.length - 1]!)
    pts = nx
  }
  for (let i = 0; i + 1 < pts.length; i++) x.c.line(pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], col)
}

function acdc(x: Ctx, r: Rect) {
  const { c, t } = x
  const rect = seg(t, T(25), T(25) + 0.6, inOutCubic), flat = seg(t, T(25) + 0.9, T(26) - 0.2, inOutCubic)
  const cols = [0x4fa8ff, 0xffb02e, 0xff4f8b]
  for (let ph = 0; ph < 3; ph++) {
    let py = NaN
    for (let i = 0; i < r.w; i++) {
      const u = i / r.w
      let v = Math.sin(u * TAU * 3 - t * 9 + (ph * TAU) / 3)
      v = v * (1 - rect) + Math.abs(v) * rect
      v = v * (1 - flat) + 0.64 * flat
      const y = r.y + r.h * 0.5 - v * r.h * 0.36 + ph * flat * 0
      if (!Number.isNaN(py) && Math.abs(y - py) > 1) x.c.line(r.x + i - 1, py, r.x + i, y, mul(cols[ph]!, 0.5), '│')
      c.put(r.x + i, y, '█', mix(cols[ph]!, 0xffffff, 0.2 * x.kick))
      py = y
    }
  }
  // axis and grid
  for (let i = 0; i < r.w; i += 2) c.put(r.x + i, r.y + r.h * 0.5, '·', 0x1a2a40)
  for (let k = 1; k < 8; k++) for (let y = r.y; y < r.y + r.h; y += 2) c.put(r.x + (r.w * k) / 8, y, '·', 0x1a2a40)
  // switch
  const sw = { x: Math.round(r.x + r.w / 2 - 14), y: r.y + 2, w: 28, h: 3 }
  c.fill(sw, ' ', 0, 0x0a1220)
  c.box(sw, 0x4fa8ff)
  const k = spring(clamp01((t - T(25)) / 0.5), 0.45, 1.5)
  c.text(sw.x + 2, sw.y + 1, 'AC', k < 0.5 ? 0xffffff : 0x3a4652)
  c.text(sw.x + sw.w - 4, sw.y + 1, 'DC', k >= 0.5 ? 0xffffff : 0x3a4652)
  for (let i = 0; i < 18; i++) c.put(sw.x + 5 + i, sw.y + 1, '━', 0x1a50c0)
  c.put(sw.x + 5 + Math.round(k * 17), sw.y + 1, '●', 0xffffff)
  // arcs on the beat
  if (x.kick > 0.45) {
    const s = x.beat.n * 7
    const rr = seeded(s)
    lightning(x, [r.x + rr.range(0, r.w), r.y], [r.x + rr.range(0, r.w), r.y + r.h - 1], mix(0xbfe0ff, 0xffffff, x.kick), s)
  }
  c.text(r.x + 2, r.y + r.h - 2, `V(t) = ${flat > 0.5 ? '311.0' : (311 * Math.sin(t * 9)).toFixed(1).padStart(6)} V   mode ${k < 0.5 ? 'AC 60Hz' : 'DC'}   rectifier ${rect > 0.5 ? 'ON ' : 'off'}`, 0x4fa8ff)
}

function blind(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  // static everywhere, eyelids closing from top and bottom
  field(c, r, (_u, _v, px, py) => {
    const h = hash(px * 131 + py * 7, x.frame)
    if (h < 0.35) c.put(px, py, h < 0.1 ? '▓' : h < 0.2 ? '▒' : '░', mul(0xc8d8e8, 0.15 + 0.5 * h))
  })
  const lid = k * (r.h / 2)
  for (let y = r.y; y < r.y + r.h; y++) {
    const d = Math.min(y - r.y, r.y + r.h - 1 - y)
    const edge = lid - d
    if (edge <= 0) continue
    for (let px = r.x; px < r.x + r.w; px++) {
      const curve = Math.sin(((px - r.x) / r.w) * Math.PI) * 3
      if (edge + curve - 3 > 0) c.put(px, y, ' ', 0, 0x020304)
      else if (edge + curve - 3 > -1) c.put(px, y, '▀', 0x26303a, 0x020304)
    }
  }
  if (k > 0.7) c.text(r.x + r.w / 2 - 9, r.y + r.h / 2, `[ NO SIGNAL ${caret(t)} ]`, 0x7d8a96)
}
const caret = (t: number) => (Math.floor(t * 4) % 2 ? '_' : ' ')

function vortex(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  const lt = t - T(27)
  field(c, r, (u, v, px, py) => {
    const rr = Math.hypot(u, v), a = Math.atan2(v, u)
    const tw = a + (2.2 + 3 * k) / (rr + 0.25) - lt * 3
    const s = Math.sin(tw * 4) * 0.5 + 0.5
    const band = Math.sin(rr * 9 - lt * 8) * 0.5 + 0.5
    const val = s * 0.65 + band * 0.35
    if (val < 0.2) return
    c.put(px, py, rampCh(val, ' .:-=+*#%@'), hsl(0.55 + 0.25 * s + lt * 0.15, 0.85, 0.25 + 0.4 * val * Math.min(1, rr * 1.4)))
  })
}

function timeTravel(x: Ctx, r: Rect) {
  const { c, t } = x
  const lt = t - T(28)
  const sp = 3 + 14 * seg(t, T(28), T(29) + 1)
  warp(c, r, t, sp, 260, (z) => mix(0xffffff, 0x4fa8ff, z / 4), 9)
  // clock face with hands spinning backwards
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.h * 0.42
  ring(c, cx, cy, R, (a) => mix(0x1a50c0, 0x4fa8ff, 0.5 + 0.5 * Math.sin(a * 6)), 0, TAU, '·')
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * TAU - Math.PI / 2
    c.text(cx + Math.cos(a) * R * 0.9 * c.aspect - 1, cy + Math.sin(a) * R * 0.9, ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][h]!, 0x9ab8d8)
  }
  const spin = -lt * lt * 6
  for (const [len, sp2, col] of [[0.55, 1, 0xffffff], [0.8, 12, 0x4fa8ff]] as const) {
    const a = spin * sp2 - Math.PI / 2
    c.line(cx, cy, cx + Math.cos(a) * R * len * c.aspect, cy + Math.sin(a) * R * len, col)
  }
  // year counter: 2026 AD rolling down through 0 into BC
  const year = Math.round(2026 - (Math.exp(lt * 1.25) - 1) * 220)
  const label = year > 0 ? `${year} AD` : `${1 - year} BC`
  const h = fitHeight(label, r.w * 0.8, Math.min(9, r.h * 0.3))
  bigText(c, label, { x: cx, y: cy, h, style: 'block', color: (_u, v) => grad(PAL.blue, 0.5 + 0.5 * (1 - v)) })
}

function helix(x: Ctx, r: Rect) {
  const { c, t } = x
  const lt = t - T(30)
  const merge = seg(t, T(31), T(31) + 2.2, inOutCubic)
  const cam = new Cam(r, c.aspect, 1, 3)
  const n = 140
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < n; i++) {
      const u = i / n
      const yy = (u - 0.5) * 3.6
      const a = u * TAU * 3 + lt * 2 + s * Math.PI
      const rad = 0.55 * (1 - merge)
      const p = cam.p(rotX([Math.cos(a) * rad * (1 + 0.3 * Math.sin(yy * 2)), yy, Math.sin(a) * rad], 0.15)) as [number, number, number, number] | null
      if (!p) continue
      const col = s === 0 ? 0x2ee6ff : 0xff4f8b
      const z = p[3]
      c.put(p[0] + 0, p[1], z < 0 ? '●' : '•', mix(merge > 0.5 ? 0xffffff : col, 0x05080b, clamp01(z * 0.6 + 0.1)))
      if (s === 0 && i % 7 === 0 && merge < 0.9) {
        const q = cam.p(rotX([Math.cos(a + Math.PI) * rad, yy, Math.sin(a + Math.PI) * rad], 0.15))
        if (q) c.line(p[0], p[1], q[0], q[1], mix(0x3a4652, 0xffffff, 0.2), '·')
      }
    }
  }
  if (merge > 0.6) ring(c, r.x + r.w / 2, r.y + r.h / 2, 2 + merge * 4 + x.kick * 2, () => mix(0xff4f8b, 0xffffff, merge), 0, TAU, '*')
}

export const current: Scene = {
  pal: PAL.blue,
  dock: (x) => {
    const t = x.t
    if (t < T(26)) return 1 - seg(t, x.act.t0 - 0.1, x.act.t0 + 0.4) * 0
    return 1
  },
  wm: (x, ws) => {
    // dizzy: the panels orbit off their docks
    const k = seg(x.t, T(27), T(27) + 0.4) * (1 - seg(x.t, T(28) - 0.3, T(28)))
    if (k <= 0) return
    let i = 0
    for (const w of [ws.sys, ws.mem, ws.insp, ws.trace]) {
      const a = x.t * 2.4 + (i++ * TAU) / 4
      w.r = { ...w.r, x: Math.round(x.D.x + x.D.w / 2 - w.r.w / 2 + Math.cos(a) * x.D.w * 0.32 * k), y: Math.round(x.D.y + x.D.h / 2 - w.r.h / 4 + Math.sin(a) * x.D.h * 0.3 * k), h: Math.round(w.r.h / 2) }
      w.on = 1
    }
  },
  glitch: (x) => 0.5 * flash(x.t, T(26), 0.3) + 0.35 * seg(x.t, T(27), T(28)) * (1 - seg(x.t, T(28), T(28) + 0.2)) + 0.4 * flash(x.t, T(28), 0.2),
  title: (x) => `scope://current.ac`,
  readouts: (x) => [['source', x.t < T(25) + 0.6 ? 'AC 3-phase' : 'DC'], ['vision', x.t >= T(26) && x.t < T(27) ? 'BLIND' : 'ok'], ['spin', x.t >= T(27) && x.t < T(28) ? `${((x.t - T(27)) * 137).toFixed(0)} rpm` : '0'], ['epoch', x.t >= T(28) && x.t < T(30) ? 'REWIND' : 'now'], ['strands', x.t >= T(31) + 1.4 ? '1' : '2']],
  view(x, V) {
    const t = x.t
    const i = curIn(t, 24, 31)
    if (i <= 25) acdc(x, V)
    else if (i === 26) blind(x, V, seg(t, T(26), T(26) + 1.2, outCubic))
    else if (i === 27) vortex(x, V, seg(t, T(27), T(28)))
    else if (i <= 29) timeTravel(x, V)
    else helix(x, V)
  },
  over(x) {
    if (x.t >= T(27) && x.t < T(28)) { /* windows orbit drawn by wm */ }
  },
}

// ── chorus ──────────────────────────────────────────────────────────────────────────────────────

function plasma(x: Ctx, r: Rect, hue: number, amt: number) {
  const { c, t } = x
  field(c, r, (u, v, px, py) => {
    const a = Math.sin(u * 3 + t * 1.3) + Math.sin(v * 4 - t * 1.7) + Math.sin((u + v) * 2.5 + t) + Math.sin(Math.hypot(u, v) * 6 - t * 3)
    const s = a / 4 * 0.5 + 0.5
    if (s * amt < 0.25) return
    c.put(px, py, rampCh(s * amt * 0.7, ' .·:-=+'), hsl(hue + 0.12 * s + 0.05 * Math.sin(t), 0.9, 0.12 + 0.22 * s * amt))
  })
}

const NET = (() => {
  const r = seeded('net')
  const layers = [5, 8, 11, 8, 5]
  const nodes: { l: number; i: number; u: number; v: number }[] = []
  layers.forEach((n, l) => { for (let i = 0; i < n; i++) nodes.push({ l, i, u: l / (layers.length - 1), v: (i + 0.5) / n + r.range(-0.03, 0.03) }) })
  const edges: [number, number][] = []
  nodes.forEach((a, ia) => nodes.forEach((b, ib) => { if (b.l === a.l + 1 && r() < 0.45) edges.push([ia, ib]) }))
  return { nodes, edges }
})()
function neural(x: Ctx, r: Rect) {
  const { c, t } = x
  const P = (k: number) => [r.x + 6 + NET.nodes[k]!.u * (r.w - 12), r.y + 2 + NET.nodes[k]!.v * (r.h - 4)] as const
  NET.edges.forEach(([a, b], k) => {
    const p = P(a), q = P(b)
    c.line(p[0], p[1], q[0], q[1], 0x6a2470, '·')
    // pulses: one wave per beat travelling layer by layer
    const ph = x.beat.phase * 4 - NET.nodes[a]!.l
    if (ph > 0 && ph < 1 && hash(k, x.beat.n) < 0.55) {
      const px = p[0] + (q[0] - p[0]) * ph, py = p[1] + (q[1] - p[1]) * ph
      c.put(px, py, '◆', 0xffffff)
      c.put(px - Math.sign(q[0] - p[0]), py, '•', 0xff3df0)
    }
  })
  NET.nodes.forEach((n, k) => {
    const p = P(k)
    const fire = Math.exp(-Math.abs(x.beat.phase * 4 - n.l - 0.9) * 4) * (hash(k, x.beat.n) < 0.7 ? 1 : 0.2)
    c.text(p[0] - 1, p[1], fire > 0.5 ? '(●)' : '(○)', mix(0xc040c8, 0xffffff, fire))
  })
}

function blob(x: Ctx, r: Rect) {
  const { t } = x
  const lt = t - T(35)
  const k = x.kick
  const sm = (a: number, b: number, h: number) => { const q = Math.max(h - Math.abs(a - b), 0) / h; return Math.min(a, b) - q * q * h * 0.25 }
  raymarch(x.c, r, {
    zoom: 1.35, dist: 3.2, steps: 40, ramp: ' .:-=+*#%@',
    sdf: (p) => {
      let d = 9
      for (let i = 0; i < 4; i++) {
        const a = lt * (0.9 + i * 0.3) + i * 1.7
        const c: V3 = [Math.cos(a) * 0.65, Math.sin(a * 1.3) * 0.45, Math.sin(a) * 0.4]
        d = sm(d, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - (0.42 + 0.12 * k), 0.7)
      }
      return d
    },
    color: (s, p) => hsl(0.85 + p[1] * 0.12 + lt * 0.05, 0.95, 0.3 + 0.6 * s),
  })
}

function cascade(x: Ctx, r: Rect) {
  const { c, t } = x
  const lt = t - T(38)
  const n = Math.min(26, Math.floor(lt * 11))
  for (let i = 0; i < n; i++) {
    const rr = seeded(i * 17 + 5)
    const w = rr.int(26, 40), h = rr.int(5, 8)
    const wx = r.x + Math.round((i * 7) % Math.max(1, r.w - w)), wy = r.y + Math.round((i * 3 + rr.int(0, 4)) % Math.max(1, r.h - h))
    const age = lt - i / 11
    const col = hsl(0.83 + rr() * 0.12, 0.9, 0.6)
    dialog(x, { x: wx, y: wy, w, h }, `exec #${String(i).padStart(2, '0')}`, [`$ ./run --pid ${1000 + i * 7}`, `${'⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[Math.floor(age * 12) % 10]} running ${Math.min(100, Math.floor(age * 140))}%`], col, { bg: 0x0c0610 })
  }
}

/** Droste: nested program windows, zooming in forever. */
function droste(x: Ctx, r: Rect) {
  const { c, t } = x
  const lt = t - T(41)
  const z = (lt * 0.9) % 1
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  for (let k = 0; k <= 7; k++) {
    const s = Math.pow(0.62, k - z)
    const w = Math.round(r.w * s), h = Math.round(r.h * s)
    if (w < 6 || h < 3 || w > r.w * 1.6) continue
    const R = { x: Math.round(cx - w / 2 + Math.sin(lt + k) * k), y: Math.round(cy - h / 2), w, h }
    const col = hsl(0.82 + k * 0.03, 0.8, 0.25 + 0.5 * (1 - k / 8))
    c.fill(R, ' ', 0, mix(0x05080b, col, 0.06))
    c.box(R, col, w > 30 ? `world.execute(me) [${k}]` : undefined, k % 2 ? 'light' : 'heavy')
    if (w > 20 && h > 6) {
      c.text(R.x + 2, R.y + 1, '◆ FILE EDIT VIEW SIMULATION'.slice(0, w - 4), mul(col, 0.8))
      c.text(R.x + 2, R.y + h - 2, `depth ${k}  scale ${s.toFixed(3)}`.slice(0, w - 4), mul(col, 0.7))
    }
  }
}

export const chorus: Scene = {
  pal: PAL.magenta,
  dock: (x) => {
    const t = x.t
    const i = curIn(t, 32, 43)
    return i >= 41 ? 1 : i >= 38 ? 0.0 + seg(t, T(38), T(38) + 0.4) : 1 - 0.6 * flash(t, T(35), 0.4)
  },
  glitch: (x) => 0.2 * x.kick + 0.4 * flash(x.t, T(41), 0.3),
  title: () => 'render://stim.dll',
  readouts: (x) => [['object', 'Stimulus'], ['bpm', '130'], ['beat', String(x.beat.n)], ['dopamine', `${(40 + 60 * x.kick).toFixed(1)}%`], ['satisfied', x.t > T(37) ? 'true' : 'false']],
  log: (k) => `syn[${(k * 13) % 97}] -> n${(k * 7) % 41} w=${(Math.sin(k) * 0.9).toFixed(3)}`,
  bg: (x) => plasma(x, x.D, 0.82, 0.5 + 0.5 * x.kick),
  view(x, V) {
    const t = x.t
    const i = curIn(t, 32, 43)
    plasma(x, V, 0.82, 0.6 + 0.4 * x.kick)
    if (i <= 34) neural(x, V)
    else if (i <= 37) blob(x, V)
    else if (i <= 40) { blob(x, V); cascade(x, V) }
    else droste(x, V)
    const h = hitAt(t, 32, 43)
    if (h) slam(x, V, h, { pal: PAL.magenta, maxH: 10, out: 1 - 0.5 * seg(t, h.t0 + 0.5, h.t0 + 0.8) })
    void echo; void outExpo; void progress; void noise1; void noise2; void rotY; void spring
  },
}
