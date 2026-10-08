import { cue, scene } from '@cueframe/core'
import { AGENTS, ARROW, C, MONO, agent, backdrop, browser, caret, el, lerp, outCubic, popAt, put, seg, slamAt, sticker, typed } from '../lib.js'

const Q = 'obscura-gateway'
const STAR = (fill: string) => `<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-0.12em"><path d="M12 1.8l3.1 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1L1.7 9.2l7.2-.8z" fill="${fill}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/></svg>`

// GitHub search → repo card → Star click, three happy agents with their own browsers.
export default scene({
  id: 'cta',
  at: cue('scene.cta.start'),
  end: cue('scene.cta.end'),
  holds: [{ id: 'cover', at: 4.5 }],
  mount(ctx) {
    const bg = backdrop(ctx.root, C.pink)
    const brand = sticker(ctx.root, 'Obscura Gateway', { size: 74, bg: C.ink, fg: C.lit })
    brand.style.fontFamily = MONO
    const search = el(ctx.root, { width: '900px', height: '120px', background: '#fff', border: `7px solid ${C.ink}`, borderRadius: '60px', boxShadow: `10px 10px 0 ${C.ink}`,
      fontFamily: MONO, fontWeight: '800', fontSize: '50px', lineHeight: '106px', paddingLeft: '200px', boxSizing: 'border-box' })
    el(search, { left: '34px', top: '22px', width: '150px', fontFamily: MONO, fontSize: '30px', lineHeight: '62px', background: C.ink, color: '#fff', borderRadius: '31px', textAlign: 'center' }, 'GitHub')
    const q = el(search, { position: 'relative' })
    const card = el(ctx.root, { width: '900px', height: '300px', background: '#fff', border: `7px solid ${C.ink}`, borderRadius: '26px', boxShadow: `12px 12px 0 ${C.ink}` })
    el(card, { left: '44px', top: '40px', fontFamily: MONO, fontWeight: '800', fontSize: '46px', color: '#2f6fe0' }, Q)
    el(card, { left: '44px', top: '118px', fontSize: '38px', fontWeight: '700', color: '#444' }, '每个 Agent 一个独立浏览器')
    const btn = el(card, { left: 'auto', right: '40px', top: 'auto', bottom: '34px', fontSize: '44px', fontWeight: '900', padding: '10px 34px', border: `6px solid ${C.ink}`,
      borderRadius: '18px', fontFamily: MONO })
    const cursor = el(ctx.root, { color: '#fff' }, ARROW)
    const rays = el(ctx.root, { width: '900px', height: '900px', background: 'repeating-conic-gradient(rgba(255,225,77,.9) 0 6deg, transparent 6deg 24deg)', borderRadius: '50%',
      WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 70%)' })
    const wins = AGENTS.map((a) => browser(ctx.root, 230, 170, a.id, a.color))
    const bots = AGENTS.map((a) => agent(ctx.root, a, 190))
    const big = el(ctx.root, { fontSize: '300px' }, STAR(C.lit))
    return { bg, brand, search, q, card, btn, cursor, big, rays, wins, bots }
  },
  render(f, s) {
    const t = f.t, gh = f.cue('cta.gh'), star = f.cue('cta.star'), t0 = f.cue('scene.cta.start')
    s.bg(f)
    const bp = slamAt(t, t0 + 0.05, 0.25, 1.8)
    put(s.brand, 540, 220, bp.s, -3, bp.o)
    const sp = popAt(t, gh - 0.15, 0.35)
    put(s.search, 540, 420, sp.s, 0, sp.o)
    const n = typed(t, gh + 0.35, Q.length, 20)
    s.q.innerHTML = `${Q.slice(0, n)}<span style="color:${C.pink}">${n < Q.length || caret(t, 3) ? '▌' : ''}</span>`
    const cp = popAt(t, gh + 1.2, 0.4)
    put(s.card, 540, 700, cp.s, 1, cp.o)
    const on = t >= star
    s.btn.innerHTML = `${STAR(on ? C.pink : '#fff')} ${on ? 'Starred' : 'Star'}`
    s.btn.style.background = on ? C.lit : '#f2f2f2'
    s.btn.style.transform = `scale(${(t >= star - 0.08 && t < star ? 0.9 : 1 + 0.15 * Math.max(0, 1 - (t - star) / 0.3) * (on ? 1 : 0)).toFixed(3)})`
    const m = outCubic(seg(t, star - 0.7, star - 0.1))
    put(s.cursor, lerp(300, 880, m), lerp(1150, 820, m), t >= star - 0.08 && t < star + 0.1 ? 0.85 : 1, 0, seg(t, star - 0.9, star - 0.7))
    const bg = popAt(t, star, 0.45)
    put(s.big, 540, 960, bg.s * (1 - 0.6 * seg(t, star + 0.6, star + 1)), 20 * (t - star), bg.o * (1 - seg(t, star + 0.6, star + 1)))
    put(s.rays, 540, 1020, 1 + 0.3 * seg(t, star, star + 1), t * 40, on ? 1 - seg(t, star + 0.6, star + 1.2) : 0)
    const xs = [200, 540, 880]
    const jump = (i: number) => (Number.isNaN(f.beatPhase) ? 0 : Math.abs(Math.sin(Math.PI * ((f.beat + i * 0.33) % 1)))) * (on ? 40 : 14)
    s.wins.forEach((b, i) => put(b.win, xs[i]!, 1010 - jump(i), 1, (i - 1) * 4, popAt(t, t0 + 0.2 + i * 0.1).o))
    s.bots.forEach((d, i) => d({ x: xs[i]!, y: 1250 - jump(i), mood: on ? 'happy' : 'smug', arms: on ? 1 : 0.4, r: on ? 6 * Math.sin(t * 9 + i) : 0, o: popAt(t, t0 + 0.2 + i * 0.1).o }))
  },
})
