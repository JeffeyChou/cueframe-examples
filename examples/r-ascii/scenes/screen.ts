// The whole MV as one canvas scene: the cell engine renders a frame, the grid is drawn with the
// fonts, then a real CRT pass (tearing, fringes, scanlines, vignette) and a phosphor glow.
import { scene } from '@cueframe/core'
import { Cells } from '../engine/cells.ts'
import { intensity, renderFrame } from '../engine/frame.ts'
import { END } from '../engine/song.ts'
import { crt, crtBuffers } from '../crt.ts'

export const CW = 10.8, RH = 21, FONT = '18px "JBM"', BOLD = '800 18px "JBM"'
const SHADE: Record<string, number> = { '█': 1, '▓': 0.7, '▒': 0.45, '░': 0.2 }
const LOWER = '▁▂▃▄▅▆▇', LEFT = '▏▎▍▌▋▊▉'
const css = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`

function flush(g: CanvasRenderingContext2D, c: Cells) {
  const { cols, rows } = c
  g.fillStyle = '#05080b'
  g.fillRect(0, 0, 1920, 1080)
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; ) {
    const b = c.bg[y * cols + x]!
    let e = x + 1
    while (e < cols && c.bg[y * cols + e] === b) e++
    if (b >= 0) { g.fillStyle = css(b); g.fillRect(x * CW, y * RH, (e - x) * CW + 0.5, RH + 0.5) }
    x = e
  }
  g.textBaseline = 'middle'
  let font = ''
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x, ch = c.ch[i]!
    if (ch === ' ' || ch === '') continue
    const px = x * CW, py = y * RH
    g.fillStyle = css(c.fg[i]!)
    const sh = SHADE[ch], lo = LOWER.indexOf(ch), le = LEFT.indexOf(ch)
    if (sh !== undefined) { g.globalAlpha = sh; g.fillRect(px, py, CW + 0.5, RH + 0.5); g.globalAlpha = 1 }
    else if (lo >= 0) { const h = ((lo + 1) / 8) * RH; g.fillRect(px, py + RH - h, CW + 0.5, h) }
    else if (le >= 0) g.fillRect(px, py, ((le + 1) / 8) * CW, RH)
    else if (ch === '▀') g.fillRect(px, py, CW + 0.5, RH / 2)
    else if (ch === '▄') g.fillRect(px, py + RH / 2, CW + 0.5, RH / 2)
    else {
      const f = c.at[i]! & 1 ? BOLD : FONT
      if (f !== font) { g.font = f; font = f }
      g.fillText(ch, px, py + RH / 2 + 1)
    }
  }
}

export default scene({
  id: 'screen',
  at: 0,
  end: END,
  async mount(ctx) {
    await document.fonts.load(FONT)
    await document.fonts.load(BOLD)
    const src = ctx.canvas('src')
    src.canvas.style.display = 'none'
    const out = ctx.canvas('out')
    const cells = new Cells(Math.floor(1920 / CW), Math.floor(1080 / RH))
    cells.aspect = RH / CW
    const buf = crtBuffers(ctx.stage, { pitch: 3, dark: 0.42, vignette: 0.65 })
    const glow = document.createElement('canvas')
    glow.width = Math.round(out.canvas.width / 2); glow.height = Math.round(out.canvas.height / 2)
    return { src, out, cells, buf, glow: glow.getContext('2d')! }
  },
  render(f, s) {
    renderFrame(s.cells, f.t, f.frame, 'canvas')
    s.src.globalCompositeOperation = 'source-over'
    s.src.globalAlpha = 1
    flush(s.src, s.cells)
    crt(s.out, s.src.canvas, s.buf, f, { intensity: 0.35 * intensity(f.t), row: RH, seed: 'crt', tint: '150,255,220' })
    const o = s.out, gl = s.glow
    gl.globalCompositeOperation = 'copy'
    gl.filter = 'blur(6px)'
    gl.drawImage(o.canvas, 0, 0, gl.canvas.width, gl.canvas.height)
    gl.filter = 'none'
    o.save()
    o.setTransform(1, 0, 0, 1, 0, 0)
    o.globalCompositeOperation = 'lighter'
    o.globalAlpha = 0.6
    o.drawImage(gl.canvas, 0, 0, o.canvas.width, o.canvas.height)
    o.restore()
  },
})
