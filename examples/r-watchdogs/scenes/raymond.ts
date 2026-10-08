import { scene, seeded } from '@cueframe/core'
import type { Glyphs } from '@cueframe/gfx'
import { boxText, C, clamp01, clear, drawMesh, ft, Glitch, inCubic, lerp, makeMesh, mono, outBack, outCubic, sans, seg, Smear, W, H } from '../lib.js'

const START = ft(24.35)
const END = ft(26.95)
const XRAY = ft(25.5)
const WHIP = ft(26.0)
const NAME_X = 700
const ROWS = [
  { text: 'Raymond', at: START + 0.18, base: 392 },
  { text: 'Kenney', at: START + 0.62, base: 586 },
]
const TAG = 'DISGRUNTLED EMPLOYEE'
const TAG_AT = START + 1.0
const META = ['SUBJ  KENNEY, RAYMOND', 'ID    0471-RK-22', 'DEPT  GRID OPS / CHI', 'STAT  TERMINATED', 'ACCS  REVOKED 03:12', 'RISK  ### HIGH']

function portrait(rnd: () => number): HTMLCanvasElement {
  const c = Object.assign(document.createElement('canvas'), { width: 470, height: 580 })
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, 0, 580)
  bg.addColorStop(0, '#2b3336'); bg.addColorStop(1, '#0d1112')
  g.fillStyle = bg; g.fillRect(0, 0, 470, 580)
  g.strokeStyle = 'rgba(200,215,220,0.22)'; g.lineWidth = 1
  g.font = '500 13px Plex'; g.fillStyle = 'rgba(200,215,220,0.4)'
  for (let i = 0; i < 12; i++) { const y = 40 + i * 44; g.beginPath(); g.moveTo(0, y); g.lineTo(470, y); g.stroke(); g.fillText(`${6 - i * 0.5}'`, 8, y - 4) }
  const body = g.createLinearGradient(0, 120, 0, 580)
  body.addColorStop(0, '#b9c4c8'); body.addColorStop(1, '#3d474b')
  g.fillStyle = body
  g.beginPath(); g.ellipse(235, 225, 92, 118, 0, 0, Math.PI * 2); g.fill()
  g.beginPath()
  g.moveTo(190, 320); g.lineTo(280, 320); g.lineTo(290, 380)
  g.bezierCurveTo(400, 400, 450, 440, 470, 580); g.lineTo(0, 580)
  g.bezierCurveTo(20, 440, 70, 400, 180, 380); g.closePath(); g.fill()
  g.fillStyle = 'rgba(10,14,15,0.55)'
  g.fillRect(170, 205, 130, 22)
  g.fillRect(215, 280, 40, 6)
  for (let y = 0; y < 580; y += 3) { g.fillStyle = `rgba(0,0,0,${0.18 + 0.12 * rnd()})`; g.fillRect(0, y, 470, 1) }
  g.strokeStyle = C.cyan; g.lineWidth = 2
  g.strokeRect(1, 1, 468, 578)
  return c
}

function xray(): HTMLCanvasElement {
  const c = Object.assign(document.createElement('canvas'), { width: 300, height: 600 })
  const g = c.getContext('2d')!
  g.fillStyle = '#06141c'; g.fillRect(0, 0, 300, 600)
  const glow = g.createRadialGradient(150, 300, 20, 150, 300, 300)
  glow.addColorStop(0, 'rgba(70,170,220,0.45)'); glow.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = glow; g.fillRect(0, 0, 300, 600)
  g.fillStyle = 'rgba(120,200,235,0.18)'
  g.beginPath(); g.ellipse(150, 80, 30, 38, 0, 0, Math.PI * 2); g.fill()
  g.beginPath()
  g.moveTo(108, 130); g.lineTo(192, 130); g.lineTo(225, 300); g.lineTo(200, 305); g.lineTo(190, 330); g.lineTo(195, 560); g.lineTo(160, 560)
  g.lineTo(150, 350); g.lineTo(140, 560); g.lineTo(105, 560); g.lineTo(110, 330); g.lineTo(100, 305); g.lineTo(75, 300); g.closePath(); g.fill()
  g.strokeStyle = 'rgba(225,245,255,0.85)'; g.lineWidth = 2.2; g.lineCap = 'round'
  g.beginPath(); g.ellipse(150, 76, 22, 27, 0, 0, Math.PI * 2); g.stroke()
  const L = (pts: number[]) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke() }
  for (let y = 120; y < 300; y += 9) L([150, y, 150, y + 5])
  for (let i = 0; i < 7; i++) {
    const y = 150 + i * 17
    const w = 42 - Math.abs(i - 2) * 3
    g.beginPath(); g.moveTo(150, y); g.quadraticCurveTo(150 - w, y - 4, 150 - w + 6, y + 14); g.stroke()
    g.beginPath(); g.moveTo(150, y); g.quadraticCurveTo(150 + w, y - 4, 150 + w - 6, y + 14); g.stroke()
  }
  L([108, 138, 192, 138])
  L([112, 140, 90, 220, 82, 300]); L([188, 140, 210, 220, 218, 300])
  g.beginPath(); g.moveTo(120, 300); g.quadraticCurveTo(150, 340, 180, 300); g.quadraticCurveTo(150, 320, 120, 300); g.stroke()
  L([132, 325, 126, 440, 124, 550]); L([168, 325, 174, 440, 176, 550])
  g.strokeStyle = C.cyan; g.lineWidth = 2; g.strokeRect(1, 1, 298, 598)
  g.font = '500 13px Plex'; g.fillStyle = C.cyan; g.fillText('XR-02  FULL BODY', 12, 22); g.fillText('SCAN OK', 12, 588)
  return c
}

function striped(g: CanvasRenderingContext2D, x: number, top: number, w: number, h: number): void {
  g.fillStyle = C.white
  for (let y = top; y < top + h; y += 9) g.fillRect(x, y, w, 6)
}

function typedName(g: CanvasRenderingContext2D, gl: Glyphs, t: number, row: typeof ROWS[number]): void {
  const size = 168
  const lay = gl.layout(row.text, { size, variation: { wght: 160, wdth: 96 }, tracking: -7, x: NAME_X + 26, y: row.base })
  const n = Math.min(row.text.length, Math.max(0, Math.floor((t - row.at) * 18 + 1e-6)))
  if (n === 0) return
  const last = lay.glyphs[n - 1]
  const w = last.x + last.advance - NAME_X + 30
  striped(g, NAME_X, row.base - size * 0.8, w, size * 0.98)
  const ghost = n === row.text.length ? n - 1 : n - 1
  g.fillStyle = C.ink
  if (ghost > 0) g.fill(gl.path2d(lay, lay.glyphs.slice(0, ghost)))
  g.fillStyle = '#9aa4a8'
  g.fill(gl.path2d(lay, lay.glyphs[ghost]))
}

export default scene({
  id: 'raymond',
  at: START,
  end: END,
  async mount(ctx) {
    const g = ctx.canvas('raymond')
    const gl = await sans()
    const rnd = seeded(24)
    const mesh = makeMesh(rnd, 34, 1180, 760, 1860, 1010, 2)
    return { g, gl, mesh, face: portrait(rnd), body: xray(), glitch: new Glitch(g.canvas.width, g.canvas.height), smear: new Smear(g.canvas.width, g.canvas.height) }
  },
  render(f, s) {
    const { g, gl } = s
    const t = f.t
    clear(g, f)

    // × grid.
    g.strokeStyle = 'rgba(160,175,180,0.35)'
    g.lineWidth = 1.2
    g.beginPath()
    const sweep = lerp(-100, W + 100, outCubic(seg(t, START, START + 0.5)))
    for (let y = 60; y < H; y += 60) for (let x = 60; x < Math.min(W, sweep); x += 60) { g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x - 4, y + 4) }
    g.stroke()

    // Yellow-green file mesh.
    const mv = (i: number) => clamp01((t - START - 0.3 - s.mesh.nodes[i].ph * 0.8) / 0.25)
    drawMesh(g, s.mesh, (i) => { const n = s.mesh.nodes[i]; return [n.x + 6 * Math.sin(t * 1.4 + n.ph * 6), n.y + 4 * Math.cos(t * 1.1 + n.ph * 5)] }, mv, C.lime, 0.85)

    // Portrait grows from small to large.
    const grow = lerp(0.2, 1, outCubic(seg(t, START + 0.05, START + 1.5))) * (1 + 0.05 * seg(t, START + 1.5, END))
    const pw = 470 * grow
    const ph = 580 * grow
    const pcx = 160 + 235
    const pcy = 190 + 290
    g.drawImage(s.face, pcx - pw / 2, pcy - ph / 2, pw, ph)
    mono(g, 15, 500)
    g.fillStyle = C.cyan
    g.fillText('SUBJECT 0471 // FACE MATCH 97.2%', pcx - pw / 2, pcy - ph / 2 - 12)

    for (const row of ROWS) typedName(g, gl, t, row)

    // DISGRUNTLED EMPLOYEE: bold on a white box.
    const tagK = outCubic(seg(t, TAG_AT, TAG_AT + 0.18))
    if (tagK > 0) {
      const lay = gl.layout(TAG, { size: 54, variation: { wght: 820, wdth: 100 }, tracking: -1.5, x: NAME_X + 20, y: 700 })
      const bw = (lay.width + 40) * tagK
      g.fillStyle = C.white
      g.fillRect(NAME_X, 646, bw, 72)
      g.save(); g.beginPath(); g.rect(NAME_X, 640, bw, 90); g.clip()
      g.fillStyle = C.ink
      g.fill(gl.path2d(lay))
      g.restore()
    }

    // Small text.
    mono(g, 15, 400)
    META.forEach((line, i) => {
      const at = TAG_AT + 0.15 + i * 0.07
      const shown = Math.min(line.length, Math.max(0, Math.floor((t - at) * 60)))
      g.fillStyle = i === 3 ? C.white : C.grey
      g.fillText(line.slice(0, shown), NAME_X, 770 + i * 24)
    })

    // X-ray card pops in at 25.5.
    if (t >= XRAY) {
      const k = (t - XRAY) / 0.35
      const sc = 0.55 + 0.45 * outBack(k, 2.4)
      const cx = 1640
      const cy = 510
      g.save()
      g.globalAlpha = clamp01(k * 4)
      g.translate(cx, cy); g.scale(sc, sc)
      g.drawImage(s.body, -150, -300)
      const scan = ((t - XRAY) * 420) % 600
      g.fillStyle = 'rgba(98,228,255,0.55)'
      g.fillRect(-150, -300 + scan, 300, 2)
      g.restore()
      g.globalAlpha = 1
      if (k < 0.5) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - k * 2)})`; g.fillRect(cx - 150, cy - 300, 300, 600) }
      mono(g, 14, 500)
      g.fillStyle = C.grey
      g.fillText(`DOSE 0.${String(Math.floor((t - XRAY) * 97) % 100).padStart(2, '0')} mSv`, cx - 150, cy + 326)
    }

    // Glitch in, whip out to the left from 26.0.
    s.glitch.apply(g, f, 1 - seg(t, START, START + 0.16), 7)
    const wx = (u: number) => -2600 * inCubic(seg(u, WHIP, END - 0.2))
    const dx = wx(t)
    if (dx < 0) s.smear.apply(g, dx, wx(t) - wx(t - 1 / 30), 12)
  },
})
