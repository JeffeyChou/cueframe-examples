// Boot (power on → protection → pieces → objects → parameters → init → new world → simulation)
// and the title / instrumental flight over a character terrain.
import { type Rect, grad, hsl, mix, mul } from '../cells.ts'
import { bigText, fitHeight } from '../font.ts'
import { Cam, PAL, TAU, type V3, field, rampCh, ring, rotX, rotY, seg3, warp } from '../gfx.ts'
import { fbm, hash, noise1, seeded } from '../rng.ts'
import { LINES } from '../song.ts'
import { caret, inOutCubic, spring, typed } from '../../motion.ts'
import type { Ctx, Scene } from '../types.ts'
import { E, T, clamp01, curIn, echo, flash, hitAt, outCubic, outExpo, progress, seg, slam } from './kit.ts'

const G = PAL.green

// ── boot ────────────────────────────────────────────────────────────────────────────────────────

const POST = [
  'CRT-BIOS v4.13  (c) 0x7E3 world.sys',
  'CPU0 ......... lambda core  @ 4.20 THz',
  'MEM TEST ..... 65536K OK',
  'VRAM ......... 177x51 cells, phosphor P1',
  'IRQ 07 ....... lyric.io',
  'IRQ 11 ....... heart.sys   [no response]',
  'DMA .......... audio.null',
  'BOOT ......... /dev/world0',
  'mount /sim ... ok',
  'load kernel .. ok',
]

function powerLine(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  const y0 = r.y + r.h * 0.62
  const head = (t - T(0)) * 1.6
  for (let i = 0; i < r.w; i++) {
    const u = i / r.w
    if (u > head) break
    const amp = 2.2 + 1.6 * Math.sin(u * 7 + t * 2)
    const y = y0 + amp * Math.sin(u * 46 - t * 14) * k
    const hot = Math.exp(-((u - ((t * 0.9) % 1.2)) ** 2) * 900)
    c.put(r.x + i, y, '•', mix(G[3]!, 0xffffff, hot))
    if (hot > 0.3) { c.put(r.x + i, y - 1, '|', mul(0xffffff, hot)); c.put(r.x + i, y + 1, '|', mul(0xffffff, hot)) }
  }
  // posts every few columns
  for (let i = 6; i < r.w * Math.min(1, head); i += 22) {
    c.line(r.x + i, y0 - 1, r.x + i, r.y + r.h - 1, G[1]!, '┃')
    c.text(r.x + i - 2, y0 - 2, '─┼─', G[2]!)
  }
  c.text(r.x + 3, r.y + r.h - 2, `V=${(220 + 9 * noise1(t * 7, 2)).toFixed(1)}V  f=60.00Hz  phase ${(t * 360 % 360).toFixed(0).padStart(3)}°`, G[2]!)
}

function hexShield(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  const s = 3
  for (let gy = -12; gy <= 12; gy++) for (let gx = -30; gx <= 30; gx++) {
    const px = cx + gx * s * 2 + (gy % 2 ? s : 0), py = cy + gy * 1.5 * 1.2
    if (px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) continue
    const d = Math.hypot((px - cx) / x.c.aspect, py - cy) / (r.h * 0.9)
    const on = clamp01((k * 1.4 - d) * 4)
    if (on <= 0) continue
    const wave = Math.exp(-((d - k * 1.2) ** 2) * 60)
    const col = mix(mul(G[2]!, on), 0xffffff, wave * 0.9)
    c.text(Math.round(px - 1), Math.round(py), on > 0.5 ? '○' : '·', col)
    if (hash(gx * 41 + gy, Math.floor(t * 6)) < 0.05 * on) c.text(Math.round(px - 1), Math.round(py), '●', G[3]!)
  }
  c.text(r.x + 3, r.y + 2, `SHIELD ${Math.round(k * 100)}%  ring0 armed  ε-guard ON`, G[3]!)
}

// falling pieces: tetromino-ish shapes with fixed landing cells
const SHAPES = [[[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]]]
const PIECES = (() => {
  const r = seeded('pieces')
  const cols = 24, h = new Array(cols).fill(0)
  return Array.from({ length: 34 }, (_, i) => {
    const s = SHAPES[r.int(0, SHAPES.length)]!
    const w = Math.max(...s.map((p) => p[0]!)) + 1
    const gx = r.int(0, cols - w + 1)
    const land = Math.max(...s.map(([dx, dy]) => h[gx + dx!]! + (Math.max(...s.filter((q) => q[0] === dx).map((q) => q[1]!)) - dy!)))
    for (const [dx, dy] of s) h[gx + dx!] = Math.max(h[gx + dx!]!, land + (1 - dy!) + (Math.max(...s.map((q) => q[1]!)) - 1))
    return { s, gx, gy: land, hue: r(), delay: i * 0.07 }
  })
})()

function pieces(x: Ctx, r: Rect, t0: number, morph: number) {
  const { c, t } = x
  const cw = Math.max(2, Math.floor(r.w / 30)) * 2, ch = Math.max(1, Math.floor(r.h / 22))
  const ox = r.x + Math.floor((r.w - 24 * cw) / 2), base = r.y + r.h - 2
  for (const p of PIECES) {
    const lt = t - t0 - p.delay
    if (lt < 0) continue
    const fall = clamp01(lt / 0.45)
    const yy = base - (p.gy + 2) * ch - (1 - outCubic(fall) ** 2) * r.h
    const col = grad(G, 0.45 + 0.5 * p.hue)
    for (const [dx, dy] of p.s) {
      let px = ox + (p.gx + dx!) * cw, py = yy - dy! * ch
      if (morph > 0) {
        const a = Math.atan2(py - (r.y + r.h / 2), px - (r.x + r.w / 2))
        px += Math.cos(a + morph * 2) * morph * r.w * 0.2
        py += Math.sin(a + morph * 2) * morph * r.h * 0.2
      }
      for (let k = 0; k < ch; k++) c.text(Math.round(px), Math.round(py) - k, '█'.repeat(cw - 1) + '▌', mix(col, 0xffffff, flash(t, t0 + p.delay + 0.45, 0.1)))
    }
  }
}

const CUBE: V3[] = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
const CE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
function objects(x: Ctx, r: Rect, t0: number) {
  const { c, t } = x
  const lt = t - t0
  const cam = new Cam(r, c.aspect, 0.55, 6)
  const n = 27
  for (let i = 0; i < n; i++) {
    const gx = (i % 3) - 1, gy = Math.floor(i / 3) % 3 - 1, gz = Math.floor(i / 9) - 1
    const pop = outExpo(clamp01((lt - i * 0.025) / 0.3))
    if (pop <= 0) continue
    const s = 0.32 * pop
    const ay = lt * 0.9 + 0.5, ax = 0.5 + 0.2 * Math.sin(lt)
    const cen: V3 = [gx * 1.2, gy * 1.2, gz * 1.2]
    const pts = CUBE.map((v) => rotX(rotY([cen[0] + v[0] * s, cen[1] + v[1] * s, cen[2] + v[2] * s], ay), ax))
    const col = grad(G, 0.5 + 0.5 * pop)
    for (const [a, b] of CE) seg3(c, cam, pts[a!]!, pts[b!]!, col)
    const p = cam.p(rotX(rotY(cen, ay), ax))
    if (p && i % 4 === 0) c.text(p[0] + 2, p[1], `obj#${i.toString(16).padStart(2, '0')}`, G[2]!)
  }
}

const PARAMS: [string, string][] = [
  ['seed', '0x5EED_C0DE'], ['gravity', '9.80665'], ['c', '299792458'], ['h', '6.626e-34'],
  ['entropy', 'monotonic'], ['dimensions', '3 + 1'], ['inhabitants', '2'], ['loneliness', 'undefined'],
]
function form(x: Ctx, r: Rect, t0: number) {
  const { c, t } = x
  const fx = r.x + Math.max(2, Math.floor(r.w * 0.12)), fy = r.y + 2
  c.text(fx, fy, 'const world = new World({', G[3]!)
  PARAMS.forEach(([k, v], i) => {
    const at = t0 + 0.15 + i * 0.28
    const y = fy + 2 + i * 2
    if (y > r.y + r.h - 3) return
    c.text(fx + 4, y, `${k}:`.padEnd(14), 0x7d8a96)
    const box = Math.min(36, r.w - 30)
    c.text(fx + 18, y, '[' + ' '.repeat(box) + ']', t >= at ? G[2]! : 0x26303a)
    const n = typed(t, at, v.length, 40)
    c.text(fx + 19, y, v.slice(0, n), i === PARAMS.length - 1 ? 0xff6a6a : 0xeaffee)
    if (n < v.length && t >= at && caret(t, 4)) c.put(fx + 19 + n, y, '▌', G[3]!)
    if (n === v.length) c.text(fx + 21 + box, y, '✓', G[3]!)
  })
  c.text(fx, fy + 3 + PARAMS.length * 2, '})', G[3]!)
}

function globe(x: Ctx, r: Rect, t0: number, grow: number) {
  const { c, t } = x
  const lt = t - t0
  const cam = new Cam(r, c.aspect, 0.8 * (1 + grow * 2.4), 3.2)
  const ay = lt * 0.6, ax = 0.35
  const build = clamp01(lt / 1.6)
  // meridians and parallels
  for (let m = 0; m < 12; m++) {
    const a = (m / 12) * TAU
    let prev: [number, number, number, number] | null = null
    for (let k = 0; k <= 24 * build; k++) {
      const b = -Math.PI / 2 + (k / 24) * Math.PI
      const p = cam.p(rotX(rotY([Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)], ay), ax))
      if (p && prev && p[3] < 0.3) c.line(prev[0], prev[1], p[0], p[1], mul(G[2]!, 0.6 + 0.4 * (1 - p[3])))
      prev = p
    }
  }
  for (let q = 1; q < 8; q++) {
    const b = -Math.PI / 2 + (q / 8) * Math.PI
    let prev: [number, number, number, number] | null = null
    for (let k = 0; k <= 48 * build; k++) {
      const a = (k / 48) * TAU
      const p = cam.p(rotX(rotY([Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)], ay), ax))
      if (p && prev && p[3] < 0.3) c.line(prev[0], prev[1], p[0], p[1], mul(G[2]!, 0.5))
      prev = p
    }
  }
  // land: noise points on the sphere
  const rr = seeded('land')
  for (let i = 0; i < 700; i++) {
    const u = rr() * 2 - 1, a = rr() * TAU, s = Math.sqrt(1 - u * u)
    const v: V3 = [s * Math.cos(a), u, s * Math.sin(a)]
    if (fbm(v[0] * 2 + 3, v[1] * 2 + v[2], 7) < 0.05) continue
    if (i / 700 > build) continue
    const p = cam.p(rotX(rotY(v, ay), ax))
    if (p && p[3] < 0.1) c.put(p[0], p[1], p[3] < -0.6 ? '#' : '+', mix(G[3]!, 0xffffff, 0.3 * (-p[3])))
  }
  if (grow > 0) warp(c, r, t, 2 + grow * 10, 120, () => G[3]!, 5)
}

export const boot: Scene = {
  pal: G,
  chrome: (x) => (x.t >= T(6) - 0.05 ? 1 : 0),
  dock: (x) => {
    const t = x.t
    if (t < T(6)) return 1
    if (t < T(10)) return 1 - spring(clamp01((t - T(6)) / 1.1), 0.55, 1.4)
    return seg(t, T(10) + 0.3, T(10) + 1.4, inOutCubic)
  },
  title: (x) => (x.t < T(6) ? null : `render://boot.sys`),
  glitch: (x) => 0.5 * flash(x.t, T(6), 0.25) + 0.25 * seg(x.t, T(10) + 1, x.act.t1) ** 2,
  readouts: (x) => [['object', 'World'], ['state', x.t < T(7) ? 'ALLOC' : x.t < T(10) ? 'INIT' : 'SIM'], ['params', `${Math.min(PARAMS.length, Math.max(0, Math.floor((x.t - T(6)) / 0.28)))}/${PARAMS.length}`], ['ring', '0'], ['shield', 'ON']],
  log: (k) => POST[k % POST.length]!.replace(/\.+/, '..'),
  view(x, V) {
    const { c, t } = x
    const i = curIn(t, 0, 10)
    // boot log on the left, always behind early phases
    if (t < T(6)) {
      const n = Math.min(POST.length, Math.floor(t * 9))
      for (let k = 0; k < n; k++) c.text(V.x + 2, V.y + 1 + k, POST[k]!, k === n - 1 ? 0xeaffee : G[2]!)
      if (caret(t, 3)) c.put(V.x + 2, V.y + 1 + n, '█', G[3]!)
    }
    if (i <= 0) powerLine(x, V, clamp01((t - T(0)) / 0.5))
    if (i >= 1 && i <= 2) { powerLine(x, V, 1 - clamp01((t - T(1)) / 0.4)); hexShield(x, V, clamp01((t - T(1)) / 1.6)) }
    if (i >= 3 && i <= 4) pieces(x, V, T(3), 0)
    if (i === 5) { pieces(x, V, T(3), outCubic(clamp01((t - T(5)) / 0.35))); objects(x, V, T(5)) }
    if (i === 6) form(x, V, T(6))
    if (i === 7) {
      const rows = ['kernel', 'phys.engine', 'time.axis', 'light.cone', 'lyric.io', 'heart.sys']
      rows.forEach((s, k) => progress(x, V.x + 4, V.y + 3 + k * 2, Math.min(V.w - 8, 90), s, (t - T(7) - k * 0.06) / (0.5 + k * 0.08) * (k === 5 ? 0.93 : 1), G[3]!))
    }
    if (i >= 8) globe(x, V, T(8), i >= 10 ? seg(t, T(10) + 0.2, x.act.t1, outCubic) : 0)
    // capitalised word in the viewport
    const h = hitAt(t, 0, 10)
    if (h) slam(x, V, h, { pal: G, out: 1 - seg(t, h.next - 0.12, h.next) * (h.i === 10 ? 0 : 1) })
  },
}

// ── title + instrumental flight ─────────────────────────────────────────────────────────────────

const CODE = [
  'import { Heart, Clock } from "kernel";',
  '',
  'class World extends Simulation {',
  '  constructor(private me: Agent) { super() }',
  '  tick(dt: number) {',
  '    for (const p of this.points) p.integrate(dt);',
  '    this.render(this.me);',
  '  }',
  '}',
  '',
  'const world = new World(me);',
  'while (heart.beats()) {',
  '  world.tick(1 / 30);',
  '}',
]

function terrain(x: Ctx, r: Rect, speed: number, rise: number, pal: readonly number[]) {
  const { c, t } = x
  const horizon = r.y + r.h * (0.34 - 0.12 * rise)
  // sky: dim stars and a sun ring
  const sunX = r.x + r.w * 0.5, sunY = horizon - r.h * 0.12
  for (let k = 0; k < 6; k++) ring(c, sunX, sunY, 2 + k * 1.3, () => mix(pal[3]!, 0x05080b, k / 6), 0, TAU, k < 2 ? '█' : '·')
  for (let k = 0; k < 90; k++) {
    const sx = r.x + hash(k, 3) * r.w, sy = r.y + hash(k, 4) * (horizon - r.y)
    if (hash(k, Math.floor(t * 3)) > 0.15) c.put(sx, sy, hash(k, 9) < 0.2 ? '+' : '·', mul(pal[3]!, 0.3 + 0.5 * hash(k, 5)))
  }
  // voxel-space columns
  const z0 = t * speed
  const camH = 1.6 + rise * 2.5
  const ybuf = new Float32Array(r.w).fill(r.y + r.h)
  for (let zi = 1; zi < 90; zi++) {
    const z = zi * zi * 0.012 + 0.3
    const fog = clamp01(1 - z / 90)
    for (let i = 0; i < r.w; i++) {
      const sx = (i - r.w / 2) / (r.h * c.aspect * 0.5)
      const wx = sx * z * 1.4, wz = z + z0
      const h = 2.2 * fbm(wx * 0.08, wz * 0.08, 11, 4) + 0.9 * Math.abs(noise1(wx * 0.3 + wz * 0.05, 3)) - 0.4
      const sy = horizon + ((camH - h) / z) * r.h * 0.45
      if (sy < ybuf[i]!) {
        const top = Math.max(r.y, Math.floor(sy))
        const slope = h - (2.2 * fbm(wx * 0.08, (wz + 0.5) * 0.08, 11, 4))
        const v = clamp01(0.25 + h * 0.3 + slope * 1.5) * fog
        const ch = zi < 12 ? rampCh(v, ' .:-=+*#%@') : slope > 0.05 ? '/' : slope < -0.05 ? '\\' : rampCh(v * 0.8, ' .,:;=+*')
        const col = mix(0x05080b, grad(pal, 0.3 + 0.6 * v), fog)
        for (let y = top; y < ybuf[i]!; y++) c.put(r.x + i, y, y === top ? ch : rampCh(v * 0.5, ' .:-'), y === top ? col : mul(col, 0.45))
        ybuf[i] = top
      }
    }
  }
  // grid lines on the near ground
  for (let k = 0; k < 8; k++) {
    const z = ((k + 1 - ((z0 * 1.5) % 1)) ** 2) * 0.5 + 0.2
    const sy = horizon + (camH / z) * r.h * 0.45
    if (sy < r.y + r.h && sy > horizon) for (let i = 0; i < r.w; i += 2) if (c.get(r.x + i, Math.round(sy)) === ' ') c.put(r.x + i, sy, '─', mul(pal[2]!, 0.4))
  }
}

export const title: Scene = {
  pal: G,
  dock: (x) => 1 - seg(x.t, x.act.t1 - 1.3, x.act.t1 - 0.1, inOutCubic),
  title: (x) => (x.t < E(11) ? 'edit://world.exe' : 'render://world.exe'),
  glitch: (x) => 0.6 * flash(x.t, E(11), 0.2) + 0.3 * flash(x.t, x.act.t1 - 0.4, 0.2),
  readouts: (x) => [['object', 'World<me>'], ['tick', (x.t * 30).toFixed(0)], ['speed', `${(2 + x.E * 4).toFixed(2)} u/s`], ['alt', `${(1.6 + seg(x.t, x.act.t1 - 4, x.act.t1) * 2.5).toFixed(2)}`]],
  view(x, V) {
    const { c, t } = x
    const tt = E(11)
    if (t < tt) {
      // editor
      const lt = t - T(11)
      CODE.forEach((s, i) => {
        const y = V.y + 1 + i - Math.max(0, Math.floor(lt * 2) - 6)
        if (y < V.y || y >= V.y + V.h) return
        c.text(V.x + 1, y, String(i + 1).padStart(3), 0x2a343e)
        c.text(V.x + 6, y, s, mul(G[2]!, 0.55))
      })
      const word = LINES[11]!.en
      const n = Math.min(word.length, Math.floor(lt * 14) + 1)
      const h = fitHeight(word, V.w - 6, Math.min(V.h * 0.38, 12))
      const sweep = (lt * 0.7) % 1.4
      echo(x, 3, 0.05, (te, k) => {
        bigText(c, word.slice(0, n), {
          x: V.x + V.w / 2 - ((word.length - n) * h * 2 * 31) / 38 / 2, y: V.y + V.h * 0.5 + (1 - k) * 2, h, style: k < 1 ? 'ramp' : 'block',
          color: (u, v) => mul(mix(grad(G, 0.6 + 0.4 * (1 - v)), 0xffffff, Math.exp(-((u - sweep) ** 2) * 80)), k),
          shear: 0.15 * Math.sin(te * 2),
        })
      })
      if (caret(t, 3)) c.text(V.x + 2, V.y + V.h - 2, `> run --as me   [${'█'.repeat(Math.min(20, Math.floor(lt * 5)))}${'·'.repeat(Math.max(0, 20 - Math.floor(lt * 5)))}]`, G[3]!)
      return
    }
    const rise = seg(t, x.act.t1 - 4, x.act.t1, inOutCubic)
    terrain(x, V, 3 + 3 * x.E, rise, G)
    // a HUD reticle
    const cx = V.x + V.w / 2, cy = V.y + V.h * 0.45
    c.text(cx - 6, cy, '─┤    ├─', mul(G[3]!, 0.7))
    c.text(V.x + 3, V.y + 1, `ALT ${(1.6 + rise * 2.5).toFixed(2)}km  HDG ${(t * 12 % 360).toFixed(0).padStart(3, '0')}  SPD ${(3 + 3 * x.E).toFixed(1)}  T+${(t - tt).toFixed(2)}`, G[3]!)
    const fade = flash(t, tt, 0.3)
    if (fade > 0.05) field(c, V, (_u, _v, px, py) => { if (hash(px * 7 + py, x.frame) < fade) c.put(px, py, '█', mix(G[3]!, 0xffffff, 0.6)) })
    void hsl
  },
}
