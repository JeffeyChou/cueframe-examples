// Shared look, layout and timing of the slice. Every time comes from the narration (cues, words).
import { hud } from './lib/hud.js'
import cueTable from './build/cues.json'
export { said } from '@cueframe/recipes/subtitles.js'
export { blocking } from './lib/blocking.js'
export { seg, outCubic, inOutCubic, caret } from '@cueframe/recipes/motion.js'

export const CUES: Record<string, number> = cueTable
export const start = (id: string) => CUES[`scene.${id}.start`]!

export const SANS = '"Noto Sans SC", sans-serif'
export const MONO = '"Plex Mono", "Noto Sans SC", ui-monospace, monospace'
/** Instruments, and colours by role: accent (the subject), warm (the other side), alert, good. */
export const ui = hud({ sans: SANS, mono: MONO })
export const C = { ...ui.theme, bg: '#06080b', edge: '#1d3843' }

export interface Rect { x: number; y: number; w: number; h: number }
export const center = (cx: number, cy: number, w: number, h: number): Rect => ({ x: cx - w / 2, y: cy - h / 2, w, h })

export function el<K extends keyof HTMLElementTagNameMap>(parent: Element, tag: K, style: Partial<CSSStyleDeclaration> = {}, text?: string) {
  const e = document.createElement(tag)
  Object.assign(e.style, { position: 'absolute', ...style })
  if (text !== undefined) e.textContent = text
  parent.append(e)
  return e
}

// The code panel (key "code") three scenes hand on: a panel holding code at its natural size.
export const VERILOG = { keywords: ['always', 'posedge', 'begin', 'end'], idents: ['count', 'a', 'b', 'avg', 'alarm'] }
export const COUNTER = ['always @(posedge clk)', '  count <= count + 1;']
export const HARDWARE = ['always @(posedge clk) begin', '  a     <= sensor_a;', '  b     <= sensor_b;', '  avg   <= (a + b) >> 1;', '  alarm <= avg > limit;', 'end']
export const PANEL_H = { x: 600, y: 300, w: 1000, h: 168 }
export const PANEL_R = { x: 110, y: 300, w: 700, h: 168 }
export const PANEL_D = { x: 1000, y: 330, w: 810, h: 360 }
