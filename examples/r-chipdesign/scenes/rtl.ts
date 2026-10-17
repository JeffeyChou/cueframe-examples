// r1–r4: the code panel arrives from `hdl`; "RTL" shrinks into register → logic → register in one
// clock cycle, which becomes the counter of the code, and two tokens link to what they become.
import { cue, scene } from '@cueframe/core'
import { codePanel, typeTo } from '../codepanel.js'
import { blocking, C, center, el, inOutCubic, MONO, outCubic, PANEL_R, said, SANS, seg, start, token, type Rect } from '../lib.js'

type Pt = [number, number]
const A0: Rect = { x: 960, y: 330, w: 170, h: 110 }
const B0: Rect = { x: 960, y: 600, w: 170, h: 110 }
const Q0: Rect = { x: 1600, y: 465, w: 170, h: 110 }
const CNT: Rect = { x: 960, y: 465, w: 170, h: 110 }
const ADD: Pt = [1340, 520]
const WIRES: Record<string, Pt[]> = {
  a: [[1130, 385], [1220, 385], [1220, 500], [1284, 500]],
  b: [[1130, 655], [1220, 655], [1220, 540], [1284, 540]],
  q: [[1396, 520], [1600, 520]],
  c: [[1130, 520], [1284, 520]],
  fb: [[1396, 520], [1480, 520], [1480, 720], [900, 720], [900, 520], [960, 520]],
}
const P = 0.6
const STAGE: Rect = { x: 0, y: 0, w: 1920, h: 1080 }
const IDS = ['rtl', 'letters', 'full', 'diagram', 'counter', 'reg', 'add', 'out'] as const

function along(pts: Pt[], k: number): Pt {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]))
  let d = Math.max(0, Math.min(1, k)) * lens.reduce((a, b) => a + b, 0)
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]! || i === lens.length - 1) {
      const u = lens[i]! ? Math.min(1, d / lens[i]!) : 0
      return [pts[i]![0] + (pts[i + 1]![0] - pts[i]![0]) * u, pts[i]![1] + (pts[i + 1]![1] - pts[i]![1]) * u]
    }
    d -= lens[i]!
  }
  return pts.at(-1)!
}

/** A full-stage layer of SVG paths (a key that only fades); paths draw on through pathLength. */
function layer(root: HTMLElement, paths: { d: string; color: string }[]) {
  const div = el(root, 'div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 1920 1080')
  Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
  div.append(svg)
  const els = paths.map(({ d, color }) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    Object.entries({ d, fill: 'none', stroke: color, 'stroke-width': '3', pathLength: '1', 'stroke-dasharray': '1 1' }).forEach(([k, v]) => p.setAttribute(k, v))
    svg.append(p)
    return p
  })
  return { div, paths: els }
}
const poly = (pts: Pt[]) => 'M' + pts.map((q) => q.join(' ')).join(' L')

function reg(root: HTMLElement) {
  const b = el(root, 'div', { boxSizing: 'border-box', border: `2px solid ${C.cyan}`, borderRadius: '8px', background: C.panel, boxShadow: `0 0 20px ${C.cyan}33` })
  const name = el(b, 'div', { left: '12px', top: '8px', font: `500 16px ${MONO}`, color: C.dim, letterSpacing: '.2em' })
  const v = el(b, 'div', { left: '0', right: '0', top: '30px', textAlign: 'center', font: `700 54px ${MONO}`, color: C.text })
  return { b, name, v }
}

export default scene({
  id: 'rtl',
  at: cue('scene.r1.start'),
  end: cue('scene.d1.start'),
  mount(ctx) {
    const root = ctx.root
    const b = blocking(IDS)
    const at = {
      rtl: start('r1'), letters: said(ctx, 'r1', 'RTL'), full: said(ctx, 'r1', '寄存器传输级'), diagram: start('r2'),
      counter: start('r3'), reg: said(ctx, 'r4', '寄存器'), add: said(ctx, 'r4', '加法'), out: start('d1') - 0.45,
    }
    const T = { go: said(ctx, 'r2', '出发'), op: said(ctx, 'r2', '运算'), store: said(ctx, 'r2', '存进'), tick: said(ctx, 'r3', '时钟每跳'), ...at }
    const code = codePanel(root)
    typeTo(code.counter, code.counter.n + 1)
    ctx.key(b.set(code.p, { rtl: PANEL_R }), 'code')

    ;[['R', '寄存器'], ['T', '传输'], ['L', '级']].forEach(([ch, zh], i) => {
      ctx.key(b.set(el(root, 'div', { textAlign: 'center', font: `700 170px ${MONO}`, color: C.cyan, textShadow: `0 0 36px ${C.cyan}77`, lineHeight: '210px' }, ch),
        { letters: { x: 1000 + i * 230, y: 410, w: 200, h: 210 }, diagram: null }), `rtl-${i}`)
      ctx.key(b.set(el(root, 'div', { textAlign: 'center', font: `600 30px ${SANS}`, color: C.text }, zh),
        { full: { x: 1000 + i * 230, y: 640, w: 200, h: 44 }, diagram: null }), `sub-${i}`)
    })
    const A = reg(root)
    const B = reg(root)
    const Q = reg(root)
    ctx.key(b.set(A.b, { diagram: A0, counter: CNT, out: null }), 'reg-a')
    ctx.key(b.set(B.b, { diagram: B0, counter: null }), 'reg-b')
    ctx.key(b.set(Q.b, { diagram: Q0, counter: null }), 'reg-q')
    B.name.textContent = 'REG B'
    B.v.textContent = '5'
    Q.name.textContent = 'REG Q'
    const adder = ctx.key(b.set(el(root, 'div', { borderRadius: '50%', boxSizing: 'border-box', border: `3px solid ${C.orange}`, background: C.panel, display: 'grid', placeItems: 'center', font: `700 44px ${MONO}`, color: C.orange }),
      { diagram: center(ADD[0], ADD[1], 112, 112), out: null }), 'adder')
    const w2 = layer(root, ['a', 'b', 'q'].map((k) => ({ d: poly(WIRES[k]!), color: `${C.cyan}aa` })))
    ctx.key(b.set(w2.div, { diagram: STAGE, counter: null }), 'wires2')
    const w3 = layer(root, ['c', 'fb'].map((k) => ({ d: poly(WIRES[k]!), color: `${C.cyan}aa` })))
    ctx.key(b.set(w3.div, { counter: STAGE, out: null }), 'wires3')
    const clockBox = ctx.key(b.set(el(root, 'div'), { diagram: { x: 900, y: 760, w: 900, h: 100 }, out: null }), 'clock')
    el(clockBox, 'div', { left: '0', top: '0', font: `500 16px ${MONO}`, color: C.dim, letterSpacing: '.3em' }, 'CLK')
    const clock = ctx.canvas('clock', { y: 30, w: 900, h: 70 })
    clockBox.append(clock.canvas)
    const dots = [0, 1, 2].map(() => el(root, 'div', { width: '18px', height: '18px', marginLeft: '-9px', marginTop: '-9px', borderRadius: '50%', background: C.cyan, boxShadow: `0 0 16px ${C.cyan}` }))

    // r4: the two tokens, the links to what they become, and the names.
    const tc = token(PANEL_R, 1, 2, 5)
    const ta = token(PANEL_R, 1, 17, 3)
    const links = [['reg', tc, `C${tc.x + tc.w / 2} 600, ${CNT.x + CNT.w / 2} 380, ${CNT.x + CNT.w / 2} ${CNT.y}`, C.orange, { x: CNT.x + 20, y: CNT.y + CNT.h + 14 }, '寄存器'],
      ['add', ta, `C${ta.x + ta.w / 2} 640, ${ADD[0]} 660, ${ADD[0]} ${ADD[1] + 56}`, C.green, { x: ADD[0] + 70, y: ADD[1] + 40 }, '加法器']] as const
    // Each link is a full-stage layer that fades with the layouts; render points it at the token
    // where the code panel is drawn (lay.map), so it would follow the panel if it moved.
    const drawOn = links.map(([id, tok, curve, color, lab, name]) => {
      const l = layer(root, [{ d: '', color }])
      const mark = el(l.div, 'div', { boxSizing: 'border-box', border: `2px solid ${color}`, borderRadius: '4px' })
      ctx.key(b.set(l.div, { [id]: STAGE, out: null }), `link-${id}`)
      ctx.key(b.set(el(root, 'div', { font: `600 26px ${SANS}`, color, whiteSpace: 'nowrap' }, name), { [id]: { ...lab, w: 120, h: 34 }, out: null }), `name-${id}`, { delay: 0.4 })
      return { path: l.paths[0]!, mark, tok, curve, at: at[id] }
    })
    const lay = ctx.layouts(IDS.map((id) => ({
      id, at: at[id],
      motion: id === 'rtl' ? { code: { dur: 0.7 } }
        : id === 'letters' ? { 'rtl-*': { enter: 'pop', stagger: 0.12 } }
        : id === 'full' ? { 'sub-*': { stagger: 0.35 } }
        : id === 'diagram' ? { 'rtl-0': { to: 'reg-a' }, 'rtl-1': { to: 'adder' }, 'rtl-2': { to: 'reg-q' }, 'reg-*': { delay: 0.2 }, adder: { delay: 0.2 } }
        : id === 'counter' ? { 'reg-a': { dur: 0.7 } } : {},
    })), b.apply)
    return { lay, T, code, A, Q, adder, wires: [...w2.paths, ...w3.paths], dots, clock, drawOn }
  },
  render(f, s) {
    const { T } = s
    const t = f.t
    const counter = s.lay.index(f) >= IDS.indexOf('counter')
    // Contents that change with the layout: names and values.
    s.A.name.textContent = counter ? 'count' : 'REG A'
    s.adder.textContent = counter ? '+1' : '+'
    const ticks = t >= T.tick ? Math.floor((t - T.tick) / P) : -1
    s.A.v.textContent = counter ? String(Math.max(0, ticks + 1)) : '3'
    s.wires.forEach((p, i) => { p.style.strokeDashoffset = String(1 - seg(t, i < 3 ? T.diagram + 0.3 : T.counter + 0.4, (i < 3 ? T.diagram : T.counter) + 0.9, outCubic)) })
    for (const d of s.drawOn) {
      const r = s.lay.map('code', f, d.tok)
      Object.assign(d.mark.style, { left: `${r.x - 4}px`, top: `${r.y + 4}px`, width: `${r.w + 8}px`, height: `${r.h - 8}px` })
      d.path.setAttribute('d', `M${r.x + r.w / 2} ${r.y + r.h} ${d.curve}`)
      d.path.style.strokeDashoffset = String(1 - seg(t, d.at, d.at + 0.6, outCubic))
    }

    // Data: leave A and B at "出发", meet in the adder at "运算", land in Q at "存进"; then the
    // counter's pulse runs round the loop once per tick.
    const go = seg(t, T.go, T.go + 0.8, inOutCubic)
    const st = seg(t, T.store, T.store + 0.6, inOutCubic)
    const put = (d: HTMLElement, p: Pt, on: boolean) => { d.style.left = `${p[0]}px`; d.style.top = `${p[1]}px`; d.style.opacity = on ? '1' : '0' }
    const [d0, d1, d2] = [s.dots[0]!, s.dots[1]!, s.dots[2]!]
    put(d0, along(WIRES.a!, go), !counter && t >= T.go && go < 1)
    put(d1, along(WIRES.b!, go), !counter && t >= T.go && go < 1)
    if (counter && t >= T.tick && t < T.out) put(d2, along([...WIRES.c!, ...WIRES.fb!.slice(1)], ((t - T.tick) % P) / P), true)
    else put(d2, along(WIRES.q!, st), !counter && t >= T.store && st < 1)
    s.adder.style.boxShadow = `0 0 ${(10 + 40 * (t >= T.op ? Math.exp(-3 * (t - T.op)) : 0)).toFixed(1)}px ${C.orange}`
    s.Q.v.textContent = st >= 1 ? '8' : ''
    const flash = t >= T.tick && counter ? Math.exp(-4 * (((t - T.tick) % P) / P)) : 0
    s.code.counter.rows.forEach((r) => { r.hl.style.opacity = String(flash) })

    // Clock: a square wave scrolling one period per tick.
    const g = s.clock
    g.clearRect(0, 0, 900, 70)
    g.strokeStyle = '#ff4fd8'
    g.lineWidth = 3
    g.beginPath()
    const shift = t >= T.tick ? (((t - T.tick) / P) * 120) % 120 : 0
    for (let x = -120; x < 1020; x += 120) {
      const x0 = x - shift
      g.moveTo(x0, 60); g.lineTo(x0, 10); g.lineTo(x0 + 60, 10); g.lineTo(x0 + 60, 60); g.lineTo(x0 + 120, 60)
    }
    g.stroke()
  },
})
