import { scene } from '@cueframe/core'
import { board, type CamMove } from '../../../recipes/doodle.js'
import { seg } from '../../../recipes/motion.js'
import { drawers, pageTable, pain, paging, sharing, type Live } from './shots.js'

// One infinite canvas; each shot draws in its own region and the camera travels between them.
// `len` is how long a shot draws (mount fails if it draws longer); holds follow from it.
const REGIONS = [
  { id: 'pain', len: 14.4, origin: [0, 0], cam: { x: 960, y: 540, z: 1 }, draw: pain },
  { id: 'drawers', len: 15.2, origin: [2200, 0], cam: { x: 3100, y: 540, z: 1.15 }, draw: drawers },
  { id: 'paging', len: 16.3, travel: 2.6, origin: [1000, 1300], cam: { x: 1960, y: 1840, z: 1 }, draw: paging },
  { id: 'page-table', len: 19.8, origin: [3100, 1300], cam: { x: 4060, y: 1840, z: 1 }, draw: pageTable },
  { id: 'sharing', len: 16.9, origin: [2050, 2600], cam: { x: 3010, y: 3140, z: 1 }, draw: sharing },
] as const
const TRAVEL = 2

let clock = 0.3
const SHOTS = REGIONS.map((r, i) => {
  const travel = 'travel' in r ? r.travel : TRAVEL
  const at = i === 0 ? clock : clock + travel - 0.4
  const hold = at + r.len + 0.4
  clock = hold + 0.1
  return { ...r, at, hold, travel }
})
const OVERVIEW = { at: clock + 0.1, dur: 3.6, cam: { x: 2510, y: 1840, z: 0.25 } }
const END = OVERVIEW.at + OVERVIEW.dur + 2.4

const moves: CamMove[] = []
for (const [i, s] of SHOTS.entries()) {
  if (i === 0) continue
  const leave = SHOTS[i - 1]!.hold + 0.1
  if (s.id === 'paging') {
    // Zoom out on the way to show where we are; push in once the pages arrive.
    moves.push({ ...s.cam, at: leave, dur: s.travel, out: 0.5 })
    moves.push({ x: 2040, y: 1830, z: 1.06, at: s.at + 7.5, dur: 1.8 })
  } else moves.push({ ...s.cam, at: leave, dur: s.travel })
}
moves.push({ ...OVERVIEW.cam, at: OVERVIEW.at, dur: OVERVIEW.dur })

export default scene({
  id: 'board',
  dur: END,
  holds: [
    ...SHOTS.map((s) => ({ id: s.id, at: s.hold, dur: 2.5 })),
    { id: 'overview', at: OVERVIEW.at + OVERVIEW.dur + 0.2, dur: 3 },
  ],
  mount(ctx) {
    const b = board(ctx.root, ctx.stage, { seed: 'paged-attention', font: 'Virgil', mono: 'JBM', boil: 8, overviewZoom: 0.8 })
    const lives: Live[] = []
    const late: string[] = []
    for (const s of SHOTS) {
      const g = b.group()
      g.setAttribute('transform', `translate(${s.origin[0]} ${s.origin[1]})`)
      b.goto(s.at)
      lives.push(b.inside(g, () => s.draw(b)))
      if (b.cursor > s.hold - 0.35) late.push(`${s.id} draws ${s.at}-${b.cursor.toFixed(2)}s, hold at ${s.hold}s`)
    }
    if (late.length) throw new Error(`shots overrun their holds: ${late.join('; ')}`)
    b.camera(SHOTS[0]!.cam, moves)
    return { b, lives }
  },
  render(f, s) {
    s.b.render(f)
    for (const live of s.lives) live(f.t, f.t + f.idle)
    s.b.svg.style.opacity = String(1 - seg(f.t, END - 1.4, END - 0.2))
  },
})
