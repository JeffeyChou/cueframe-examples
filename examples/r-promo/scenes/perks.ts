import { cue, scene } from '@cueframe/core'
import { AGENTS, C, MONO, agent, cjk, clamp01, backdrop, browser, burst, el, fly, jolt, lerp, outBack, popAt, put, seg, skeleton, slamAt, sticker, stamp, typed } from '../lib.js'

const TEXT = 'Q3 营收 +12%，见第 2 页。'

// Perks montage: three comic panels — revive (1UP), PDF → text, intranet door slammed shut.
export default scene({
  id: 'perks',
  at: cue('scene.perks.start'),
  end: cue('scene.perks.end'),
  mount(ctx) {
    const bg = backdrop(ctx.root, C.yellow)
    const panel = (bg: string) => el(ctx.root, { width: '960px', height: '330px', background: bg, border: `7px solid ${C.ink}`, borderRadius: '20px',
      boxShadow: `12px 12px 0 ${C.ink}`, overflow: 'hidden' })
    const p = [panel('#fff'), panel('#fff'), panel('#fff')]
    // 1: crashed browser revives
    const mini = browser(p[0]!, 330, 230, 'agent-a')
    skeleton(mini.body, 330, 3, 20)
    const crack = el(mini.win, { width: '100%', height: '100%' }, `<svg width="330" height="230"><path d="M160 90l-40-60M160 90l70-40M160 90l-90 50M160 90l40 110" stroke="${C.ink}" stroke-width="7" fill="none"/></svg>`)
    const spin = el(p[0]!, {}, `<svg viewBox="0 0 100 100" width="120" height="120"><path d="M78 34A34 34 0 1 0 84 56" stroke="${C.ink}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M78 34A34 34 0 1 0 84 56" stroke="${C.green}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M62 30l26 4-4-26z" fill="${C.green}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/></svg>`)
    const oneUp = sticker(p[0]!, '1UP!', { size: 76, bg: C.green, pad: '4px 26px' })
    oneUp.style.fontFamily = MONO
    const botA = agent(p[0]!, AGENTS[0], 170)
    // 2: PDF → text
    const doc = el(p[1]!, { width: '190px', height: '240px', background: '#fff', border: `6px solid ${C.ink}`, borderRadius: '10px' },
      `<div style="position:absolute;right:-6px;top:-6px;background:${C.red};color:#fff;font:800 34px JBM;padding:2px 14px">PDF</div>`)
    const arrow = el(p[1]!, { fontSize: '110px', fontWeight: '900', color: C.ink }, '→')
    const out = el(p[1]!, { width: '470px', height: '220px', background: '#f6f3ea', border: `5px dashed ${C.ink}`, borderRadius: '14px',
      fontSize: '44px', fontWeight: '700', padding: '28px 30px', boxSizing: 'border-box', whiteSpace: 'normal', lineHeight: '1.4' })
    // 3: peeking at the intranet, door slams
    const botC = agent(p[2]!, AGENTS[2], 170)
    const frame = el(p[2]!, { width: '210px', height: '290px' }, `<svg width="210" height="290"><rect x="3" y="3" width="204" height="284" fill="#2b2b3a" stroke="${C.ink}" stroke-width="7"/>
      <rect data-door x="3" y="3" width="204" height="284" fill="#c9773b" stroke="${C.ink}" stroke-width="7"/><circle data-knob cx="180" cy="150" r="12" fill="${C.lit}" stroke="${C.ink}" stroke-width="4"/></svg>`)
    const door = frame.querySelector('[data-door]')!, knob = frame.querySelector('[data-knob]')!
    const sign = sticker(p[2]!, cjk('内网 10.0.0.0/8'), { size: 34, pad: '4px 16px', bg: C.lit })
    sign.style.fontFamily = MONO
    const nope = stamp(p[2]!, '没门', C.red, 88)
    const bonk = burst(p[2]!, '砰!', C.pink, 170)
    return { bg, p, mini, crack, spin, oneUp, botA, doc, arrow, out, botC, door, knob, frame, sign, nope, bonk }
  },
  render(f, s) {
    const t = f.t, c = (n: string) => f.cue(n)
    const t1 = c('scene.perks.vo'), revive = c('perk.revive'), pdf = c('perk.pdf'), peek = c('perk.peek') - 0.5, no = c('perk.nope')
    const words = f.words({ text: '文字', line: 'perks' }).start
    s.bg(f)
    ;[t1 - 0.05, pdf - 0.3, peek - 0.1].forEach((at, i) => {
      const k = fly(t, at, 0.4)
      const sh = i === 2 ? jolt(t, no, 18, 0.4) : { x: 0, y: 0, rot: 0 }
      put(s.p[i]!, lerp(i % 2 ? 1700 : -700, 540, k) + sh.x, 400 + i * 380 + sh.y, 1, (i - 1) * 1.6 + sh.rot, k > 0 ? 1 : 0)
    })
    // panel 1
    const alive = t >= revive
    put(s.mini.win, 230, 165, 1, alive ? 0 : -6, 1)
    s.mini.win.style.filter = alive ? 'none' : 'grayscale(1)'
    s.crack.style.visibility = alive ? 'hidden' : ''
    put(s.spin, 450, 165, 1, -360 * outBack(seg(t, revive - 0.35, revive + 0.2)), alive ? 1 : seg(t, revive - 0.35, revive - 0.2))
    const up = popAt(t, revive, 0.35)
    put(s.oneUp, 830, 120, up.s, 8, up.o)
    s.botA({ x: 640, y: 175 - (alive ? 14 * Math.abs(Math.sin(t * 7)) : 0), mood: alive ? 'happy' : 'dead', arms: alive ? 1 : 0, s: 0.95 })
    // panel 2
    put(s.doc, 140, 165, 1, -5, 1)
    put(s.arrow, 315, 160, 1 + 0.08 * Math.sin(t * 10), 0, 1)
    put(s.out, 670, 165, 1, 0, 1)
    const n = typed(t, words - 0.15, TEXT.length, 16)
    s.out.innerHTML = `${TEXT.slice(0, n)}<span style="color:${C.purple}">${n < TEXT.length ? '▌' : ''}</span>`
    // panel 3
    const shut = seg(t, no - 0.12, no, (x) => clamp01(x) ** 2)
    const dw = 204 * (0.22 + 0.78 * shut)
    s.door.setAttribute('width', dw.toFixed(1))
    s.knob.setAttribute('cx', (dw - 22).toFixed(1))
    put(s.frame, 560, 176, 1, 0, 1)
    put(s.sign, 560, 40, 1, -3, 1)
    const lean = seg(t, peek + 0.2, peek + 0.6)
    s.botC({ x: lerp(250, 380, lean) - 60 * seg(t, no, no + 0.25), y: 200, r: 18 * lean - 30 * seg(t, no, no + 0.2), mood: t >= no ? 'dizzy' : 'smug', s: 0.95 })
    const sp = slamAt(t, no + 0.05, 0.2, 2.6)
    put(s.nope, 770, 170, sp.s * 0.85, 10, sp.o)
    const bp = popAt(t, no, 0.2)
    put(s.bonk, 420, 250, bp.s, -10, bp.o * (1 - seg(t, no + 0.6, no + 0.8)))
  },
})
