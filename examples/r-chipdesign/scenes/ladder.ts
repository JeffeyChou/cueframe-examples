// c1–c7: spec → circuit, too many transistors, and the abstraction ladder
// (transistors → gate → adder → core → chip). Every step up is the camera pulling back: a card
// shrinks into a cell while the rest of its grid comes in around it, and the grid shrinks into
// the next card. Layouts and keys, no interpolation.
import { cue, scene, type Motion } from '@cueframe/core'
import { CARDS, FET, ICON, LEVELS, nandSchematic, PARTS } from '../art.js'
import { blocking, C, center, el, inOutCubic, MONO, outCubic, said, SANS, seg, start, ui, type Rect } from '../lib.js'

const CX = 1150
const CY = 580
const CARD = center(CX, CY, 360, 250)
const SCHEM = center(CX, CY, 520, 340)
const [COLS, CW, CH, GAP] = [6, 150, 96, 16]
const GRID = center(CX, CY, COLS * CW + (COLS - 1) * GAP, 4 * CH + 3 * GAP)
const cell = (i: number): Rect => ({ x: GRID.x + (i % COLS) * (CW + GAP), y: GRID.y + Math.floor(i / COLS) * (CH + GAP), w: CW, h: CH })
const RUNG = (k: number): Rect => ({ x: 106, y: 736 - k * 100, w: 28, h: 28 })
// The cell a card shrinks into, near the grid's middle; hidden spots that make a grid zoom as one:
// around the card it grows out of, and inside the card it shrinks into.
const MID = 8
const zoomed = (r: Rect): Rect => {
  const [sx, sy, c] = [CARD.w / CW, CARD.h / CH, cell(MID)]
  return { x: CARD.x + (r.x - c.x) * sx, y: CARD.y + (r.y - c.y) * sy, w: r.w * sx, h: r.h * sy }
}
const PACK = CARD.w / GRID.w
const scaled = (r: Rect, k: number): Rect => ({ x: CX + (r.x - CX) * k, y: CY + (r.y - CY) * k, w: r.w * k, h: r.h * k })
const hidden = (r: Rect) => ({ ...r, opacity: 0 })
const ZOOM = 0.9
// Layouts: one per beat of the narration.
const IDS = ['spec', 'circuit', 'field', 'cannot', 'ladder', 'schematic', 'gate', 'gates', 'adder', 'parts', 'core', 'cores', 'chip', 'leave'] as const
const STEP = ['gate', 'adder', 'core', 'chip'] as const   // where card k appears
const GRIDS = ['gates', 'parts', 'cores'] as const          // where grid k appears

function card(parent: Element, c: (typeof CARDS)[number]) {
  const p = ui.panel(parent).el
  const icon = el(p, 'div', { left: '50%', top: '30%', width: '42%', transform: 'translate(-50%,-50%)', color: C.accent, filter: `drop-shadow(0 0 8px ${C.accent}88)` })
  icon.innerHTML = c.icon
  el(p, 'div', { left: '0', right: '0', bottom: '22%', textAlign: 'center', font: `700 34px ${SANS}`, color: C.text }, c.label)
  el(p, 'div', { left: '0', right: '0', bottom: '10%', textAlign: 'center', font: `500 14px ${MONO}`, color: C.dim, letterSpacing: '.3em' }, c.en)
  return p
}

function gridCell(parent: Element, k: number, i: number) {
  const p = ui.panel(parent, { role: k === 2 ? 'warm' : 'accent' }).el
  p.style.borderRadius = '6px'
  const inner = el(p, 'div', { left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: C.accent, width: k === 3 ? '44%' : '58%', textAlign: 'center' })
  if (k === 1) inner.innerHTML = [ICON.gate, ICON.nor, ICON.not][i % 3]!
  else if (k === 2) { inner.textContent = PARTS[i]!; Object.assign(inner.style, { font: `600 26px ${MONO}`, color: C.warm }) }
  else inner.innerHTML = ICON.core
  return p
}

export default scene({
  id: 'ladder',
  at: cue('scene.c1.start'),
  end: cue('scene.h1.start', { offset: 1.2 }),
  mount(ctx) {
    const root = ctx.root
    const b = blocking(IDS)
    const T = { billion: said(ctx, 'c2', '上千亿'), cannot: said(ctx, 'c2', '不可能') }

    const spec = ctx.key(b.set(ui.panel(root).el, { spec: center(CX, CY, 560, 400), circuit: center(820, CY, 460, 400), field: null }), 'spec')
    el(spec, 'div', { left: '32px', top: '26px', font: `700 30px ${SANS}`, color: C.text }, '规格书')
    el(spec, 'div', { right: '32px', top: '36px', font: `500 15px ${MONO}`, color: C.dim, letterSpacing: '.3em' }, 'SPEC')
    ;[['计算核心', '144 组'], ['片上缓存', '96 MB'], ['HBM', '8 堆栈'], ['功耗上限', '1000 W']].forEach(([a, v], i) => {
      el(spec, 'div', { left: '32px', top: `${100 + i * 64}px`, font: `500 24px ${SANS}`, color: C.dim }, a)
      el(spec, 'div', { right: '32px', top: `${98 + i * 64}px`, font: `600 26px ${MONO}`, color: C.accent }, v)
      el(spec, 'div', { left: '32px', right: '32px', top: `${146 + i * 64}px`, height: '1px', background: C.edge })
    })
    ctx.key(b.set(el(root, 'div', { background: `linear-gradient(90deg, ${C.accent}00, ${C.accent})` }), { circuit: { x: 1060, y: CY - 2, w: 240, h: 4 }, field: null }), 'arrow')
    const circuit = ctx.key(b.set(ui.panel(root, { role: 'warm' }).el, { circuit: center(1520, CY, 340, 240), field: null }), 'circuit', { enter: 'pop' })
    circuit.style.borderStyle = 'dashed'
    el(circuit, 'div', { inset: '0', display: 'grid', placeItems: 'center', font: `700 40px ${SANS}`, color: C.warm }, '电路 ?')

    // One pull-back from a few transistors to a sea of them, then the count and "one by one?".
    const fieldBox = ctx.key(b.set(el(root, 'div', { overflow: 'hidden' }), { field: { x: 560, y: 250, w: 1250, h: 640, opacity: 0.8 }, ladder: null }), 'field')
    const lens = el(fieldBox, 'div', { inset: '0' })
    const field = ctx.canvas('field', { w: 1250, h: 640 })
    lens.append(field.canvas)
    const hue = (x: number, y: number) => ((x * 7 + y * 13) % 5 === 0 ? C.warm : C.accent)
    const near: string[] = []
    for (let y = 6; y < 640; y += 12) for (let x = 6; x < 1250; x += 12) {
      field.globalAlpha = hue(x, y) === C.warm ? 0.55 : 0.35
      field.fillStyle = hue(x, y)
      field.fillRect(x, y, 3, 3)
      if (Math.abs(x - 625) < 230 && Math.abs(y - 320) < 125) near.push(`<use href="#fet" x="${x - 4.5}" y="${y - 4.5}" color="${hue(x, y)}"/>`)
    }
    const fets = el(lens, 'div', { inset: '0' })
    fets.innerHTML = `<svg width="1250" height="640" viewBox="0 0 1250 640"><defs>${FET}</defs>${near.join('')}</svg>`
    const num = ui.counter(root, { unit: '个晶体管', align: 'middle', role: 'warm', format: (v) => `>${Math.round(v)}亿` })
    ctx.key(b.set(num.el, { field: ui.box(num, CX - 450, 360, 900), ladder: null }), 'count')
    const one = ctx.key(b.set(el(root, 'div', { textAlign: 'center', font: `600 40px ${SANS}`, color: C.dim }), { cannot: { x: CX - 200, y: 680, w: 400, h: 56 }, ladder: null }), 'one')
    one.append('一个一个画？')
    const strike = el(one, 'div', { left: '90px', right: '90px', top: '52%', height: '4px', background: C.alert, transformOrigin: 'left' })

    // The ladder: rungs come in from the bottom; the marker climbs as each level is named.
    const rungs = LEVELS.map((name, k) => {
      const r = ctx.key(b.set(el(root, 'div', { font: `500 26px ${SANS}`, color: C.dim, paddingLeft: '40px', boxSizing: 'border-box', whiteSpace: 'nowrap' }),
        { ladder: { x: 112, y: 730 - k * 100, w: 220, h: 40 }, leave: null }), `rung-${k}`)
      el(r, 'div', { left: '0', top: '12px', width: '16px', height: '16px', borderRadius: '3px', border: `2px solid ${C.faint}`, boxSizing: 'border-box' })
      r.append(name)
      return r
    })
    ctx.key(b.set(el(root, 'div', { borderRadius: '6px', border: `2px solid ${C.accent}`, boxShadow: `0 0 14px ${C.accent}`, boxSizing: 'border-box' }),
      { ladder: RUNG(0), gate: RUNG(1), adder: RUNG(2), core: RUNG(3), chip: RUNG(4), leave: null }), 'marker')

    // Level 0: a transistor-level schematic; card 1 grows out of it, card k + 1 out of grid k.
    const schem = ctx.key(b.set(ui.panel(root).el, { schematic: SCHEM, gate: null }), 'schematic')
    el(schem, 'div', { inset: '24px', color: C.accent }).innerHTML = nandSchematic()
    CARDS.forEach((c, k) => ctx.key(b.set(card(root, c), {
      ...(k > 0 ? { [GRIDS[k - 1]!]: hidden(scaled(CARD, 1 / PACK)) } : {}),
      [STEP[k]!]: CARD, ...(k < 3 ? { [GRIDS[k]!]: null } : { leave: null }),
    }), `card${k + 1}`))
    for (let k = 1; k <= 3; k++) {
      for (let i = 0; i < 24; i++) {
        ctx.key(b.set(gridCell(root, k, i), { [STEP[k - 1]!]: hidden(zoomed(cell(i))), [GRIDS[k - 1]!]: cell(i), [STEP[k]!]: hidden(scaled(cell(i), PACK)) }), `cell${k}-${i}`)
      }
    }
    // Where the chip card goes when the section ends: an anchor that paints nothing.
    ctx.key(b.set(el(root, 'div'), { leave: center(CX, 330, 180, 125) }), 'up')
    CARDS.forEach((c, k) => {
      const p = ctx.key(b.set(ui.panel(root, { role: 'warm' }).el, { [STEP[k]!]: { x: 1600, y: 250, w: 250, h: 120 }, ...(k < 3 ? { [STEP[k + 1]!]: null } : { leave: null }) }), `badge-${k}`)
      el(p, 'div', { left: '24px', top: '14px', font: `700 44px ${MONO}`, color: C.warm, whiteSpace: 'nowrap' }, c.badge[0])
      el(p, 'div', { left: '26px', top: '74px', font: `500 22px ${SANS}`, color: C.dim }, c.badge[1])
    })

    const at: Record<(typeof IDS)[number], number> = {
      spec: start('c1'), circuit: said(ctx, 'c1', '变成电路'), field: start('c2'), cannot: T.cannot, ladder: start('c3'),
      schematic: start('c4') + 0.2, gate: said(ctx, 'c4', '逻辑门'), gates: start('c5'), adder: said(ctx, 'c5', '加法器'),
      parts: start('c6'), core: said(ctx, 'c6', '计算核心'), cores: start('c7'), chip: said(ctx, 'c7', '整颗芯片'), leave: start('h1'),
    }
    const badge = (k: number) => ({ 'badge-*': { dur: 0.3 }, [`badge-${k}`]: { delay: 0.25 } })
    const shrink = (k: number) => ({ [`card${k}`]: { to: `cell${k}-${MID}`, dur: ZOOM }, [`cell${k}-*`]: { enter: 'move' as const, dur: ZOOM }, [`cell${k}-${MID}`]: { from: `card${k}` } })
    const collapse = (k: number) => ({ [`cell${k}-*`]: { exit: 'move' as const, dur: ZOOM }, [`card${k + 1}`]: { enter: 'move' as const, dur: ZOOM }, ...badge(k) })
    const motion: Partial<Record<(typeof IDS)[number], Record<string, Motion>>> = {
        circuit: { circuit: { delay: 0.3 }, arrow: { delay: 0.2 } },
        field: { count: { delay: T.billion - at.field } },
        ladder: { 'rung-*': { enter: 'fade' as const, stagger: 0.1 } },
        gate: { schematic: { to: 'card1' }, card1: { from: 'schematic' }, ...badge(0) },
        gates: shrink(1), adder: collapse(1), parts: shrink(2), core: collapse(2), cores: shrink(3), chip: collapse(3),
        leave: { card4: { to: 'up', dur: 1 } },
    }
    const lay = ctx.layouts(IDS.map((id) => ({ id, at: at[id], motion: motion[id] ?? {} })), b.apply)
    return { lay, T, num, strike, lens, dots: field.canvas, fets, pull: [at.field, T.billion + 1] as const, rungs }
  },
  render(f, s) {
    // What moves on its own: the count, the strike, the field's pull-back, the lit rung.
    s.num.set(1000 * seg(f.t, s.T.billion, s.T.billion + 1, outCubic))
    s.strike.style.transform = `scaleX(${seg(f.t, s.T.cannot + 0.4, s.T.cannot + 0.8, outCubic).toFixed(4)})`
    const z = 8 ** (1 - seg(f.t, s.pull[0], s.pull[1], inOutCubic))
    s.lens.style.transform = `scale(${z.toFixed(4)})`
    s.fets.style.opacity = Math.min(1, Math.max(0, (z - 2) / 2.5)).toFixed(3)
    s.dots.style.opacity = Math.min(1, Math.max(0, (5 - z) / 2.5)).toFixed(3)
    const level = STEP.filter((id) => IDS.indexOf(id) <= s.lay.index(f)).length
    s.rungs.forEach((r, k) => { r.style.color = k === level ? C.accent : k < level ? C.text : C.dim })
  },
})
