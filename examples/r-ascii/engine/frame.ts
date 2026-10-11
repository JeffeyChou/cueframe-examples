// One frame of the MV into a Cells buffer: scene layers, windows, chrome, captions, CRT post.
// Pure: the same (t, frame, size, mode) always produces the same cells.
import { Cells, type Rect, mix, mul } from './cells.ts'
import { actAt, beatAt, BANDS, END, LINES, energy, pulse } from './song.ts'
import { frameRng, noise1 } from './rng.ts'
import { flash, clamp01, seg, inCubic, outCubic } from '../motion.ts'
import { captions, chromeBottom, chromeTop, collapse, layout, panels, windows, genericLog } from './ui.ts'
import { post } from './post.ts'
import { SCENES } from './scenes/index.ts'
import type { Ctx } from './types.ts'

/** Song-wide glitch envelope: calm base, kicks on every line, big hits on capitalised words. */
export function intensity(t: number): number {
  let g = 0.08 + 0.05 * (noise1(t * 3, 5) + 1)
  for (const l of LINES) {
    if (t < l.t0 - 0.01 || t > l.t0 + 1.2) continue
    g += l.caps ? flash(t, l.t0, 0.2, 0.85) : flash(t, l.t0, 0.08, 0.3)
  }
  return g
}

const specBuf = new Float32Array(BANDS)

export function renderFrame(c: Cells, t: number, frame: number, mode: 'term' | 'canvas' = 'term') {
  const L = layout(c.cols, c.rows)
  const act = actAt(t)
  const sc = SCENES[act.id]
  const pal = sc.pal ?? [0x020a04, 0x0a3a18, 0x16803a, act.accent, 0xffffff]
  const beat = beatAt(t)
  const x: Ctx = {
    c, t, frame, L, D: L.D, act, lt: t - act.t0, p: clamp01((t - act.t0) / (act.t1 - act.t0)),
    G: 0, E: energy(t), beat, kick: pulse(t), spec: specBuf, accent: act.accent, pal,
    rng: (s) => frameRng(s, frame), mode,
  }
  x.G = Math.max(0, intensity(t) + (sc.glitch?.(x) ?? 0))

  c.clear()
  c.fill({ x: 0, y: 0, w: c.cols, h: c.rows }, ' ', 0, 0x05080b)
  const chrome = sc.chrome?.(x) ?? 1

  // desktop
  c.clip = L.D
  const ws = windows(L, sc.dock?.(x) ?? 0)
  sc.wm?.(x, ws)
  sc.bg?.(x)
  c.clip = L.D
  if (chrome > 0) panels(x, ws, sc.readouts?.(x) ?? [['act', act.id]], sc.log ?? genericLog)
  const vw = ws.view
  if (vw.on > 0) {
    const r = vw.on < 1 ? collapse(vw.r, vw.on) : vw.r
    const title = sc.title ? sc.title(x) : `render://${act.file}`
    const inner: Rect = title === null ? r : { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }
    c.clip = inner
    sc.view?.(x, inner)
    c.clip = L.D
    if (title !== null && r.w > 4 && r.h > 2) {
      c.box(r, mix(0x10161c, x.accent, 0.75), `${title}  ${inner.w}x${inner.h}`, 'heavy', mix(0x10161c, x.accent, 0.95))
      const live = ` ${frame % 2 ? '◐' : '◑'} LIVE  ${(30).toFixed(2)}Hz `
      if (r.w > title.length + live.length + 16) c.text(r.x + r.w - live.length - 2, r.y, live, x.accent)
      for (let k = 3; k < r.h - 1; k += 5) c.put(r.x, r.y + k, '┫', mix(0x10161c, x.accent, 0.6))
    }
  }
  c.clip = L.D
  sc.over?.(x)
  c.unclip()

  // chrome
  if (chrome > 0) {
    chromeTop(x)
    captions(x, mode === 'term')
    chromeBottom(x)
  } else {
    // boot: captions still need their band once lyrics start
    if (t >= LINES[0]!.t0) captions(x, mode === 'term')
    chromeBottom(x)
  }

  post(c, {
    G: x.G, t, frame, protect: [L.cap, { x: 0, y: L.spec, w: L.W, h: 2 }],
    tint: mix(x.accent, 0xffffff, 0.4), hot: [0xff2050, 0x20f0ff, 0xffe040, 0xff40ff, 0x40ff80, x.accent],
    halo: mode === 'term' ? 1 : 0, scan: mode === 'term' ? 0.1 : 0,
  })

  // power envelope: CRT switch-on at the start, switch-off at the end
  const on = Math.min(seg(t, 0, 0.9, outCubic), 1 - seg(t, END - 2.4, END - 0.6, inCubic))
  if (on < 1) power(c, on)
}

/** Squashes the picture vertically into a bright line, then horizontally into a dot. */
function power(c: Cells, k: number) {
  const { cols, rows } = c
  const ch = c.ch.slice(), fg = c.fg.slice(), bg = c.bg.slice()
  const kv = clamp01(k * 2 - 1), kh = clamp01(k * 2)
  const cy = (rows - 1) / 2, cx = (cols - 1) / 2
  const hw = Math.max(0.5, kh * cols / 2)
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x
    const sy = kv > 0.001 ? Math.round(cy + (y - cy) / kv) : -1
    const inLine = kv <= 0.02 && Math.abs(y - cy) < 0.6 && Math.abs(x - cx) <= hw
    if (inLine) {
      const e = 1 - Math.abs(x - cx) / (hw + 1)
      c.ch[i] = kh < 0.08 ? '●' : '━'; c.fg[i] = mix(0xffffff, 0x9fffd0, 1 - e); c.bg[i] = mul(0x9fffd0, 0.25 * e)
      if (kh < 0.08 && Math.abs(x - cx) > 0.6) { c.ch[i] = ' '; c.bg[i] = 0x000000 }
      continue
    }
    if (sy < 0 || sy >= rows || kv <= 0.02) { c.ch[i] = ' '; c.bg[i] = 0x000000; continue }
    const j = sy * cols + x
    const glow = 1 + (1 - kv) * 2.5
    c.ch[i] = ch[j]!; c.fg[i] = mul(fg[j]!, glow); c.bg[i] = bg[j]! >= 0 ? mul(bg[j]!, glow) : -1
  }
}

export { Cells }
