import type { Frame } from '@cueframe/core'
import { C, RAMP_GREEN, hash, hex, ramp, type Grid, type Rect } from './lib.js'
import { DUR, SONG0, lines, type Line } from './timing.js'
import type { LogLine, Readout } from './visuals/types.js'

export const COLS = 160
export const ROWS = 49
export const LEFT: Rect = { x: 0, y: 2, w: 34, h: 38 }
export const VIEW: Rect = { x: 34, y: 2, w: 92, h: 38 }
export const RIGHT: Rect = { x: 126, y: 2, w: 34, h: 38 }
export const TIMELINE_ROW = 40
export const CAP: Rect = { x: 0, y: 41, w: 160, h: 8 }

const PROCS = ['kernel', 'world.sim', 'render', 'me.exe', 'lyric.io', 'crt.drv', 'gc', 'entropy']
const fmtT = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(3).padStart(6, '0')}`

export function chrome(g: Grid, f: Frame, gl: number, view: string, readouts: Readout[], log: LogLine[], line: Line) {
  const t = f.t
  const tick = Math.floor(t * 20)
  // title bar
  g.fill({ x: 0, y: 0, w: COLS, h: 1 }, ' ', C.text, 236)
  g.text(1, 0, '▓▒░', C.magenta, 236)
  g.text(5, 0, 'world.execute(me);', C.white, 236)
  g.text(25, 0, '— MILI://sim.kernel v2.0.13  [pid 0x2F9A]  tty/crt0  256c', C.mid, 236)
  g.text(COLS - 33, 0, `song ${fmtT(t + SONG0)}  ─ □ ×`, C.text, 236)
  // menu row
  g.fill({ x: 0, y: 1, w: COLS, h: 1 }, ' ', C.mid, 234)
  let x = 1
  for (const m of ['File', 'Edit', 'Object', 'World', 'Execute', 'Debug', 'Help']) {
    g.put(x, 1, m[0], C.amber, 234)
    x += g.text(x + 1, 1, m.slice(1) + '  ', C.text, 234) + 1
  }
  const st = `│ mode:SIMULATION │ frame ${String(f.frame).padStart(5, '0')} │ ${f.fps.toFixed(2)}fps │ glitch ${gl.toFixed(2)} │ seed 0x5EED │ MEM 87% │`
  g.text(COLS - st.length - 1, 1, st, C.mid, 234)

  // memory dump
  g.box({ x: LEFT.x, y: LEFT.y, w: LEFT.w, h: 20 }, C.frame, 'MEM 0x7F3A····', C.cyan)
  const scroll = Math.floor(t * 14)
  for (let j = 0; j < 18; j++) {
    const addr = 0x7f3a0000 + (scroll + j) * 8
    const y = LEFT.y + 1 + j
    const hot = (scroll + j) % 23 === 0
    g.text(1, y, hex(addr, 6), hot ? C.amber : C.dim, hot ? 52 : undefined)
    let asc = ''
    for (let i = 0; i < 8; i++) {
      let b = Math.floor(hash(addr + i) * 256)
      const mut = hash(addr * 3 + i + tick * 977) < 0.05
      if (mut) b = (b * 7 + tick) & 255
      if (hash(addr + i * 13) < 0.25) b = 0
      g.text(8 + i * 2 + (i >= 4 ? 1 : 0), y, hex(b, 2), mut ? C.amber : b === 0 ? 237 : 245)
      asc += b >= 33 && b < 127 ? String.fromCharCode(b) : '.'
    }
    g.text(26, y, asc.slice(0, 7), C.teal)
  }
  // processes
  g.box({ x: LEFT.x, y: 22, w: LEFT.w, h: 10 }, C.frame, 'PROC', C.cyan)
  PROCS.forEach((p, j) => {
    const v = Math.max(0, Math.min(0.99, 0.35 + 0.3 * Math.sin(t * (1.3 + j * 0.7) + j * 2) + 0.25 * gl * (j % 3 === 0 ? 1 : 0.4)
      + (hash(tick * 31 + j) - 0.5) * 0.1))
    const y = 23 + j
    g.text(1, y, hex(0x100 + j * 37, 4), C.dim)
    g.text(6, y, p.padEnd(9), j === 3 ? C.amber : C.text)
    const bar = Math.round(v * 10)
    for (let i = 0; i < 10; i++) g.put(16 + i, y, i < bar ? '█' : '░', i < bar ? ramp(RAMP_GREEN, 0.3 + v * 0.7) : C.faint)
    g.text(27, y, `${String(Math.round(v * 100)).padStart(2, ' ')}%`, v > 0.8 ? C.red : C.mid)
  })
  // registers
  g.box({ x: LEFT.x, y: 32, w: LEFT.w, h: 8 }, C.frame, 'REG', C.cyan)
  const regs = ['EAX', 'EBX', 'ECX', 'EDX', 'ESI', 'EDI', 'EBP', 'ESP', 'EIP', 'EFL', 'CR0', 'CR3']
  const rt = Math.floor(t * 10)
  for (let j = 0; j < 6; j++) for (let i = 0; i < 2; i++) {
    const n = j * 2 + i
    const val = Math.floor(hash(n * 101 + (n % 3 === 0 ? rt : Math.floor(rt / 7))) * 4294967296)
    g.text(1 + i * 16, 33 + j, regs[n], C.mid)
    g.text(5 + i * 16, 33 + j, hex(val, 8), n % 3 === 0 ? C.lime : 245)
  }

  // viewport frame with dotted grid
  g.box(VIEW, C.frame, `VIEWPORT 0 ▸ ${view}`, C.white, true)
  for (let y = VIEW.y + 1; y < VIEW.y + VIEW.h - 1; y++) {
    for (let x = VIEW.x + 1; x < VIEW.x + VIEW.w - 1; x++) {
      if ((x - VIEW.x) % 6 === 0 && (y - VIEW.y) % 3 === 0 && g.get(x, y) === ' ') g.put(x, y, '·', 235)
    }
    if ((y - VIEW.y) % 3 === 0) { g.put(VIEW.x, y, '┨', C.frame); g.put(VIEW.x + VIEW.w - 1, y, '┠', C.frame) }
  }
  const foot = `┤ ${VIEW.w - 2}x${VIEW.h - 2} cells │ ${f.stage.w}x${f.stage.h} │ t=${t.toFixed(3)}s │ buf ${hex(0xa000 + f.frame * 64, 4)} ├`
  g.text(VIEW.x + 2, VIEW.y + VIEW.h - 1, foot, C.mid)

  // inspector
  g.box({ x: RIGHT.x, y: RIGHT.y, w: RIGHT.w, h: 13 }, C.frame, 'INSPECT', C.cyan)
  readouts.slice(0, 11).forEach(([k, v, c], j) => {
    const y = RIGHT.y + 1 + j
    g.text(RIGHT.x + 1, y, k.padEnd(9, '.'), C.dim)
    g.text(RIGHT.x + 11, y, v.slice(0, 21), c ?? C.text)
  })
  // signal / spectrum
  g.box({ x: RIGHT.x, y: 15, w: RIGHT.w, h: 8 }, C.frame, 'SIGNAL', C.cyan)
  const bars = '▁▂▃▄▅▆▇█'
  for (let i = 0; i < 32; i++) {
    const v = Math.max(0, Math.min(1, 0.25 + 0.2 * Math.sin(t * 9 + i * 0.7) * Math.sin(t * 2.3 + i * 0.21)
      + 0.45 * gl * Math.exp(-((i - 6) ** 2) / 40) + 0.2 * hash(tick * 57 + i) * (0.5 + gl)))
    const hgt = v * 6
    for (let r = 0; r < 6; r++) {
      const fill = Math.max(0, Math.min(1, hgt - r))
      if (fill <= 0) continue
      const col = r >= 5 ? C.red : r >= 3 ? C.amber : C.green
      g.put(RIGHT.x + 1 + i, 21 - r, bars[Math.max(0, Math.round(fill * 8) - 1)], col)
    }
  }
  // log
  g.box({ x: RIGHT.x, y: 23, w: RIGHT.w, h: 17 }, C.frame, 'LOG', C.cyan)
  const vis = log.filter((l) => l[0] <= t + 1e-6).slice(-15)
  vis.forEach(([lt, s, c], j) => {
    const n = Math.min(s.length, Math.floor((t - lt) * 70) + 1)
    const y = 24 + j
    g.text(RIGHT.x + 1, y, (lt + SONG0).toFixed(2).padStart(5, '0'), C.faint + 2)
    g.text(RIGHT.x + 7, y, s.slice(0, Math.min(n, 26)), c)
    if (j === vis.length - 1 && Math.floor(t * 4) % 2 === 0) g.put(RIGHT.x + 7 + Math.min(n, 26), y, '█', C.text)
  })

  // timeline
  const tl = TIMELINE_ROW
  g.text(1, tl, (SONG0).toFixed(3), C.mid)
  const x0 = 9, x1 = COLS - 10
  const pos = x0 + ((x1 - x0) * t) / DUR
  for (let x = x0; x <= x1; x++) g.put(x, tl, x <= pos ? '━' : '─', x <= pos ? C.teal : C.faint)
  for (const l of lines) {
    const lx = Math.round(x0 + ((x1 - x0) * l.t0) / DUR)
    g.put(lx, tl, l.caps ? '◆' : '┿', l === line ? C.white : l.caps ? C.amber : C.mid)
  }
  g.put(pos, tl, '█', C.white)
  g.text(x1 + 2, tl, (SONG0 + DUR).toFixed(3), C.mid)

  // caption band frame (text is drawn on the canvas)
  g.fill({ x: CAP.x + 1, y: CAP.y + 1, w: CAP.w - 2, h: CAP.h - 2 }, ' ', C.text, 233)
  g.box(CAP, line.caps ? C.amber : C.frame, `LYRIC ${String(line.i + 1).padStart(2, '0')}/${lines.length}`, line.caps ? C.amber : C.cyan)
  g.text(CAP.x + CAP.w - 24, CAP.y, '┤ EN ▪ ZH  utf-8 ├', C.mid)
  g.text(CAP.x + 2, CAP.y + CAP.h - 1, `┤ ${fmtT(line.t0 + SONG0)} → ${fmtT(line.t1 + SONG0)} ├`, C.mid)
}
