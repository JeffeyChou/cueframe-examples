// AE-style block grammar: rectangles snapped to a coarse grid inside a tile, each with another
// treatment (ASCII, dots, inverted, a solid accent). Seeded per shot and hit, so a set holds until
// the next hit.
import { seeded } from '@cueframe/core'
import type { Block, Mode } from './look.js'

export interface BlockOptions {
  n: number
  modes: Mode[]
  /** Grid the blocks snap to (columns, rows of the tile). */
  grid?: [number, number]
  /** Block size range in grid cells. */
  w?: [number, number]
  h?: [number, number]
  /** Keep blocks inside this part of the tile (0..1). */
  area?: { x: number; y: number; w: number; h: number }
}

export function blocks(seed: string | number, o: BlockOptions): Block[] {
  const r = seeded(`blk:${seed}`)
  const [gc, gr] = o.grid ?? [24, 14]
  const [w0, w1] = o.w ?? [1, 5]
  const [h0, h1] = o.h ?? [1, 3]
  const A = o.area ?? { x: 0, y: 0, w: 1, h: 1 }
  const out: Block[] = []
  for (let i = 0; i < o.n; i++) {
    const w = r.int(w0, w1), h = r.int(h0, h1)
    const cx = r.int(Math.ceil(A.x * gc), Math.max(Math.ceil(A.x * gc), Math.floor((A.x + A.w) * gc) - w))
    const cy = r.int(Math.ceil(A.y * gr), Math.max(Math.ceil(A.y * gr), Math.floor((A.y + A.h) * gr) - h))
    out.push({ x: cx / gc, y: cy / gr, w: w / gc, h: h / gr, mode: o.modes[i % o.modes.length]! })
  }
  return out
}
