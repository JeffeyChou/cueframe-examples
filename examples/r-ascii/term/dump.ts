// Renders frames to JSON cell dumps for tools/snap.py: tsx term/dump.ts <cols> <rows> <out.json> t1,t2,...
import { writeFileSync } from 'node:fs'
import { Cells } from '../engine/cells.ts'
import { renderFrame } from '../engine/frame.ts'

const [cols, rows, out, times] = process.argv.slice(2)
const c = new Cells(Number(cols), Number(rows))
const frames = times!.split(',').map(Number).map((t) => {
  const t0 = performance.now()
  renderFrame(c, t, Math.round(t * 30), 'term')
  const ms = performance.now() - t0
  return { t, ms, ch: c.ch.join('\u0001'), fg: Array.from(c.fg), bg: Array.from(c.bg), at: Array.from(c.at) }
})
writeFileSync(out!, JSON.stringify({ cols: c.cols, rows: c.rows, frames }))
console.error(frames.map((f) => `${f.t}s ${f.ms.toFixed(1)}ms`).join('  '))
