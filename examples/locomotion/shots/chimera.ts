// VI CHIMERA: the sum. The red car in profile in the dark studio; every two beats one borrowed
// feature lands on it as its trace, with the animal it came from in a thumbnail below and a leader
// line between them: the measure (horse), the haunch (cheetah), the face (eagle), the skin (shark),
// the air (dragonfly).
import { BEAT } from '../edit.js'
import { clipFrame, type Kit } from '../lib/kit.js'
import { cover, type Rect } from '../lib/look.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { drawTrace, type Poly } from '../lib/trace.js'
import { GREY, INK, RED, text } from '../lib/ui.js'
import { carStage, carTrace, renderCar, type CarStage } from './car.js'
import { flowLines } from './windtunnel.js'
import { paintMuy } from './plate.js'

interface Layer { label: string; latin: string; clip?: string; frame?: number; focus: [number, number, number]; trace: string }
const LAYERS: Layer[] = [
  { label: 'THE MEASURE', latin: 'EQUUS', focus: [0.5, 0.5, 1], trace: 'measure' },
  { label: 'THE HAUNCH', latin: 'ACINONYX', clip: 'cheetah-hunt', frame: 20, focus: [0.47, 0.57, 2.4], trace: 'spine' },
  { label: 'THE FACE', latin: 'AQUILA', clip: 'eagle-eye', frame: 40, focus: [0.48, 0.39, 1.6], trace: 'eye' },
  { label: 'THE SKIN', latin: 'SQUALUS', clip: 'shark', frame: 50, focus: [0.5, 0.56, 1.1], trace: 'body' },
  { label: 'THE AIR', latin: 'ANISOPTERA', clip: 'dragonfly-pollen', frame: 60, focus: [0.5, 0.45, 1.3], trace: 'flow' },
]

const shown = (c: ShotCtx) => Math.min(LAYERS.length, Math.floor(c.m.beats / 2) + 1)

function slots(k: Kit): Rect[] {
  const w = 256, h = 144, gap = 40, y = k.H - 330
  const x0 = (k.W - LAYERS.length * w - (LAYERS.length - 1) * gap) / 2
  return LAYERS.map((_, i) => ({ x: x0 + i * (w + gap), y, w, h }))
}

function traceOf(c: ShotCtx, cs: CarStage, l: Layer): Poly[] {
  const { k, m } = c
  if (l.trace === 'flow') return flowLines(k, k.models.car.meshes, cs.cam, false).slice(1, 5)
  if (l.trace === 'measure') {
    // the measure: the wheelbase as a dimension line under the car
    const [top] = carTrace(k, cs, 'body', 'side', m.lt) ?? [[]]
    const y = Math.max(...(top ?? []).map((p) => p[1])) + 34
    const xs = (top ?? []).map((p) => p[0])
    return [[[Math.min(...xs), y], [Math.max(...xs), y]]]
  }
  return carTrace(k, cs, l.trace, 'side', m.lt) ?? []
}

export default defineShot({
  mount: (k): CarStage => carStage(k),
  loads: (c) => LAYERS.filter((l) => l.clip).map((l) => [l.clip!, l.frame!] as [string, number]),
  draw(c, cs) {
    const { k, f, m } = c
    const tex = renderCar(c, cs, 'side', { dark: true })
    k.look.draw(f, { src: tex, mode: 'print', levels: [0, 0.9, 1.05], colour: 1, exposure: 1.2, streak: m.glitch })
    // the thumbnails: the animal each feature came from
    const S = slots(k)
    const n = shown(c)
    LAYERS.forEach((l, i) => {
      if (i >= n) return
      const b = { x: i * 384, y: 0, w: 380, h: 214 }
      if (l.clip) {
        const s = k.clips[l.clip]!
        const cr = cover(s.w / s.h, b.w / b.h, l.focus[0], l.focus[1], l.focus[2])
        k.board.g.drawImage(s.image(l.frame!), cr.x * s.w, cr.y * s.h, cr.w * s.w, cr.h * s.h, b.x, b.y, b.w, b.h)
      } else paintMuy(k, Math.floor(f.t / BEAT * 11) % 11, b)
      k.board.upload()
      const age = m.beats - i * 2
      k.look.draw(f, { src: k.board.tex, rect: S[i]!, crop: k.board.rect(b), mode: age < 0.25 ? 'matrix' : 'clean', cell: 6, red: 1, levels: [0.05, 0.9, 1.1] })
    })
  },
  ui(g, c, cs) {
    const { f, k, m } = c
    const S = slots(k)
    const n = shown(c)
    LAYERS.forEach((l, i) => {
      if (i >= n) return
      const age = m.beats - i * 2
      const on = Math.min(1, age / 1.2)
      const lines = traceOf(c, cs, l)
      const colour = l.trace === 'flow' ? 'rgba(242,242,238,0.7)' : l.trace === 'body' ? INK : RED
      drawTrace(g, f, lines, { on, color: colour, width: l.trace === 'body' ? 1.5 : 2.5, nodes: l.trace === 'flow' ? 999 : 8, dash: l.trace === 'flow' ? f.t * 420 : undefined })
      // leader from the thumbnail to the trace
      const r = S[i]!
      const tgt = lines[0]?.[Math.floor((lines[0]!.length - 1) * (0.2 + 0.15 * i))]
      if (tgt && on > 0.3) {
        g.strokeStyle = 'rgba(255,42,58,0.6)'
        g.lineWidth = 1
        g.beginPath(); g.moveTo(r.x + r.w / 2, r.y); g.lineTo(r.x + r.w / 2, r.y - 30); g.lineTo(tgt[0], tgt[1]); g.stroke()
      }
      text(g, f, l.label, r.x, r.y + r.h + 26, { size: 14, color: i === n - 1 ? RED : INK })
      text(g, f, l.latin, r.x, r.y + r.h + 46, { size: 12, color: GREY })
    })
  },
})
