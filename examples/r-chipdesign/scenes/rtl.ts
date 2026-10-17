// r1–r4: "RTL" → register → logic → register in one clock cycle → the counter from the code,
// with its two tokens tied to the register and the adder they become.
import { cue, scene } from '@cueframe/core'
import { C, center, el, inOutCubic, lerpRect, MONO, outBack, outCubic, place, said, SANS, seg, start, type Rect } from '../lib.js'
import { counterToken } from './code.js'

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

function reg(root: HTMLElement, name: string) {
  const b = el(root, 'div', { boxSizing: 'border-box', border: `2px solid ${C.cyan}`, borderRadius: '8px', background: C.panel, boxShadow: `0 0 20px ${C.cyan}33` })
  el(b, 'div', { left: '12px', top: '8px', font: `500 16px ${MONO}`, color: C.dim, letterSpacing: '.2em' }, name)
  const v = el(b, 'div', { left: '0', right: '0', top: '30px', textAlign: 'center', font: `700 54px ${MONO}`, color: C.text })
  return { b, v }
}

export default scene({
  id: 'rtl',
  at: cue('scene.r1.start'),
  end: cue('scene.d1.start', { offset: 0.8 }),
  mount(ctx) {
    const root = ctx.root
    const T = {
      r1: start('r1'), rtl: said(ctx, 'r1', 'RTL'), full: said(ctx, 'r1', '寄存器传输级'),
      r2: start('r2'), go: said(ctx, 'r2', '出发'), op: said(ctx, 'r2', '运算'), store: said(ctx, 'r2', '存进'),
      r3: start('r3'), tick: said(ctx, 'r3', '时钟每跳'),
      reg: said(ctx, 'r4', '寄存器'), add: said(ctx, 'r4', '加法'), d1: start('d1'),
    }
    const letters = [['R', '寄存器'], ['T', '传输'], ['L', '级']].map(([ch, zh], i) => ({
      big: el(root, 'div', { left: `${1000 + i * 230}px`, top: '420px', width: '200px', textAlign: 'center', font: `700 170px ${MONO}`, color: C.cyan, textShadow: `0 0 36px ${C.cyan}77` }, ch),
      sub: el(root, 'div', { left: `${1000 + i * 230}px`, top: '640px', width: '200px', textAlign: 'center', font: `600 30px ${SANS}`, color: C.text }, zh),
    }))
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 1920 1080')
    Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', width: '1920px', height: '1080px' })
    root.append(svg)
    const path = (pts: Pt[], color: string, w = 3) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      p.setAttribute('d', 'M' + pts.map((q) => q.join(' ')).join(' L'))
      p.setAttribute('fill', 'none')
      p.setAttribute('stroke', color)
      p.setAttribute('stroke-width', String(w))
      p.setAttribute('pathLength', '1')
      p.setAttribute('stroke-dasharray', '1 1')
      svg.append(p)
      return p
    }
    const wires = Object.fromEntries(Object.entries(WIRES).map(([k, pts]) => [k, path(pts, `${C.cyan}aa`)]))
    const curve = (d: string, color: string) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      p.setAttribute('d', d)
      Object.entries({ fill: 'none', stroke: color, 'stroke-width': '3', pathLength: '1', 'stroke-dasharray': '1 1' }).forEach(([k, v]) => p.setAttribute(k, v))
      svg.append(p)
      return p
    }
    const tc = counterToken(1, 2, 5)
    const ta = counterToken(1, 17, 3)
    const links = {
      reg: curve(`M${tc.x + tc.w / 2} ${tc.y + tc.h} C${tc.x + tc.w / 2} 600, ${CNT.x + CNT.w / 2} 380, ${CNT.x + CNT.w / 2} ${CNT.y}`, C.orange),
      add: curve(`M${ta.x + ta.w / 2} ${ta.y + ta.h} C${ta.x + ta.w / 2} 640, ${ADD[0]} 660, ${ADD[0]} ${ADD[1] + 56}`, C.green),
    }
    const marks = {
      reg: el(root, 'div', { boxSizing: 'border-box', border: `2px solid ${C.orange}`, borderRadius: '4px' }),
      add: el(root, 'div', { boxSizing: 'border-box', border: `2px solid ${C.green}`, borderRadius: '4px' }),
    }
    const labels = {
      reg: el(root, 'div', { font: `600 26px ${SANS}`, color: C.orange, whiteSpace: 'nowrap' }, '寄存器'),
      add: el(root, 'div', { font: `600 26px ${SANS}`, color: C.green, whiteSpace: 'nowrap' }, '加法器'),
    }
    const A = reg(root, 'REG A')
    const B = reg(root, 'REG B')
    const Q = reg(root, 'REG Q')
    const adder = el(root, 'div', { width: '112px', height: '112px', borderRadius: '50%', boxSizing: 'border-box', border: `3px solid ${C.orange}`, background: C.panel, display: 'grid', placeItems: 'center', font: `700 44px ${MONO}`, color: C.orange })
    const dots = [0, 1, 2].map(() => el(root, 'div', { width: '18px', height: '18px', marginLeft: '-9px', marginTop: '-9px', borderRadius: '50%', background: C.cyan, boxShadow: `0 0 16px ${C.cyan}` }))
    const clock = ctx.canvas('clock', { x: 900, y: 790, w: 900, h: 70 })
    const clockLabel = el(root, 'div', { left: '900px', top: '760px', font: `500 16px ${MONO}`, color: C.dim, letterSpacing: '.3em' }, 'CLK')
    return { T, letters, wires, links, marks, labels, A, B, Q, adder, dots, clock, clockLabel, tc, ta }
  },
  render(f, s) {
    const { T } = s
    const t = f.t
    const out = 1 - seg(t, T.d1 - 0.1, T.d1 + 0.5)

    // r1: big RTL letters, spelled out when the full name is said; they leave as the diagram comes.
    const diagram = seg(t, T.r2 - 0.2, T.r2 + 0.5, inOutCubic)
    s.letters.forEach((l, i) => {
      const k = seg(t, T.rtl - 0.2 + i * 0.12, T.rtl + 0.2 + i * 0.12, outBack)
      l.big.style.opacity = String(Math.min(1, k) * (1 - diagram))
      l.big.style.transform = `scale(${(1 - 0.5 * diagram).toFixed(4)})`
      l.sub.style.opacity = String(seg(t, T.full + i * 0.35, T.full + i * 0.35 + 0.3) * (1 - diagram))
    })

    // r2: A, B → (+) → Q. r3: A becomes the counter register, B and Q go, the output loops back.
    const toCounter = seg(t, T.r3 - 0.1, T.r3 + 0.6, inOutCubic)
    place(s.A.b, lerpRect(A0, CNT, toCounter), diagram * out)
    place(s.B.b, B0, diagram * (1 - toCounter))
    place(s.Q.b, Q0, diagram * (1 - toCounter))
    place(s.adder, center(ADD[0], ADD[1], 112, 112), diagram * out)
    s.A.b.firstElementChild!.textContent = toCounter > 0.5 ? 'count' : 'REG A'
    s.adder.textContent = toCounter > 0.5 ? '+1' : '+'
    const draw = (p: SVGPathElement, k: number, o: number) => { p.style.strokeDashoffset = String(1 - k); p.style.opacity = String(o) }
    const wk = seg(t, T.r2 + 0.1, T.r2 + 0.7, outCubic)
    draw(s.wires.a!, wk, 1 - toCounter)
    draw(s.wires.b!, wk, 1 - toCounter)
    draw(s.wires.q!, wk, 1 - toCounter)
    const ck = seg(t, T.r3 + 0.3, T.r3 + 0.9, outCubic)
    draw(s.wires.c!, ck, out)
    draw(s.wires.fb!, ck, out)

    // Data: leave A and B at "出发", meet in the adder at "运算", land in Q at "存进".
    s.A.v.textContent = toCounter > 0.5 ? '' : '3'
    s.B.v.textContent = '5'
    const go = seg(t, T.go, T.go + 0.8, inOutCubic)
    const st = seg(t, T.store, T.store + 0.6, inOutCubic)
    const moving = t >= T.go && t < T.store + 0.6 && toCounter === 0
    const d0 = s.dots[0]!, d1 = s.dots[1]!, d2 = s.dots[2]!
    const pa = along(WIRES.a!, go)
    const pb = along(WIRES.b!, go)
    const pq = along(WIRES.q!, st)
    d0.style.left = `${pa[0]}px`; d0.style.top = `${pa[1]}px`; d0.style.opacity = moving && go < 1 ? '1' : '0'
    d1.style.left = `${pb[0]}px`; d1.style.top = `${pb[1]}px`; d1.style.opacity = moving && go < 1 ? '1' : '0'
    d2.style.left = `${pq[0]}px`; d2.style.top = `${pq[1]}px`; d2.style.opacity = t >= T.store && st < 1 && toCounter === 0 ? '1' : '0'
    const opGlow = t >= T.op ? Math.exp(-3 * (t - T.op)) : 0
    s.adder.style.boxShadow = `0 0 ${(10 + 40 * opGlow).toFixed(1)}px ${C.orange}`
    s.Q.v.textContent = st >= 1 ? '8' : ''

    // r3: the counter ticks. Each tick a pulse runs round the loop and the value goes up by one.
    const ticks = t >= T.tick ? Math.floor((t - T.tick) / P) : -1
    if (toCounter > 0.5) s.A.v.textContent = String(Math.max(0, ticks + 1))
    const ph = t >= T.tick ? ((t - T.tick) % P) / P : 0
    const d3on = t >= T.tick && out > 0
    const loop = [...WIRES.c!, ...WIRES.fb!.slice(1)]
    const pl = along(loop, ph)
    d2.style.left = d3on ? `${pl[0]}px` : d2.style.left
    d2.style.top = d3on ? `${pl[1]}px` : d2.style.top
    if (d3on) d2.style.opacity = String(out)

    // Clock: a square wave scrolling left, one period per tick.
    const g = s.clock
    g.clearRect(0, 0, 900, 70)
    const clk = diagram * out
    s.clockLabel.style.opacity = String(clk)
    if (clk > 0) {
      g.globalAlpha = clk
      g.strokeStyle = '#ff4fd8'
      g.lineWidth = 3
      g.beginPath()
      const per = 120
      const shift = t >= T.tick ? (((t - T.tick) / P) * per) % per : 0
      for (let x = -per; x < 900 + per; x += per) {
        const x0 = x - shift
        g.moveTo(x0, 60); g.lineTo(x0, 10); g.lineTo(x0 + per / 2, 10); g.lineTo(x0 + per / 2, 60); g.lineTo(x0 + per, 60)
      }
      g.stroke()
      g.globalAlpha = 1
    }

    // r4: the code tokens light, and links run to what they become.
    for (const [key, at, tok] of [['reg', T.reg, s.tc], ['add', T.add, s.ta]] as const) {
      const k = seg(t, at - 0.1, at + 0.6, outCubic)
      draw(s.links[key], k, out)
      place(s.marks[key], { x: tok.x - 4, y: tok.y + 4, w: tok.w + 8, h: tok.h - 8 }, Math.min(1, k * 2) * out)
    }
    place(s.labels.reg, { x: CNT.x + 20, y: CNT.y + CNT.h + 14, w: 200, h: 34 }, seg(t, T.reg + 0.4, T.reg + 0.8) * out)
    place(s.labels.add, { x: ADD[0] + 70, y: ADD[1] + 40, w: 200, h: 34 }, seg(t, T.add + 0.4, T.add + 0.8) * out)
  },
})
