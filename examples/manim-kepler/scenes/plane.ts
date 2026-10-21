// The faint coordinate plane under the flat shots. Its grid is the 3D grid seen from above.
import { cue, scene } from '@cueframe/core'
import { plane } from '../lib/manim.js'
import { CUES, fade } from '../lib.js'
import { ORIGIN } from '../world3d.js'

const IN = CUES['scene.i1.start']! - 0.4
const OUT = CUES['scene.m1.start']! + 1.6

export default scene({
  id: 'plane',
  at: cue('scene.i1.start', { offset: -0.4 }),
  end: cue('scene.m1.start', { offset: 1.6 }),
  mount(ctx) {
    const p = plane(ctx.root, ctx.stage, { step: 60, major: 4, origin: ORIGIN })
    return { p }
  },
  render(f, s) {
    s.p.svg.style.opacity = String(fade(f.t, IN, OUT, 0.8))
  },
})
