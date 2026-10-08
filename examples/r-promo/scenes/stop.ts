import { cue, scene } from '@cueframe/core'
import { AGENTS, C, agent, backdrop, bob, browser, el, flash, fly, jolt, lerp, outCubic, put, seg, skeleton, slamAt } from '../lib.js'

// A giant stop sign slams in, then three browsers are dealt out, one per agent.
export default scene({
  id: 'stop',
  at: cue('scene.stop.start'),
  end: cue('scene.stop.end'),
  mount(ctx) {
    const bg = backdrop(ctx.root, C.red)
    const sign = el(ctx.root, { width: '560px', height: '560px' },
      `<svg viewBox="0 0 100 100" width="100%" height="100%"><polygon points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30" fill="${C.red}" stroke="${C.ink}" stroke-width="4"/>
      <polygon points="32,8 68,8 92,32 92,68 68,92 32,92 8,68 8,32" fill="none" stroke="#fff" stroke-width="3.5"/>
      <text x="50" y="66" text-anchor="middle" font-family="Noto" font-weight="900" font-size="46" fill="#fff">停</text></svg>`)
    const wins = AGENTS.map((a) => { const b = browser(ctx.root, 300, 240, `agent-${a.id.toLowerCase()}`, a.color); skeleton(b.body, 300, 3, 22); return b })
    const bots = AGENTS.map((a) => agent(ctx.root, a, 200))
    const white = el(ctx.root, { width: '100%', height: '100%', background: '#fff' })
    return { bg, sign, wins, bots, white }
  },
  render(f, s) {
    const t = f.t, hit = f.cue('stop.stop'), give = f.cue('stop.give')
    s.bg(f)
    const sl = slamAt(t, hit, 0.22, 3)
    const sh = jolt(t, hit + 0.22, 30, 0.5, 9)
    const up = outCubic(seg(t, give - 0.3, give + 0.1))
    put(s.sign, 540 + sh.x, lerp(780, 380, up) + sh.y, sl.s * lerp(1, 0.5, up), sh.rot - 6 + 12 * up, sl.o)
    const w = flash(t, hit + 0.18, 0.12, 0.85)
    s.white.style.opacity = String(w)
    s.white.style.visibility = w > 0.01 ? '' : 'hidden'
    const xs = [190, 540, 890]
    s.wins.forEach((b, i) => {
      const at = give + i * 0.16
      const k = fly(t, at, 0.45)
      put(b.win, lerp(540, xs[i]!, k), lerp(1900, 860 + (i === 1 ? -40 : 0), k), lerp(0.3, 1, k), lerp(40, (i - 1) * 6, k), t >= at ? 1 : 0)
      const glad = t >= at + 0.2
      s.bots[i]!({ x: xs[i]!, y: 1210 + bob(t, i * 0.5, glad ? 18 : 6), mood: glad ? 'happy' : t >= hit ? 'shock' : 'dead', arms: glad ? 0.9 : 0.1, r: glad ? 4 * Math.sin(t * 8 + i) : 0 })
    })
  },
})
