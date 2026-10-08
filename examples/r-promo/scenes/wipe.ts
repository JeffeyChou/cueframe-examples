import { cue, scene } from '@cueframe/core'
import { C, el, inOutCubic, seg } from '../lib.js'

const COLORS = [C.ink, C.pink, C.yellow, C.purple, C.cyan, C.ink, C.pink]

// Diagonal comic wipe that covers every scene cut.
export default scene({
  id: 'wipe',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    const band = el(ctx.root, { left: '50%', top: '50%', width: '1500px', height: '3200px', borderLeft: `28px solid ${C.ink}`, borderRight: `28px solid ${C.ink}` })
    const ids = ['fail', 'stop', 'isolate', 'deploy', 'perks', 'compare', 'cta']
    return { band, cuts: ids.map((id) => ctx.data.cue(`scene.${id}.start`)) }
  },
  render(f, s) {
    const k = s.cuts.findIndex((b) => Math.abs(f.t - b) < 0.2)
    s.band.style.visibility = k < 0 || f.hold ? 'hidden' : ''
    if (k < 0) return
    const x = -2200 + 4400 * seg(f.t, s.cuts[k]! - 0.2, s.cuts[k]! + 0.2, inOutCubic)
    s.band.style.background = COLORS[k]!
    s.band.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(1)}px) rotate(14deg)`
  },
})
