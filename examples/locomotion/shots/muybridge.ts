// Muybridge's 11 frames as a contact strip or a grid. `band`: one row across the middle sliding
// left one frame per beat, a red read-head sweeping the 11 frames once per stride. `full`: the 4 × 3
// plate, each tile in another treatment that rotates on the hats, the 12th cell a label.
import type { Mode, Rect } from '../lib/look.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, INK, RED, brackets, hline, text, vline } from '../lib/ui.js'
import { muyAt, paintMuy } from './plate.js'

const LEVELS: [number, number, number] = [0.25, 0.85, 1.4]
const cellOf = (j: number): Rect => ({ x: (j % 6) * 320, y: Math.floor(j / 6) * 216, w: 320, h: 216 })

interface Tile extends Rect { i: number; hot: boolean; opacity: number }

// band: tile pitch and size (Muybridge frames are 3:2)
const BW = 168, BH = 112, PITCH = 182

function band(c: ShotCtx): Tile[] {
  const { k, m, f } = c
  const cx = k.W / 2, y = k.H / 2 - BH / 2
  const s = m.beats
  const hot = muyAt(f.t)
  const out: Tile[] = []
  for (let j = Math.floor(s) - 1; j <= Math.floor(s) + 11; j++) {
    const x = cx - BW / 2 + (j - s - 5) * PITCH
    const d = Math.abs(x + BW / 2 - cx)
    const i = ((j % 11) + 11) % 11
    const opacity = Math.max(0, Math.min(1, 1 - (d - 720) / 240))
    if (opacity <= 0) continue
    out.push({ x, y, w: BW, h: BH, i, hot: i === hot && d < PITCH * 5.5, opacity })
  }
  return out
}

const GW = 380, GH = 253, GAP = 14
function grid(c: ShotCtx): Tile[] {
  const { k, f } = c
  const x0 = (k.W - 4 * GW - 3 * GAP) / 2, y0 = (k.H - 3 * GH - 2 * GAP) / 2
  const hot = muyAt(f.t)
  return Array.from({ length: 12 }, (_, i) => ({ x: x0 + (i % 4) * (GW + GAP), y: y0 + Math.floor(i / 4) * (GH + GAP), w: GW, h: GH, i, hot: i === hot, opacity: 1 }))
}

const MODES: Mode[] = ['clean', 'dots', 'ascii', 'matrix', 'dither']

export default defineShot({
  draw(c) {
    const { k, f, m, plan } = c
    const full = plan.spec.frame === 'full'
    const tiles = full ? grid(c).slice(0, 11) : band(c)
    const g = k.board.g
    g.fillStyle = '#000'
    g.fillRect(0, 0, 1920, 1080)
    tiles.forEach((t, j) => paintMuy(k, t.i, cellOf(j)))
    k.board.upload()
    tiles.forEach((t, j) => {
      // the hot tile in red matrix in the grid (a clean red tile would be a large bright flash)
      const mode: Mode = full ? (t.hot ? 'matrix' : MODES[(t.i + Math.max(0, m.snare.k + 1)) % MODES.length]!) : t.hot ? 'clean' : 'matrix'
      k.look.draw(f, {
        src: k.board.tex, rect: t, crop: k.board.rect(cellOf(j)), mode,
        cell: full ? (mode === 'ascii' ? 7 : 5) : 4, levels: LEVELS,
        ink: t.hot ? RED : INK, opacity: t.opacity, streak: m.glitch,
      })
    })
  },
  ui(g, c) {
    const { k, f, m, plan } = c
    if (plan.spec.frame === 'full') {
      const tiles = grid(c)
      const hot = tiles[muyAt(f.t)]!
      brackets(g, { x: hot.x - 6, y: hot.y - 6, w: hot.w + 12, h: hot.h + 12 }, RED, 2)
      tiles.slice(0, 11).forEach((t) => text(g, f, String(t.i + 1).padStart(2, '0'), t.x + 8, t.y + t.h - 10, { size: 12, color: GREY }))
      const lab = tiles[11]!
      g.strokeStyle = 'rgba(242,242,238,0.3)'
      g.lineWidth = 1
      g.strokeRect(lab.x + 0.5, lab.y + 0.5, lab.w - 1, lab.h - 1)
      text(g, f, 'SALLIE GARDNER', lab.x + 22, lab.y + 48, { size: 16 })
      text(g, f, '11 FRAMES · ONE STRIDE', lab.x + 22, lab.y + 76, { size: 13, color: GREY })
      text(g, f, 'PALO ALTO · 1878', lab.x + 22, lab.y + 100, { size: 13, color: GREY })
      text(g, f, `FRAME ${String(muyAt(f.t) + 1).padStart(2, '0')} / 11`, lab.x + 22, lab.y + lab.h - 26, { size: 14, color: RED })
      return
    }
    // the strip: film edges with sprocket ticks moving with it, a read-head at the centre
    const y0 = k.H / 2 - BH / 2 - 22, y1 = k.H / 2 + BH / 2 + 22
    hline(g, 0, k.W, y0, GREY)
    hline(g, 0, k.W, y1, GREY)
    const off = ((m.beats * PITCH) % (PITCH / 4) + PITCH / 4) % (PITCH / 4)
    for (let x = -off; x < k.W; x += PITCH / 4) {
      vline(g, x, y0 - 6, y0, GREY)
      vline(g, x, y1, y1 + 6, GREY)
    }
    const hot = band(c).find((t) => t.hot)
    if (hot) {
      g.fillStyle = RED
      g.fillRect(hot.x + hot.w / 2 - 3, y0 - 16, 6, 6)
      text(g, f, String(hot.i + 1).padStart(2, '0'), hot.x + hot.w / 2, y1 + 30, { size: 13, align: 'center', color: RED })
    }
    text(g, f, 'ONE STRIDE = 11 FRAMES = ONE BEAT', k.W / 2, y1 + 66, { size: 14, align: 'center', color: GREY })
  },
})
