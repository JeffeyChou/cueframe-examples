// The opening: Muybridge's 1878 plate on a black void. One small frame per bar of the intro's
// chords, the gallop playing inside it at one stride per beat; the vertical title; the date.
// The board holds the Muybridge frames; the look draws them as dots and clean grey.
import { BEAT } from '../edit.js'
import type { Kit } from '../lib/kit.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, INK, WIDE, brackets, text } from '../lib/ui.js'

/** Paint Muybridge frame `i` (0..10) into the board at `r` (board px, contain). */
export function paintMuy(k: Kit, i: number, r: { x: number; y: number; w: number; h: number }): void {
  const im = k.muy[((i % k.muy.length) + k.muy.length) % k.muy.length]!
  const s = Math.min(r.w / im.width, r.h / im.height)
  const w = im.width * s, h = im.height * s
  k.board.g.drawImage(im, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h)
}

/** The Muybridge frame at time t: 11 frames per stride, one stride per beat. */
export const muyAt = (t: number) => Math.floor(((t / BEAT) % 1) * 11 + 11) % 11

const BAR = BEAT * 4

function layout(c: ShotCtx) {
  const { k, m } = c
  const bar = Math.min(3, Math.floor(m.lt / BAR))
  // bar 0: one tiny frame; 1: three stacked; 2: the gallop, larger; 3: a strip of 11
  const push = bar === 0 ? 1 + 0.18 * (m.lt / BAR) : 1
  const w = [300, 230, 640, 150][bar]! * push, h = w * 0.666
  const cx = k.W / 2, cy = k.H / 2
  if (bar === 1) return { bar, tiles: [-1, 0, 1].map((j) => ({ x: cx - w / 2, y: cy - h / 2 + j * (h + 14), w, h, i: 3 + j })) }
  if (bar === 3) return { bar, tiles: Array.from({ length: 11 }, (_, j) => ({ x: cx - (11 * (w + 8)) / 2 + j * (w + 8), y: cy - h / 2, w, h, i: j })) }
  return { bar, tiles: [{ x: cx - w / 2, y: cy - h / 2, w, h, i: bar === 0 ? 4 : -1 }] }
}

export default defineShot({
  draw(c) {
    const { k, f, m } = c
    const L = layout(c)
    const g = k.board.g
    g.fillStyle = '#000'
    g.fillRect(0, 0, 1920, 1080)
    const cells = L.tiles.map((t, j) => {
      const r = { x: (j % 6) * 320, y: Math.floor(j / 6) * 216, w: 320, h: 216 }
      // everything moves from the first frame: the plate plays at half speed in bar 0, the stack in
      // offset phases in bar 1, the big gallop at full speed in bar 2; the strip in bar 3 holds still
      const n = L.bar === 3 ? t.i : L.bar === 2 ? muyAt(f.t * 0.5) : (muyAt(f.t * 0.5) + j * 4) % 11
      paintMuy(k, n, r)
      return r
    })
    k.board.upload()
    L.tiles.forEach((t, j) => {
      const hot = L.bar === 3 && j === muyAt(f.t)
      k.look.draw(f, {
        src: k.board.tex, rect: t, crop: k.board.rect(cells[j]!), mode: L.bar === 2 ? 'dots' : hot ? 'clean' : 'matrix',
        cell: L.bar === 2 ? 6 : 4, levels: [0.25, 0.85, 1.4], ink: hot ? '#ff2a3a' : '#f2f2ee', streak: m.glitch,
      })
    })
  },
  ui(g, c) {
    const { f, k, m } = c
    const L = layout(c)
    const t0 = L.tiles[0]!
    if (L.bar === 0) {
      brackets(g, { x: t0.x - 18, y: t0.y - 12, w: t0.w + 36, h: t0.h + 24 })
      text(g, f, 'SALLIE GARDNER AT A GALLOP', k.W / 2, t0.y - 34, { size: 14, align: 'center' })
      text(g, f, 'PALO ALTO · 19 JUNE 1878 · E. MUYBRIDGE', k.W / 2, t0.y + t0.h + 44, { size: 13, align: 'center', color: GREY })
    }
    if (L.bar >= 2) {
      // the vertical title, like a spine
      g.save()
      g.translate(k.W / 2 + (L.bar === 2 ? 400 : 0), L.bar === 2 ? k.H / 2 : k.H * 0.28)
      g.rotate(Math.PI / 2)
      text(g, f, 'LOCOMOTION', 0, 0, { font: WIDE, size: L.bar === 2 ? 46 : 24, align: 'center', track: 10, base: 'middle', color: INK })
      g.restore()
    }
    if (L.bar === 3) text(g, f, `FRAME ${String(muyAt(f.t) + 1).padStart(2, '0')} / 11 · 1/25 s`, k.W / 2, k.H / 2 + 90, { size: 13, align: 'center', color: GREY })
    void m
  },
})
