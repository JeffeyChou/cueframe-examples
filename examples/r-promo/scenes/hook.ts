import { cue, scene } from '@cueframe/core'
import { AGENTS, C, agent, backdrop, bob, browser, burst, el, jolt, lerp, outBack, popAt, put, seg, skeleton, slamAt, sticker } from '../lib.js'

// Three agents, one browser: they pop in, lunge, and a fight breaks out around the window.
export default scene({
  id: 'hook',
  at: cue('scene.hook.start'),
  end: cue('scene.hook.end'),
  mount(ctx) {
    const bg = backdrop(ctx.root, C.yellow)
    const tag = sticker(ctx.root, 'OBSCURA GATEWAY', { size: 34, bg: C.ink, fg: C.lit, pad: '8px 22px' })
    tag.style.fontFamily = '"JBM"'
    const title = sticker(ctx.root, '浏览器<span style="color:#ff4f8b">争夺战</span>！', { size: 104, pad: '10px 40px' })
    const b = browser(ctx.root, 680, 480, 'about:blank')
    skeleton(b.body, 680, 6)
    const one = sticker(ctx.root, '×1', { size: 72, bg: C.red, fg: '#fff', pad: '0 22px' })
    const bots = AGENTS.map((a) => agent(ctx.root, a, 260))
    const pows = ['POW!', 'BAM!', '咚!'].map((t, i) => burst(ctx.root, t, [C.lit, C.cyan, C.pink][i], 230))
    const q = el(ctx.root, { fontSize: '260px', fontWeight: '900', color: C.pink, textShadow: `8px 8px 0 ${C.ink}`, WebkitTextStroke: `6px ${C.ink}` }, '?!')
    return { bg, tag, title, b, one, bots, pows, q }
  },
  render(f, s) {
    const t = f.t, one = f.cue('hook.one'), what = f.cue('hook.what')
    s.bg(f)
    put(s.tag, 540, 196, 1, -3)
    put(s.title, 540, 300, 1 + 0.02 * Math.sin(t * 5), -3 + Math.sin(t * 3))
    const fight = seg(t, one + 0.2, one + 0.35)
    const sh = jolt(t, one, 22, 0.5)
    const tug = fight * (1 - seg(t, what, what + 0.2)) * 7 * Math.sin(t * 30)
    const sl = slamAt(t, one - 0.08, 0.26, 1.5)
    put(s.b.win, 540 + sh.x, 820 + sh.y, t < one - 0.08 ? 0.82 : sl.s, sh.rot + tug, 1)
    const o1 = popAt(t, one + 0.05, 0.35)
    put(s.one, 850, 600, o1.s, 12, o1.o)
    const home = [[180, 1230], [900, 1230], [540, 1300]] as const
    const lunge = [[300, 1060], [780, 1060], [540, 1140]] as const
    s.bots.forEach((draw, i) => {
      const hop = Math.sin(Math.PI * seg(t, [0.21, 0.5, 0.78][i]!, [0.21, 0.5, 0.78][i]! + 0.3)) * 70
      const k = outBack(seg(t, one + 0.05, one + 0.3), 2)
      const j = fight * 10 * Math.sin(t * 40 + i * 2)
      const x = lerp(home[i]![0], lunge[i]![0], k) + j
      const y = lerp(home[i]![1], lunge[i]![1], k) + bob(t, i * 0.6, 8) * (1 - fight) - hop
      const mood = t >= what ? 'shock' : t >= one ? 'angry' : i === 2 ? 'smug' : 'happy'
      draw({ x, y, r: (i === 0 ? 1 : i === 1 ? -1 : 0) * 10 * k, mood, arms: t >= one ? 0.8 + 0.2 * Math.sin(t * 36 + i) : 0.15 })
    })
    const spots = [[260, 860], [820, 980], [540, 1000]] as const
    s.pows.forEach((e, i) => {
      const at = one + 0.35 + 0.2 * i
      const p = popAt(t, at, 0.22)
      put(e, spots[i]![0], spots[i]![1], p.s * (t > what ? 1 - seg(t, what, what + 0.2) : 1), -12 + i * 14, p.o)
    })
    const qp = slamAt(t, what, 0.22, 2.4)
    put(s.q, 210, 560, qp.s, -10, qp.o)
  },
})
