import { scene, seeded } from '@cueframe/core'
import { boxText, C, clear, dotCells, ft, inCubic, lerp, mono, outBack, outCubic, outExpo, seg } from '../lib.js'

const START = ft(26.6)
const END = ft(30.6)
const PLUG = START + 0.45
const VIRUS = START + 0.55
const AND = START + 1.05
const WALK = AND + 0.28
const WIPE = ft(28.45)
const PIES = ft(28.75)
const SHRINK = ft(29.0)
const LY = 430
const PX = 470
const PITCH = 26
const VX = 680
const VY = 340
const FRAC = [0.72, 0.38, 0.86, 0.55]

/** Branching traces from the plug point: polylines and their start delays. */
const BRANCH: { pts: [number, number][]; d: number }[] = [
  { pts: [[PX, LY], [610, LY], [610, VY + 13], [VX - 18, VY + 13]], d: 0 },
  { pts: [[PX, LY], [610, LY], [VX - 18, LY]], d: 0.04 },
  { pts: [[PX, LY], [590, LY], [590, VY + 6 * PITCH + 13], [VX - 18, VY + 6 * PITCH + 13]], d: 0.08 },
  { pts: [[PX, LY], [560, LY], [560, 640], [VX - 18, 640]], d: 0.12 },
  { pts: [[PX, LY], [560, LY], [560, 250], [1100, 250]], d: 0.16 },
]

function poly(g: CanvasRenderingContext2D, pts: [number, number][], k: number): [number, number] {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  let left = segs.reduce((a, b) => a + b, 0) * k
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  let end = pts[0]
  for (let i = 0; i < segs.length && left > 0; i++) {
    const u = Math.min(1, left / segs[i])
    end = [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]
    g.lineTo(end[0], end[1])
    left -= segs[i]
  }
  g.stroke()
  return end
}

function usb(g: CanvasRenderingContext2D, x: number, y: number): void {
  // Drawn with its connector tip at (x, y), pointing right.
  g.fillStyle = C.white
  g.strokeStyle = C.white
  g.lineWidth = 3
  g.beginPath(); g.roundRect(x - 150, y - 26, 104, 52, 8); g.fill()
  g.fillRect(x - 48, y - 18, 48, 36)
  g.fillStyle = '#000'
  g.fillRect(x - 36, y - 9, 9, 7); g.fillRect(x - 18, y - 9, 9, 7)
  g.fillStyle = C.ink
  mono(g, 15, 500)
  g.fillText('USB/ROOT', x - 140, y + 5)
}

export default scene({
  id: 'virus',
  at: START,
  end: END,
  mount(ctx) {
    const g = ctx.canvas('virus')
    const rnd = seeded(31)
    const cells = dotCells('VIRUS').map((c) => ({ ...c, at: VIRUS + (c.c / 33) * 0.45 + rnd() * 0.18 }))
    const data = FRAC.map(() => Array.from({ length: 7 }, () => `${(rnd() * 99).toFixed(1).padStart(4, '0')} ${Math.floor(rnd() * 4096).toString(16).toUpperCase().padStart(3, '0')}`))
    return { g, cells, data }
  },
  render(f, s) {
    const { g } = s
    const t = f.t
    clear(g, f)
    const sh = 1.12 * (1 - 0.82 * inCubic(seg(t, SHRINK, END - 0.15)))
    g.save()
    g.translate(960, 540); g.scale(sh, sh); g.translate(-1000, -585)
    g.globalAlpha = 1 - seg(t, SHRINK + 0.5, END)
    const A = g.globalAlpha

    // Horizontal line from the left, USB plugs in along it.
    g.strokeStyle = C.white
    g.lineWidth = 3
    const lineK = outCubic(seg(t, START, START + 0.25))
    g.beginPath(); g.moveTo(0, LY); g.lineTo(PX * lineK, LY); g.stroke()
    const ux = lerp(-160, PX, outExpo(seg(t, START + 0.08, PLUG)))
    const jolt = t >= PLUG ? 6 * Math.exp(-(t - PLUG) * 30) * Math.sin((t - PLUG) * 90) : 0
    usb(g, ux + jolt, LY)
    if (t >= PLUG) {
      const k = seg(t, PLUG, PLUG + 0.3)
      g.strokeStyle = C.cyan
      g.globalAlpha = A * (1 - k)
      g.lineWidth = 2
      g.beginPath(); g.arc(PX, LY, 10 + 70 * outCubic(k), 0, Math.PI * 2); g.stroke()
      g.globalAlpha = A
      g.strokeStyle = 'rgba(238,243,245,0.75)'
      g.lineWidth = 2
      for (const b of BRANCH) {
        const bk = outCubic(seg(t, PLUG + b.d, PLUG + b.d + 0.35))
        if (bk <= 0) continue
        const [ex, ey] = poly(g, b.pts, bk)
        g.fillStyle = C.white
        g.fillRect(ex - 4, ey - 4, 8, 8)
      }
    }

    // VIRUS: 5×7 dot matrix, each cell two short italic vertical dashes.
    g.fillStyle = C.white
    for (const c of s.cells) {
      if (t < c.at) continue
      const x = VX + c.c * PITCH
      const y = VY + c.r * PITCH
      const hot = t - c.at < 0.08
      g.fillStyle = hot ? C.cyan : C.white
      g.save()
      g.translate(x + 13, y + 13)
      g.transform(1, 0, -0.26, 1, 0, 0)
      g.fillRect(-7, -10, 4, 20)
      g.fillRect(3, -10, 4, 20)
      g.restore()
    }
    mono(g, 15, 500)
    g.fillStyle = C.grey
    if (t >= VIRUS) g.fillText(`PAYLOAD ${String(Math.min(100, Math.floor(seg(t, VIRUS, VIRUS + 0.7) * 100))).padStart(3, '0')}%  //  SCADA.INJECT`, VX, VY + 7 * PITCH + 30)

    // "...and" / "walked away" on white boxes, wiped at 28.45.
    const wipe = seg(t, WIPE, WIPE + 0.18)
    if (wipe < 1) {
      g.save()
      g.beginPath(); g.rect(VX - 20 + 760 * outCubic(wipe), 560, 900, 220); g.clip()
      const and = '...and'.slice(0, Math.min(6, Math.max(0, Math.floor((t - AND) * 30 + 1e-6))))
      const walk = 'walked away'.slice(0, Math.min(11, Math.max(0, Math.floor((t - WALK) * 30 + 1e-6))))
      boxText(g, and, VX, 640, 44, { cursor: t >= AND && t < WALK })
      boxText(g, walk, VX, 722, 44, { cursor: t >= WALK })
      g.restore()
      if (wipe > 0) { g.fillStyle = C.cyan; g.fillRect(VX - 20 + 760 * outCubic(wipe), 580, 5, 180) }
    }

    // Four white pie charts sweep open and rotate, with data columns.
    FRAC.forEach((fr, i) => {
      const k = outCubic(seg(t, PIES + i * 0.07, PIES + i * 0.07 + 0.5))
      if (k <= 0) return
      const cx = 740 + i * 220
      const cy = 690
      const r = 64 * outBack(Math.min(1, k * 1.6), 1.5)
      const a0 = -Math.PI / 2 + (t - PIES) * (0.5 + i * 0.12)
      g.strokeStyle = 'rgba(238,243,245,0.45)'; g.lineWidth = 1.5
      g.beginPath(); g.arc(cx, cy, r + 8, 0, Math.PI * 2); g.stroke()
      g.fillStyle = C.white
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a0 + Math.PI * 2 * fr * k); g.closePath(); g.fill()
      mono(g, 12, 400)
      g.fillStyle = C.grey
      s.data[i].forEach((line, j) => {
        const shown = Math.min(line.length, Math.max(0, Math.floor((t - PIES - 0.1 - j * 0.03) * 70)))
        g.fillText(line.slice(0, shown), cx + 82, cy - 46 + j * 16)
      })
    })
    g.restore()
    g.globalAlpha = 1
  },
})
