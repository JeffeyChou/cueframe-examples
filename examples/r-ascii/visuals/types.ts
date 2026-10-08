import type { Frame } from '@cueframe/core'
import type { Grid, Rect } from '../lib.js'
import type { Stanza } from '../timing.js'

export type Readout = [key: string, value: string, color?: number]
export type LogLine = [t: number, text: string, color: number]

export interface Vis {
  title: string
  /** u = seconds since stanza start; m = line-onset offsets within the stanza, plus its end. */
  draw(g: Grid, V: Rect, u: number, m: number[], f: Frame): Readout[]
  log(st: Stanza): LogLine[]
}

export const marks = (st: Stanza) => [...st.lines.map((l) => l.t0 - st.t0), st.t1 - st.t0]
