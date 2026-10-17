// The code panel that three scenes hand on to one another (key "code"): Verilog with per-character
// spans, so typing only toggles visibility.
import { C, CODE, el, panel } from './lib.js'

export type Tok = [string, string?]
export const COUNTER: Tok[][] = [
  [['always', 'kw'], [' @('], ['posedge', 'kw'], [' clk)']],
  [['  '], ['count', 'id'], [' <= '], ['count', 'id'], [' + 1;']],
]
export const HARDWARE: Tok[][] = [
  [['always', 'kw'], [' @('], ['posedge', 'kw'], [' clk) '], ['begin', 'kw']],
  [['  '], ['a', 'id'], ['     <= sensor_a;']],
  [['  '], ['b', 'id'], ['     <= sensor_b;']],
  [['  '], ['avg', 'id'], ['   <= (a + b) >> 1;']],
  [['  '], ['alarm', 'id'], [' <= avg > limit;']],
  [['end', 'kw']],
]

export function lines(parent: HTMLElement, src: Tok[][], accent = C.cyan) {
  const box = el(parent, 'div', { left: `${CODE.pad}px`, top: `${CODE.pad}px` })
  box.className = 'chip-code'
  const rows = src.map((toks, r) => {
    const row = el(box, 'div', { position: 'relative', height: `${CODE.lh}px`, lineHeight: `${CODE.lh}px` })
    const hl = el(row, 'div', { left: '-12px', top: '4px', width: '760px', height: `${CODE.lh - 8}px`, background: `${accent}22`, borderLeft: `3px solid ${accent}`, opacity: '0' })
    el(row, 'span', { position: 'relative' }, String(r + 1)).className = 'ln'
    const chars: HTMLElement[] = []
    for (const [text, cls] of toks) for (const ch of text) {
      const s = el(row, 'span', { position: 'relative' }, ch)
      if (cls) s.className = cls
      chars.push(s)
    }
    return { row, hl, chars }
  })
  return { box, rows, n: rows.reduce((a, r) => a + r.chars.length, 0) }
}
export type Lines = ReturnType<typeof lines>

/** Show the first `n` characters, line by line; returns [row, col] of the next one. */
export function typeTo(block: Lines, n: number): [number, number] {
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

/** A code panel with the counter's two lines (and, for the comparison, the hardware code). */
export function codePanel(parent: HTMLElement, withHardware = false) {
  const p = panel(parent)
  const counter = lines(p, COUNTER)
  const hw = withHardware ? lines(p, HARDWARE) : null
  const caretEl = el(p, 'div', { width: `${CODE.cw}px`, height: '34px', background: C.cyan, opacity: '0' })
  return { p, counter, hw, caret: caretEl }
}
