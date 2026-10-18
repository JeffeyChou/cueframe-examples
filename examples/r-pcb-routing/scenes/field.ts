// One rider routes a bus between stones; the camera pulls back, the frame splits on the beat into
// ten panels (one per layer, each its own routing world), and the panels become the ten layer tiles.
// cueframe: one scene with one canvas, because each panel is a whole sub-animation with its own
// clock; CueFrame has no nested composition to instance, so the worlds are drawn by hand per rect.
import { cue, scene } from '@cueframe/core'
import type { MountContext } from '@cueframe/core'
import {
  ART_H, ART_W, BEAT, C, LAYERS, MONO, W, H, drawWorld, el, grid, layerArt, lerpRect, onBeat, outBack, inOutCubic,
  said, seg, sprite, start, tiles, world, type Rect, type World,
} from '../lib.js'

const COUNTS = [1, 2, 4, 8, 10]

export default scene({
  id: 'field',
  at: 0,
  end: cue('scene.k1.start'),
  mount(ctx: MountContext) {
    el(ctx.root, 'div', { inset: '0', background: C.bg })
    const g = ctx.canvas('field')
    const t0 = said(ctx, 'r1', '出发')
    // Panel worlds: the hero (F.Cu) starts on "出发"; the others are already under way when they appear.
    const worlds: World[] = LAYERS.map((L, i) => world(L.seed, L.color, L.hat, { t0: i === 0 ? t0 : t0 - 2 - i * 0.7, speed: 260 - (i % 3) * 20 }))
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
    return { g, worlds, sp, zoomOut, toTiles, reveal, labels, arts }
  },
  render(f, s) {
    const g = s.g
    g.clearRect(0, 0, W, H)
    const t = f.t
    // Which split stage, and how far through its move.
    let k = 0
    while (k + 1 < s.sp.length && t >= s.sp[k + 1]!) k++
    const move = k > 0 ? seg(t, s.sp[k]!, s.sp[k]! + 0.42, (x) => outBack(x, 1.3)) : 1
    const n = COUNTS[k]!, prev = COUNTS[Math.max(0, k - 1)]!
    const to = grid(n, n > 1 ? 4 : 0), from = grid(prev, prev > 1 ? 4 : 0)
    const tileK = seg(t, s.toTiles, s.toTiles + 0.9, inOutCubic)
    const tl = tiles()
    const zoom0 = 1 - 0.45 * seg(t, s.zoomOut[0]!, s.zoomOut[1]!, inOutCubic)
    for (let i = 0; i < n; i++) {
      // A new panel grows out of the one it split from (i - prev); old panels move to their new cell.
      const a = i < prev ? from[i]! : from[i - prev]!
      let r: Rect = lerpRect(a, to[i]!, move)
      if (tileK > 0) r = lerpRect(r, tl[i]!, tileK)
      const z = zoom0 * Math.pow(r.h / H, 0.55)
      const px = Math.max(3, Math.round(7 * Math.pow(r.h / H, 0.35)))
      drawWorld(g, s.worlds[i]!, t, r, z, px)
      // The layer's copper fades in over the world when it is named; the rider stays on top.
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
      // cueframe: a 2D context keeps its state between frames, and lineWidth = 0 is silently ignored,
      // so a "no border" frame drawn after a bordered one used to stroke anyway (determinism FAIL).
      if (n > 1 || tileK > 0) { g.strokeStyle = C.gold; g.lineWidth = 2; g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2) }
      const lab = s.labels[i]!
      lab.style.left = `${r.x + 10}px`; lab.style.top = `${r.y + r.h + 6}px`
      // cueframe: fading text by element opacity differed by render order (determinism FAIL, ≤11 levels);
      // fading the colour's alpha does not.
      const la = Math.min(tileK, seg(t, s.reveal[i]!, s.reveal[i]! + 0.3))
      lab.style.color = `rgba(238,241,246,${la.toFixed(3)})`
      lab.style.visibility = la > 0 ? 'visible' : 'hidden'   // audit reads a transparent colour as visible text
    }
    for (let i = n; i < 10; i++) s.labels[i]!.style.visibility = 'hidden'
  },
})
