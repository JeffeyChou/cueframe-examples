import { scene } from '@cueframe/core'
import { blameGeom, C, caret, clamp01, clear, ft, Glitch, hash, inOutCubic, lerp, mono, outBack, sans, seg, W, H } from '../lib.js'

const T = {
  settle0: ft(18.45), settle1: ft(18.6), ground: ft(18.85), bevel: ft(19.2), dash: ft(19.3), type: ft(19.55),
  out: ft(21.1), dim: ft(21.3), del: ft(21.42), fade0: ft(22.0), fade1: ft(22.3),
}
const LINE = 'a small vulnerability inside'
const SMALL = [2, 7]
const VULN = [8, 21]

type Pat = 0 | 1 | 2 | 3 | 4
function pattern(g: CanvasRenderingContext2D, p: Pat, x: number, y: number, w: number, h: number, d: number): void {
  g.save()
  g.beginPath(); g.rect(x, y, w, h); g.clip()
  g.beginPath()
  if (p === 0) for (let yy = y + d / 2; yy < y + h; yy += d) { g.moveTo(x, yy); g.lineTo(x + w, yy) }
  if (p === 2) for (let xx = x + d / 2; xx < x + w; xx += d) { g.moveTo(xx, y); g.lineTo(xx, y + h) }
  if (p === 4) for (let k = -h; k < w + h; k += d * 1.6) { g.moveTo(x + k, y); g.lineTo(x + k + h, y + h); g.moveTo(x + k + h, y); g.lineTo(x + k, y + h) }
  g.stroke()
  if (p === 1) for (let yy = y + d; yy < y + h; yy += d * 2.2) for (let xx = x + d; xx < x + w; xx += d * 2.2) g.fillRect(xx, yy, d * 1.1, d * 1.1)
  if (p === 3) for (let yy = y + d / 2; yy < y + h; yy += d) for (let xx = x + d / 2; xx < x + w; xx += d) g.fillRect(xx - 1.2, yy - 1.2, 2.4, 2.4)
  g.restore()
}

export default scene({
  id: 'blame',
  at: 0,
  end: T.fade1,
  async mount(ctx) {
    const g = ctx.canvas('blame')
    const gl = await sans()
    const geo = blameGeom(gl)
    const paths = geo.lay.glyphs.map((gg) => gl.path2d(geo.lay, gg))
    const glitch = new Glitch(g.canvas.width, g.canvas.height)
    return { g, geo, paths, glitch }
  },
  render(f, s) {
    const { g, geo, paths } = s
    const t = f.t
    g.canvas.style.opacity = String(1 - seg(t, T.fade0, T.fade1))
    clear(g, f, '#000')

    // Grid-tile cut: 2 + 2 lines re-split every 0.1 s, then settle into quadrants.
    if (t < 0.75) {
      const step = Math.min(2, Math.floor(t / 0.1))
      const k = inOutCubic(seg(t, T.settle0, T.settle1))
      const xs = [hash(step, 11), hash(step, 12)].sort().map((v) => lerp(lerp(240, 1680, v), W / 2, k))
      const ys = [hash(step, 13), hash(step, 14)].sort().map((v) => lerp(lerp(140, 940, v), H / 2, k))
      const ex = [0, xs[0], xs[1], W]
      const ey = [0, ys[0], ys[1], H]
      const patA = 1 - seg(t, 0.42, 0.66)
      g.lineWidth = 2
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        const cw = ex[i + 1] - ex[i]
        const ch = ey[j + 1] - ey[j]
        if (cw < 2 || ch < 2) continue
        const cell = j * 3 + i
        const p = Math.floor(hash(step * 9 + cell, 5) * 5) as Pat
        const d = 10 + Math.floor(hash(step * 9 + cell, 6) * 4) * 6
        const tone = hash(cell, 7) < 0.2 ? C.cyan : C.white
        g.globalAlpha = patA * (0.45 + 0.5 * hash(step * 9 + cell, 8))
        g.strokeStyle = tone; g.fillStyle = tone
        pattern(g, p, ex[i], ey[j], cw, ch, d)
      }
      g.globalAlpha = 1 - seg(t, 0.5, 0.75)
      g.strokeStyle = C.white
      g.lineWidth = 3
      g.beginPath()
      for (const x of xs) { g.moveTo(x, 0); g.lineTo(x, H) }
      for (const y of ys) { g.moveTo(0, y); g.lineTo(W, y) }
      g.stroke()
      g.globalAlpha = 1
    }

    const [, , z] = geo.cam(t)
    const pushK = (z - 1) / 1.6

    // Diamond-grid ground with central fog.
    const gA = seg(t, T.ground, T.ground + 0.5)
    if (gA > 0) {
      const hor = 560 - 40 * clamp01(pushK)
      const zc = t * 3 + pushK * 26
      const fl = 900
      const camH = 9
      g.save()
      g.beginPath(); g.rect(0, hor, W, H - hor); g.clip()
      const grad = g.createLinearGradient(0, hor, 0, H)
      grad.addColorStop(0, 'rgba(120,150,160,0)')
      grad.addColorStop(0.25, 'rgba(120,160,170,0.35)')
      grad.addColorStop(1, 'rgba(170,200,210,0.75)')
      g.strokeStyle = grad
      g.lineWidth = 1.3
      g.globalAlpha = gA
      g.beginPath()
      const sp = 6
      for (let kk = -60; kk <= 60; kk++) for (const sgn of [1, -1]) {
        const c = kk * sp - sgn * Math.floor(zc / sp) * sp
        const z0 = 0.6
        const z1 = 260
        const X0 = sgn * (z0 + zc) + c
        const X1 = sgn * (z1 + zc) + c
        g.moveTo(W / 2 + (X0 * fl) / z0, hor + (camH * fl) / z0)
        g.lineTo(W / 2 + (X1 * fl) / z1, hor + (camH * fl) / z1)
      }
      g.stroke()
      g.restore()
      const fog = g.createRadialGradient(W / 2, hor, 0, W / 2, hor, 820)
      fog.addColorStop(0, 'rgba(190,225,235,0.30)')
      fog.addColorStop(0.45, 'rgba(120,170,185,0.10)')
      fog.addColorStop(1, 'rgba(0,0,0,0)')
      g.globalAlpha = gA
      g.fillStyle = fog
      g.fillRect(0, 0, W, H)
      g.globalAlpha = 1
    }

    // Letters in world space.
    const [dx, dy] = geo.cam(t)
    const sc = f.stage.scale
    const bright = seg(t, 0.32, 0.85) * (t < 0.85 ? 0.55 + 0.45 * hash(f.frame, 3) : 1)
    g.save()
    g.setTransform(sc * z, 0, 0, sc * z, sc * (dx - z * geo.dot[0]), sc * (dy - z * geo.dot[1]))
    g.lineJoin = 'miter'
    g.miterLimit = 10
    paths.forEach((p, i) => {
      const tOut = T.out + i * 0.11
      const outK = i < 5 ? seg(t, tOut, tOut + 0.28) : 0
      if (outK >= 1) return
      const flick = outK > 0 ? (hash(f.frame * 7 + i, 9) < 0.5 ? 0.25 : 1) * (1 - outK) : 1
      if (t < T.bevel || outK > 0) {
        g.globalAlpha = (t < T.bevel ? bright : flick)
        g.strokeStyle = C.white
        g.lineWidth = 2.4 / z
        g.stroke(p)
        if (t < T.bevel) { g.globalAlpha *= 0.12; g.fillStyle = C.white; g.fill(p) }
        if (t < T.bevel || outK > 0.12) return
      }
      // Bevelled solid glyph.
      g.globalAlpha = 1
      g.save()
      for (let d = 7; d >= 1; d--) { g.translate(1.1, 1.4); g.fillStyle = d > 1 ? '#0f1719' : '#1d2a2e'; g.fill(p) }
      g.restore()
      const top = geo.base - geo.capH
      const fill = g.createLinearGradient(0, top, 0, geo.base)
      fill.addColorStop(0, '#f6fafb')
      fill.addColorStop(0.55, '#c9d4d8')
      fill.addColorStop(1, '#7f8d92')
      g.fillStyle = fill
      g.fill(p)
      g.save()
      g.clip(p)
      g.lineJoin = 'bevel'
      g.translate(-2.4, -2.4); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 5; g.stroke(p)
      g.translate(4.8, 4.8); g.strokeStyle = 'rgba(20,32,36,0.55)'; g.lineWidth = 9; g.stroke(p)
      g.restore()
      g.strokeStyle = '#26363b'; g.lineWidth = 1.5; g.lineJoin = 'bevel'; g.stroke(p)
    })
    g.restore()

    // Glowing short dash on the baseline after "?".
    if (t >= T.dash) {
      const [qx, qy] = geo.screen(t, geo.qRight + 24, geo.base)
      const land = outBack(seg(t, T.dash, T.dash + 0.2), 2.2)
      const y = qy - 70 * (1 - land)
      g.save()
      g.globalAlpha = clamp01((t - T.dash) / 0.06)
      g.shadowColor = C.cyan; g.shadowBlur = 26
      g.fillStyle = '#bff4ff'
      g.fillRect(qx, y - 10, 64, 10)
      g.shadowBlur = 8
      g.fillRect(qx, y - 10, 64, 10)
      g.restore()
    }

    // Typed line tight under the baseline.
    if (t >= T.type) {
      const [mx, my] = geo.screen(t, geo.meLeft, geo.base)
      const size = 38
      const cw = mono(g, size, 500)
      const x0 = Math.max(mx + 12, 104)
      const y0 = my + 62
      const end = Math.min(LINE.length, Math.floor((t - T.type) * 42 + 1e-6))
      const start = t < T.del ? 0 : Math.min(LINE.length, Math.floor((t - T.del) * 50 + 1e-6))
      const a = Math.max(start, VULN[0])
      const b = Math.min(end, VULN[1])
      if (b > a) { g.fillStyle = '#596469'; g.fillRect(x0 + a * cw - 4, y0 - size * 0.86, (b - a) * cw + 8, size * 1.14) }
      for (let i = start; i < end; i++) {
        const dim = i >= SMALL[0] && i < SMALL[1] && t >= T.dim
        g.globalAlpha = dim ? 0.28 : 1
        g.fillStyle = C.white
        g.fillText(LINE[i], x0 + i * cw, y0)
      }
      g.globalAlpha = 1
      const typing = end < LINE.length || start > 0
      if (start < LINE.length && (typing || caret(t, 2.5))) { g.fillStyle = C.white; g.fillText('_', x0 + end * cw, y0) }
    }

    // HUD corner ticks.
    g.globalAlpha = 0.55 * seg(t, T.ground, T.ground + 0.3)
    g.strokeStyle = C.grey; g.lineWidth = 1.5
    g.beginPath()
    for (const [x, y, sx, sy] of [[64, 64, 1, 1], [W - 64, 64, -1, 1], [64, H - 64, 1, -1], [W - 64, H - 64, -1, -1]]) {
      g.moveTo(x, y + sy * 28); g.lineTo(x, y); g.lineTo(x + sx * 28, y)
    }
    g.stroke()
    mono(g, 14, 400)
    g.fillStyle = C.grey
    g.fillText(`CTOS//NODE 18:${String(20 + Math.floor(t * 30) % 100).padStart(2, '0')}`, 84, H - 76)
    g.globalAlpha = 1

    // Glitch on the cut and on the bevel switch.
    const gl = Math.max(seg(t, 0, 0.02) * (1 - seg(t, 0.06, 0.16)), 1 - Math.abs(t - T.bevel - 0.03) / 0.07)
    s.glitch.apply(g, f, clamp01(gl), 5)
  },
})
