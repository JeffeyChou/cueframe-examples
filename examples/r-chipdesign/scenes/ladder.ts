// c1–c7: spec → circuit, too many transistors, and the abstraction ladder
// (transistors → gate → adder → core → chip). Each level's card shrinks into one cell of a grid,
// and the grid collapses into the next level's card.
import { cue, scene } from '@cueframe/core'
import { C, center, el, lerpRect, MONO, outBack, outCubic, inOutCubic, panel, place, said, SANS, seg, start, type Rect } from '../lib.js'

const CX = 1150
const CY = 580
const CARD = center(CX, CY, 360, 250)
const SCHEM = center(CX, CY, 520, 340)
const COLS = 6
const ROWS = 4
const CW = 150
const CH = 96
const GAP = 16
const GRID = center(CX, CY, COLS * CW + (COLS - 1) * GAP, ROWS * CH + (ROWS - 1) * GAP)
const cell = (i: number): Rect => ({ x: GRID.x + (i % COLS) * (CW + GAP), y: GRID.y + Math.floor(i / COLS) * (CH + GAP), w: CW, h: CH })

const ICON = {
  gate: `<svg viewBox="0 0 100 60"><path d="M14 8h30a22 22 0 0 1 0 44H14z" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="72" cy="30" r="5" fill="none" stroke="currentColor" stroke-width="4"/><path d="M0 20h14M0 40h14M77 30h23" stroke="currentColor" stroke-width="4"/></svg>`,
  nor: `<svg viewBox="0 0 100 60"><path d="M10 8q22 0 40 6q16 8 22 16q-6 8-22 16q-18 6-40 6q12-22 0-44z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M72 30h28M0 20h16M0 40h16" stroke="currentColor" stroke-width="4"/></svg>`,
  not: `<svg viewBox="0 0 100 60"><path d="M20 8l44 22l-44 22z" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="70" cy="30" r="5" fill="none" stroke="currentColor" stroke-width="4"/><path d="M0 30h20M75 30h25" stroke="currentColor" stroke-width="4"/></svg>`,
  add: `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" stroke-width="4"/><path d="M30 16v28M16 30h28" stroke="currentColor" stroke-width="5"/></svg>`,
  core: `<svg viewBox="0 0 60 60">${[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `<rect x="${6 + c * 17}" y="${6 + r * 17}" width="14" height="14" fill="currentColor" opacity="${0.45 + 0.18 * ((r + c) % 3)}"/>`)).join('')}</svg>`,
  chip: `<svg viewBox="0 0 60 60"><rect x="12" y="12" width="36" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="4"/><rect x="21" y="21" width="18" height="18" fill="currentColor" opacity=".6"/>${[18, 26, 34, 42].map((p) => `<path d="M${p} 4v8M${p} 48v8M4 ${p}h8M48 ${p}h8" stroke="currentColor" stroke-width="3"/>`).join('')}</svg>`,
}
const PARTS = ['REG', 'MUX', 'ALU', 'CMP', 'SHL', 'DEC', 'REG', 'ADD', 'MUX', 'REG', 'CMP', 'ALU', 'SHL', 'REG', 'MUX', 'ADD', 'DEC', 'REG', 'ALU', 'MUX', 'CMP', 'REG', 'ADD', 'SHL']
const LEVELS = ['晶体管', '逻辑门', '加法器', '计算核心', '整颗芯片']
const CARDS = [
  { label: '逻辑门', en: 'LOGIC GATE', icon: ICON.gate, badge: ['≈4', '个晶体管'] },
  { label: '加法器', en: 'ADDER', icon: ICON.add, badge: ['几十~上百', '个逻辑门'] },
  { label: '计算核心', en: 'CORE', icon: ICON.core, badge: ['成千上万', '个部件'] },
  { label: '整颗芯片', en: 'CHIP', icon: ICON.chip, badge: ['>1000亿', '个晶体管'] },
]

function card(parent: Element, c: (typeof CARDS)[number]) {
  const p = panel(parent)
  const icon = el(p, 'div', { left: '50%', top: '30%', width: '42%', transform: 'translate(-50%,-50%)', color: C.cyan, filter: `drop-shadow(0 0 8px ${C.cyan}88)` })
  icon.innerHTML = c.icon
  el(p, 'div', { left: '0', right: '0', bottom: '22%', textAlign: 'center', font: `700 34px ${SANS}`, color: C.text }, c.label)
  el(p, 'div', { left: '0', right: '0', bottom: '10%', textAlign: 'center', font: `500 14px ${MONO}`, color: C.dim, letterSpacing: '.3em' }, c.en)
  return p
}

function gridCells(parent: Element, k: number) {
  return Array.from({ length: COLS * ROWS }, (_, i) => {
    const p = panel(parent, k === 2 ? C.orange : C.cyan)
    p.style.borderRadius = '6px'
    const inner = el(p, 'div', { left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: C.cyan, width: '58%', textAlign: 'center' })
    if (k === 1) inner.innerHTML = [ICON.gate, ICON.nor, ICON.not][i % 3]!
    else if (k === 2) { inner.textContent = PARTS[i]!; Object.assign(inner.style, { font: `600 26px ${MONO}`, color: C.orange }) }
    else { inner.innerHTML = ICON.core; inner.style.width = '44%' }
    return p
  })
}

export default scene({
  id: 'ladder',
  at: cue('scene.c1.start'),
  end: cue('scene.h1.start', { offset: 1.2 }),
  mount(ctx) {
    const root = ctx.root
    const T = {
      c1: start('c1'), circuit: said(ctx, 'c1', '变成电路'),
      c2: start('c2'), billion: said(ctx, 'c2', '上千亿'), cannot: said(ctx, 'c2', '不可能'),
      c3: start('c3'), c4: start('c4'), c5: start('c5'), c6: start('c6'), c7: start('c7'), h1: start('h1'),
    }
    // Level k's card appears when its name is said; grid k appears at the next line.
    const A = [T.c4 + 0.2, said(ctx, 'c4', '逻辑门'), said(ctx, 'c5', '加法器'), said(ctx, 'c6', '计算核心'), said(ctx, 'c7', '整颗芯片')]
    const G = [0, T.c5, T.c6, T.c7]

    // Spec card and the circuit it must become.
    const spec = panel(root)
    el(spec, 'div', { left: '32px', top: '26px', font: `700 30px ${SANS}`, color: C.text }, '规格书')
    el(spec, 'div', { right: '32px', top: '36px', font: `500 15px ${MONO}`, color: C.dim, letterSpacing: '.3em' }, 'SPEC')
    ;[['计算核心', '144 组'], ['片上缓存', '96 MB'], ['HBM', '8 堆栈'], ['功耗上限', '1000 W']].forEach(([a, b], i) => {
      const y = 100 + i * 64
      el(spec, 'div', { left: '32px', top: `${y}px`, font: `500 24px ${SANS}`, color: C.dim }, a)
      el(spec, 'div', { right: '32px', top: `${y - 2}px`, font: `600 26px ${MONO}`, color: C.cyan }, b)
      el(spec, 'div', { left: '32px', right: '32px', top: `${y + 46}px`, height: '1px', background: C.edge })
    })
    const arrow = el(root, 'div', { left: '1060px', top: `${CY - 2}px`, height: '4px', background: `linear-gradient(90deg, ${C.cyan}00, ${C.cyan})`, transformOrigin: 'left' })
    const circuit = panel(root, C.orange)
    circuit.style.borderStyle = 'dashed'
    el(circuit, 'div', { inset: '0', display: 'grid', placeItems: 'center', font: `700 40px ${SANS}`, color: C.orange }, '电路 ?')

    // A field of transistors and the count.
    const field = ctx.canvas('field', { x: 560, y: 250, w: 1250, h: 640 })
    const fieldEl = field.canvas
    for (let y = 6; y < 640; y += 12) for (let x = 6; x < 1250; x += 12) {
      field.fillStyle = (x * 7 + y * 13) % 5 === 0 ? 'rgba(255,138,61,.55)' : 'rgba(56,214,232,.35)'
      field.fillRect(x, y, 3, 3)
    }
    const count = el(root, 'div', { left: `${CX}px`, top: '470px', transform: 'translate(-50%,-50%)', font: `700 150px ${MONO}`, color: C.orange, textShadow: `0 0 30px ${C.orange}66`, whiteSpace: 'nowrap' })
    const unit = el(root, 'div', { left: `${CX}px`, top: '575px', transform: 'translateX(-50%)', font: `600 36px ${SANS}`, color: C.text }, '个晶体管')
    const one = el(root, 'div', { left: `${CX}px`, top: '680px', transform: 'translateX(-50%)', font: `600 40px ${SANS}`, color: C.dim }, '一个一个画？')
    const strike = el(one, 'div', { left: '-8px', right: '-8px', top: '52%', height: '4px', background: C.red, transformOrigin: 'left' })

    // Ladder on the left.
    const ladder = el(root, 'div', { left: '110px', top: '330px', width: '260px', height: '470px' })
    el(ladder, 'div', { left: '9px', top: '30px', width: '2px', height: '400px', background: C.edge })
    const rungs = LEVELS.map((name, k) => {
      const y = 400 - k * 100
      const dot = el(ladder, 'div', { left: '2px', top: `${y + 14}px`, width: '16px', height: '16px', borderRadius: '3px', border: `2px solid ${C.faint}`, boxSizing: 'border-box', background: C.bg })
      const label = el(ladder, 'div', { left: '40px', top: `${y + 4}px`, font: `500 26px ${SANS}`, color: C.dim }, name)
      return { dot, label }
    })
    const marker = el(ladder, 'div', { left: '-4px', width: '28px', height: '28px', borderRadius: '6px', border: `2px solid ${C.cyan}`, boxShadow: `0 0 14px ${C.cyan}`, boxSizing: 'border-box' })

    // Level 0: a transistor-level schematic (a NAND gate).
    const schem = panel(root)
    const sv = el(schem, 'div', { inset: '24px', color: C.cyan })
    const fet = (x: number, y: number, p: boolean) => `<g transform="translate(${x} ${y})"><path d="M0 0v40M14 0v40M14 6h26M14 34h26M-30 20h30" stroke="currentColor" stroke-width="3" fill="none"/>${p ? '<circle cx="-6" cy="20" r="5" fill="none" stroke="currentColor" stroke-width="3"/>' : ''}</g>`
    sv.innerHTML = `<svg viewBox="0 0 470 290" width="100%" height="100%">
      <path d="M40 20h390M40 270h390" stroke="#ff8a3d" stroke-width="3"/><text x="440" y="26" fill="#7b8a93" font-size="16" font-family="monospace">VDD</text><text x="440" y="276" fill="#7b8a93" font-size="16" font-family="monospace">GND</text>
      ${fet(150, 40, true)}${fet(290, 40, true)}${fet(220, 140, false)}${fet(220, 200, false)}
      <path d="M190 46v-26M330 46v-26M190 74v26h140v-26M260 100v46M260 174v32M260 234v36M120 60h-60v120h130M260 60h-0M260 60h0" stroke="currentColor" stroke-width="3" fill="none"/>
      <path d="M330 100h110" stroke="currentColor" stroke-width="3"/><circle cx="440" cy="100" r="5" fill="currentColor"/>
      <path d="M60 220h130M260 60v0" stroke="currentColor" stroke-width="3"/></svg>`
    const cards = CARDS.map((c) => card(root, c))
    const grids = [[], gridCells(root, 1), gridCells(root, 2), gridCells(root, 3)] as HTMLElement[][]
    const badge = panel(root, C.orange)
    place(badge, { x: 1600, y: 250, w: 250, h: 120 })
    const badgeNum = el(badge, 'div', { left: '24px', top: '14px', font: `700 44px ${MONO}`, color: C.orange, whiteSpace: 'nowrap' })
    const badgeUnit = el(badge, 'div', { left: '26px', top: '74px', font: `500 22px ${SANS}`, color: C.dim })
    return { T, A, G, spec, arrow, circuit, fieldEl, count, unit, one, strike, ladder, rungs, marker, schem, cards, grids, badge, badgeNum, badgeUnit }
  },
  render(f, s) {
    const { T, A, G } = s
    const t = f.t

    // c1: the spec card, then it slides left and points at a circuit to be made.
    const specIn = seg(t, T.c1 - 0.3, T.c1 + 0.4, outCubic)
    const specMove = seg(t, T.circuit - 0.2, T.circuit + 0.5, inOutCubic)
    const c2out = 1 - seg(t, T.c2, T.c2 + 0.5)
    place(s.spec, lerpRect(center(CX, CY, 560, 400), center(820, CY, 460, 400), specMove), specIn * c2out, 0.96 + 0.04 * specIn)
    s.arrow.style.width = `${240 * seg(t, T.circuit, T.circuit + 0.5, outCubic)}px`
    s.arrow.style.opacity = String(c2out)
    const cin = seg(t, T.circuit + 0.3, T.circuit + 0.8, outBack)
    place(s.circuit, center(1520, CY, 340, 240), Math.min(1, cin) * c2out, 0.8 + 0.2 * cin)

    // c2: a field of transistors and the count.
    const fieldOn = seg(t, T.c2 - 0.1, T.c2 + 0.6) * (1 - seg(t, T.c3, T.c3 + 0.5))
    s.fieldEl.style.opacity = String(fieldOn * 0.8)
    s.fieldEl.style.transform = `scale(${(1.5 - 0.5 * seg(t, T.c2, T.c3, outCubic)).toFixed(4)})`
    const n = Math.round(1000 * seg(t, T.billion, T.billion + 1.0, outCubic))
    s.count.textContent = `>${n}亿`
    s.count.style.opacity = s.unit.style.opacity = String(seg(t, T.billion - 0.2, T.billion + 0.2) * (1 - seg(t, T.c3, T.c3 + 0.4)))
    s.one.style.opacity = String(seg(t, T.cannot - 0.3, T.cannot) * (1 - seg(t, T.c3, T.c3 + 0.4)))
    s.strike.style.transform = `scaleX(${seg(t, T.cannot + 0.4, T.cannot + 0.8, outCubic).toFixed(4)})`

    // Ladder: rungs appear from the bottom, the marker climbs as each level is named.
    const leave = 1 - seg(t, T.h1 + 0.2, T.h1 + 1.0)
    s.ladder.style.opacity = String(seg(t, T.c3, T.c3 + 0.5) * leave)
    let level = 0
    for (let k = 1; k < 5; k++) level += seg(t, A[k]! - 0.1, A[k]! + 0.5, inOutCubic)
    s.marker.style.top = `${400 - level * 100 + 8}px`
    s.rungs.forEach((r, k) => {
      const on = seg(t, T.c3 + 0.1 * k, T.c3 + 0.1 * k + 0.4)
      const lit = Math.max(0, 1 - Math.abs(level - k))
      r.label.style.opacity = String(on)
      r.dot.style.opacity = String(on)
      r.label.style.color = lit > 0.5 ? C.cyan : k < level ? C.text : C.dim
      r.dot.style.borderColor = k <= level + 0.01 ? C.cyan : C.faint
    })

    // Level 0 schematic → card 1.
    const schemIn = seg(t, A[0]!, A[0]! + 0.5, outCubic)
    const toCard1 = seg(t, A[1]! - 0.1, A[1]! + 0.5, inOutCubic)
    place(s.schem, lerpRect(SCHEM, CARD, toCard1), schemIn * (1 - toCard1))

    // Card k grows from the previous level (schematic or grid), then shrinks into cell 0 of its grid.
    for (let k = 1; k <= 4; k++) {
      const grow = seg(t, A[k]! - 0.1, A[k]! + 0.5, inOutCubic)
      const from = k === 1 ? SCHEM : GRID
      const shrink = k < 4 ? seg(t, G[k]!, G[k]! + 0.6, inOutCubic) : 0
      const r = shrink > 0 ? lerpRect(CARD, cell(0), shrink) : lerpRect(from, CARD, grow)
      const exit = k === 4 ? seg(t, T.h1 - 0.2, T.h1 + 0.9, inOutCubic) : 0
      const r2 = exit > 0 ? lerpRect(r, center(CX, 330, 180, 125), exit) : r
      place(s.cards[k - 1]!, r2, Math.min(grow * 1.4, 1) * (shrink > 0.95 ? 0 : 1) * (1 - exit))
    }

    // Grid k: cells pop in after the card has shrunk into cell 0, then collapse into card k+1.
    for (let k = 1; k <= 3; k++) {
      const collapse = seg(t, A[k + 1]! - 0.1, A[k + 1]! + 0.45, inOutCubic)
      s.grids[k]!.forEach((c, i) => {
        const pop = i === 0 ? seg(t, G[k]! + 0.55, G[k]! + 0.6) : seg(t, G[k]! + 0.4 + 0.025 * i, G[k]! + 0.7 + 0.025 * i, outBack)
        const r = lerpRect(cell(i), center(CX, CY, CW * 0.6, CH * 0.6), collapse)
        place(c, r, Math.min(1, pop) * (1 - collapse), i === 0 ? 1 : 0.7 + 0.3 * Math.min(1, pop))
      })
    }

    // Badge: the count for the level last named.
    let b = -1
    for (let k = 1; k <= 4; k++) if (t >= A[k]! - 0.1) b = k - 1
    const bk = b >= 0 ? seg(t, A[b + 1]! - 0.1, A[b + 1]! + 0.3) : 0
    if (b >= 0) { s.badgeNum.textContent = CARDS[b]!.badge[0]!; s.badgeUnit.textContent = CARDS[b]!.badge[1]! }
    s.badge.style.opacity = String(bk * leave)
    s.badge.style.transform = `translateY(${(1 - bk) * 12}px)`
  },
})
