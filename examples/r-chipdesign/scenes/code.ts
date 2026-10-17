// The code panel, alive from h1 to the end: typed in h2, moved left for RTL (r1–r4), and turned
// into the hardware side of the comparison (d1–d3). One scene so it never crossfades with itself.
import { cue, scene } from '@cueframe/core'
import { C, caret, CODE, CUES, el, inOutCubic, lerpRect, MONO, PANEL_D, PANEL_H, PANEL_R, panel, place, said, SANS, seg, start, token, type Rect } from '../lib.js'

type Tok = [string, string?]
const COUNTER: Tok[][] = [
  [['always', 'kw'], [' @('], ['posedge', 'kw'], [' clk)']],
  [['  '], ['count', 'id'], [' <= '], ['count', 'id'], [' + 1;']],
]
const HARDWARE: Tok[][] = [
  [['always', 'kw'], [' @('], ['posedge', 'kw'], [' clk) '], ['begin', 'kw']],
  [['  '], ['a', 'id'], ['     <= sensor_a;']],
  [['  '], ['b', 'id'], ['     <= sensor_b;']],
  [['  '], ['avg', 'id'], ['   <= (a + b) >> 1;']],
  [['  '], ['alarm', 'id'], [' <= avg > limit;']],
  [['end', 'kw']],
]

/** Lines of per-character spans, so typing only toggles visibility. */
function lines(parent: HTMLElement, src: Tok[][]) {
  const box = el(parent, 'div', { left: `${CODE.pad}px`, top: `${CODE.pad}px` })
  box.className = 'chip-code'
  const rows = src.map((toks, r) => {
    const row = el(box, 'div', { position: 'relative', height: `${CODE.lh}px`, lineHeight: `${CODE.lh}px` })
    const hl = el(row, 'div', { left: '-12px', top: '4px', width: '760px', height: `${CODE.lh - 8}px`, background: `${C.cyan}22`, borderLeft: `3px solid ${C.cyan}`, opacity: '0' })
    const ln = document.createElement('span')
    ln.className = 'ln'
    ln.textContent = String(r + 1)
    ln.style.position = 'relative'
    row.append(ln)
    const chars: HTMLElement[] = []
    for (const [text, cls] of toks) for (const ch of text) {
      const s = document.createElement('span')
      s.textContent = ch
      s.style.position = 'relative'
      if (cls) s.className = cls
      row.append(s)
      chars.push(s)
    }
    return { row, hl, chars }
  })
  return { box, rows, n: rows.reduce((a, r) => a + r.chars.length, 0) }
}

/** Show the first `n` characters, line by line. Returns [row, col] of the next character. */
function typeTo(block: ReturnType<typeof lines>, n: number): [number, number] {
  let left = n
  let at: [number, number] = [0, 0]
  block.rows.forEach((r, i) => {
    const k = Math.max(0, Math.min(r.chars.length, left))
    r.chars.forEach((c, j) => { c.style.visibility = j < k ? 'visible' : 'hidden' })
    if (left >= 0 && left <= r.chars.length) at = [i, k]
    left -= r.chars.length + 1
  })
  return at
}

export default scene({
  id: 'code',
  at: cue('scene.h1.start'),
  end: cue('total'),
  mount(ctx) {
    const T = {
      h1: start('h1'), describe: said(ctx, 'h1', '描述'),
      h2: start('h2'), r1: start('r1'), r3: start('r3'), tick: said(ctx, 'r3', '时钟每跳'),
      d1: start('d1'), d3: start('d3'), parallel: said(ctx, 'd3', '同时工作'), total: CUES.total!,
    }
    const p = panel(ctx.root)
    const counter = lines(p, COUNTER)
    const hw = lines(p, HARDWARE)
    const cur = el(p, 'div', { width: `${CODE.cw}px`, height: '34px', background: C.cyan })
    const tab = el(ctx.root, 'div', { font: `600 24px ${SANS}`, color: C.cyan, letterSpacing: '.06em' }, '硬件 · Verilog')
    const note = el(ctx.root, 'div', { font: `600 28px ${SANS}`, color: C.green, whiteSpace: 'nowrap' }, '每个周期，所有行同时生效')
    return { T, p, counter, hw, cur, tab, note }
  },
  render(f, s) {
    const { T } = s
    const t = f.t
    // Panel: centre (h1–h3) → left (RTL) → right half (comparison).
    const toR = seg(t, T.r1 - 0.1, T.r1 + 0.7, inOutCubic)
    const toD = seg(t, T.d1, T.d1 + 0.8, inOutCubic)
    const r: Rect = toD > 0 ? lerpRect(PANEL_R, PANEL_D, toD) : lerpRect(PANEL_H, PANEL_R, toR)
    place(s.p, r, seg(t, T.describe - 0.2, T.describe + 0.4))

    // Counter code: typed during h2, swapped for the comparison code in d1.
    const n = Math.floor(Math.max(0, t - T.h2 - 0.4) * 11)
    const [row, col] = typeTo(s.counter, n)
    const swap = seg(t, T.d1 + 0.2, T.d1 + 0.6)
    s.counter.box.style.opacity = String(1 - swap)
    s.hw.box.style.opacity = String(swap)
    typeTo(s.hw, swap > 0 ? s.hw.n + 6 : 0)
    const typing = n < s.counter.n + 1
    s.cur.style.left = `${CODE.pad + CODE.gutter + col * CODE.cw}px`
    s.cur.style.top = `${CODE.pad + row * CODE.lh + 7}px`
    s.cur.style.opacity = String(swap === 0 && (typing || caret(t)) && t < T.r3 ? 0.9 : 0)

    // r3: both counter lines light on each clock tick.
    const P = 0.6
    const ph = t >= T.tick ? ((t - T.tick) % P) / P : 1
    const flash = t >= T.tick && t < T.d1 ? Math.exp(-4 * ph) : 0
    s.counter.rows.forEach((x) => { x.hl.style.opacity = String(flash) })
    // d3: every hardware line lights at once, every cycle.
    const ph3 = t >= T.parallel ? ((t - T.parallel) % P) / P : 1
    const all = t >= T.parallel ? 0.25 + 0.75 * Math.exp(-4 * ph3) : 0
    s.hw.rows.forEach((x) => { x.hl.style.opacity = String(all) })

    place(s.tab, { x: r.x + 4, y: r.y - 44, w: 400, h: 32 }, swap)
    place(s.note, { x: PANEL_D.x, y: PANEL_D.y + PANEL_D.h + 28, w: 600, h: 40 }, seg(t, T.parallel - 0.2, T.parallel + 0.3))
  },
})

export const counterToken = (row: number, col: number, len: number) => token(PANEL_R, row, col, len)
