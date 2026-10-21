// One footage clip on the black stage: full frame, a small window, a band or a tall panel, drawn
// through the look; blocks of other treatments jump on kicks, an inverted block on snares.
import { seeded } from '@cueframe/core'
import { blocks } from '../lib/blocks.js'
import { clipFrame, type Kit } from '../lib/kit.js'
import { cover, type Rect } from '../lib/look.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { marks, text, GREY } from '../lib/ui.js'
import { FOCUS } from '../lib/focus.js'
import { FOOTAGE_TRACES, circle, throughCrop, type Poly } from '../lib/trace.js'
import { BEAT } from '../edit.js'

/** Framing for traced shots: focus and zoom on the feature. */
const TRACE_CROP: Record<string, [number, number, number]> = { spine: [0.47, 0.57, 2.6], body: [0.5, 0.56, 1.12] }
/** Eye (or lamp) radius as a fraction of the plate width. */
const EYE_R: Record<string, number> = {
  'eagle-eye': 0.05, 'owl-eye': 0.032, 'cat-black': 0.03, 'horse-eye': 0.03, 'chameleon': 0.045, 'lion-head': 0.025,
  'car-pan': 0.055, 'night-drive': 0.035, 'car-rear': 0.03, 'car-macro': 0.05,
}

export function frameRect(c: ShotCtx): Rect {
  const { W, H } = c.k
  // seeded per shot, not per frame (f.rng is keyed by frame: the window would jump every frame)
  const r = seeded(`win:${c.plan.shot.i}`)
  switch (c.plan.spec.frame ?? 'full') {
    case 'window': { const w = 640, h = 360; return { x: Math.round(W / 2 - w / 2 + r.range(-260, 260)), y: Math.round(H / 2 - h / 2 + r.range(-120, 120)), w, h } }
    case 'band': return { x: 0, y: Math.round(H / 2 - 190), w: W, h: 380 }
    case 'tall': return { x: Math.round(W / 2 - 230), y: 150, w: 460, h: H - 300 }
    default: return { x: 0, y: 0, w: W, h: H }
  }
}

/** Paint a clip frame on the board (cover-fit into `into`, board px) and return the board crop for `rect`. */
export function paintClip(k: Kit, id: string, n: number, into = { x: 0, y: 0, w: 1920, h: 1080 }): void {
  k.clips[id]!.draw(k.board.g, n, into)
}

/** Seconds into a clip where its shot starts (car-pan opens on a glare). */
const LEAD: Record<string, number> = { 'car-pan': 1.5 }
export const clipAt = (c: ShotCtx, id: string, lead = LEAD[id] ?? 0) => clipFrame(c.k, id, c.m.lt + lead)

/** The frame a shot shows: a traced freeze runs into its frame over a beat, then holds. */
function frameOf(c: ShotCtx): number {
  const sp = c.plan.spec
  const tr = sp.trace ? FOOTAGE_TRACES[sp.trace] : undefined
  if (sp.freeze && tr) return Math.max(0, Math.min(tr.frame, tr.frame - Math.round(BEAT * 30) + Math.round(c.m.lt * 30)))
  return clipAt(c, sp.clip!)
}

function cropOf(c: ShotCtx, rect: Rect): Rect {
  const sp = c.plan.spec, ar = rect.w / rect.h
  const punch = 1 + 0.04 * c.m.kick.pulse
  const tc = sp.trace ? TRACE_CROP[sp.trace] : undefined
  if (tc) return cover(16 / 9, ar, tc[0], tc[1], tc[2] * punch)
  if (sp.trace === 'eye') { const [fx, fy] = FOCUS[sp.clip!] ?? [0.5, 0.5]; return cover(16 / 9, ar, fx, fy, (1.5 + 0.3 * c.m.u) * punch) }
  return cover(16 / 9, ar, 0.5, 0.5, punch)
}

/** The shot's trace in stage px: the footage contour through the crop, or a ring on the eye. */
function traceOf(c: ShotCtx): Poly[] | null {
  const sp = c.plan.spec
  if (!sp.trace) return null
  const rect = frameRect(c), crop = cropOf(c, rect)
  const tr = FOOTAGE_TRACES[sp.trace]
  if (tr && tr.clip === sp.clip) return throughCrop(tr.lines, crop, rect)
  if (sp.trace === 'eye') {
    const [fx, fy] = FOCUS[sp.clip!] ?? [0.5, 0.5]
    const [p] = throughCrop([[[fx, fy]]], crop, rect)
    const r = ((EYE_R[sp.clip!] ?? 0.04) / crop.w) * rect.w
    return [circle(p![0]![0], p![0]![1], r)]
  }
  return null
}

export default defineShot({
  loads: (c) => [[c.plan.spec.clip!, frameOf(c)]],
  trace: (c) => traceOf(c),
  draw(c) {
    const { k, plan, m, f } = c
    const id = plan.spec.clip!
    const rect = frameRect(c)
    paintClip(k, id, frameOf(c))
    k.board.upload()
    const crop = cropOf(c, rect)
    const mode = plan.spec.mode ?? 'clean'
    const bl = [
      ...(m.kick.k >= 0 ? blocks(`${plan.shot.i}:${m.kick.k}`, { n: 3, modes: mode === 'ascii' ? ['clean', 'invert', 'dots'] : ['ascii', 'invert', 'matrix'], w: [2, 6], h: [1, 4] }) : []),
      ...(m.snare.k >= 0 && m.snare.since < 0.12 ? blocks(`s${plan.shot.i}:${m.snare.k}`, { n: 1, modes: ['accent'], w: [1, 3], h: [1, 2] }) : []),
    ]
    k.look.draw(f, {
      src: k.board.tex, rect, crop, mode, cell: rect.w < 900 ? 8 : 12,
      levels: [0.06, 0.85, 1.1], streak: m.glitch, blocks: plan.spec.trace ? [] : bl, split: 6 * m.kick.pulse, red: 1,
    })
  },
  ui(g, c) {
    const rect = frameRect(c)
    if (rect.w < c.k.W) {
      marks(g, { x: rect.x - 8, y: rect.y - 8, w: rect.w + 16, h: rect.h + 16 }, 14)
      text(g, c.f, `${c.plan.spec.clip!.toUpperCase()}  ${(c.m.lt).toFixed(2)}s`, rect.x, rect.y + rect.h + 30, { size: 14, color: GREY })
    }
  },
})
