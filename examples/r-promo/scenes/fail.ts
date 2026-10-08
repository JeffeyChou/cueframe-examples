import { cue, scene } from '@cueframe/core'
import { AGENTS, ARROW, C, MONO, agent, backdrop, bob, browser, burst, el, jolt, lerp, outCubic, popAt, put, seg, sticker } from '../lib.js'

const MOJI = ['锟斤拷锟斤拷烫烫烫', '屯屯屯锟斤拷##', '烫烫烫锟斤拷屯屯', '%$# 锟斤拷烫屯屯', '斤拷锟斤拷烫烫屯']

// Sharing one browser goes wrong three ways: a stolen login, a garbled PDF, a crash to black.
export default scene({
  id: 'fail',
  at: cue('scene.fail.start'),
  end: cue('scene.fail.end'),
  mount(ctx) {
    const bg = backdrop(ctx.root, C.cyan)
    const b = browser(ctx.root, 860, 700, 'mail.example.com/login')
    const avatar = el(b.bar, { left: 'auto', right: '18px', top: '8px', width: '44px', height: '44px', borderRadius: '50%', border: `4px solid ${C.ink}`,
      background: C.pink, fontFamily: MONO, fontWeight: '800', fontSize: '26px', lineHeight: '38px', textAlign: 'center' }, 'A')
    const login = el(b.body, { width: '100%', height: '100%' })
    el(login, { left: '50%', top: '70px', transform: 'translateX(-50%)', fontSize: '60px', fontWeight: '900' }, '登录')
    for (const [i, ph] of ['agent-a@mail', '••••••••'].entries()) {
      el(login, { left: '110px', top: `${180 + i * 110}px`, width: '640px', height: '80px', border: `5px solid ${C.ink}`, borderRadius: '18px',
        fontFamily: MONO, fontSize: '32px', lineHeight: '70px', padding: '0 24px', boxSizing: 'border-box', color: '#666' }, ph)
    }
    const btn = el(login, { left: '110px', top: '420px', width: '640px', height: '92px', borderRadius: '20px', border: `5px solid ${C.ink}`,
      fontSize: '44px', fontWeight: '900', textAlign: 'center', lineHeight: '82px', boxShadow: `6px 6px 0 ${C.ink}` }, '')
    const pdf = el(b.body, { width: '100%', height: '100%', background: '#f1eee6' })
    const page = el(pdf, { left: '110px', top: '36px', width: '640px', height: '560px', background: '#fff', border: `5px solid ${C.ink}`, boxSizing: 'border-box' })
    el(page, { left: 'auto', right: '-5px', top: '-5px', background: C.red, color: '#fff', fontFamily: MONO, fontWeight: '800', fontSize: '34px', padding: '4px 18px' }, 'PDF')
    const rows = MOJI.map((m, i) => el(page, { left: '36px', top: `${110 + i * 82}px`, fontSize: '44px', fontWeight: '700', color: C.ink }, m))
    const crack = el(b.win, { width: '100%', height: '100%' },
      `<svg viewBox="0 0 860 700" width="860" height="700"><path d="M430 300l-60-120-40-180M430 300l140-90 120-200M430 300l-170 60-260 30M430 300l40 160-50 240M430 300l200 110 230 40M370 180l-90-30M570 210l60 70M260 360l-40 120" stroke="${C.ink}" stroke-width="9" fill="none" stroke-linejoin="round"/></svg>`)
    const bots = AGENTS.map((a) => agent(ctx.root, a, 240))
    const cursor = el(ctx.root, { color: C.cyan }, ARROW)
    const tagB = sticker(ctx.root, 'A', { size: 40, bg: C.pink, pad: '0 14px' })
    tagB.style.fontFamily = MONO
    const huh = burst(ctx.root, '?!', '#fff', 230)
    const boom = burst(ctx.root, '崩!', C.red, 330)
    const dark = el(ctx.root, { width: '100%', height: '100%', background: '#050505' })
    const eyes = [0, 1, 2].map(() => el(ctx.root, {}, '<svg width="120" height="50"><ellipse cx="30" cy="25" rx="16" ry="20" fill="#fff"/><ellipse cx="90" cy="25" rx="16" ry="20" fill="#fff"/></svg>'))
    const dots = el(ctx.root, { color: '#fff', fontSize: '120px', fontWeight: '900', letterSpacing: '20px' }, '…')
    return { bg, b, avatar, login, btn, pdf, rows, crack, bots, cursor, tagB, huh, boom, dark, eyes, dots }
  },
  render(f, s) {
    const t = f.t, c = (n: string) => f.cue(n)
    const [login, steal, open, garble, crash, black] = ['fail.login', 'fail.steal', 'fail.pdf', 'fail.garble', 'fail.crash', 'fail.black'].map(c) as number[]
    const c0 = c('scene.fail.start')
    s.bg(f)
    const sh = jolt(t, crash, 34, 0.7, 5)
    const tilt = 6 * outCubic(seg(t, crash, crash + 0.3))
    const enter = popAt(t, c0 + 0.05, 0.35)
    put(s.b.win, 540 + sh.x, 720 + sh.y, enter.s, sh.rot + tilt, 1)
    const isPdf = t >= open - 0.15
    s.login.style.display = isPdf ? 'none' : 'block'
    s.pdf.style.display = isPdf ? 'block' : 'none'
    s.b.addr.textContent = isPdf ? 'file:///report.pdf' : t >= login ? 'mail.example.com/inbox' : 'mail.example.com/login'
    const ok = t >= login
    s.btn.textContent = ok ? '✓ 欢迎回来，A' : '登录'
    s.btn.style.background = ok ? C.green : C.lit
    const ap = popAt(t, login, 0.3)
    s.avatar.style.opacity = ok ? String(ap.o) : '0'
    s.avatar.style.transform = `scale(${ok ? ap.s.toFixed(3) : 0.6})`
    s.rows.forEach((r, i) => {
      const on = t >= garble + i * 0.08
      const g = f.rng(i + 1)
      r.style.visibility = t >= open + 0.2 ? '' : 'hidden'
      r.style.color = on ? [C.red, C.purple, C.ink][i % 3]! : '#bbb'
      r.style.transform = on ? `translate(${g.range(-8, 8).toFixed(1)}px, ${g.range(-4, 4).toFixed(1)}px) skewX(${g.range(-12, 12).toFixed(1)}deg)` : 'none'
      r.textContent = on ? MOJI[i]! : 'Quarterly report — page 1'.slice(0, 18 + i)
    })
    s.crack.style.visibility = t >= crash ? '' : 'hidden'
    // A logs in (left), B sneaks in (right) wearing A's tag, C opens the PDF (bottom)
    const bIn = outCubic(seg(t, steal - 0.35, steal + 0.1))
    const cIn = popAt(t, c('fail.pdf') - 0.7, 0.4)
    const dead = t >= crash
    s.bots[0]!({ x: 170, y: 1210 + bob(t, 0, 6), s: 1, r: t >= steal ? -8 : 0, mood: dead ? 'shock' : t >= steal ? 'shock' : 'happy', arms: t >= steal && t < open ? 0.9 : 0.1 })
    s.bots[1]!({ x: lerp(1260, 900, bIn), y: 1210 + bob(t, 1, 6), s: 1, o: bIn > 0 ? 1 : 0, r: -6, mood: dead ? 'shock' : 'smug', arms: 0.3 })
    s.bots[2]!({ x: 540, y: 1250 + bob(t, 2, 6), s: cIn.s, o: cIn.o, mood: dead ? 'dead' : t >= garble ? 'dizzy' : 'happy', arms: t >= garble && !dead ? 0.6 + 0.3 * Math.sin(t * 25) : 0.2 })
    const tp = popAt(t, steal + 0.25, 0.3)
    put(s.tagB, lerp(1260, 900, bIn) + 10, 1270, tp.s, -14, tp.o * (t < crash ? 1 : 0))
    const cx = lerp(980, 500, outCubic(seg(t, steal, steal + 0.6))), cy = 640 + 20 * Math.sin(t * 6)
    put(s.cursor, cx, cy, 1, 0, t >= steal - 0.1 && t < open ? 1 : 0)
    const hp = popAt(t, steal + 0.1, 0.3)
    put(s.huh, 300, 1010, hp.s, -10, hp.o * (t < open ? 1 : 0))
    const bp = popAt(t, crash, 0.25)
    put(s.boom, 760, 420, bp.s * 1.1, 10, bp.o)
    // black screen: only the eyes are left, blinking
    const k = seg(t, black - 0.05, black + 0.12)
    s.dark.style.opacity = String(k)
    s.dark.style.visibility = k > 0 ? '' : 'hidden'
    const pos = [[170, 1150], [900, 1150], [540, 1190]]
    s.eyes.forEach((e, i) => {
      const blink = ((t + i * 0.37) % 1.3) < 0.1 ? 0.1 : 1
      e.style.transform = `translate(${pos[i]![0] - 60}px, ${pos[i]![1] - 25}px) scaleY(${blink})`
      e.style.opacity = String(k)
      e.style.visibility = k > 0 ? '' : 'hidden'
    })
    put(s.dots, 540, 720, 1, 0, seg(t, black + 0.4, black + 0.7))
  },
})
