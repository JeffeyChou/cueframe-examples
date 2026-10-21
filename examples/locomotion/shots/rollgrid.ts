// The snare rolls: a 4 × 3 grid that fills one tile per sixteenth of the roll (the snare hits
// land on that grid; a tile that arrives on a detected hit comes in red). Intro: the 11 Muybridge
// frames and the live gallop, collapsing to the centre line in the last beat, onto the drop.
// Finale: animal and machine footage alternating, the film's pairs flashing back.
import { BEAT } from '../edit.js'
import { paintFocus } from '../lib/focus.js'
import { clipFrame } from '../lib/kit.js'
import type { Mode, Rect } from '../lib/look.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, INK, MONO, RED, text } from '../lib/ui.js'
import { muyAt, paintMuy } from './plate.js'

const PAIRS = ['horse-eye', 'car-pan', 'eagle-eye', 'night-drive', 'shark', 'car-rear', 'cheetah-hunt', 'car-road', 'owl-eye', 'tunnel-dark', 'dragonfly-pollen', 'car-macro']
const N = 12
const STEP = BEAT / 4

const isIntro = (c: ShotCtx) => c.plan.section.id === 'intro'
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t) }
const at = (c: ShotCtx, id: string, i: number) => clipFrame(c.k, id, c.m.lt + 1.2 + i * 0.05)

/** Tiles shown so far, and when each arrived (seconds into the shot). */
function shown(c: ShotCtx): number {
  return Math.min(N, Math.floor(c.m.lt / STEP + 1e-6) + 1)
}

/** Did tile `i` arrive on a detected snare hit (any tier)? */
function onHit(c: ShotCtx, i: number): boolean {
  const t = c.plan.shot.at + i * STEP
  return c.plan.shot.hits.some((h) => h.kind === 'snare' && Math.abs(h.t - t) < 0.04)
}

function tiles(c: ShotCtx): Rect[] {
  const { k, m } = c
  const intro = isIntro(c)
  const w = intro ? 360 : 380, h = intro ? 240 : 214, gx = 14, gy = 14
  const x0 = (k.W - 4 * w - 3 * gx) / 2, y0 = (k.H - 3 * h - 2 * gy) / 2
  const base = Array.from({ length: N }, (_, i) => ({ x: x0 + (i % 4) * (w + gx), y: y0 + Math.floor(i / 4) * (h + gy), w, h }))
  if (!intro) return base
  // the last beat: every tile squashes into a sliver on the centre line, spread across the width
  const p = smooth((m.lt - 2 * BEAT) / (BEAT * 0.92))
  if (p <= 0) return base
  const sw = (k.W - 2 * 80 - 11 * 8) / 12
  return base.map((r, i) => {
    const tx = 80 + i * (sw + 8), th = 4
    const L = (a: number, b: number) => a + (b - a) * p
    return { x: L(r.x, tx), y: L(r.y, k.H / 2 - th / 2), w: L(r.w, sw), h: L(r.h, th) }
  })
}

/** Board cells: 3:2 for the Muybridge frames, 16:9 for footage. */
const cellOf = (i: number, intro = false): Rect => (intro ? { x: (i % 4) * 480, y: Math.floor(i / 4) * 330, w: 476, h: 317 } : { x: (i % 4) * 480, y: Math.floor(i / 4) * 270, w: 476, h: 268 })
/** One treatment per column: animals in dots and clean grey, machines in glyphs and dither. */
const FOOT: Mode[] = ['dots', 'ascii', 'clean', 'dither']

export default defineShot({
  loads: (c) => (isIntro(c) ? [] : PAIRS.slice(0, shown(c)).map((id, i) => [id, at(c, id, i)] as [string, number])),
  draw(c) {
    const { k, f, m } = c
    const intro = isIntro(c)
    const n = shown(c)
    const g = k.board.g
    g.fillStyle = '#000'
    g.fillRect(0, 0, 1920, 1080)
    for (let i = 0; i < n; i++) {
      if (intro) paintMuy(k, i === 11 ? muyAt(f.t) : i, cellOf(i, true))
      else paintFocus(k, PAIRS[i]!, at(c, PAIRS[i]!, i), cellOf(i), 2 + 0.25 * m.u)
    }
    k.board.upload()
    const T = tiles(c)
    for (let i = 0; i < n; i++) {
      const fresh = m.lt - i * STEP < 0.09
      const hit = fresh && onHit(c, i)
      const live = intro && i === 11
      // a tile arriving on a snare hit lands in red matrix; others arrive clean for a few frames
      const mode: Mode = hit ? 'matrix' : fresh ? 'clean' : intro ? 'matrix' : FOOT[i % FOOT.length]!
      k.look.draw(f, {
        src: k.board.tex, rect: T[i]!, crop: k.board.rect(cellOf(i, intro)), mode,
        cell: intro ? 4 : 6, levels: intro ? [0.25, 0.85, 1.4] : [0.03, 0.65, 0.85],
        ink: hit || live ? RED : INK, red: intro ? 0 : 1, streak: m.glitch,
      })
    }
  },
  ui(g, c) {
    const { k, f, m } = c
    const intro = isIntro(c)
    const n = shown(c)
    const T = tiles(c)
    const collapsing = intro && m.lt > 2 * BEAT
    if (!collapsing) {
      for (let i = 0; i < n; i++) {
        const r = T[i]!
        const label = intro ? (i === 11 ? 'LIVE' : String(i + 1).padStart(2, '0')) : PAIRS[i]!.toUpperCase()
        // a black tab under the label so it reads on bright tiles
        g.font = `500 12px ${MONO}`
        g.fillStyle = '#000'
        g.fillRect(r.x, r.y + r.h - 24, g.measureText(label).width + label.length * 1 + 14, 24)
        text(g, f, label, r.x + 7, r.y + r.h - 8, { size: 12, color: intro && i === 11 ? RED : GREY })
      }
      const last = T[N - 1]!
      text(g, f, intro ? `ROLL ${String(n).padStart(2, '0')} / 12` : 'ANIMAL / MACHINE', k.W / 2, last.y + last.h + 40, { size: 14, align: 'center', color: GREY })
    } else {
      text(g, f, 'EQUUS', k.W / 2, k.H / 2 - 28, { size: 14, align: 'center', color: INK })
    }
  },
})
