// Organic (eggplant, tomato, tabby cat, the only god), Switch (♀/♂, AM→PM, role swap, trance)
// and Vibrate (ripple surface, completion ring).
import { type Rect, grad, hsl, mix, mul } from '../cells.ts'
import { bigText, fitHeight } from '../font.ts'
import { Cam, FINE, PAL, TAU, type V3, field, raymarch, rampCh, ring, rotX, rotY, rotZ } from '../gfx.ts'
import { hash, noise1, seeded } from '../rng.ts'
import { inOutCubic, spring } from '../../motion.ts'
import type { Ctx, Scene } from '../types.ts'
import { T, clamp01, curIn, flash, hitAt, outCubic, outExpo, seg, slam } from './kit.ts'

const sm = (a: number, b: number, h: number) => { const q = Math.max(h - Math.abs(a - b), 0) / h; return Math.min(a, b) - q * q * h * 0.25 }
const sph = (p: V3, c: V3, r: number) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r

/** Scanner sweep + labelled leader lines around an object centred in r. */
function scan(x: Ctx, r: Rect, t0: number, labels: [string, string][], col: number) {
  const { c, t } = x
  const lt = t - t0
  const sy = r.y + ((lt * 0.8) % 1) * r.h
  for (let i = r.x; i < r.x + r.w; i++) if (c.get(i, Math.round(sy)) === ' ') c.put(i, sy, '─', mul(col, 0.5))
  c.text(r.x + 2, Math.round(sy) - 1 < r.y ? r.y : Math.round(sy) - 1, `scan y=${(sy - r.y).toFixed(1)}`, mul(col, 0.8))
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  labels.forEach(([k, v], i) => {
    const at = t0 + 0.25 + i * 0.22
    if (t < at) return
    const right = i % 2 === 0
    const a = (i / labels.length) * TAU + 0.6
    const px = cx + Math.cos(a) * r.h * 0.32 * c.aspect, py = cy + Math.sin(a) * r.h * 0.3
    const lx = right ? r.x + r.w - 26 : r.x + 3, ly = r.y + 3 + i * 3
    const k2 = outCubic(clamp01((t - at) / 0.25))
    c.line(px, py, px + (lx + (right ? 0 : 22) - px) * k2, py + (ly - py) * k2, mul(col, 0.6), '·')
    c.put(px, py, '◆', 0xffffff)
    if (k2 > 0.9) { c.text(lx, ly, k.padEnd(12).slice(0, 12), mul(col, 0.9)); c.text(lx + 12, ly, v, 0xffffff) }
  })
}

function eggplant(x: Ctx, r: Rect, lt: number) {
  raymarch(x.c, r, {
    zoom: 1.4, steps: 44, ramp: ' .:-=+*#%@',
    sdf: (p0) => {
      const p = rotY(rotZ(p0, 0.5 + 0.1 * Math.sin(lt)), lt * 0.9)
      const body = sm(sph(p, [0, 0.35, 0], 0.62), sph(p, [0, -0.35, 0], 0.4), 0.5)
      const cap = sph([p[0], (p[1] + 0.82) * 2.2, p[2]], [0, 0, 0], 0.5) / 2.2
      return Math.min(body, cap)
    },
    color: (s, p0) => { const p = rotY(rotZ(p0, 0.5), lt * 0.9); return p[1] < -0.7 ? hsl(0.3, 0.75, 0.25 + 0.5 * s) : hsl(0.78, 0.8, 0.22 + 0.62 * s) },
  })
}
function tomato(x: Ctx, r: Rect, lt: number) {
  raymarch(x.c, r, {
    zoom: 1.5, steps: 44, ramp: ' .:-=+*#%@',
    sdf: (p0) => {
      const p = rotX(rotY(p0, lt * 0.8), -0.35)
      const a = Math.atan2(p[2], p[0])
      const rr = 0.75 + 0.05 * Math.cos(a * 5)
      const body = (Math.hypot(p[0], p[1] * 1.35, p[2]) - rr) * 0.7
      const star = Math.hypot(p[0], (p[1] + 0.58) * 4, p[2]) - 0.32 - 0.1 * Math.cos(a * 5)
      return Math.min(body, star * 0.25)
    },
    color: (s, p0) => { const p = rotX(rotY(p0, lt * 0.8), -0.35); return p[1] < -0.48 ? hsl(0.3, 0.8, 0.25 + 0.45 * s) : hsl(0.0, 0.9, 0.22 + 0.62 * s) },
  })
}

/** An original stylised tabby: rounded head, two ears, forehead stripes, slit eyes, whiskers. */
function cat(x: Ctx, r: Rect, lt: number) {
  const { c, t } = x
  const purr = 0.03 * Math.sin(t * 42) * (0.5 + 0.5 * x.kick)
  const blink = (lt % 2.6) > 2.45
  field(c, r, (u0, v0, px, py) => {
    const u = u0 / 0.95, v = (v0 + purr) / 0.95
    const head = (u * u) / 0.62 + ((v - 0.12) ** 2) / 0.4
    const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
      const d = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry)
      const a = d(u, v, ax, ay, bx, by), b = d(u, v, bx, by, cx, cy), e = d(u, v, cx, cy, ax, ay)
      return !((a < 0 || b < 0 || e < 0) && (a > 0 || b > 0 || e > 0))
    }
    const ear = (sx: number) => tri(sx * 0.2, -0.38, sx * 0.62, -1.0, sx * 0.78, -0.18)
    const inHead = head < 1 || ear(1) || ear(-1)
    if (!inHead) return
    const edge = head > 0.88 && head < 1 && v > -0.4
    const stripe = v < -0.05 && Math.abs(u) < 0.32 && Math.sin((u * 18) + Math.abs(u) * 4) > 0.55 && v > -0.55
    const cheek = Math.abs(v - 0.15) < 0.04 && Math.abs(u) > 0.42 && Math.sin(u * 30) > 0
    const eye = (sx: number) => ((u - sx * 0.3) ** 2) / 0.012 + ((v - 0.05) ** 2) / (blink ? 0.0004 : 0.02) < 1
    const pupil = (sx: number) => Math.abs(u - sx * 0.3) < 0.025 && Math.abs(v - 0.05) < 0.12 && !blink
    const nose = Math.abs(u) < 0.06 - (v - 0.3) * 0.5 && v > 0.27 && v < 0.36
    const mouth = Math.abs(v - 0.42 - 0.08 * Math.cos(u * 14)) < 0.03 && Math.abs(u) < 0.16
    const hd = Math.min(head, 0.75)
    let ch = rampCh(0.25 + 0.3 * (1 - hd), ' .:-=+'), col = mix(0x7a4410, 0xffb04a, 0.4 + 0.5 * (1 - hd))
    if (stripe || cheek) { ch = '#'; col = 0x5a2a08 }
    if (edge) { ch = '%'; col = 0xffc070 }
    if (eye(1) || eye(-1)) { ch = '@'; col = 0x9aff60 }
    if (pupil(1) || pupil(-1)) { ch = '█'; col = 0x081004 }
    if (nose) { ch = '▼'; col = 0xff7aa0 }
    if (mouth) { ch = '~'; col = 0x3a1a04 }
    c.put(px, py, ch, col)
  })
  // whiskers
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + r.h * 0.17
  for (const s of [-1, 1]) for (const k of [-1, 0, 1]) c.line(cx + s * r.h * 0.36 * c.aspect, cy + k * 0.6, cx + s * r.h * 0.78 * c.aspect, cy + k * 2.2 + purr * 20, 0xe8d8c0)
  // purr meter
  const by = r.y + r.h - 3
  for (let i = 0; i < r.w - 8; i++) c.put(r.x + 4 + i, by + Math.sin(i * 0.9 + t * 40) * 1.2 * (0.5 + 0.5 * x.kick), '~', 0xffb02e)
  c.text(r.x + 4, by - 2, `purr  ${(25 + 5 * Math.sin(t)).toFixed(1)} Hz   mood ${'▮'.repeat(1 + Math.floor(clamp01(lt / 1.6) * 9))}`, 0xffb02e)
}

function god(x: Ctx, r: Rect, lt: number) {
  const { c, t } = x
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  // rays across the whole rect
  field(c, r, (u, v, px, py) => {
    const a = Math.atan2(v, u), d = Math.hypot(u, v)
    const ray = Math.sin(a * 18 + t * 0.8) * 0.5 + 0.5
    const wave = Math.sin(d * 10 - t * 5) * 0.5 + 0.5
    const s = ray * 0.7 * Math.min(1, d * 1.5) + wave * 0.15
    if (s < 0.35) return
    c.put(px, py, s > 0.7 ? '|' : s > 0.55 ? ':' : '·', mix(0x2a1a04, 0xffd060, (s - 0.35) * 1.4 * clamp01(lt * 2)))
  })
  // triangle
  const R = r.h * 0.42
  const tri: [number, number][] = [0, 1, 2].map((k) => { const a = -Math.PI / 2 + (k * TAU) / 3; return [cx + Math.cos(a) * R * c.aspect, cy + Math.sin(a) * R + R * 0.15] })
  for (let k = 0; k < 3; k++) c.line(tri[k]![0], tri[k]![1], tri[(k + 1) % 3]![0], tri[(k + 1) % 3]![1], 0xffe080)
  // eye
  const ey = cy + R * 0.2, ew = R * 0.5
  for (let i = -ew * c.aspect; i <= ew * c.aspect; i += 0.5) {
    const u = i / (ew * c.aspect), hgt = Math.sqrt(Math.max(0, 1 - u * u)) * ew * 0.45
    c.put(cx + i, ey - hgt, '─', 0xfff0c0); c.put(cx + i, ey + hgt, '─', 0xfff0c0)
  }
  ring(c, cx + Math.sin(t * 0.7) * 2, ey, ew * 0.28, () => 0xffd060, 0, TAU, '●')
  c.put(cx + Math.sin(t * 0.7) * 2, ey, '█', 0x000000)
  c.text(r.x + 3, r.y + 2, '∃! g ∈ U : ∀ x ∈ U, x ⊢ g', 0xffe080)
  c.text(r.x + 3, r.y + 3, 'proof: by you.  ∎', mul(0xffe080, 0.7))
}

const ORG = [
  { f: eggplant, pal: PAL.violet, labels: [['K', '229 mg'], ['fiber', '3.0 g'], ['nasunin', 'present'], ['Mn', '0.23 mg'], ['kcal', '25']] as [string, string][] },
  { f: tomato, pal: PAL.red, labels: [['lycopene', '2.57 mg'], ['vit.C', '13.7 mg'], ['β-carotene', '449 µg'], ['ORAC', '387'], ['H2O', '94.5 %']] as [string, string][] },
  { f: cat, pal: PAL.amber, labels: [] as [string, string][] },
  { f: god, pal: [0x0c0802, 0x4a3608, 0xb88a12, 0xffd060, 0xfff6d8], labels: [] as [string, string][] },
]

function benzene(x: Ctx, r: Rect, col: number) {
  const { c, t } = x
  for (let i = 0; i < 9; i++) {
    const rr = seeded(i * 7 + 1)
    const cx = r.x + ((rr() * r.w + t * (3 + rr() * 4)) % r.w), cy = r.y + rr() * r.h, R = 2 + rr() * 2.5
    const a0 = t * (rr() - 0.5)
    const pts: [number, number][] = Array.from({ length: 6 }, (_, k) => [cx + Math.cos(a0 + (k * TAU) / 6) * R * c.aspect, cy + Math.sin(a0 + (k * TAU) / 6) * R])
    for (let k = 0; k < 6; k++) c.line(pts[k]![0], pts[k]![1], pts[(k + 1) % 6]![0], pts[(k + 1) % 6]![1], mul(col, 0.35))
    ring(c, cx, cy, R * 0.5, () => mul(col, 0.25), 0, TAU, '·')
  }
}

export const organic: Scene = {
  pal: PAL.violet,
  dock: (x) => {
    const k = Math.floor((curIn(x.t, 44, 55) - 44) / 3)
    return k === 3 ? seg(x.t, T(53), T(53) + 0.6, inOutCubic) : 0.15 * flash(x.t, T(44 + 3 * k + 2), 0.3)
  },
  glitch: (x) => 0.35 * flash(x.t, T(44 + 3 * Math.floor((curIn(x.t, 44, 55) - 44) / 3)), 0.15),
  title: (x) => `scan://organic.db/${['solanum_melongena', 'solanum_lycopersicum', 'felis_catus', 'deus'][Math.floor((curIn(x.t, 44, 55) - 44) / 3)]}`,
  readouts: (x) => {
    const k = Math.floor((curIn(x.t, 44, 55) - 44) / 3)
    return [['specimen', ['eggplant', 'tomato', 'tabby', 'god'][k]!], ['kingdom', ['plantae', 'plantae', 'animalia', '—'][k]!], ['alive', k === 3 ? 'axiom' : 'yes'], ['gives', ['nutrients', 'antioxid.', 'purring', 'existence'][k]!], ['sample', `#${(x.frame % 997).toString().padStart(3, '0')}`]]
  },
  log: (k) => `assay[${k % 64}] ${['K', 'Mg', 'Fe', 'Zn', 'C', 'lyc', 'ORAC'][k % 7]}=${(Math.sin(k * 1.3) * 50 + 60).toFixed(2)}`,
  bg: (x) => benzene(x, x.D, ORG[Math.max(0, Math.floor((curIn(x.t, 44, 55) - 44) / 3))]!.pal[3]!),
  view(x, V) {
    const t = x.t
    const k = Math.max(0, Math.floor((curIn(t, 44, 55) - 44) / 3))
    const o = ORG[k]!
    x.pal = o.pal; x.accent = o.pal[3]!
    if (k === 1) benzene(x, V, 0xff6040)
    const lt = t - T(44 + 3 * k)
    const enter = outExpo(clamp01(lt / 0.4))
    const R: Rect = { x: V.x, y: Math.round(V.y + (1 - enter) * V.h * 0.5), w: V.w, h: V.h }
    o.f(x, R, lt)
    if (o.labels.length) scan(x, V, T(44 + 3 * k), o.labels, o.pal[3]!)
    const h = hitAt(t, 44 + 3 * k, 46 + 3 * k)
    if (h) slam(x, { x: V.x, y: V.y + Math.round(V.h * 0.55), w: V.w, h: Math.round(V.h * 0.45) }, h, { pal: o.pal, maxH: 7 })
  },
}

// ── switch ──────────────────────────────────────────────────────────────────────────────────────

function genderGlyph(x: Ctx, cx: number, cy: number, R: number, m: number, col: number) {
  const { c } = x
  ring(c, cx, cy, R, () => col, 0, TAU, '█')
  // m: 0 = cross below (♀), 1 = arrow up-right (♂)
  const a = Math.PI / 2 + m * (-Math.PI / 2 - Math.PI / 4 - Math.PI / 2 + Math.PI / 2)
  const ang = Math.PI / 2 * (1 - m) + (-Math.PI / 4) * m
  void a
  const sx = cx + Math.cos(ang) * R * c.aspect, sy = cy + Math.sin(ang) * R
  const ex = cx + Math.cos(ang) * R * 2 * c.aspect, ey = cy + Math.sin(ang) * R * 2
  c.line(sx, sy, ex, ey, col, '█')
  const nx = -Math.sin(ang), ny = Math.cos(ang)
  const crossK = 1 - m
  if (crossK > 0.05) {
    const mx = cx + Math.cos(ang) * R * 1.55 * c.aspect, my = cy + Math.sin(ang) * R * 1.55
    c.line(mx - nx * R * 0.5 * c.aspect * crossK, my - ny * R * 0.5 * crossK, mx + nx * R * 0.5 * c.aspect * crossK, my + ny * R * 0.5 * crossK, col, '█')
  }
  if (m > 0.05) for (const s of [-1, 1]) {
    const b = ang + Math.PI + s * 0.6
    c.line(ex, ey, ex + Math.cos(b) * R * 0.6 * m * c.aspect, ey + Math.sin(b) * R * 0.6 * m, col, '█')
  }
}

function sky(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  const day = Math.sin(Math.PI * clamp01(k * 1.15))
  const dusk = Math.exp(-((k - 0.62) ** 2) * 40)
  field(c, r, (_u, v, px, py) => {
    const h = (v + 1) / 2
    const base = mix(mix(0x050a20, 0x2a6ac0, day), 0xff6a30, dusk * (1 - h * 0.6))
    if (hash(px * 13 + py * 7, 3) < 0.04 * (1 - day)) c.put(px, py, hash(px, py) < 0.3 ? '+' : '·', mul(0xffffff, 0.7 * (1 - day)))
    else c.put(px, py, h > 0.8 ? '▒' : '░', mul(base, 0.35 + 0.5 * (1 - h)))
  })
  const horizon = r.y + r.h * 0.8
  const a = Math.PI * (1 - clamp01(k * 1.15))
  const sx = r.x + r.w / 2 + Math.cos(a) * r.w * 0.42, sy = horizon - Math.sin(a) * r.h * 0.65
  for (let rr = 4; rr >= 1; rr--) ring(c, sx, sy, rr, () => mix(0xffe070, 0xff8030, rr / 4), 0, TAU, rr < 2 ? '█' : '▓')
  const ma = Math.PI * (1 - clamp01((k - 0.55) * 2.2))
  if (k > 0.55) { const mx = r.x + r.w / 2 + Math.cos(ma) * r.w * 0.38, my = horizon - Math.sin(ma) * r.h * 0.6; ring(c, mx, my, 2.5, () => 0xe8f0ff, -1.2, 1.9, '█') }
  for (let i = 0; i < r.w; i++) {
    const hgt = 2 + 2.5 * Math.abs(noise1(i * 0.08, 7)) + (hash(i >> 2, 5) < 0.3 ? 3 : 0)
    for (let y = Math.round(horizon - hgt); y < r.y + r.h; y++) c.put(r.x + i, y, y === Math.round(horizon - hgt) ? '▄' : (k > 0.65 && hash(i * 7 + y, Math.floor(t * 2)) < 0.05 ? '▪' : '█'), y === Math.round(horizon - hgt) ? mul(0x101828, 1.2) : 0x080c14)
  }
  const hr = Math.floor(k * 24)
  c.text(r.x + 3, r.y + 2, `${String((hr % 12) || 12).padStart(2, '0')}:${String(Math.floor((k * 24 * 60) % 60)).padStart(2, '0')} ${hr < 12 ? 'AM' : 'PM'}`, 0xffffff)
}

function roles(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  for (const [s, side] of [['S', -1], ['M', 1]] as const) {
    const a = k * Math.PI
    const px = cx + side * Math.cos(a) * r.w * 0.22, depth = side * Math.sin(a)
    const w = Math.round(r.w * 0.2 * (1 - 0.25 * depth)), h = Math.round(r.h * 0.6 * (1 - 0.25 * depth))
    const flip = Math.abs(Math.cos(k * Math.PI * 2))
    const ww = Math.max(2, Math.round(w * flip))
    const R = { x: Math.round(px - ww / 2), y: Math.round(cy - h / 2), w: ww, h }
    const col = s === 'S' ? 0xff6ab4 : 0x6ab4ff
    c.fill(R, ' ', 0, mul(col, 0.12))
    c.box(R, col, ww > 8 ? `role.${s}` : undefined, 'double')
    if (ww > 8) bigText(c, s, { x: R.x + R.w / 2, y: cy, h: Math.min(h * 0.6, 14), sx: flip, style: 'block', color: (_u, v) => mix(col, 0xffffff, 1 - v) })
  }
  c.text(r.x + 3, r.y + 2, `swap(role_a, role_b)  ${'⇄'}  ${(k * 100).toFixed(0)}%`, 0xffffff)
  void t
}

function trance(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  const lt = t - T(62)
  field(c, r, (u, v, px, py) => {
    const d = Math.hypot(u, v) + 1e-3, a = Math.atan2(v, u)
    const s = Math.sin(Math.log(d) * 7 - a * 2 - lt * 6)
    const s2 = Math.sin(a * 8 + Math.log(d) * 3 + lt * 2)
    const val = (s * 0.5 + 0.5) * 0.8 + 0.2 * (s2 * 0.5 + 0.5)
    if (val < 0.3) return
    c.put(px, py, rampCh(val, ' ·:=+*#%@'), hsl(0.9 + lt * 0.15 + d * 0.3, 0.85, (0.15 + 0.45 * val) * Math.min(1, d * 2) * (0.6 + 0.4 * k)))
  })
}

export const switchAct: Scene = {
  pal: PAL.pink,
  dock: (x) => {
    const i = curIn(x.t, 56, 63)
    return i >= 62 ? seg(x.t, T(62), T(62) + 0.5) : i >= 58 && i <= 59 ? 1 : 0
  },
  wm: (x, ws) => {
    const k = seg(x.t, T(60) + 0.2, T(61) + 1.2, inOutCubic)
    if (k <= 0 || k >= 1) { if (k >= 1 && x.t < T(62)) swap(ws, 1, x); return }
    swap(ws, k, x)
  },
  glitch: (x) => 0.3 * flash(x.t, T(57), 0.2) + 0.3 * flash(x.t, T(61), 0.2) + 0.25 * seg(x.t, T(62), T(64)),
  title: (x) => (curIn(x.t, 56, 63) >= 62 ? 'render://trance.exe' : 'config://switch.cfg'),
  readouts: (x) => [['gender', x.t > T(57) + 0.3 ? 'M' : 'F'], ['clock', x.t > T(59) + 0.5 ? 'PM' : 'AM'], ['role', x.t > T(61) + 0.6 ? 'M' : 'S'], ['state', curIn(x.t, 56, 63) >= 62 ? 'TRANCE' : 'awake']],
  log: (k) => `toggle(bit ${k % 32}) ${k % 3 ? '0→1' : '1→0'}`,
  view(x, V) {
    const t = x.t
    const i = curIn(t, 56, 63)
    if (i <= 57) {
      const m = spring(clamp01((t - T(57)) / 0.6), 0.4, 1.5)
      const R = Math.min(V.h * 0.2, V.w / 10)
      genderGlyph(x, V.x + V.w / 2, V.y + V.h * 0.45, R, m, mix(0xff6ab4, 0x6ab4ff, clamp01(m)))
      const sw = { x: Math.round(V.x + V.w / 2 - 12), y: V.y + V.h - 5, w: 24, h: 3 }
      c(x).box(sw, 0xff6ab4)
      c(x).text(sw.x + 2, sw.y + 1, 'F', m < 0.5 ? 0xffffff : 0x3a4652)
      c(x).text(sw.x + sw.w - 3, sw.y + 1, 'M', m >= 0.5 ? 0xffffff : 0x3a4652)
      c(x).put(sw.x + 4 + Math.round(clamp01(m) * 15), sw.y + 1, '●', 0xffffff)
    } else if (i <= 59) sky(x, V, seg(t, T(58), T(60), inOutCubic))
    else if (i <= 61) roles(x, V, seg(t, T(60) + 0.2, T(61) + 1.2, inOutCubic))
    else trance(x, V, seg(t, T(62), T(63)))
    if (i >= 62) {
      const h = fitHeight('TRANCE', V.w * 0.6, 9)
      const br = 0.5 + 0.5 * Math.sin((t - T(62)) * 3)
      bigText(x.c, 'TRANCE', { x: V.x + V.w / 2, y: V.y + V.h / 2, h: h * (0.9 + 0.1 * br), style: 'outline', glyphs: '░▒', color: () => mul(0xffffff, 0.25 + 0.35 * br) })
    }
  },
}
const c = (x: Ctx) => x.c
function swap(ws: Record<string, { r: Rect }>, k: number, x: Ctx) {
  const pairs: [string, string][] = [['sys', 'trace'], ['mem', 'insp']]
  for (const [a, b] of pairs) {
    const A = ws[a]!.r, B = ws[b]!.r
    const lift = Math.sin(k * Math.PI) * x.D.h * 0.25
    ws[a]!.r = { ...A, x: Math.round(A.x + (B.x - A.x) * k), y: Math.round(A.y + (B.y - A.y) * k - lift) }
    ws[b]!.r = { ...B, x: Math.round(B.x + (A.x - B.x) * k), y: Math.round(B.y + (A.y - B.y) * k + lift) }
  }
}

// ── vibrate / completion ────────────────────────────────────────────────────────────────────────

function ripple(x: Ctx, r: Rect, amp: number) {
  const { c, t } = x
  const lt = t - T(64)
  const cam = new Cam(r, c.aspect, 1.3, 3)
  const N = 46
  const H = (i: number, j: number) => {
    const u = (i / N - 0.5) * 4, v = (j / N - 0.5) * 4
    const d = Math.hypot(u, v)
    return amp * (Math.sin(d * 5 - lt * 9) * Math.exp(-d * 0.35) * 0.35 + 0.08 * x.kick * Math.sin(u * 3 + t * 20))
  }
  const P = (i: number, j: number) => cam.p(rotX(rotY([(i / N - 0.5) * 4, H(i, j), (j / N - 0.5) * 4], lt * 0.25), 0.55))
  for (let j = N; j >= 0; j--) for (let i = 0; i <= N; i++) {
    const p = P(i, j)
    if (!p) continue
    const h = H(i, j)
    const col = grad(PAL.cyan, clamp01(0.45 + h * 1.5))
    if (i < N) { const q = P(i + 1, j); if (q) c.line(p[0], p[1], q[0], q[1], mul(col, 0.8)) }
    if (j > 0 && i % 2 === 0) { const q = P(i, j - 1); if (q) c.line(p[0], p[1], q[0], q[1], mul(col, 0.5), '·') }
  }
}

function completion(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  const R = r.h * 0.38
  for (let w = 0; w < 3; w++) ring(c, cx, cy, R - w * 0.5, (a) => (((a + Math.PI / 2) / TAU + 1) % 1 <= k ? mix(0x3dfcff, 0xffffff, w / 3) : 0x10303a), -Math.PI / 2, -Math.PI / 2 + TAU, '█')
  const label = `${Math.floor(k * 100)}%`
  bigText(c, label, { x: cx, y: cy, h: Math.min(8, R * 0.7), style: 'block', color: (_u, v) => mix(0x3dfcff, 0xffffff, 1 - v) })
  if (k >= 1) ring(c, cx, cy, R + 2 + (t - T(69)) * 30, () => mul(0xffffff, Math.max(0, 1 - (t - T(69)) * 1.5)), 0, TAU, '*')
}

export const vibrate: Scene = {
  pal: PAL.cyan,
  dock: (x) => (x.t < T(67) ? 1 : 1 - seg(x.t, T(67), T(67) + 0.5) * 0.0),
  wm: (x, ws) => {
    const a = x.t < T(69) ? 1.5 * x.E * (0.4 + x.kick) : 0
    for (const w of Object.values(ws)) w.r = { ...w.r, x: w.r.x + Math.round(noise1(x.t * 30, w.r.y) * a), y: w.r.y + Math.round(noise1(x.t * 31, w.r.x) * a * 0.5) }
  },
  glitch: (x) => 0.25 * x.kick * (x.t < T(69) ? 1 : 0) + 0.6 * flash(x.t, T(69), 0.25),
  title: () => 'render://vibe.wav',
  readouts: (x) => [['amplitude', (0.3 + seg(x.t, T(64), T(67)) * 0.9).toFixed(3)], ['freq', `${(130 / 60).toFixed(3)} Hz`], ['complete', `${Math.floor(seg(x.t, T(67), T(69)) * 100)}%`]],
  view(x, V) {
    const t = x.t
    if (t < T(67) + 0.3) ripple(x, V, 0.3 + seg(t, T(64), T(67)) * 0.9)
    else completion(x, V, seg(t, T(67) + 0.3, T(69), inOutCubic))
    const h = hitAt(t, 64, 69)
    if (h) slam(x, { x: V.x, y: V.y, w: V.w, h: Math.round(V.h * 0.4) }, h, { pal: PAL.cyan, maxH: 8 })
  },
}
void rotZ; void outCubic
