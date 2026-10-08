import { seeded } from '@cueframe/core'
import { C, CH, CW, RAMP_CYAN, big, fx, project, ramp, rot, smooth, type V3 } from '../lib.js'
import type { Vis } from './types.js'

const N = 512
const r = seeded('points')
const GOLD = Math.PI * (3 - Math.sqrt(5))
// Each point has a flat home on a Vogel disc and a target on a Fibonacci sphere with the same index.
const pts = Array.from({ length: N }, (_, i) => {
  const th = i * GOLD
  const rr = Math.sqrt((i + 0.5) / N)
  const p2: V3 = { x: rr * Math.cos(th) * 1.35, y: rr * Math.sin(th) * 1.35, z: 0 }
  const zc = 1 - (2 * (i + 0.5)) / N
  const s = Math.sqrt(1 - zc * zc)
  const p3: V3 = { x: s * Math.cos(th) * 1.25, y: s * Math.sin(th) * 1.25, z: zc * 1.25 }
  return { p2, p3, order: r(), ph: r.range(0, Math.PI * 2) }
})
const labelled = [3, 99, 230, 341, 470]
const DEPTH = ' .·:;=ox0O@'

const points: Vis = {
  title: 'PointSet<512>.render()',
  draw(g, V, u, m) {
    const [, a1, a2, end] = m
    const born = smooth(0, a1 * 0.85, u)
    const lift = smooth(a1, a2, u)
    const dim = smooth(a2, a2 + 0.25, u)
    const ax = 0.55 * lift + 0.18 * Math.sin(u * 1.7) * lift
    const ay = lift * (0.65 + (u - a1) * 0.9) + dim * (u - a2) * 2.6
    const az = (1 - lift) * (u * 0.35)
    const k = 250
    const zb = new Float32Array(V.w * V.h).fill(-99)
    const rd: [string, string, number?][] = []
    let shown = 0
    let zmin = 9, zmax = -9

    // bounding cube and axes once the set has depth
    if (lift > 0.02) {
      const s = 1.3
      const cn = [-s, s]
      const P = (x: number, y: number, z: number) => project(rot({ x, y, z: z * lift }, ax, ay, az), V, k)
      for (const x of cn) for (const y of cn) {
        const e = [[P(x, y, -s), P(x, y, s)], [P(x, -s, y), P(x, s, y)], [P(-s, x, y), P(s, x, y)]]
        for (const [p, q] of e) g.line(p.x, p.y, q.x, q.y, lift > 0.9 ? C.frame : C.faint, '·')
      }
    }
    if (dim > 0) {
      const ax3 = [{ x: 1.7, y: 0, z: 0, n: 'X', c: C.red }, { x: 0, y: 1.7, z: 0, n: 'Y', c: C.green }, { x: 0, y: 0, z: 1.7, n: 'Z', c: C.blue }]
      const o = project(rot({ x: 0, y: 0, z: 0 }, ax, ay, az), V, k)
      for (const a of ax3) {
        const q = project(rot({ x: a.x * dim, y: a.y * dim, z: a.z * dim }, ax, ay, az), V, k)
        g.line(o.x, o.y, q.x, q.y, a.c)
        g.put(q.x + 1, q.y, a.n, a.c)
      }
    }
    for (let i = 0; i < N; i++) {
      const p = pts[i]
      if (p.order > born) continue
      shown++
      const wob = dim * 0.06 * Math.sin(u * 9 + p.ph)
      const src: V3 = {
        x: p.p2.x + (p.p3.x - p.p2.x) * lift,
        y: p.p2.y + (p.p3.y - p.p2.y) * lift,
        z: p.p3.z * lift,
      }
      const q = rot({ x: src.x * (1 + wob), y: src.y * (1 + wob), z: src.z * (1 + wob) }, ax, ay, az)
      const s = project(q, V, k)
      const cx = Math.round(s.x), cy = Math.round(s.y)
      if (cx < V.x || cy < V.y || cx >= V.x + V.w || cy >= V.y + V.h) continue
      const zi = (cy - V.y) * V.w + (cx - V.x)
      if (q.z <= zb[zi]) continue
      zb[zi] = q.z
      zmin = Math.min(zmin, q.z); zmax = Math.max(zmax, q.z)
      const d = lift < 0.05 ? 0.62 : Math.max(0, Math.min(1, (q.z + 1.3) / 2.6))
      const fresh = born - p.order < 0.04 && born < 1
      const ch = fresh ? '+' : DEPTH[1 + Math.round(d * (DEPTH.length - 2))]
      g.put(cx, cy, ch, fresh ? C.white : ramp(RAMP_CYAN, 0.25 + 0.75 * d))
    }
    for (const i of labelled) {
      const p = pts[i]
      if (p.order > born) continue
      const src = { x: p.p2.x + (p.p3.x - p.p2.x) * lift, y: p.p2.y + (p.p3.y - p.p2.y) * lift, z: p.p3.z * lift }
      const s = project(rot(src, ax, ay, az), V, k)
      g.put(s.x, s.y, '◆', C.amber)
      g.text(s.x + 2, s.y - 1, `p${i}(${src.x.toFixed(2)},${src.y.toFixed(2)}${lift > 0.5 ? ',' + src.z.toFixed(2) : ''})`, C.mid)
    }
    // dimension counter
    const dv = 2 + lift
    big(g, V.x + 2, V.y + 1, `${dv >= 2.995 ? '3' : '2'}D`, (x) => (x >= 6 ? C.frame : dv >= 2.995 ? C.amber : C.cyan),
      (x, y) => (x >= 6 ? '▒' : (x + y + Math.floor(u * 12)) % 5 === 0 ? '▓' : '█'))
    g.text(V.x + 2, V.y + 7, `dim = ${dv.toFixed(3)}`, dv >= 2.995 ? C.amber : C.text)
    g.text(V.x + 2, V.y + 8, `|P| = ${String(shown).padStart(3, '0')}/${N}`, C.mid)
    rd.push(['class', 'PointSet'], ['n', `${shown}/${N}`], ['dim', dv.toFixed(4), dv >= 2.995 ? C.amber : C.cyan],
      ['rot.x', fx(ax, 5, 3)], ['rot.y', fx(ay % (Math.PI * 2), 5, 3)], ['rot.z', fx(az, 5, 3)],
      ['z.span', `${(zmax > zmin ? zmax - zmin : 0).toFixed(3)}`], ['shape', lift < 0.5 ? 'vogel disc' : 'fib sphere'],
      ['cell', `${CW}x${CH}px`], ['t.end', `${(end - u).toFixed(3)}s`])
    return rd
  },
  log(st) {
    const t = st.lines.map((l) => l.t0)
    return [
      [t[0], '> pts = new PointSet(512)', C.text],
      [t[0] + 0.25, '  alloc 0x7F3A0040 [8192 B] ok', C.mid],
      [t[0] + 0.7, '  seed vogel disc (z=0)', C.mid],
      [t[1], '> pts.dimension()  // 2', C.text],
      [t[1] + 0.45, '  lift z <- fib sphere', C.mid],
      [t[1] + 1.0, '  warn: depth buffer resized', C.orange],
      [t[2], '! DIMENSION := 3', C.amber],
      [t[2] + 0.3, '  axes X Y Z attached', C.mid],
    ]
  },
}
export default points
