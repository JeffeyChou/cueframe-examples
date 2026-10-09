// crt: CRT / glitch post for a 2D canvas — row displacement, ghosts, block corruption, colour
// fringing, rolling band, scanlines and vignette, scaled by one `intensity` (0 calm … 1 wrecked).
// mount: const src = ctx.canvas('src'); src.canvas.style.display = 'none'; const out = ctx.canvas('out'); const buf = crtBuffers(ctx.stage)
// render: draw into src, then crt(out, src.canvas, buf, f, { intensity: 0.2 + 0.8 * flash(f.t, f.cue('hit')) })

import { seeded, type Frame, type Stage } from '@cueframe/core'

export interface CrtBuffers { w: number; h: number; scale: number; overlay: HTMLCanvasElement; tmp: CanvasRenderingContext2D }

/** Builds the static scanline + vignette overlay and a scratch canvas. Call once in mount. */
export function crtBuffers(stage: Pick<Stage, 'w' | 'h' | 'scale'>, o: { pitch?: number; dark?: number; vignette?: number } = {}): CrtBuffers {
  const { w, h, scale } = stage
  const { pitch = 3, dark = 0.4, vignette = 0.6 } = o
  const mk = () => {
    const c = document.createElement('canvas')
    c.width = Math.round(w * scale); c.height = Math.round(h * scale)
    const g = c.getContext('2d')!
    g.setTransform(scale, 0, 0, scale, 0, 0)
    return g
  }
  const ov = mk()
  ov.fillStyle = `rgba(0,0,0,${dark})`
  for (let y = 0; y < h; y += pitch) ov.fillRect(0, y + pitch - 1, w, 1)
  const v = ov.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, `rgba(0,0,0,${vignette})`)
  ov.fillStyle = v
  ov.fillRect(0, 0, w, h)
  return { w, h, scale, overlay: ov.canvas, tmp: mk() }
}

export interface CrtOptions {
  intensity: number
  row?: number            // displacement band height in px (a text row height works well)
  seed?: string
  hold?: number           // frames a "slow" glitch (bands, blocks, ghosts) persists
  tint?: string           // rolling band / scan flash colour, "r,g,b"
  bg?: string
  hot?: readonly string[] // block corruption colours
}

/** Composites `src` (a canvas at buffer scale) onto `out` with the CRT damage of this frame. */
export function crt(out: CanvasRenderingContext2D, src: HTMLCanvasElement, b: CrtBuffers, f: Frame, o: CrtOptions) {
  const { w, h, scale: sc } = b
  const G = Math.max(0, o.intensity)
  const { row = 22, seed = 'crt', hold = 3, tint = '120,255,200', bg = '#020403' } = o
  const hot = o.hot ?? ['#ff2050', '#20f0ff', '#ffe040', '#ff40ff', '#40ff80']
  const r = f.rng(seed)
  const slow = seeded(`${seed}:${Math.floor(f.frame / hold)}`)
  const rows = Math.ceil(h / row)
  out.globalCompositeOperation = 'source-over'
  out.globalAlpha = 1
  out.fillStyle = bg
  out.fillRect(0, 0, w, h)

  // row displacement: a few persistent bands plus per-frame jitter; displaced rows wrap around
  const dx = new Float32Array(rows)
  const nb = Math.floor(G * 5 + (slow() < G * 0.6 ? 1 : 0))
  for (let k = 0; k < nb; k++) {
    const y0 = slow.int(0, rows), n = slow.int(1, 5), d = slow.range(-1, 1) * (10 + 110 * G)
    for (let y = y0; y < Math.min(rows, y0 + n); y++) dx[y]! += d
  }
  for (let y = 0; y < rows; y++) if (r() < 0.12 * G) dx[y]! += r.range(-1, 1) * (4 + 40 * G)
  for (let y = 0; y < rows; y++) {
    const d = Math.round(dx[y]!)
    out.drawImage(src, 0, y * row * sc, w * sc, row * sc, d, y * row, w, row)
    if (d !== 0) out.drawImage(src, 0, y * row * sc, w * sc, row * sc, d - Math.sign(d) * w, y * row, w, row)
  }

  // ghost rows: faint copies of a row a few rows away
  const ng = Math.floor(G * 3 + slow() * 1.5 * G)
  for (let k = 0; k < ng; k++) {
    const sy = slow.int(0, rows), ty = Math.max(0, Math.min(rows - 1, sy + slow.pick([-3, -2, -1, 1, 2, 3])))
    out.globalAlpha = 0.2 + 0.25 * slow()
    out.drawImage(src, 0, sy * row * sc, w * sc, row * sc, slow.range(-30, 30), ty * row, w, row)
  }
  out.globalAlpha = 1

  // block corruption: displaced source blocks and solid colour blocks
  const nk = Math.floor(G * G * 10)
  for (let k = 0; k < nk; k++) {
    const bw = slow.range(20, 260), bh = slow.int(1, 3) * row
    const x = slow.range(0, w - bw), y = slow.int(0, rows) * row
    if (slow() < 0.5) out.drawImage(src, x * sc, y * sc, bw * sc, bh * sc, x + slow.range(-80, 80), y, bw, bh)
    else { out.fillStyle = slow.pick(hot); out.globalAlpha = 0.35 + 0.4 * slow(); out.fillRect(x, y, bw, bh * 0.5); out.globalAlpha = 1 }
  }

  // colour fringing: red copy right, cyan copy left, added on top
  const s = 1.5 + 6 * G
  const t = b.tmp
  for (const [col, off] of [['#ff0000', s], ['#00ffff', -s]] as const) {
    t.globalCompositeOperation = 'copy'
    t.drawImage(out.canvas, 0, 0, w, h)
    t.globalCompositeOperation = 'multiply'
    t.fillStyle = col
    t.fillRect(0, 0, w, h)
    out.globalCompositeOperation = 'lighter'
    out.globalAlpha = Math.min(0.5, 0.12 + 0.3 * G)
    out.drawImage(t.canvas, off, 0, w, h)
  }
  t.globalCompositeOperation = 'source-over'

  // rolling phosphor band
  const by = (((f.t * 0.42) % 1.25) - 0.15) * h
  const gr = out.createLinearGradient(0, by - 90, 0, by + 90)
  gr.addColorStop(0, `rgba(${tint},0)`)
  gr.addColorStop(0.5, `rgba(${tint},0.06)`)
  gr.addColorStop(1, `rgba(${tint},0)`)
  out.globalAlpha = 1
  out.fillStyle = gr
  out.fillRect(0, by - 90, w, 180)
  if (r() < 0.2 + G * 0.5) {
    out.fillStyle = `rgba(${tint},${(0.04 + 0.08 * G).toFixed(3)})`
    out.fillRect(0, r.int(0, h), w, r.int(1, 4))
  }
  out.globalCompositeOperation = 'source-over'
  out.drawImage(b.overlay, 0, 0, w, h)
  out.fillStyle = `rgba(0,0,0,${(r() * 0.05 + 0.02 * G).toFixed(3)})`   // flicker
  out.fillRect(0, 0, w, h)
}
