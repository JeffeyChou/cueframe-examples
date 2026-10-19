// One rider routes a bus between stones; the camera pulls back, the frame splits on the beat into
// ten panels (one per layer, each its own routing world), and the panels become the ten layer tiles.
// Each panel is an instance of the `ride` composition on its own clock (it appears on its split beat);
// the field moves the instances' rects and draws the copper, borders and labels over them.
import { clock, cue, scene } from '@cueframe/core'
import type { MountContext } from '@cueframe/core'
import {
  ART_H, ART_W, BEAT, C, LAYERS, MONO, W, H, el, grid, layerArt, lerpRect, onBeat, outBack, inOutCubic,
  said, seg, sprite, tiles, type Rect,
} from '../lib.js'
import { ride } from './ride.js'

const COUNTS = [1, 2, 4, 8, 10]

export default scene({
  id: 'field',
  at: 0,
  end: cue('scene.k1.start'),
  mount(ctx: MountContext) {
    el(ctx.root, 'div', { inset: '0', background: C.bg })
    const t0 = said(ctx, 'r1', '出发')
    // Splits land on the beat after the words that ask for them.
    const sp = [
      0,
      onBeat(said(ctx, 's1', '不止')),
      onBeat(said(ctx, 's2', '每一层')),
      onBeat(said(ctx, 's2', '每一层')) + 2 * BEAT,
      onBeat(said(ctx, 's2', '布线')),
    ]
    const zoomOut = [said(ctx, 's1', '镜头'), said(ctx, 's1', '拉远', { end: true }) + 0.4]
    const toTiles = said(ctx, 's3', '顶层') - 0.35
    // A tile shows its copper when the narration names its kind of layer; "十层" names the rest.
    const named = {
      top: said(ctx, 's3', '顶层'), inner: said(ctx, 's3', '内层'), pwr: said(ctx, 's3', '电源层'),
      gnd: said(ctx, 's3', '地层'), all: said(ctx, 's3', '十层'),
    }
    const reveal = LAYERS.map((L, i) => i === 0 ? named.top : i === 9 ? named.all : L.kind === 'pwr' ? named.pwr : L.kind === 'gnd' ? named.gnd : named.inner)
    const labels = LAYERS.map((L, i) => {
      const d = el(ctx.root, 'div', { font: `600 22px ${MONO}`, color: 'rgba(238,241,246,0)', letterSpacing: '0.04em', visibility: 'hidden' }, L.name)
      d.dataset.i = String(i)
      return d
    })
    const arts = LAYERS.map(layerArt)
    const toTilesK = (t: number) => seg(t, toTiles, toTiles + 0.9, inOutCubic)
    const st = { sp, toTiles, toTilesK }
    // Panel i: the hero (F.Cu) is there from the start and leaves its pins on "出发"; the others are
    // already under way when they split off. Each appears on the split that first shows it.
    const panels = LAYERS.map((_, i) => {
      const k = COUNTS.findIndex((n) => n > i)
      const tStart = i === 0 ? t0 : t0 - 2 - i * 0.7
      const shown = sp[k]!
      return ctx.comp(ride, {
        id: `p${i}`,
        params: { i, ...(i === 0 ? { zoomOut: [zoomOut[0]! - tStart, zoomOut[1]! - tStart] as [number, number] } : {}) },
        time: clock.segments([{ from: shown, to: 999, clock: clock.offset(tStart) }]),
        rect: (f) => panelRect(st, i, f.t),
        fit: 'cover',
        outside: 'clamp',            // before its clock starts the world waits at its beginning
      })
    })
    const g = ctx.canvas('over', { frame: true })
    return { g, st, panels, reveal, labels, arts }
  },
  render(f, s) {
    const g = s.g
    const t = f.t
    const k = stageAt(s.st, t)
    const n = COUNTS[k]!
    const tileK = s.st.toTilesK(t)
    for (let i = 0; i < n; i++) {
      const r = panelRect(s.st, i, t)
      const px = Math.max(3, Math.round(7 * Math.pow(r.h / H, 0.35)))
      // The layer's copper fades in over the world when it is named; the rider sits on top.
      const art = seg(t, s.reveal[i]!, s.reveal[i]! + 0.5)
      if (art > 0) {
        g.save()
        g.globalAlpha = art
        g.translate(r.x + r.w / 2, r.y + r.h / 2); g.rotate(Math.PI / 2)
        const sc = r.h / ART_W
        g.drawImage(s.arts[i]!, (-ART_W * sc) / 2, (-ART_H * sc) / 2, ART_W * sc, ART_H * sc)
        g.restore()
        sprite(g, r.x + r.w / 2, r.y + r.h * 0.42, px, LAYERS[i]!.hat, t)
      }
      if (n > 1 || tileK > 0) { g.strokeStyle = C.gold; g.lineWidth = 2; g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2) }
      const lab = s.labels[i]!
      lab.style.left = `${r.x + 10}px`; lab.style.top = `${r.y + r.h + 6}px`
      const la = Math.min(tileK, seg(t, s.reveal[i]!, s.reveal[i]! + 0.3))
      lab.style.color = `rgba(238,241,246,${la.toFixed(3)})`
      lab.style.visibility = la > 0 ? 'visible' : 'hidden'   // audit reads a transparent colour as visible text
    }
    for (let i = n; i < 10; i++) s.labels[i]!.style.visibility = 'hidden'
  },
})

interface Split { sp: number[]; toTilesK: (t: number) => number }
/** Which split stage holds t. */
function stageAt(st: Split, t: number): number {
  let k = 0
  while (k + 1 < st.sp.length && t >= st.sp[k + 1]!) k++
  return k
}
/** Panel i's rect at t: grown out of the panel it split from, moved to its cell, then to its tile. */
function panelRect(st: Split, i: number, t: number): Rect {
  const k = stageAt(st, t)
  const move = k > 0 ? seg(t, st.sp[k]!, st.sp[k]! + 0.42, (x) => outBack(x, 1.3)) : 1
  const n = COUNTS[k]!, prev = COUNTS[Math.max(0, k - 1)]!
  const to = grid(n, n > 1 ? 4 : 0), from = grid(prev, prev > 1 ? 4 : 0)
  const j = Math.min(i, n - 1)
  const a = j < prev ? from[j]! : from[j - prev]!
  let r = lerpRect(a, to[j]!, move)
  const tileK = st.toTilesK(t)
  if (tileK > 0) r = lerpRect(r, tiles()[j]!, tileK)
  return r
}
