import { cue, scene } from '@cueframe/core'
import { AGENTS, C, MONO, agent, backdrop, browser, burst, el, fly, jolt, lerp, outBack, outCubic, popAt, put, seg, slamAt, sticker, stamp } from '../lib.js'

const XS = [190, 540, 890]
const COOKIE = `<svg viewBox="0 0 40 40" width="74" height="74"><circle cx="20" cy="20" r="17" fill="#d99a4e" stroke="#141414" stroke-width="3"/><circle cx="13" cy="14" r="3" fill="#5a3311"/><circle cx="25" cy="12" r="2.4" fill="#5a3311"/><circle cx="24" cy="25" r="3" fill="#5a3311"/><circle cx="13" cy="26" r="2.2" fill="#5a3311"/></svg>`

// One address fans out to one browser per agent; cookies stay home; a token gets revoked.
export default scene({
  id: 'isolate',
  at: cue('scene.isolate.start'),
  end: cue('scene.isolate.end'),
  mount(ctx) {
    const bg = backdrop(ctx.root, C.mint)
    const wires = el(ctx.root, { width: '1080px', height: '1920px' },
      `<svg width="1080" height="1920">${XS.map((x) => `<path d="M540 330C540 460 ${x} 440 ${x} 560" stroke="#141414" stroke-width="10" fill="none" stroke-linecap="round"/>`).join('')}</svg>`)
    const paths = [...wires.querySelectorAll('path')]
    const addr = sticker(ctx.root, '<span style="color:#7c5cff">https://</span>gw.example.com', { size: 46, pad: '14px 34px' })
    addr.style.fontFamily = MONO
    const wins = AGENTS.map((a) => browser(ctx.root, 300, 320, `#${a.id}`, a.color))
    const bots = AGENTS.map((a, i) => agent(wins[i]!.body, a, 150))
    const cookies = AGENTS.map((_, i) => el(wins[i]!.body, {}, COOKIE))
    const flyer = el(ctx.root, {}, COOKIE)
    const bonk = burst(ctx.root, 'BONK', C.lit, 170)
    const tokens = AGENTS.map((a, i) => {
      const card = el(ctx.root, { width: '290px', height: '250px' })
      el(card, { left: '45px', top: '0', width: '200px', height: '130px', background: '#2b2b3a', border: `6px solid ${C.ink}`, borderRadius: '14px' },
        `<div style="position:absolute;inset:14px;background:${a.color};border-radius:6px"></div>`)
      el(card, { left: '20px', top: '130px', width: '250px', height: '22px', background: '#b9b9c6', border: `6px solid ${C.ink}`, borderRadius: '0 0 18px 18px' })
      const tk = el(card, { left: '10px', top: '176px', width: '270px', height: '70px', background: C.lit, border: `5px solid ${C.ink}`, borderRadius: '12px',
        fontFamily: MONO, fontWeight: '800', fontSize: '28px', lineHeight: '60px', textAlign: 'center', boxSizing: 'border-box' }, `TOKEN ${['a1f3', 'b7c2', 'c9d4'][i]}`)
      return { card, tk }
    })
    const st = stamp(ctx.root, '已吊销<div style="font-size:34px;letter-spacing:8px;text-align:center;font-family:JBM">REVOKED</div>', C.red, 92)
    return { bg, paths, addr, wins, bots, cookies, flyer, bonk, tokens, st }
  },
  render(f, s) {
    const t = f.t, c = (n: string) => f.cue(n)
    const [addrT, own, cookieT, token, revoke] = ['iso.addr', 'iso.own', 'iso.cookie', 'iso.token', 'iso.revoke'].map(c) as number[]
    const each = f.words({ text: '每', line: 'isolate' }).start
    const cookieIn = f.words({ text: 'Cookie', line: 'isolate' }).start
    const machine = f.words({ text: '机器', line: 'isolate' }).start - 0.3
    s.bg(f)
    const ap = slamAt(t, addrT - 0.1, 0.25, 1.8)
    const lift = outCubic(seg(t, machine, machine + 0.5))
    put(s.addr, 540, lerp(280, 230, lift), ap.s, -2, ap.o)
    s.paths.forEach((p, i) => {
      const k = seg(t, each + 0.1 * i, each + 0.4 + 0.1 * i)
      const cut = i === 1 && t >= revoke
      p.style.strokeDasharray = cut ? '18 22' : '600'
      p.style.strokeDashoffset = cut ? '0' : String(600 * (1 - k))
      p.style.stroke = cut ? C.red : C.ink
    })
    s.wins.forEach((b, i) => {
      const k = fly(t, each + 0.1 + 0.12 * i)
      const y = lerp(720, 640, lift)
      put(b.win, XS[i]!, lerp(1400, y, k), lerp(0.4, 1, k) * lerp(1, 0.86, lift), (i - 1) * 3, k > 0 ? 1 : 0)
      b.win.style.filter = i === 1 && t >= revoke ? 'grayscale(1) brightness(.8)' : 'none'
      const off = i === 1 && t >= revoke
      s.bots[i]!({ x: 150, y: 130, s: 1, mood: off ? 'dead' : i === 0 && t >= cookieT && t < cookieT + 0.8 ? 'shock' : 'happy', arms: 0.2 })
      const cp = popAt(t, cookieIn + 0.08 * i, 0.3)
      put(s.cookies[i]!, 245, 200, cp.s, 0, i === 0 ? 0 : cp.o)
    })
    // A's cookie tries to visit B and bonks off the wall between windows
    const go = seg(t, cookieIn + 0.1, cookieT)
    const back = outBack(seg(t, cookieT, cookieT + 0.5), 1.2)
    const fx = lerp(lerp(XS[0]! + 95, 365, go), XS[0]! + 95, back)
    const fy = 720 + 70 - 140 * Math.sin(Math.PI * go) * (1 - back)
    put(s.flyer, fx, lerp(fy, fy - 80, lift), 1 - 0.14 * lift, t * 400 * (1 - back), t >= cookieIn ? 1 : 0)
    const bp = popAt(t, cookieT, 0.25)
    put(s.bonk, 365, 560, bp.s, -10, bp.o * (1 - seg(t, cookieT + 0.7, cookieT + 0.9)))
    s.tokens.forEach((o, i) => {
      const k = fly(t, machine + 0.15 * i, 0.45)
      const sh = i === 1 ? jolt(t, revoke, 20, 0.4) : { x: 0, y: 0, rot: 0 }
      put(o.card, XS[i]! + sh.x, lerp(1700, 1110, k) + sh.y, 0.92, sh.rot, k > 0 ? 1 : 0)
      const tp = popAt(t, token + 0.08 * i, 0.3)
      o.tk.style.transform = `scale(${tp.s.toFixed(3)})`
      o.tk.style.opacity = String(tp.o)
      o.tk.style.filter = i === 1 && t >= revoke ? 'grayscale(1)' : 'none'
    })
    const sp = slamAt(t, revoke, 0.2, 3)
    put(s.st, 540, 1130, sp.s * 0.9, -14, sp.o)
  },
})
