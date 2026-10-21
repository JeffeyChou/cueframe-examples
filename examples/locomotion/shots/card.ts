// The end card on the downbeat: the title in Michroma, the line in English and Chinese, a rule
// and the credits; a small Muybridge gallop in dots above the title. The type arrives through the
// cut's pixel-sort streak (drawn on the board and through the look while the glitch lasts), then
// holds still as crisp UI type.
import { defineShot, type ShotCtx } from '../lib/shot.js'
import type { Rect } from '../lib/look.js'
import { GREY, RED, WIDE, hline, text } from '../lib/ui.js'
import { muyAt, paintMuy } from './plate.js'

// no CJK face is loaded in timeline.ts yet: the browser's fallback draws the Chinese line
const CJK = '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", sans-serif'

const CREDITS: [string, string][] = [
  ['MUSIC', 'NEED FOR SPEED — ARULO (MIXKIT)'],
  ['FOOTAGE', 'MIXKIT'],
  ['PHOTOGRAPHS', 'E. MUYBRIDGE, 1878'],
  ['MODELS', 'FERRARI 458 BY VICENT091036 (CC BY 4.0) · HORSE, STORK, PARROT, FLAMINGO — RO.ME (CC BY-NC-SA 3.0)'],
  ['', 'MADE WITH CUEFRAME + THREE.JS'],
]

const GALLOP: Rect = { x: 960 - 84, y: 268, w: 168, h: 112 }
const CELL: Rect = { x: 1600, y: 860, w: 320, h: 216 }

function typeset(g: CanvasRenderingContext2D, c: ShotCtx): void {
  const { f, k } = c
  const cx = k.W / 2
  text(g, f, 'LOCOMOTION', cx + 18, 500, { font: WIDE, size: 76, align: 'center', track: 36 })
  text(g, f, 'EVERY MACHINE REMEMBERS AN ANIMAL', cx, 568, { size: 18, align: 'center', track: 4 })
  text(g, f, '每一台机器，都记得一种动物', cx, 610, { size: 20, align: 'center', track: 6, font: CJK, label: 'CJK LINE' })
  hline(g, cx - 260, cx + 260, 652, 'rgba(242,242,238,0.45)')
  const xL = 470
  CREDITS.forEach(([lab, val], i) => {
    const y = 704 + i * 28
    if (lab) text(g, f, lab, xL, y, { size: 14, color: GREY, align: 'right', track: 1.2 })
    text(g, f, val, xL + 24, y, { size: 14, color: GREY, track: 1.2 })
  })
}

export default defineShot({
  draw(c) {
    const { k, f, m } = c
    const g = k.board.g
    g.fillStyle = '#000'
    g.fillRect(0, 0, 1920, 1080)
    // inverted on the board, so the dots draw a white horse on black
    g.save()
    g.filter = 'invert(1)'
    paintMuy(k, muyAt(f.t), CELL)
    g.restore()
    if (m.glitch) typeset(g, c)
    k.board.upload()
    if (m.glitch) {
      // the type, smeared on the cut (the board is stage-sized: no crop scaling)
      k.look.draw(f, { src: k.board.tex, mode: 'clean', colour: 1, levels: [0, 1, 1], crop: { x: 0, y: 0, w: 1, h: 0.79 }, rect: { x: 0, y: 0, w: k.W, h: k.H * 0.79 }, streak: { ...m.glitch, dir: 3 } })
    }
    k.look.draw(f, { src: k.board.tex, rect: GALLOP, crop: k.board.rect(CELL), mode: 'dots', cell: 4, levels: [0.25, 0.85, 1.4], streak: m.glitch })
  },
  ui(g, c) {
    const { m } = c
    if (!m.glitch) typeset(g, c)
    g.fillStyle = RED
    g.fillRect(GALLOP.x + GALLOP.w / 2 - 3, GALLOP.y + GALLOP.h + 14, 6, 6)
  },
})
