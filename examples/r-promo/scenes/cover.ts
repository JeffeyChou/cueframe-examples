import { cue, scene } from '@cueframe/core'
import { AGENTS, C, MONO, agent, backdrop, browser, burst, el, put, skeleton, sticker } from '../lib.js'

// Cover art, shown only during the `cover` hold (stills --holds cover); adapts to 9:16 and 3:4.
export default scene({
  id: 'cover',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    const box = el(ctx.root, { width: '100%', height: '100%' })
    const bg = backdrop(box, C.yellow)
    const b = browser(box, 520, 380, 'about:blank')
    skeleton(b.body, 520, 4)
    const bots = AGENTS.map((a) => agent(box, a, 250))
    const pow = burst(box, 'POW!', C.cyan, 230)
    const l1 = sticker(box, '3 个 AI Agent', { size: 88 })
    const l2 = sticker(box, '抢 <span style="color:#ff4f8b">1</span> 个浏览器？！', { size: 98, bg: C.lit })
    const chip = sticker(box, '每个 Agent 一个独立浏览器', { size: 50, bg: C.green, pad: '10px 28px' })
    const brand = sticker(box, 'Obscura Gateway', { size: 70, bg: C.ink, fg: C.lit })
    brand.style.fontFamily = MONO
    return { box, bg, b, bots, pow, l1, l2, chip, brand }
  },
  render(f, s) {
    const on = f.hold === 'cover'
    s.box.style.visibility = on ? '' : 'hidden'
    if (!on) return
    const h = f.stage.h, k = h / 1920
    s.bg(f)
    put(s.l1, 540, 250 * k + 20, 1, -4)
    put(s.l2, 540, 250 * k + 185, 1, 2)
    put(s.b.win, 540, h * 0.52, k < 0.9 ? 0.8 : 1, -4)
    put(s.pow, 820, h * 0.43, k < 0.9 ? 0.8 : 1, 12)
    const y = h * 0.52 + (k < 0.9 ? 150 : 250)
    s.bots[0]!({ x: 170, y, r: 12, mood: 'angry', arms: 0.9, s: k < 0.9 ? 0.85 : 1 })
    s.bots[1]!({ x: 910, y, r: -12, mood: 'angry', arms: 0.9, s: k < 0.9 ? 0.85 : 1 })
    s.bots[2]!({ x: 540, y: y + 60 * k, mood: 'shock', arms: 0.7, s: k < 0.9 ? 0.85 : 1 })
    put(s.chip, 540, h - 380 * k - 40, 1, -2)
    put(s.brand, 540, h - 230 * k - 30, 1, 2)
  },
})
