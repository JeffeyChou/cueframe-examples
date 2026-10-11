// Geometry: four sections (points, circle, sine, limit), three lines each, drawn by the original
// visuals through the shim; the viewport breathes out to full screen on each capitalised word.
import { PAL } from '../gfx.ts'
import { LINES } from '../song.ts'
import { inOutCubic } from '../../motion.ts'
import type { Ctx, Scene } from '../types.ts'
import { VISUALS } from './geomvis.ts'
import { C256, type Kind, type Section, View } from './shim.ts'
import { T, flash, seg, slam } from './kit.ts'

const KINDS: [Kind, string, number, number[], readonly number[]][] = [
  ['points', 'points.obj', 51, [17, 18, 24, 31, 38, 45, 51, 87, 123, 159, 195, 231], PAL.cyan],
  ['circle', 'circle.geo', 214, [52, 88, 130, 136, 172, 178, 214, 220, 221, 222, 229, 231], PAL.amber],
  ['sine', 'sine.wav', 84, [22, 28, 34, 35, 41, 47, 83, 84, 120, 121, 157, 194], [0x020a06, 0x0a3a20, 0x18a060, 0x5fffaf, 0xe8fff0]],
  ['limit', 'limit.inf', 201, [53, 54, 89, 90, 126, 127, 163, 164, 200, 201, 207, 219], PAL.magenta],
]
const FIRST = 12
const SECTIONS: (Section & { pal: readonly number[] })[] = KINDS.map(([kind, file, accent, ramp, pal], k) => ({
  kind, file, accent, ramp, pal,
  t0: T(FIRST + 3 * k), mid: T(FIRST + 3 * k + 1), hit: T(FIRST + 3 * k + 2),
  t1: T(FIRST + 3 * k + 3),
}))
const secAt = (t: number) => { let i = 0; while (i + 1 < SECTIONS.length && t >= SECTIONS[i + 1]!.t0) i++; return SECTIONS[i]! }

export const geometry: Scene = {
  pal: PAL.cyan,
  dock: (x) => {
    const s = secAt(x.t)
    const out = seg(x.t, s.hit - 0.05, s.hit + 0.25, inOutCubic) * (1 - seg(x.t, s.t1 - 0.3, s.t1, inOutCubic))
    const intro = 1 - seg(x.t, x.act.t0 - 0.2, x.act.t0 + 0.4, inOutCubic)
    return Math.max(out, intro)
  },
  title: (x) => `render://${secAt(x.t).file}`,
  glitch: (x) => 0.4 * flash(x.t, secAt(x.t).t0, 0.15),
  readouts: (x) => VISUALS[secAt(x.t).kind].readouts(x.t, secAt(x.t)).map(([a, b]) => [a, b] as [string, string]),
  log: (k) => VISUALS[secAt(k / 9).kind].log(k, secAt(k / 9)),
  view(x, V) {
    const s = secAt(x.t)
    x.accent = C256[s.accent]!
    x.pal = s.pal
    VISUALS[s.kind].draw(new View(x.c, V.x, V.y, V.w, V.h), x.t, s)
    const l = LINES[FIRST + 3 * SECTIONS.indexOf(s) + 2]!
    if (x.t >= l.t0) slam(x, { x: V.x, y: V.y, w: V.w, h: Math.round(V.h * 0.4) }, l, { pal: s.pal, maxH: 9, out: 1 - 0.65 * seg(x.t, l.t0 + 0.5, l.t0 + 0.8) })
  },
}
