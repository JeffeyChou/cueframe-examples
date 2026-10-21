// r1–r4: the code panel arrives from `hdl`; "RTL" shrinks into register → logic → register in one
// clock cycle, which becomes the counter of the code, and two tokens link to what they become.
import { cue, scene } from '@cueframe/core'
import { inside } from '../lib/hud.js'
import { blocking, C, center, COUNTER, el, inOutCubic, MONO, outCubic, PANEL_R, said, SANS, seg, start, ui, VERILOG, type Rect } from '../lib.js'

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

/** A register: a panel with its name and a counter (−1 shows nothing), centred in it. */
function reg(root: HTMLElement, name: string) {
  const p = ui.panel(root)
  const label = el(p.body, 'div', { left: '12px', top: '8px', font: `500 16px ${MONO}`, color: C.dim, letterSpacing: '.2em' }, name)
  const v = ui.counter(p.body, { align: 'middle', role: 'text', format: (n) => (n < 0 ? '' : String(n)), box: { x: (A0.w - 300) / 2, y: 24, w: 300, h: 100 } })
  return { b: p.el, name: label, v }
}
// The clock, and the count under it, scrolled so that "now" stands two cycles from the left.
const WAVE = { x: 900, y: 750, w: 900 }
const count = (i: number) => Math.max(0, i + 1)

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
    const panel = ui.panel(root)
    const code = ui.code(panel.body, { lines: COUNTER, ...VERILOG })
    ctx.key(b.set(panel.el, { rtl: PANEL_R }), 'code')

    ;[['R', '寄存器'], ['T', '传输'], ['L', '级']].forEach(([ch, zh], i) => {
      ctx.key(b.set(el(root, 'div', { textAlign: 'center', font: `700 170px ${MONO}`, color: C.accent, textShadow: `0 0 36px ${C.accent}77`, lineHeight: '210px' }, ch),
        { letters: { x: 1000 + i * 230, y: 410, w: 200, h: 210 }, diagram: null }), `rtl-${i}`)
      ctx.key(b.set(el(root, 'div', { textAlign: 'center', font: `600 30px ${SANS}`, color: C.text }, zh),
        { full: { x: 1000 + i * 230, y: 640, w: 200, h: 44 }, diagram: null }), `sub-${i}`)
    })
    const A = reg(root, 'REG A')
    const B = reg(root, 'REG B')
    const Q = reg(root, 'REG Q')
    ctx.key(b.set(A.b, { diagram: A0, counter: CNT, out: null }), 'reg-a')
    ctx.key(b.set(B.b, { diagram: B0, counter: null }), 'reg-b')
    ctx.key(b.set(Q.b, { diagram: Q0, counter: null }), 'reg-q')
    B.v.set(5)
    const adder = ctx.key(b.set(el(root, 'div', { borderRadius: '50%', boxSizing: 'border-box', border: `3px solid ${C.warm}`, background: C.surface, display: 'grid', placeItems: 'center', font: `700 44px ${MONO}`, color: C.warm }),
      { diagram: center(ADD[0], ADD[1], 112, 112), out: null }), 'adder')
    const w2 = layer(root, ['a', 'b', 'q'].map((k) => ({ d: poly(WIRES[k]!), color: `${C.accent}aa` })))
    ctx.key(b.set(w2.div, { diagram: STAGE, counter: null }), 'wires2')
    const w3 = layer(root, ['c', 'fb'].map((k) => ({ d: poly(WIRES[k]!), color: `${C.accent}aa` })))
    ctx.key(b.set(w3.div, { counter: STAGE, out: null }), 'wires3')
    const clock = ui.wave(root, { signals: [{ name: 'CLK', kind: 'clock' }], cycles: 7 })
    ctx.key(b.set(clock.el, { diagram: ui.box(clock, WAVE.x, WAVE.y, WAVE.w), out: null }), 'clock')
    const bus = ui.wave(root, { signals: [{ name: 'count', kind: 'bus', data: count }], cycles: 7 })
    ctx.key(b.set(bus.el, { counter: ui.box(bus, WAVE.x, WAVE.y + 56 * WAVE.w / 1000, WAVE.w), out: null }), 'bus')
    const dots = [0, 1, 2].map(() => el(root, 'div', { width: '18px', height: '18px', marginLeft: '-9px', marginTop: '-9px', borderRadius: '50%', background: C.accent, boxShadow: `0 0 16px ${C.accent}` }))

    // r4: the two tokens, the links to what they become, and the names.
    const token = (col: number, n: number) => ui.at(code, code.token(1, col, n), inside(panel.bodyIn(PANEL_R), code.box))
    const tc = token(2, 5)
    const ta = token(17, 3)
    const links = [['reg', tc, `C${tc.x + tc.w / 2} 600, ${CNT.x + CNT.w / 2} 380, ${CNT.x + CNT.w / 2} ${CNT.y}`, C.warm, { x: CNT.x + 20, y: CNT.y + CNT.h + 14 }, '寄存器'],
      ['add', ta, `C${ta.x + ta.w / 2} 640, ${ADD[0]} 660, ${ADD[0]} ${ADD[1] + 56}`, C.good, { x: ADD[0] + 70, y: ADD[1] + 40 }, '加法器']] as const
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
    return { lay, T, code, A, Q, adder, wires: [...w2.paths, ...w3.paths], dots, clock, bus, drawOn }
  },
  render(f, s) {
    const { T } = s
    const t = f.t
    const counter = s.lay.index(f) >= IDS.indexOf('counter')
    // Contents that change with the layout: names and values.
    s.A.name.textContent = counter ? 'count' : 'REG A'
    s.adder.textContent = counter ? '+1' : '+'
    const now = Math.max(0, (t - T.tick) / P)
    s.A.v.set(counter ? (t >= T.tick ? count(Math.floor(now)) : 0) : 3)
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
    s.adder.style.boxShadow = `0 0 ${(10 + 40 * (t >= T.op ? Math.exp(-3 * (t - T.op)) : 0)).toFixed(1)}px ${C.warm}`
    s.Q.v.set(st >= 1 ? 8 : -1)
    const flash = t >= T.tick && counter ? Math.exp(-4 * (((t - T.tick) % P) / P)) : 0
    s.code.set({ lit: [flash, flash] })

    // The clock scrolls one period per tick; the count under it changes on each rising edge.
    const cursor = t >= T.tick ? now : null
    s.clock.set({ phase: now - 2, cursor })
    s.bus.set({ phase: now - 2, cursor })
  },
})
