// Program chrome: menu and tab bars, the window manager (panels + viewport), the caption band,
// the one-row spectrum and the status bar. Layout is responsive in cells.
import { Cells, type Rect, mix, mul, rgb, strWidth } from './cells.ts'
import { type Line, ACTS, BANDS, END, LINES, lastLine, lineAt, spectrum } from './song.ts'
import { hash, noise1, seeded } from './rng.ts'
import { caret, clamp01, outCubic, seg } from '../motion.ts'
import type { Ctx } from './types.ts'

export interface Layout {
  W: number; H: number
  menu: number; tabs: number
  D: Rect           // desktop: everything between the tab bar and the caption band
  cap: Rect         // caption band
  spec: number      // spectrum row
  status: number    // status row
  side: number      // panel width
}
export function layout(W: number, H: number): Layout {
  const capH = H >= 40 ? 6 : 5
  const status = H - 1, spec = H - 2
  const cap = { x: 0, y: spec - capH, w: W, h: capH }
  const D = { x: 0, y: 2, w: W, h: cap.y - 2 }
  const side = W >= 150 ? Math.round(Math.min(40, W * 0.2)) : W >= 110 ? 30 : 0
  return { W, H, menu: 0, tabs: 1, D, cap, spec, status, side }
}

export type WinId = 'sys' | 'mem' | 'insp' | 'trace' | 'view'
export interface Win { id: WinId; r: Rect; title: string; on: number; z: number }
/** Docked rects lerped toward "viewport fills the desktop" by k. */
export function windows(L: Layout, k: number): Record<WinId, Win> {
  const { D, side } = L
  const e = outCubic(k)
  const off = Math.round(e * (side + 3))
  const topH = Math.round(D.h * 0.45)
  const sx = side > 0 ? side : 0
  const v0 = { x: D.x + sx, y: D.y, w: D.w - 2 * sx, h: D.h }
  const view = { x: Math.round(v0.x * (1 - e) + D.x * e), y: D.y, w: Math.round(v0.w * (1 - e) + D.w * e), h: D.h }
  return {
    sys: { id: 'sys', r: { x: D.x - off, y: D.y, w: side, h: topH }, title: 'SYS.MONITOR', on: side > 0 ? 1 : 0, z: 1 },
    mem: { id: 'mem', r: { x: D.x - off, y: D.y + topH, w: side, h: D.h - topH }, title: 'MEMORY 0x7FFE0000', on: side > 0 ? 1 : 0, z: 1 },
    insp: { id: 'insp', r: { x: D.x + D.w - side + off, y: D.y, w: side, h: topH }, title: 'INSPECTOR', on: side > 0 ? 1 : 0, z: 1 },
    trace: { id: 'trace', r: { x: D.x + D.w - side + off, y: D.y + topH, w: side, h: D.h - topH }, title: 'STDERR / TRACE', on: side > 0 ? 1 : 0, z: 1 },
    view: { id: 'view', r: view, title: '', on: 1, z: 0 },
  }
}
/** CRT-style close: squash to a line, then to a dot. on = 1 open, 0 gone. */
export function collapse(r: Rect, on: number): Rect {
  const a = clamp01(on * 2 - 1), b = clamp01(on * 2)
  const h = Math.max(1, Math.round(r.h * a)), w = Math.max(1, Math.round(r.w * (0.04 + 0.96 * b)))
  return { x: Math.round(r.x + (r.w - w) / 2), y: Math.round(r.y + (r.h - h) / 2), w, h }
}

const BG = 0x05080b, PANEL = 0x070b0f, DIM = 0x3a4652, MID = 0x7d8a96, HI = 0xd6e2ea

export const clock = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(3).padStart(6, '0')}`
export const hexs = (v: number, n = 4) => (Math.floor(v) >>> 0).toString(16).toUpperCase().padStart(n, '0').slice(-n)
export const fmt = (v: number, d = 3, w = 7) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(d).padStart(w - 1, '0')

export function chromeTop(x: Ctx) {
  const { c, t, L } = x
  const W = L.W, A = x.accent
  c.fill({ x: 0, y: 0, w: W, h: 1 }, ' ', 0, 0x1a2026)
  c.pen = 1
  const n = c.text(0, 0, ' ◆ world.execute(me); ', 0x05080b, A)
  c.pen = 0
  const menus = 'FILE  EDIT  VIEW  SIMULATION  DEBUG  WINDOW  HELP'
  const right = ` SONG ${clock(t)} │ FRM ${String(x.frame).padStart(5, '0')} │ ${caret(t, 1.5) ? '●' : '○'} ${x.G > 0.75 ? 'FAULT' : 'EXEC '} `
  if (W - right.length - n - 2 > menus.length) c.text(n + 2, 0, menus, 0x9aa6b0, 0x1a2026)
  c.text(W - right.length, 0, right, x.G > 0.75 ? 0xff5050 : 0xc0ccd6, 0x1a2026)
  // tabs
  c.fill({ x: 0, y: 1, w: W, h: 1 }, ' ', 0, 0x0b0f13)
  let px = 1
  const seen = new Set<string>()
  for (const a of ACTS) {
    if (seen.has(a.file)) continue
    seen.add(a.file)
    const on = a.file === x.act.file
    const s = ` ${on ? '▸' : ' '} ${a.file} `
    if (px + s.length > W - 2) break
    px += c.text(px, 1, s, on ? 0x05080b : 0x5a6670, on ? x.accent : 0x11161b) + 1
  }
}

export function chromeBottom(x: Ctx) {
  const { c, t, L } = x
  const W = L.W
  // spectrum: one thin row
  const sp = spectrum(t, x.spec)
  const y = L.spec
  c.fill({ x: 0, y, w: W, h: 1 }, ' ', 0, 0x030507)
  const lo = mix(x.pal[2]!, 0x0a0f14, 0.2), hi = x.pal[4]!
  for (let i = 0; i < W; i++) {
    const u = (i / (W - 1)) * (BANDS - 1), b = Math.floor(u), f = u - b
    const v = sp[b]! * (1 - f) + (sp[Math.min(BANDS - 1, b + 1)] ?? 0) * f
    const k = Math.max(0, Math.min(8, Math.round(v * 8)))
    c.put(i, y, k === 0 ? '▁' : '▁▂▃▄▅▆▇█'[k - 1]!, k === 0 ? 0x10161c : mix(lo, hi, v * v), 0x030507)
  }
  // status
  const s = L.status
  c.fill({ x: 0, y: s, w: W, h: 1 }, ' ', 0, 0x11161b)
  const fault = x.G > 0.75
  c.pen = 1
  c.text(0, s, fault ? ' FAULT ' : ' EXEC  ', 0x05080b, fault ? 0xff3030 : x.accent)
  c.pen = 0
  const errs = Math.floor(Math.max(0, t - 118) ** 2.2 * 3)
  const info = `${x.act.id.toUpperCase().padEnd(9)} │ t${fmt(t, 3, 8)} │ beat ${String(Math.max(0, x.beat.n)).padStart(3, '0')} ${'◐◓◑◒'[Math.floor(x.beat.phase * 4)]} │ sig ${String(Math.round(x.G * 100)).padStart(3)}% │ errs ${String(errs).padStart(5, '0')} │ heap 0x${hexs(0x2000 + t * 900, 5)}`
  const tag = ' Mili // world.execute(me);  ·  ascii-mv '
  c.text(8, s, info.slice(0, Math.max(0, W - tag.length - 10)), 0x8a96a0, 0x11161b)
  if (W > info.length + tag.length + 10) c.text(W - tag.length, s, tag, 0x4a5660, 0x11161b)
  // progress across the whole song on the status row's top edge: drawn as a cursor in the tag area
  const p = Math.round(clamp01(t / END) * (W - 1))
  c.put(p, s, '▲', x.accent, 0x11161b)
}

// ── caption band ────────────────────────────────────────────────────────────────────────────────

/** Splits an English line into runs; all-caps words (2+ letters) are highlighted. */
const runs = (s: string) => s.split(/(\b[A-Z][A-Z.\-']+\b)/).filter(Boolean).map((p) => ({ s: p, hot: /^[A-Z][A-Z.\-']+$/.test(p) }))

export function captions(x: Ctx, text: boolean) {
  const { c, t, L } = x
  const C = L.cap
  const l = lineAt(t)
  const prev = lastLine(t)
  const A = x.accent
  c.fill(C, ' ', 0, 0x040608)
  const cur: Line | null = l
  const hit = cur?.caps ?? false
  c.box(C, hit ? A : 0x2a343e, `STDOUT ▸ lyric[${String((cur ?? prev)?.i ?? 0).padStart(3, '0')}]`, hit ? 'heavy' : 'light', hit ? A : 0x6a7680)
  const ref = cur ?? prev
  if (ref) {
    const tc = ` ${clock(ref.t0)} → ${clock(ref.t1)} `
    c.text(C.x + C.w - tc.length - 2, C.y, tc, 0x56626c)
  }
  // progress along the bottom border
  if (cur) {
    const k = clamp01((t - cur.t0) / Math.max(0.05, cur.t1 - cur.t0))
    const n = Math.round(k * (C.w - 4))
    for (let i = 0; i < n; i++) c.put(C.x + 2 + i, C.y + C.h - 1, '━', mix(0x2a343e, A, 0.85))
  }
  c.text(C.x + 2, C.y + 1, 'EN>', 0x3a4652)
  c.text(C.x + 2, C.y + C.h - 2, 'ZH>', 0x3a4652)
  if (!text || !cur) {
    if (!cur && text) c.text(C.x + 7, C.y + Math.floor(C.h / 2), caret(t, 2) ? '█' : ' ', 0x2a343e)
    return
  }
  // text: EN on the upper row, ZH on the lower; both start at the same column; typed in fast
  const lt = t - cur.t0
  const enW = strWidth(cur.en), zhW = strWidth(cur.zh)
  const w = Math.max(enW, zhW)
  const x0 = Math.max(C.x + 7, Math.round(C.x + (C.w - w) / 2))
  const yE = C.y + Math.floor((C.h - 2) / 2), yZ = yE + (C.h >= 6 ? 2 : 1)
  const nE = Math.min(enW, Math.floor(lt * 90) + 1)
  let k = 0
  c.pen = 1
  for (const r of runs(cur.en)) {
    for (const ch of r.s) {
      if (k >= nE) break
      if (r.hot) c.put(x0 + k, yE, ch, 0x05080b, A)
      else c.put(x0 + k, yE, ch, 0xf2f6f8)
      k++
    }
  }
  c.pen = 0
  if (k < enW || caret(t, 2.5)) c.put(x0 + k + (k < enW ? 0 : 1), yE, '█', A)
  const nZ = Math.min([...cur.zh].length, Math.floor(lt * 40) + 1)
  c.pen = 1
  c.text(x0, yZ, [...cur.zh].slice(0, nZ).join(''), hit ? mix(A, 0xffffff, 0.35) : 0xc8d2da)
  c.pen = 0
}

// ── panels ──────────────────────────────────────────────────────────────────────────────────────

const PROCS = ['world.exe', 'render.d', 'geom.srv', 'lyric.io', 'crt.drv', 'sched', 'gc', 'heart.sys', 'kernel']

function sys(x: Ctx, r: Rect) {
  const { c, t } = x
  c.text(r.x + 2, r.y + 1, 'PID  NAME       CPU', 0x56626c)
  const bw = Math.max(4, r.w - 23)
  PROCS.forEach((n, i) => {
    const y = r.y + 2 + i
    if (y >= r.y + r.h - 1) return
    const dead = x.act.id === 'left' || x.act.id === 'fragments' ? clamp01((t - x.act.t0) / 6 - i * 0.08) : 0
    const v = Math.max(0.03, Math.min(1, (0.35 + 0.35 * noise1(t * 2.3 + i * 1.7, i) + x.E * 0.35 + x.kick * 0.15 * (i % 3 === 0 ? 1 : 0)) * (1 - dead)))
    c.text(r.x + 2, y, `${String(100 + i * 37).padStart(4, '0')} ${n.padEnd(10)}`, dead > 0.5 ? 0x3a4652 : i === 0 ? x.accent : 0xa8b4be)
    c.bar(r.x + 18, y, bw, v, mix(x.pal[2]!, x.pal[3]!, v), 0x1a2228)
    c.text(r.x + 19 + bw, y, `${Math.round(v * 99)}`.padStart(2), 0x6a7680)
  })
  const yy = r.y + 3 + PROCS.length
  if (yy < r.y + r.h - 1) c.text(r.x + 2, yy, `load ${(2 + noise1(t, 3) + x.E).toFixed(2)} ${(1.8 + noise1(t, 4) * 0.5).toFixed(2)} 1.07`, 0x56626c)
  if (yy + 1 < r.y + r.h - 1) c.text(r.x + 2, yy + 1, `thr 0x${hexs(512 + t * 37)}  irq ${hexs(t * 991, 5)}`, 0x56626c)
  // a sparkline of energy over the last seconds
  const sy = r.y + r.h - 2
  if (sy > yy + 1) for (let i = 0; i < r.w - 4; i++) {
    const tt = t - (r.w - 4 - i) * 0.08
    const v = clamp01(0.3 + 0.5 * noise1(tt * 3, 11) * x.E + 0.4 * Math.exp(-(((tt % 0.4615) + 0.4615) % 0.4615) * 9))
    c.put(r.x + 2 + i, sy, '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor(v * 8))]!, mix(0x1a2a30, x.pal[3]!, v * 0.8))
  }
}

function mem(x: Ctx, r: Rect) {
  const { c, t } = x
  const scroll = Math.floor(t * (6 + 14 * x.E))
  const nb = Math.max(2, Math.floor((r.w - 13) / 3))
  for (let k = 0; k < r.h - 2; k++) {
    const a = scroll + k, rr = seeded(a * 7 + 3)
    c.text(r.x + 2, r.y + 1 + k, hexs(0x7ffe0000 + a * 8, 8), 0x3a4652)
    for (let b = 0; b < nb; b++) {
      const v = Math.floor(rr() * 256)
      const hot = v > 236 || (x.kick > 0.6 && hash(a * 31 + b, x.beat.n) < 0.12)
      c.text(r.x + 11 + b * 3, r.y + 1 + k, hexs(v, 2), hot ? x.accent : v < 16 ? 0x26303a : 0x8a96a0)
    }
  }
}

function insp(x: Ctx, r: Rect, rows: [string, string][]) {
  const { c, t } = x
  rows.slice(0, r.h - 5).forEach(([k, v], i) => {
    c.text(r.x + 2, r.y + 1 + i, k.padEnd(10, '.').slice(0, 10), 0x56626c)
    c.text(r.x + 13, r.y + 1 + i, v.slice(0, r.w - 15), i === 0 ? x.accent : 0xd0dae2)
  })
  const sp = clamp01((t - x.act.t0) / (x.act.t1 - x.act.t0))
  c.text(r.x + 2, r.y + r.h - 3, 'section', 0x56626c)
  c.bar(r.x + 11, r.y + r.h - 3, r.w - 13, sp, x.accent)
  c.text(r.x + 2, r.y + r.h - 2, 'signal', 0x56626c)
  c.bar(r.x + 11, r.y + r.h - 2, r.w - 13, Math.min(1, x.G), x.G > 0.6 ? 0xff3030 : 0x7d8a96)
}

function trace(x: Ctx, r: Rect, log: (k: number) => string) {
  const { c, t } = x
  const rate = 6 + 10 * x.E
  // integrate the rate piecewise so the scroll never jumps: use a fixed rate grid instead
  const kNow = Math.floor(t * 9)
  for (let i = 0; i < r.h - 2; i++) {
    const k = kNow - (r.h - 3) + i
    if (k < 0) continue
    const line = log(k)
    const warn = /WARN|ERR|FATAL|KILL/.test(line)
    c.text(r.x + 2, r.y + 1 + i, `${String(k).padStart(4, '0')} ${line}`.slice(0, r.w - 3), warn ? 0xff5a5a : i === r.h - 3 ? 0xffffff : 0x8a96a0)
  }
  void rate
}

export function drawWin(x: Ctx, w: Win, content: (r: Rect) => void, style: 'light' | 'heavy' = 'light') {
  const { c } = x
  if (w.on <= 0) return
  const r = w.on < 1 ? collapse(w.r, w.on) : w.r
  if (r.w < 2 || r.h < 1) return
  const lit = w.on < 1 ? mix(0xffffff, x.accent, w.on) : 0x2a343e
  c.fill(r, ' ', 0, PANEL)
  if (r.h >= 3 && r.w >= 6) c.box(r, lit, w.on >= 1 ? w.title : undefined, style, 0x7d8a96)
  else { c.fill(r, '━', mix(0xffffff, x.accent, 0.4), PANEL); return }
  if (w.on < 1) return
  const save = c.clip
  c.clip = { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }
  content(r)
  c.clip = save
}

export function panels(x: Ctx, ws: Record<WinId, Win>, rows: [string, string][], log: (k: number) => string) {
  drawWin(x, ws.sys, (r) => sys(x, r))
  drawWin(x, ws.mem, (r) => mem(x, r))
  drawWin(x, ws.insp, (r) => insp(x, r, rows))
  drawWin(x, ws.trace, (r) => trace(x, r, log))
}

export const genericLog = (k: number) => {
  const r = seeded(k * 13 + 1)
  const ops = ['alloc', 'free', 'tick', 'sync', 'yield', 'map', 'emit', 'poll']
  return `${r.pick(ops)}(0x${hexs(r() * 65535)}) ${r() < 0.8 ? 'ok' : 'retry'}`
}
export { BG, PANEL, DIM, MID, HI, LINES, rgb, mul }
