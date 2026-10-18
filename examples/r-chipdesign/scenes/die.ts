// c7 → h1: the whole chip in 3D behind the ladder. The plate (blender/die.py) is placed on the
// narration: wide while the cores are put together, the push from "整颗芯片" to the card, and a slow drift under
// chapter 03's card, fading out as h1 begins. Re-recording a line moves these; nothing renders again.
import { cue, scene, type Plate } from '@cueframe/core'
import { C, said, seg, start } from '../lib.js'
// Imported so that `pnpm check` reports a clone without the render as not built.
import manifest from '../build/plates/die/manifest.json'

const CARD = 3

export default scene({
  id: 'die',
  at: cue('scene.c7.start'),
  end: cue('scene.h1.start', { offset: 1.5 }),
  async mount(ctx) {
    if (!manifest.variants.final) ctx.warn('plate die: no final render yet; make.sh renders it')
    const plate: Plate = await ctx.plate('build/plates/die', {
      timing: [
        { at: start('c7'), hold: 'push' },                           // the wide view, where the push starts
        { at: said(ctx, 'c7', '整颗芯片'), play: 'push', fit: true },   // in by the time the card comes
        { at: start('h1') - 0.25 - CARD, play: 'drift', fit: true },
      ],
      blend: true,
    })
    const shade = document.createElement('div')
    Object.assign(shade.style, { position: 'absolute', inset: '0', background: `radial-gradient(70% 70% at 60% 55%, transparent 40%, ${C.bg} 100%)` })
    ctx.root.append(shade)
    return { plate, t0: start('c7'), t1: start('h1') + 1.5 }
  },
  render(f, s) {
    // The plate sits back behind the overlay: in over a second, out as h1 begins.
    const k = seg(f.t, s.t0, s.t0 + 1.2) * (1 - seg(f.t, s.t1 - 1.5, s.t1))
    s.plate.layer.style.opacity = (0.55 * k).toFixed(4)
  },
})
