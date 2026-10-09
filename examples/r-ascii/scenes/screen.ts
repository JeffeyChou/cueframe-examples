// The whole program UI: chrome panels, the section visual in the viewport, cell corruption, CRT post and phosphor glow.
import { scene, seeded } from '@cueframe/core'
import { flush, gridFor, ramp, type Grid } from '../ascii-grid.js'
import { crt, crtBuffers } from '../crt.js'
import { DUR, FONT, L, LINES, SECTIONS, SONG0, View, banner, corrupt, drawBanner, fmt, hex, intensity, lineAt, sectionAt, type Banner } from '../lib.js'
import { caret, noise1, outExpo, seg } from '../motion.js'
import { VISUALS } from './visuals.js'

const PROCS = ['world.exe', 'render.d', 'geom.srv', 'lyric.io', 'crt.drv', 'sched', 'gc', 'audio.null', 'kernel']
const clock = (t: number) => {
  const s = t + SONG0
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(3).padStart(6, '0')}`
}

function chrome(g: Grid, t: number, frame: number) {
  const S = sectionAt(t)
  const A = S.accent
  const W = g.cols
  // menu bar
  g.fill({ x: 0, y: 0, w: W, h: 1 }, ' ', 16, 236)
  g.text(1, 0, ' ◆ world.execute(me); ', 16, A)
  g.text(24, 0, 'FILE  EDIT  VIEW  SIMULATION  DEBUG  WINDOW  HELP', 250, 236)
  g.text(W - 58, 0, `SONG ${clock(t)} │ FRAME ${String(frame).padStart(4, '0')}/0442 │ ${caret(t, 1.5) ? '●' : '○'} EXEC `, 252, 236)
  // tabs
  g.fill({ x: 0, y: 1, w: W, h: 1 }, ' ', 16, 233)
  let x = 1
  for (const s of SECTIONS) {
    const on = s === S
    x += g.text(x, 1, ` ${on ? '▸' : ' '} ${s.file} `, on ? 16 : 243, on ? s.accent : 234) + 1
  }
  g.text(x + 2, 1, `~/sim/world/${S.file}  [utf-8] [lf] [ro]`, 240, 233)
  g.text(W - 26, 1, `pid 0x${hex(0x3f1 + SECTIONS.indexOf(S))}  uid 0  nice -20`, 240, 233)

  // left: process table and memory dump
  const P = { x: L.left.x, y: L.left.y, w: L.left.w, h: 16 }
  g.box(P, 239, 'SYS.MONITOR')
  g.text(P.x + 2, P.y + 1, 'PID  NAME        CPU', 245)
  PROCS.forEach((n, i) => {
    const v = Math.max(0.03, Math.min(1, 0.45 + 0.4 * noise1(t * 2.3 + i * 1.7, i) + (i === 0 ? 0.3 : 0)))
    g.text(P.x + 2, P.y + 2 + i, `${String(100 + i * 37).padStart(4, '0')} ${n.padEnd(11)}`, i === 0 ? A : 250)
    g.bar(P.x + 19, P.y + 2 + i, 12, v, ramp(S.ramp, 0.4 + 0.6 * v))
    g.text(P.x + 32, P.y + 2 + i, `${Math.round(v * 99)}`.padStart(3), 245)
  })
  g.text(P.x + 2, P.y + 12, `load ${(2 + noise1(t, 3)).toFixed(2)} ${(1.8 + noise1(t, 4) * 0.5).toFixed(2)} 1.07`, 244)
  g.text(P.x + 2, P.y + 13, `threads 0x${hex(512 + Math.floor(t * 37))}  irq ${hex(Math.floor(t * 991), 5)}`, 244)
  const M = { x: L.left.x, y: L.left.y + 16, w: L.left.w, h: L.left.h - 16 }
  g.box(M, 239, 'MEMORY 0x7FFE0000')
  const scroll = Math.floor(t * 9)
  for (let r = 0; r < M.h - 2; r++) {
    const a = scroll + r
    const rr = seeded(a * 7 + 3)
    g.text(M.x + 2, M.y + 1 + r, hex(0x7ffe0000 + a * 8, 8), 240)
    for (let b = 0; b < 8; b++) {
      const v = Math.floor(rr() * 256)
      g.text(M.x + 11 + b * 3, M.y + 1 + r, hex(v, 2), v > 230 ? A : v < 16 ? 238 : 247)
    }
  }

  // right: inspector and log
  const vis = VISUALS[S.kind]
  const I = { x: L.right.x, y: L.right.y, w: L.right.w, h: 15 }
  g.box(I, 239, 'INSPECTOR')
  vis.readouts(t, S).forEach(([k, v], i) => {
    g.text(I.x + 2, I.y + 2 + i, k.padEnd(10, '.'), 243)
    g.text(I.x + 13, I.y + 2 + i, v.slice(0, I.w - 15), i === 0 ? A : 252)
  })
  const sp = (t - S.t0) / (S.t1 - S.t0)
  g.text(I.x + 2, I.y + 12, 'section', 243)
  g.bar(I.x + 13, I.y + 12, 22, sp, A)
  const G = intensity(t)
  g.text(I.x + 2, I.y + 13, 'signal', 243)
  g.bar(I.x + 13, I.y + 13, 22, Math.min(1, G), G > 0.6 ? 196 : 244)
  const O = { x: L.right.x, y: L.right.y + 15, w: L.right.w, h: L.right.h - 15 }
  g.box(O, 239, 'STDERR / TRACE')
  const rate = 11
  const kNow = Math.floor(t * rate)
  for (let r = 0; r < O.h - 2; r++) {
    const k = kNow - (O.h - 3) + r
    if (k < 0) continue
    const sec = sectionAt(k / rate)
    const line = VISUALS[sec.kind].log(k, sec)
    const warn = /WARN|ERR/.test(line)
    g.text(O.x + 2, O.y + 1 + r, `${String(k).padStart(4, '0')} ${line}`.slice(0, O.w - 3), warn ? 203 : r === O.h - 3 ? 255 : 245)
  }

  // lyric track: one block per line, a playhead at t
  const T = L.track
  g.box(T, 238)
  g.text(T.x + 2, T.y, ' SEQ ', 245)
  const x0 = T.x + 8, x1 = T.x + T.w - 3
  const cx = (u: number) => Math.round(x0 + ((x1 - x0) * u) / DUR)
  for (const l of LINES) {
    const a = cx(l.t0), b = cx(l.i + 1 < LINES.length ? LINES[l.i + 1]!.t0 : DUR)
    const on = t >= l.t0 && (l.i + 1 >= LINES.length || t < LINES[l.i + 1]!.t0)
    const sec = sectionAt(l.t0)
    g.fill({ x: a, y: T.y + 1, w: b - a, h: 1 }, ' ', 16, on ? sec.accent : l.caps ? 237 : 235)
    g.text(a + 1, T.y + 1, l.en.slice(0, b - a - 2), on ? 16 : l.caps ? sec.accent : 244)
    g.put(a, T.y + 1, '▏', 239)
  }
  const ph = cx(t)
  g.put(ph, T.y, '▼', 231)
  g.put(ph, T.y + 2, '▲', 231)

  // caption band frame (text is DOM, in captions.ts)
  const C = L.caption
  const l = lineAt(t)
  g.box(C, l.caps ? A : 240, `STDOUT ▸ lyric[${String(l.i + 12).padStart(2, '0')}]`, l.caps)
  g.text(C.x + C.w - 34, C.y, ` ${clock(l.t0)} → ${clock(l.t1)} `, 244)
  g.text(C.x + 2, C.y + 2, 'EN>', 240)
  g.text(C.x + 2, C.y + 4, 'ZH>', 240)
  for (let r = 1; r < C.h - 1; r++) g.put(C.x + C.w - 3, C.y + r, r / (C.h - 2) <= (t - l.t0) / (l.t1 - l.t0) ? '█' : '░', l.caps ? A : 238)

  // status bar
  const y = L.status
  g.fill({ x: 0, y, w: W, h: 1 }, ' ', 16, 234)
  g.text(0, y, ` ${G > 0.7 ? 'FAULT' : 'EXEC'} `, 16, G > 0.7 ? 196 : A)
  g.text(8, y, `${S.kind.toUpperCase().padEnd(7)} │ t${fmt(t, 3, 7)} │ ε=1e-9 │ sig ${(G * 100).toFixed(0).padStart(3)}% │ errs ${String(Math.floor(Math.max(0, t - 11) ** 3 * 9)).padStart(4, '0')} │ heap 0x${hex(0x2000 + t * 900)}`, 247, 234)
  g.text(W - 36, y, `Mili // world.execute(me); 29.709-44.452`, 240, 234)
}

export default scene({
  id: 'screen',
  at: 0,
  end: DUR,
  async mount(ctx) {
    await document.fonts.load(`800 40px "JBM"`)
    await document.fonts.load(FONT)
    const src = ctx.canvas('src')
    src.canvas.style.display = 'none'
    const out = ctx.canvas('out')
    const grid = gridFor(src, ctx.stage, FONT)
    const buf = crtBuffers(ctx.stage, { pitch: 3, dark: 0.45, vignette: 0.7 })
    const glow = document.createElement('canvas')
    glow.width = Math.round(out.canvas.width / 2); glow.height = Math.round(out.canvas.height / 2)
    const banners = new Map<number, Banner>()
    for (const l of LINES) if (l.caps) banners.set(l.i, banner(l.en, L.view.w - 6, 6, grid.cw, grid.rh))
    return { src, out, grid, buf, glow: glow.getContext('2d')!, banners }
  },
  render(f, s) {
    const g = s.grid
    const t = f.t
    const S = sectionAt(t)
    g.clear()
    chrome(g, t, f.frame)
    // viewport
    const V = L.view
    g.box(V, S.accent, `render://${S.file}  ${V.w - 2}x${V.h - 2}  @30Hz`, true)
    g.text(V.x + V.w - 22, V.y, ` ${(f.frame % 2 ? '◐' : '◑')} LIVE  fps 30.00 `, S.accent)
    for (let x = 2; x < V.w - 2; x += 10) g.text(V.x + x, V.y + V.h - 1, `${x}`, 240)
    for (let y = 3; y < V.h - 1; y += 5) g.text(V.x, V.y + y, '┤', 240)
    g.clip = { x: V.x + 1, y: V.y + 1, w: V.w - 2, h: V.h - 2 }
    const view = new View(g, V.x + 1, V.y + 1, V.w - 2, V.h - 2)
    VISUALS[S.kind].draw(view, t, S)
    // block-letter banner for the capitalised word
    const l = lineAt(t)
    const b = s.banners.get(l.i)
    if (b) {
      const k = outExpo(seg(t, l.t0, l.t0 + 0.22))
      drawBanner(g, b, Math.round(V.x + (V.w - b.cols) / 2), V.y + 2, S.ramp, k, t)
    }
    g.clip = { x: 0, y: 0, w: g.cols, h: g.rows }
    // section switch: a frame of scrambled cells
    const G = intensity(t)
    corrupt(g, f, G)
    // repaint the whole source: the grid stops short of the stage edge, and stale pixels would leak between frames
    s.src.globalAlpha = 1
    s.src.globalCompositeOperation = 'copy'
    s.src.fillStyle = '#04060a'
    s.src.fillRect(0, 0, f.stage.w, f.stage.h)
    s.src.globalCompositeOperation = 'source-over'
    flush(s.src, g, null)
    const hot = S.kind === 'limit' ? ['#ff2050', '#ff40ff', '#ffffff', '#20f0ff'] : undefined
    crt(s.out, s.src.canvas, s.buf, f, { intensity: G, row: g.rh, seed: 'crt', tint: S.kind === 'circle' ? '255,200,120' : '120,255,220', ...(hot ? { hot } : {}) })
    // phosphor glow: half-res blur added on top
    const o = s.out, gl = s.glow
    gl.globalCompositeOperation = 'copy'
    gl.filter = 'blur(5px)'
    gl.drawImage(o.canvas, 0, 0, gl.canvas.width, gl.canvas.height)
    gl.filter = 'none'
    o.save()
    o.setTransform(1, 0, 0, 1, 0, 0)
    o.globalCompositeOperation = 'lighter'
    o.globalAlpha = 0.55
    o.drawImage(gl.canvas, 0, 0, o.canvas.width, o.canvas.height)
    o.restore()
  },
})
