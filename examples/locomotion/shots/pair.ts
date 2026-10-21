// IV CHIMERA. `pair`: animal left, machine right, each cropped around its focus so an eye and a
// headlight sit at the same height on either side of the seam; the push-in tightens through the
// shot, a half drops into dots on the hats, the reds survive. `eyes`: a 4 × 3 grid of eyes and
// lights, one tile changing treatment per sixteenth, the kick's tile bracketed in red.
import { blocks } from '../lib/blocks.js'
import { paintFocus } from '../lib/focus.js'
import { clipFrame, type Kit } from '../lib/kit.js'
import type { Mode, Rect } from '../lib/look.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, INK, RED, brackets, text, vline } from '../lib/ui.js'
import { cover } from '../lib/look.js'
import { carStage, renderCar, type CarStage } from './car.js'

const at = (c: ShotCtx, id: string) => clipFrame(c.k, id, c.m.lt + 1.2)

function halves(k: Kit): [Rect, Rect] {
  const g = 10
  return [{ x: 0, y: 0, w: k.W / 2 - g / 2, h: k.H }, { x: k.W / 2 + g / 2, y: 0, w: k.W / 2 - g / 2, h: k.H }]
}

export const pair = defineShot({
  mount: (k): CarStage => carStage(k),
  loads: (c) => [c.plan.spec.clip!, c.plan.spec.clip2].filter((x): x is string => !!x).map((id) => [id, at(c, id)] as [string, number]),
  draw(c, cs) {
    const { k, f, m, plan } = c
    // the machine half is the 3D car when the spec names a view instead of a second clip
    if (plan.spec.view) {
      const tex = renderCar(c, cs, plan.spec.view === 'windtunnel' ? 'rear34' : 'haunch', { dark: true })
      const H = halves(k)
      k.look.draw(f, { src: tex, rect: H[1], crop: cover(k.W / k.H, H[1].w / H[1].h, 0.5, 0.5, 1.15), mode: m.snare.k % 2 === 1 ? 'dither' : 'print', cell: 10, streak: m.glitch, colour: 1, exposure: 1.2 })
    }
    const ids = [plan.spec.clip!, plan.spec.clip2].filter((x): x is string => !!x)
    const H = halves(k)
    const zoom = 1.35 + 0.5 * m.u + 0.06 * m.kick.pulse
    const board: Rect[] = [{ x: 0, y: 0, w: 955, h: 1080 }, { x: 960, y: 0, w: 955, h: 1080 }]
    ids.forEach((id, j) => paintFocus(k, id, at(c, id), board[j]!, zoom, j === 1))
    k.board.upload()
    ids.forEach((id, j) => {
      const dotted = m.snare.k >= 0 && (m.snare.k + j) % 2 === 0
      const mode: Mode = dotted ? 'dither' : 'clean'
      k.look.draw(f, {
        src: k.board.tex, rect: H[j]!, crop: k.board.rect(board[j]!), mode, cell: 10, red: 1,
        levels: [0.05, 0.9, 1.15], streak: m.glitch,
        blocks: m.kick.k >= 0 ? blocks(`p${plan.shot.i}:${m.kick.k}:${j}`, { n: 2, modes: ['invert', 'matrix'], w: [1, 4], h: [1, 3] }) : [],
      })
      void id
    })
  },
  ui(g, c) {
    const { k, f, plan, m } = c
    vline(g, k.W / 2, 0, k.H, INK, 1)
    const y = k.H / 2
    g.fillStyle = m.kick.pulse > 0.3 ? RED : INK
    g.fillRect(k.W / 2 - 4, y - 4, 8, 8)
    text(g, f, plan.spec.clip!.toUpperCase(), k.W / 2 - 24, y + 40, { size: 14, align: 'right' })
    text(g, f, (plan.spec.clip2 ?? `458 / ${plan.spec.view}`).toUpperCase(), k.W / 2 + 24, y + 40, { size: 14 })
    text(g, f, 'OCULUS', k.W / 2 - 24, y - 26, { size: 13, align: 'right', color: GREY })
    text(g, f, 'LUX', k.W / 2 + 24, y - 26, { size: 13, color: GREY })
  },
})

const EYES = ['horse-eye', 'car-pan', 'eagle-eye', 'night-drive', 'owl-eye', 'car-rear', 'chameleon', 'dash-accel', 'lion-head', 'car-macro', 'cat-black', 'tunnel-dark']
const MODES: Mode[] = ['clean', 'dots', 'ascii', 'matrix', 'dither', 'clean']

function grid(k: Kit): Rect[] {
  const cols = 4, rows = 3, gx = 14, gy = 14, w = 380, h = 214
  const x0 = (k.W - cols * w - (cols - 1) * gx) / 2, y0 = (k.H - rows * h - (rows - 1) * gy) / 2
  return Array.from({ length: cols * rows }, (_, i) => ({ x: x0 + (i % cols) * (w + gx), y: y0 + Math.floor(i / cols) * (h + gy), w, h }))
}

export const eyes = defineShot({
  loads: (c) => EYES.map((id) => [id, at(c, id)] as [string, number]),
  draw(c) {
    const { k, f, m, plan } = c
    const tiles = grid(k)
    // the grid rotates by one clip per shot so repeats look different
    const ids = EYES.map((_, i) => EYES[(i + plan.shot.i) % EYES.length]!)
    const board = tiles.map((_, i) => ({ x: (i % 4) * 480, y: Math.floor(i / 4) * 270, w: 476, h: 268 }))
    ids.forEach((id, i) => paintFocus(k, id, at(c, id), board[i]!, 2.1 + 0.3 * m.u))
    k.board.upload()
    tiles.forEach((r, i) => {
      // tiles appear one per sixteenth on the first beat of the shot, then each takes a treatment
      const shown = m.beats * 4 >= i * 0.5 || plan.shot.n > 0
      if (!shown) return
      const mode = MODES[(i + Math.max(0, m.kick.k) * (i % 3 === 0 ? 1 : 0)) % MODES.length]!
      k.look.draw(f, { src: k.board.tex, rect: r, crop: k.board.rect(board[i]!), mode, cell: 6, red: 1, levels: [0.05, 0.9, 1.2], streak: m.glitch })
    })
  },
  ui(g, c) {
    const { k, m, f } = c
    const tiles = grid(k)
    const hot = m.kick.k >= 0 ? (m.kick.k * 5 + c.plan.shot.i) % tiles.length : -1
    tiles.forEach((r, i) => {
      if (i === hot) brackets(g, { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }, RED, 2)
    })
    text(g, f, 'OCULUS ↔ LUX', k.W / 2, tiles[tiles.length - 1]!.y + tiles[0]!.h + 44, { size: 14, align: 'center', color: GREY })
  },
})
