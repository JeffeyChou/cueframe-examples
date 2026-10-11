// Left (windows close one by one → isolation), Fragments (shatter, eraser, cracked heart),
// Illegal (alarms, popups, stack trace) and Crash (kernel panic, flashback montage, singularity).
import { type Rect, grad, luma, mix, mul, rgb } from '../cells.ts'
import { bigText, fitHeight } from '../font.ts'
import { PAL, TAU, field, rampCh, ring, warp } from '../gfx.ts'
import { hash, noise1, seeded } from '../rng.ts'
import { ACTS, type ActId } from '../song.ts'
import { caret, inCubic, inOutCubic } from '../../motion.ts'
import type { Ctx, Scene } from '../types.ts'
import { REG, T, clamp01, curIn, dialog, flash, hitAt, outCubic, outExpo, seg, slam } from './kit.ts'

const GREY = [0x040506, 0x1a1e24, 0x4a525c, 0x9aa7b8, 0xe8eef4]

/** Desaturate every painted cell inside r by k. */
function desat(x: Ctx, r: Rect, k: number) {
  const { c } = x
  for (let y = r.y; y < r.y + r.h; y++) for (let i = r.x; i < r.x + r.w; i++) {
    const j = y * c.cols + i
    const f = c.fg[j]!, l = luma(f) * 255
    c.fg[j] = mix(f, rgb(l, l, l * 1.08), k)
    const b = c.bg[j]!
    if (b >= 0) { const lb = luma(b) * 255; c.bg[j] = mix(b, rgb(lb, lb, lb * 1.1), k) }
  }
}

// ── left ────────────────────────────────────────────────────────────────────────────────────────

const ORDER = ['trace', 'insp', 'mem', 'sys', 'view'] as const
const SESSION = [
  'session 0x2A open  ·  peers: me, you',
  '[you] typing…',
  '[me]  are you still there?',
]
export const left: Scene = {
  pal: GREY,
  dock: () => 0,
  wm: (x, ws) => {
    ORDER.forEach((id, k) => {
      const at = T(70 + k) + 0.05
      ws[id].on = 1 - seg(x.t, at, at + 0.4, inCubic)
    })
    if (x.t >= T(76)) ws.view.on = 0
  },
  glitch: (x) => 0.35 * flash(x.t, T(curIn(x.t, 70, 76)), 0.15),
  title: () => 'tty://session.log',
  readouts: (x) => [['peers', String(Math.max(1, 2 - Math.floor(clamp01((x.t - T(70)) / 0.5))))], ['link', 'DOWN'], ['retries', String(curIn(x.t, 70, 76) - 69)]],
  log: (k) => (k % 3 ? 'ping you … timeout' : 'WARN peer gone'),
  view(x, V) {
    const { c, t } = x
    SESSION.forEach((s, i) => c.text(V.x + 2, V.y + 1 + i, s, i === 1 ? 0x6a7680 : 0xc8d2da))
    const n = curIn(t, 70, 76) - 69
    for (let k = 0; k < n; k++) {
      const y = V.y + 5 + k * 2
      c.text(V.x + 2, y, `*** [you] has left the session  (code 0x${(k * 37 + 0x10).toString(16)})`, k === n - 1 ? 0xffffff : 0x56626c)
      c.text(V.x + 2, y + 1, `    [me]  ${'.'.repeat(1 + k)}`, 0x3a4652)
    }
  },
  over(x) {
    const { c, t, D } = x
    // the screen drains of colour as each window closes
    desat(x, D, seg(t, T(70), T(76), inOutCubic))
    if (t < T(76)) return
    const lt = t - T(76)
    // isolation: dark desktop, distant stars receding, a lone cursor
    c.fill(D, ' ', 0, 0x020304)
    warp(c, D, t, -0.6, 90, (z) => mul(0x9aa7b8, 0.15 + 0.15 * (1 - z / 4)), 13)
    const cx = Math.round(D.x + D.w / 2), cy = Math.round(D.y + D.h / 2)
    c.text(cx - 3, cy, '> me', 0x9aa7b8)
    if (caret(t, 1.2)) c.put(cx + 2, cy, '█', 0xe8eef4)
    for (let k = 1; k < 5; k++) ring(c, cx, cy, k * 3 + (lt * 4) % 3, () => mul(0x9aa7b8, 0.12 / k), 0, TAU, '·')
    const h = hitAt(t, 76, 76)
    if (h) {
      const hh = fitHeight(h.en, D.w * 0.7, 7)
      bigText(c, h.en, { x: cx, y: D.y + D.h * 0.22, h: hh, style: 'outline', glyphs: '░', reveal: outExpo(clamp01(lt / 0.5)), color: () => mul(0x9aa7b8, 0.5) })
    }
  },
}

// ── fragments ───────────────────────────────────────────────────────────────────────────────────

const SHARDS = (() => {
  const r = seeded('shards')
  return Array.from({ length: 70 }, () => ({ u: r(), v: r(), w: r.int(6, 18), h: r.int(2, 5), vx: r.range(-1, 1), vy: r.range(-1, 0.6), spin: r.range(-1, 1), s: r.int(0, 1000) }))
})()
function shatter(x: Ctx, r: Rect, k: number) {
  const { c, t } = x
  for (const s of SHARDS) {
    const bx = r.x + s.u * (r.w - s.w), by = r.y + s.v * (r.h - s.h)
    const fly = outCubic(k)
    const dx = s.vx * r.w * 0.5 * fly + Math.sin(t * 3 + s.s) * fly, dy = s.vy * r.h * 0.6 * fly + 0.5 * 30 * fly * fly * 0.3
    const sk = Math.round(s.spin * 3 * fly)
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const g = hash(s.s * 97 + i * 13 + j, 1)
      const ch = '0123456789ABCDEF'[Math.floor(g * 16)]!
      c.put(bx + dx + i + sk * (j - s.h / 2), by + dy + j, ch, mix(0xd8f4ff, 0x4a6a8a, 0.3 + 0.5 * fly + 0.2 * g))
    }
    c.box({ x: Math.round(bx + dx - 1), y: Math.round(by + dy - 1), w: s.w + 2, h: s.h + 2 }, mul(0xd8f4ff, 0.4 * (1 - fly)))
  }
}
function eraser(x: Ctx, r: Rect, k: number) {
  const { c } = x
  const ex = r.x + k * (r.w + 8) - 4
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let i = r.x; i < Math.min(r.x + r.w, ex); i++) c.put(i, y, hash(i * 7 + y, 4) < 0.08 ? '░' : ' ', 0x1a2a3a, 0x05080b)
    for (let w = 0; w < 3; w++) c.put(ex + w, y, '█', mix(0xffffff, 0x9ab8d8, w / 3))
  }
}
/** Implicit heart outline, cracking down the middle; halves drift apart and fall. */
function heartCrack(x: Ctx, r: Rect, k: number, fall: number) {
  const { c, t } = x
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  const S = r.h * 0.36
  field(c, r, (u0, v0, px, py) => {
    const side = u0 < 0 ? -1 : 1
    const sep = side * k * 0.35 + side * fall * 0.25
    const drop = fall * fall * 1.6 * (side < 0 ? 1 : 1.25)
    const u = (u0 - sep) / (S / (r.h / 2)), v = -(v0 - drop) / (S / (r.h / 2))
    const f = (u * u + v * v - 1) ** 3 - u * u * v * v * v
    if (f > 0) return
    const zig = Math.abs(u0 - sep - 0.04 * Math.sin(v * 9 + 1.3)) < 0.035
    if (zig && k > 0) return
    const depth = clamp01(-f * 3)
    const rim = depth < 0.12
    c.put(px, py, rim ? '█' : rampCh(0.35 + 0.5 * depth, ' .:-=+*#%@'), mix(rim ? 0xff7aa8 : mix(0x60102a, 0xff4f8b, depth), 0x6a7680, clamp01(k * 0.5 + fall)))
  })
  if (k > 0) for (let i = 0; i < 40 * fall; i++) {
    const rr = seeded(i * 11)
    c.put(cx + rr.range(-1, 1) * S * 1.4 + Math.sin(t + i), cy + rr.range(0, 1) * r.h * 0.5 + fall * rr() * 10, rr.pick(['.', ',', '`', '\'']), mul(0xff4f8b, 0.5))
  }
}

export const fragments: Scene = {
  pal: PAL.ice,
  chrome: () => 1,
  dock: () => 1,
  glitch: (x) => 0.3 + 0.3 * flash(x.t, T(79), 0.3) + 0.5 * flash(x.t, T(80), 0.2),
  title: () => 'gdb://heap.dump',
  readouts: (x) => [['heap', `${Math.max(0, 100 - Math.floor((x.t - T(77)) * 14))}%`], ['fragments', String(70 + Math.floor((x.t - T(77)) * 31))], ['gc', 'aggressive']],
  view(x, V) {
    const t = x.t
    const i = curIn(t, 77, 82)
    if (i <= 79) {
      shatter(x, V, seg(t, T(78), T(80), inOutCubic))
      if (t > T(78)) eraser(x, V, seg(t, T(78), T(80) - 0.1))
    } else {
      heartCrack(x, V, seg(t, T(80) + 0.2, T(81) + 0.4, outExpo), seg(t, T(82), T(83), inCubic))
    }
    desat(x, V, 0.5)
    const h = hitAt(t, 77, 82)
    if (h) slam(x, { x: V.x, y: V.y, w: V.w, h: Math.round(V.h * 0.42) }, h, { pal: h.i === 82 ? PAL.pink : PAL.ice, maxH: 8 })
  },
}

// ── illegal ─────────────────────────────────────────────────────────────────────────────────────

const TRACE = [
  'IllegalArgumentException: argument "you" is not a member of World',
  '    at World.execute (world.ts:13:7)',
  '    at God.validate (kernel/god.sys:404:1)',
  '    at Heart.beat (heart.sys:130:60)',
  '    at Simulation.tick (sim.ts:30:1)',
  '    at me (<anonymous>)',
  '    at Object.<anonymous> (love.alg:1:1)',
  '  caused by: AccessViolation 0xC0000005 reading 0x00000000',
  '  caused by: CircularDependency me -> you -> me',
]
const POPS = ['ACCESS VIOLATION', 'PERMISSION DENIED', 'SEGMENTATION FAULT', 'STACK OVERFLOW', 'INVALID OPERAND', 'ASSERTION FAILED']

export const illegal: Scene = {
  pal: PAL.red,
  dock: (x) => seg(x.t, T(84), T(84) + 0.5),
  glitch: (x) => 0.2 + 0.35 * seg(x.t, T(83), T(85)) + 0.4 * flash(x.t, T(85), 0.3) - 0.2 * seg(x.t, T(85) + 0.6, T(85) + 1),
  title: () => 'kernel://god.sys',
  readouts: (x) => [['caller', 'me'], ['callee', 'god'], ['perm', 'DENIED'], ['args', x.t > T(85) ? 'ILLEGAL' : 'checking…'], ['errno', String(1 + Math.floor((x.t - x.act.t0) * 41))]],
  log: (k) => (k % 2 ? `ERR 0x${(k * 7919).toString(16).slice(-4)} access denied` : `WARN ring0 call from user`),
  bg(x) {
    const { c, t, D } = x
    const strobe = Math.exp(-x.beat.phase * 5)
    field(c, D, (u, v, px, py) => {
      const s = Math.sin(Math.hypot(u, v) * 8 - t * 6) * 0.5 + 0.5
      if (s > 0.8) c.put(px, py, '▲', mul(0xff2a3a, 0.15 + 0.25 * strobe))
    })
  },
  view(x, V) {
    const { c, t } = x
    const lt = t - T(83)
    const strobe = Math.exp(-x.beat.phase * 5)
    c.fill(V, ' ', 0, mul(0x400008, 0.4 + 0.6 * strobe))
    // scrolling stack trace
    const off = Math.floor(lt * 8)
    for (let y = 0; y < V.h; y++) {
      const s = TRACE[(y + off) % TRACE.length]!
      c.text(V.x + 2, V.y + y, s.slice(0, V.w - 4), y % TRACE.length === 0 ? 0xffffff : mul(0xff6a6a, 0.5))
    }
    // popups cascade
    const n = Math.min(18, Math.floor(lt * 5))
    for (let i = 0; i < n; i++) {
      const r = seeded(i * 13 + 2)
      const w = 34, h = 6
      dialog(x, { x: V.x + r.int(0, Math.max(1, V.w - w)), y: V.y + r.int(0, Math.max(1, V.h - h)), w, h }, POPS[i % POPS.length]!, [`pid 0x${(0x3f1 + i).toString(16)} terminated`, 'by order of god.sys'], i % 2 ? 0xff2a3a : 0xffb02e, { buttons: ['ABORT', 'RETRY'], icon: '/!\\', bg: 0x140406 })
    }
    const h = hitAt(t, 83, 85)
    if (h) slam(x, V, h, { pal: PAL.red, maxH: 12 })
  },
}

// ── crash ───────────────────────────────────────────────────────────────────────────────────────

const PANIC = [
  'KERNEL PANIC - not syncing: heart.sys: attempted to kill init!',
  'CPU: 0 PID: 1 Comm: world.exe Tainted: G   D   4.13.0-sim',
  'Call Trace:',
  ' <IRQ> dump_stack+0x63/0x8a',
  '  panic+0xe4/0x253',
  '  do_exit+0xb1a/0xb20',
  '  love_alg_eval+0x41/0x1337',
  ' ---[ end Kernel panic - not syncing ]---',
]
/** Earlier moments replayed in the montage: act and time inside it. */
const FLASH: [ActId, number][] = [['geometry', 32.9], ['boot', 12.4], ['current', 50.2], ['chorus', 64.0], ['organic', 83.6], ['switch', 100.5], ['vibrate', 105.2], ['title', 23], ['current', 52.5], ['organic', 86.5], ['chorus', 71.6], ['geometry', 42.4]]

export const crash: Scene = {
  pal: PAL.red,
  dock: () => 1,
  glitch: (x) => {
    const lt = x.t - x.act.t0
    return 0.45 + 0.4 * x.kick * (lt > 4 ? 1 : 0.3) + 0.5 * seg(x.t, x.act.t1 - 2, x.act.t1)
  },
  title: (x) => (x.t - x.act.t0 < 4 ? 'tty0://panic' : 'replay://memory'),
  readouts: (x) => [['state', 'PANIC'], ['replay', `${Math.max(0, x.beat.n % FLASH.length)}`], ['uptime', (x.t).toFixed(2)]],
  log: (k) => `dump 0x${(0x7ffe0000 + k * 64).toString(16)} ${(k * 2654435761 >>> 0).toString(16).padStart(8, '0')}`,
  view(x, V) {
    const { c, t } = x
    const lt = t - x.act.t0, dur = x.act.t1 - x.act.t0
    if (lt < 4) {
      // red hex rain under the panic text
      for (let i = 0; i < V.w; i += 3) for (let k = 0; k < 6; k++) {
        const y = V.y + ((t * (8 + (i % 7)) + hash(i, 5) * 40 + k * 1.0) % V.h)
        c.text(V.x + i, Math.floor(y), (Math.floor(hash(i * 7 + k, Math.floor(t * 6)) * 256)).toString(16).padStart(2, '0'), mul(0xff2a3a, 0.15 + 0.12 * k))
      }
      const n = Math.min(PANIC.length, Math.floor(lt * 6) + 1)
      for (let k = 0; k < n; k++) c.text(V.x + 3, V.y + 2 + k, PANIC[k]!, k === 0 ? 0xffffff : 0xff6a6a, k === 0 ? 0x600010 : undefined)
      return
    }
    if (lt < dur - 2.2) {
      // montage: one earlier scene per beat, red-shifted, with a hard frame label
      const k = ((x.beat.n % FLASH.length) + FLASH.length) % FLASH.length
      const [id, at] = FLASH[k]!
      const sc = REG.scenes![id]!
      const a = ACTS.find((q) => q.id === id)!
      const y: Ctx = { ...x, t: at + x.beat.phase * 0.46, act: a, lt: at - a.t0, pal: sc.pal ?? x.pal, accent: a.accent }
      sc.view?.(y, V)
      for (let j = V.y; j < V.y + V.h; j++) for (let i = V.x; i < V.x + V.w; i++) {
        const q = j * c.cols + i
        const l = luma(c.fg[q]!) * 255
        c.fg[q] = rgb(l * 1.2 + 30, l * 0.35, l * 0.4)
        if (c.bg[q]! >= 0) c.bg[q] = mul(c.bg[q]!, 0.4)
      }
      c.text(V.x + 2, V.y + 1, ` ◀◀ REPLAY ${a.file}  @ ${at.toFixed(2)}s `, 0x05080b, 0xff2a3a)
      return
    }
    // singularity: everything falls into the centre
    const k = seg(t, x.act.t1 - 2.2, x.act.t1, inCubic)
    field(c, V, (u, v, px, py) => {
      const d = Math.hypot(u, v), a = Math.atan2(v, u)
      const sw = a + (1.5 + 6 * k) / (d + 0.15) - t * 4
      const s = Math.sin(sw * 3) * 0.5 + 0.5
      const hole = d < 0.12 + 0.25 * k
      if (hole) { c.put(px, py, ' ', 0, 0x000000); return }
      const disc = Math.exp(-((d - (0.18 + 0.25 * k)) ** 2) * 200)
      const val = s * 0.6 * Math.min(1, d * 2) + disc
      if (val < 0.25) return
      c.put(px, py, rampCh(val, ' .:-=+*#%@'), mix(mul(0xff2a3a, 0.4 + 0.6 * val), 0xffffff, disc))
    })
    void noise1; void grad
  },
}
