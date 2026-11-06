// 雨停了 on a three-drum riso: teal, then yellow, then fluo pink. Each frame draws the plates as
// ink densities into one separation canvas and prints it (kits/print.ts). Registration is fixed per
// shot, kicked when a plate lands, drifts while the rain thins and snaps back on the downbeat.
import { scene } from '@cueframe/core'
import { hdr } from '@cueframe/gfx'
import { ink, inking, onTwos, over, PAPER, press, printSeed, registration, riso, RISO, type Separation } from '../../../kits/print.js'
import { disc, houses, marks, P, puddles, rain, rect, street, T, walker, Y } from '../lib/draw.js'
import { K, SHOT, TOTAL } from '../timing.js'

type G = CanvasRenderingContext2D
type Figure = (g: G, w: Parameters<typeof walker>[1]) => void

const W = 1920, H = 1080
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a))

const FAR = street(11, -400, 4200)
const NEAR = street(23, -300, 4400)
// A low skyline with no gaps, so the setting sun shows only above it.
const LOW = street(41, -200, 2200).map((h, i, a) => ({ ...h, h: Math.round(h.h * 0.55), w: (a[i + 1]?.x ?? h.x + h.w) - h.x }))
const LAMPS = [520, 1240, 1960, 2680, 3400]

/** Shot A: tracking the walker along the wet street. */
function shotA(g: G, t: number, figure: Figure): void {
  const tw = onTwos(t)
  const cam = 150 * t
  rect(g, 0, 0, W, H, T(0.2))
  g.save()
  g.translate(-cam * 0.5, 0)
  houses(g, FAR, 700, 0, 0.6)
  g.restore()
  g.save()
  g.translate(-cam, 0)
  houses(g, NEAR, 820, seg(t, K.plates[1], K.plates[1] + 1.5))
  rect(g, cam - 50, 820, W + 100, H - 820, T(0.4))
  puddles(g, [300, 900, 1500, 2100, 2700], 900, 'rgb(0,0,0)', 1, tw)
  for (const x of LAMPS) lamp(g, x, 820)
  g.restore()
  over(g, () => rain(g, W, H, tw, 1))
  const wx = 700 + 150 * (tw - t)
  g.save()
  g.translate(wx, 960)
  g.scale(1.05, 1.05)
  figure(g, { step: tw * 1.8, furl: 0, palm: 0, canopy: P(1) })
  g.restore()
}

/** Shot B: held on the walker, who stops and feels for rain. */
function shotB(g: G, t: number, figure: Figure): void {
  const tw = onTwos(t)
  const clear = seg(t, K.stop, K.drift[1] - 0.4)
  rect(g, 0, 0, W, H, T(0.2))
  over(g, () => {
    rect(g, 0, 0, W, 320, P(0.4))
    rect(g, 0, 320, W, 640, P(0.2))
  })
  rect(g, 200, 260, 560, 700, T(0.6))
  rect(g, 1180, 160, 640, 800, T(0.4))
  for (const [x, y] of [[300, 360], [520, 360], [300, 560], [1300, 260], [1560, 260], [1300, 520], [1560, 520]] as const) {
    rect(g, x - 4, y - 4, 108, 148, 'rgb(0,0,0)')
    rect(g, x, y, 100, 140, Y(1))
  }
  rect(g, 0, 960, W, 120, T(0.6))
  puddles(g, [380, 1500], 1010, 'rgb(0,0,0)', 1 - clear, tw)
  over(g, () => rain(g, W, H, tw, 1 - clear, 9))
  const palm = seg(tw, K.stop, K.stop + 0.5)
  const furl = seg(tw, K.snap, K.snap + 0.6)
  g.save()
  g.translate(940, 1010)
  g.scale(1.9, 1.9)
  figure(g, { step: Math.min(tw, K.stop - 0.1) * 1.8, furl, palm: palm * (1 - furl), canopy: P(1) })
  g.restore()
}

/** Shot C: the cleared street at sunset, the title, then the pull back to the sheet. */
function shotC(g: G, t: number, figure: Figure): void {
  const tw = onTwos(t)
  const sun = ink(0, 1, 0.7)
  rect(g, 0, 0, W, H, P(0.2))
  over(g, () => {
    rect(g, 0, 380, W, 160, Y(0.2))
    rect(g, 0, 540, W, 160, Y(0.4))
    rect(g, 0, 700, W, 120, Y(0.6))
  })
  disc(g, 1300, 610, 190, sun)
  houses(g, LOW, 820, 1)
  rect(g, 0, 820, W, H - 820, T(0.6))
  puddles(g, [460], 900, PAPER, 0, 0)
  puddles(g, [1300], 880, sun, 0, 0)
  g.save()
  g.translate(840 + 40 * (tw - SHOT.c), 930)
  g.scale(0.6, 0.6)
  figure(g, { step: (tw - SHOT.c) * 1.8, furl: 1, palm: 0, canopy: P(1) })
  g.restore()
  title(g, t)
}

function title(g: G, t: number): void {
  const [h1, h2] = K.title
  if (t < h1) return
  g.save()
  g.font = '900 210px "Noto Sans SC"'
  g.textBaseline = 'alphabetic'
  const hit = (dx: number, dy: number, a: number) => over(g, () => {
    g.fillStyle = T(a)
    g.fillText('雨停了', 140 + dx, 330 + dy)
  })
  hit(0, 0, 0.75)
  if (t >= h2) hit(4, -3, 0.75)
  g.font = '500 44px Jost'
  g.letterSpacing = '14px'
  g.fillStyle = T(1)
  if (t >= h2) g.fillText('AFTER THE RAIN', 150, 410)
  g.restore()
}

function lamp(g: G, x: number, ground: number): void {
  rect(g, x - 5, ground - 330, 10, 330, T(1))
  over(g, () => {
    g.fillStyle = Y(0.4)
    g.beginPath()
    g.moveTo(x - 14, ground - 320)
    g.lineTo(x + 14, ground - 320)
    g.lineTo(x + 130, ground + 60)
    g.lineTo(x - 130, ground + 60)
    g.fill()
  })
  disc(g, x, ground - 330, 20, Y(1))
}

/** The walker with a paper-white trap around it, so plates off register fringe it instead of muddying it. */
const haloed = (sep: Separation): Figure => (_g, w) => sep.halo((h) => walker(h, w), 5)

export const print = scene({
  id: 'print',
  dur: TOTAL,
  mount(ctx) {
    const comp = hdr(ctx, { clear: [1, 1, 1] })
    const pr = press(ctx, riso([RISO.teal, RISO.yellow, RISO.fluoPink]))
    return { comp, pr, figure: haloed(pr.sep) }
  },
  render(f, s) {
    const t = f.t
    const shot = t < SHOT.b ? 0 : t < SHOT.c ? 1 : 2
    const pull = seg(t, K.pull[0], K.pull[1])
    s.pr.sep.draw((g) => {
      const z = 1 - 0.3 * pull
      const pw = W * z, ph = H * z, px = (W - pw) / 2, py = (H - ph) / 2 - 20 * pull
      g.save()
      if (pull > 0) {
        g.beginPath()
        g.rect(px, py, pw, ph)
        g.clip()
        g.translate(px, py)
        g.scale(z, z)
      }
      ;[shotA, shotB, shotC][shot]!(g, t, s.figure)
      g.restore()
      if (pull > 0) {
        g.globalAlpha = seg(t, K.pull[0] + 1.2, K.pull[1])
        marks(g, px, py, pw, ph)
        g.font = '500 22px Jost, "Noto Sans SC"'
        g.letterSpacing = '4px'
        g.fillStyle = T(1)
        g.fillText('雨停了 · TEAL / YELLOW / FLUORESCENT PINK · 3 DRUMS', px, py + ph + 52)
        g.globalAlpha = 1
      }
    })
    const rollers = K.plates.map((at) => inking(t, at, 0.6))
    const drift = shot === 1 ? seg(t, K.drift[0], K.drift[1] - 0.05) * (t < K.drift[1] ? 1 : 0) : 0
    const reg = registration({ n: 3, shot, t, kicks: [...K.plates, ...K.title], drift })
    s.comp.begin(f)
    s.pr.print(f, { ...reg, gate: rollers.map((k) => k.gate), sweep: rollers.map((k) => k.sweep), sheet: shot, print: printSeed(t) })
    s.comp.present()
  },
})
