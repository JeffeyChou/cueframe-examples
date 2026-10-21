// Authored paths as pure geometry: waypoints (free, or 45°/90° with inserted elbows), sharp or
// filleted corners, named marks, parallel lanes, clearance against obstacles, and time → distance
// pinned to story times. Screen conventions: x right, y down, angles in degrees, a positive turn is
// clockwise on screen, a positive lane offset lies to the right of travel.
// Impossible requests throw a PathError listing every issue. Design: cueframe/docs/design/paths-paper-music.md (6a).

export interface Pt { x: number; y: number }
export type Elbow = 'straight-first' | 'diagonal-first' | 'horizontal-first' | 'vertical-first'
export interface Waypoint extends Pt { name?: string; elbow?: Elbow }
export interface Mark { name: string; s: number }
/** A corner: index into `pts`, signed turn in degrees, and its arc range (s0 = s1 when sharp). */
export interface Bend { i: number; turn: number; s: number; s0: number; s1: number }
export interface Pose { x: number; y: number; angle: number }
export interface PathOpts { angles?: 45 | 90 | 'any'; elbow?: Elbow; fillet?: number }

export interface Path {
  /** The waypoint polyline after elbows were inserted. */
  readonly pts: readonly Pt[]
  readonly total: number
  readonly marks: readonly Mark[]
  /** Length tolerance: 1e-9 × max(1, bounding-box diagonal). */
  readonly eps: number
  at(s: number): Pose
  mark(name: string): number
  bends(): readonly Bend[]
  /** Points from s0 to s1; arcs tessellated with chord error ≤ tol. */
  slice(s0: number, s1: number, tol?: number): Pt[]
  /** SVG path data from s0 to s1 with exact arcs. */
  svg(s0?: number, s1?: number): string
}
export interface Lane extends Path {
  readonly offset: number
  /** The lane distance abreast of centreline distance s (same piece, same fraction). */
  fromCentre(s: number): number
}

export class PathError extends Error {
  constructor(what: string, readonly issues: readonly string[]) {
    super(`${what}:\n  ${issues.join('\n  ')}`)
    this.name = 'PathError'
  }
}

const AEPS = 1e-7
const deg = (r: number) => (r * 180) / Math.PI
const rad = (d: number) => (d * Math.PI) / 180
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k })
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const unit = (v: Pt): Pt => { const n = Math.hypot(v.x, v.y); return { x: v.x / n, y: v.y / n } }
/** Right of travel on screen (y down). */
const right = (u: Pt): Pt => ({ x: -u.y, y: u.x })
const fmt = (n: number) => String(+n.toPrecision(6))
const finite = (what: string, ...ns: number[]) => {
  for (const n of ns) if (!Number.isFinite(n)) throw new PathError(what, [`${n} is not a finite number`])
}

/** `u`: the segment's direction, kept from the waypoints (a short remnant's ends may coincide numerically). */
type Line = { kind: 'line'; a: Pt; b: Pt; u: Pt; s0: number; len: number; dep: boolean }
type Arc = { kind: 'arc'; c: Pt; r: number; a0: number; sweep: number; s0: number; len: number; v: number }
type Piece = Line | Arc

interface Inner { pieces: Piece[]; turns: number[]; fillet: number; segs: number[] }
const inner = new WeakMap<Path, Inner>()

function pieceAt(pieces: readonly Piece[], s: number): number {
  let lo = 0, hi = pieces.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (pieces[mid]!.s0 <= s) lo = mid
    else hi = mid - 1
  }
  return lo
}

function poseOn(p: Piece, f: number): Pose {
  if (p.kind === 'line') return { x: p.a.x + (p.b.x - p.a.x) * f, y: p.a.y + (p.b.y - p.a.y) * f, angle: deg(Math.atan2(p.u.y, p.u.x)) }
  const phi = p.a0 + p.sweep * f
  return { x: p.c.x + p.r * Math.cos(phi), y: p.c.y + p.r * Math.sin(phi), angle: deg(phi + Math.sign(p.sweep) * (Math.PI / 2)) }
}

function build(pts: Pt[], pieces: Piece[], marks: Mark[], bends: Bend[], eps: number, info: Omit<Inner, 'pieces'>): Path {
  const total = pieces.reduce((n, p) => n + p.len, 0)
  const check = (what: string, s: number) => {
    finite(what, s)
    if (s < -eps || s > total + eps) throw new PathError(what, [`distance ${fmt(s)} is outside [0, ${fmt(total)}]`])
    return Math.min(total, Math.max(0, s))
  }
  const locate = (s: number): [Piece, number] => {
    const p = pieces[pieceAt(pieces, s)]!
    return [p, p.len > 0 ? Math.min(1, Math.max(0, (s - p.s0) / p.len)) : 0]
  }
  const path: Path = {
    pts, total, marks, eps,
    at(s) {
      const [p, f] = locate(check('at', s))
      return poseOn(p, f)
    },
    mark(name) {
      const m = marks.find((k) => k.name === name)
      if (!m) throw new PathError('mark', [`no mark "${name}" (known: ${marks.map((k) => k.name).join(', ') || 'none'})`])
      return m.s
    },
    bends: () => bends,
    slice(s0, s1, tol = 0.1) {
      const a = check('slice', s0), b = check('slice', s1)
      if (!(Number.isFinite(tol) && tol > 0)) throw new PathError('slice', [`tol must be a finite number above 0, got ${tol}`])
      if (a > b) throw new PathError('slice', [`s0 ${fmt(a)} is after s1 ${fmt(b)}`])
      const out: Pt[] = []
      const put = (q: Pose) => { const l = out[out.length - 1]; if (!l || l.x !== q.x || l.y !== q.y) out.push({ x: q.x, y: q.y }) }
      for (let i = pieceAt(pieces, a); i < pieces.length; i++) {
        const p = pieces[i]!
        if (p.s0 > b) break
        const f0 = p.len > 0 ? Math.max(0, (a - p.s0) / p.len) : 0
        const f1 = p.len > 0 ? Math.min(1, (b - p.s0) / p.len) : 0
        if (f1 < f0) continue
        put(poseOn(p, f0))
        if (p.kind === 'arc') {
          // Chord angle with sagitta tol: tol = 2r·sin²(θ/4), stable for small tol.
          const step = Math.min(Math.PI / 2, 4 * Math.asin(Math.min(1, Math.sqrt(tol / (2 * p.r)))))
          const n = Math.max(1, Math.ceil((Math.abs(p.sweep) * (f1 - f0)) / step))
          if (n > 1e6) throw new PathError('slice', [`tol ${tol} would need ${n} points on the arc of radius ${fmt(p.r)}`])
          for (let k = 1; k < n; k++) put(poseOn(p, f0 + ((f1 - f0) * k) / n))
        }
        put(poseOn(p, f1))
      }
      return out
    },
    svg(s0 = 0, s1 = total) {
      const a = check('svg', s0), b = check('svg', s1)
      if (a > b) throw new PathError('svg', [`s0 ${fmt(a)} is after s1 ${fmt(b)}`])
      const start = path.at(a)
      const out = [`M${fmt(start.x)} ${fmt(start.y)}`]
      for (let i = pieceAt(pieces, a); i < pieces.length; i++) {
        const p = pieces[i]!
        if (p.s0 > b) break
        const f1 = p.len > 0 ? Math.min(1, (b - p.s0) / p.len) : 0
        const f0 = p.len > 0 ? Math.max(0, (a - p.s0) / p.len) : 0
        if (f1 <= f0) continue
        const e = poseOn(p, f1)
        out.push(p.kind === 'line' ? `L${fmt(e.x)} ${fmt(e.y)}` : `A${fmt(p.r)} ${fmt(p.r)} 0 0 ${p.sweep > 0 ? 1 : 0} ${fmt(e.x)} ${fmt(e.y)}`)
      }
      return out.join(' ')
    },
  }
  inner.set(path, { pieces, ...info })
  return path
}

function elbowFor(a: Pt, b: Pt, angles: 45 | 90, how: Elbow, eps: number): Pt | null {
  const dx = b.x - a.x, dy = b.y - a.y, ax = Math.abs(dx), ay = Math.abs(dy)
  if (ax < eps || ay < eps) return null
  if (angles === 90) return how === 'vertical-first' ? { x: a.x, y: b.y } : { x: b.x, y: a.y }
  if (Math.abs(ax - ay) < eps) return null
  const m = Math.min(ax, ay)
  const diag = { x: Math.sign(dx) * m, y: Math.sign(dy) * m }
  return how === 'diagonal-first' ? add(a, diag) : sub(b, diag)
}

/** A path through waypoints. With `angles` 45 or 90, a leg off the allowed directions gets one elbow. */
export function path(points: readonly Waypoint[], opts: PathOpts = {}): Path {
  const angles = opts.angles ?? 'any'
  const fillet = opts.fillet ?? 0
  if (points.length < 2) throw new PathError('path', ['needs at least two points'])
  for (const p of points) finite('path', p.x, p.y)
  finite('path', fillet)
  if (fillet < 0) throw new PathError('path', [`fillet must be ≥ 0, got ${fillet}`])
  const allowed: Record<string, Elbow[]> = { 45: ['straight-first', 'diagonal-first'], 90: ['horizontal-first', 'vertical-first'], any: [] }
  const okElbow = (e: Elbow | undefined, where: string) => {
    if (e !== undefined && !allowed[String(angles)]!.includes(e)) throw new PathError('path', [`${where}: elbow "${e}" does not apply to angles ${angles}${angles === 'any' ? '' : ` (use ${allowed[String(angles)]!.join(' or ')})`}`])
  }
  okElbow(opts.elbow, 'opts')
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
  const eps = 1e-9 * Math.max(1, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)))

  // Waypoints → polyline with elbows; names stay on their waypoints.
  const pts: Pt[] = [{ x: points[0]!.x, y: points[0]!.y }]
  const named: { i: number; name: string }[] = []
  const names = new Set<string>()
  const name = (p: Waypoint, i: number) => {
    if (p.name === undefined) return
    if (names.has(p.name)) throw new PathError('path', [`mark "${p.name}" is used twice`])
    names.add(p.name)
    named.push({ i, name: p.name })
  }
  name(points[0]!, 0)
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]!, b = points[k]!
    if (dist(a, b) < eps) throw new PathError('path', [`points ${k - 1} and ${k} are the same point`])
    okElbow(b.elbow, `point ${k}`)
    if (angles !== 'any') {
      const how = b.elbow ?? opts.elbow ?? allowed[String(angles)]![0]!
      const e = elbowFor(a, b, angles, how, eps)
      if (e) pts.push(e)
    }
    pts.push({ x: b.x, y: b.y })
    name(b, pts.length - 1)
  }

  // Turns at interior vertices.
  const n = pts.length
  const dirs = pts.slice(1).map((p, j) => unit(sub(p, pts[j]!)))
  const lens = pts.slice(1).map((p, j) => dist(p, pts[j]!))
  const turns = pts.map((_, i) => {
    if (i === 0 || i === n - 1) return 0
    const u = dirs[i - 1]!, w = dirs[i]!
    const th = deg(Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y))
    if (Math.abs(th) > 180 - AEPS) throw new PathError('path', [`the path reverses at point ${i} (${fmt(pts[i]!.x)}, ${fmt(pts[i]!.y)})`])
    return Math.abs(th) < AEPS ? 0 : th
  })

  // Fillets: setbacks must fit each segment jointly.
  const back = turns.map((th) => (fillet > 0 && th !== 0 ? fillet * Math.tan(rad(Math.abs(th)) / 2) : 0))
  if (fillet > 0) {
    const issues: string[] = []
    let best = Infinity
    for (let j = 0; j < n - 1; j++) {
      const ta = Math.tan(rad(Math.abs(turns[j]!)) / 2), tb = Math.tan(rad(Math.abs(turns[j + 1]!)) / 2)
      if (ta + tb > 0) best = Math.min(best, lens[j]! / (ta + tb))
      if (back[j]! + back[j + 1]! > lens[j]! + eps) issues.push(`segment ${j} (${fmt(lens[j]!)} long) needs ${fmt(back[j]! + back[j + 1]!)} for its fillets`)
    }
    if (issues.length) throw new PathError('path', [...issues, `the largest fillet that fits every segment is ${fmt(best)}`])
  }

  // Pieces, marks at vertices (arc midpoints when filleted), bends.
  const pieces: Piece[] = []
  const vertexS: number[] = new Array(n).fill(0)
  const bends: Bend[] = []
  const segs: number[] = []
  let s = 0
  for (let j = 0; j < n - 1; j++) {
    const u = dirs[j]!
    const a = add(pts[j]!, u, back[j]!), b = add(pts[j + 1]!, u, -back[j + 1]!)
    const len = lens[j]! - back[j]! - back[j + 1]!
    if (j === 0) vertexS[0] = 0
    if (len > 0) {
      pieces.push({ kind: 'line', a, b, u, s0: s, len, dep: fillet === 0 && (turns[j] !== 0 || turns[j + 1] !== 0) })
      segs.push(j)
      s += len
    }
    const v = j + 1
    if (v === n - 1) { vertexS[v] = s; break }
    const th = turns[v]!
    if (fillet > 0 && th !== 0) {
      const sg = Math.sign(th)
      const c = add(b, right(u), sg * fillet)
      const sweep = rad(th)
      const alen = fillet * Math.abs(sweep)
      pieces.push({ kind: 'arc', c, r: fillet, a0: Math.atan2(b.y - c.y, b.x - c.x), sweep, s0: s, len: alen, v })
      segs.push(-1)
      bends.push({ i: v, turn: th, s: s + alen / 2, s0: s, s1: s + alen })
      vertexS[v] = s + alen / 2
      s += alen
    } else {
      vertexS[v] = s
      if (th !== 0) bends.push({ i: v, turn: th, s, s0: s, s1: s })
    }
  }
  const marks = named.map(({ i, name }) => ({ name, s: vertexS[i]! }))
  return build(pts, pieces, marks, bends, eps, { turns, fillet, segs })
}

/** Parallel lanes at offsets (k − (n−1)/2)·gap, right of travel positive; miters at sharp corners,
 * concentric arcs at fillets. Validation is local (a lane may still cross an earlier part of itself). */
export function lanes(p: Path, o: { n: number; gap: number }): Lane[] {
  const I = inner.get(p)
  if (!I) throw new PathError('lanes', ['not a path made by path()'])
  if (!Number.isInteger(o.n) || o.n < 1) throw new PathError('lanes', [`n must be a positive integer, got ${o.n}`])
  finite('lanes', o.gap)
  if (!(o.gap > 0)) throw new PathError('lanes', [`gap must be above 0, got ${o.gap}`])
  const eps = p.eps
  const half = (o.n - 1) / 2
  const tanH = (v: number) => Math.tan(rad(I.turns[v]!) / 2)
  // Each offset-dependent piece shrinks linearly in the offset: size(d) = L − c·d.
  const issues: string[] = []
  let bound = Infinity, sup = Infinity
  const segOf = (k: number) => I.segs[k]!
  I.pieces.forEach((pc, k) => {
    let L: number, c: number, where: string
    if (pc.kind === 'arc') { L = pc.r; c = Math.sign(pc.sweep); where = `the fillet at point ${pc.v}` }
    else if (pc.dep) { const j = segOf(k); L = pc.len; c = tanH(j) + tanH(j + 1); where = `segment ${j}` }
    else return
    if (c === 0 || half === 0) return
    const b = (L - eps) / (half * Math.abs(c)), g = L / (half * Math.abs(c))
    bound = Math.min(bound, b); sup = Math.min(sup, g)
    if (!(o.gap < b)) {
      const lane = c > 0 ? o.n - 1 : 0
      issues.push(`${where}: lane ${lane} (offset ${fmt((lane - half) * o.gap)}) would be ${fmt(L - Math.abs(c) * half * o.gap)} ${pc.kind === 'arc' ? 'in radius' : 'long'}`)
    }
  })
  if (issues.length) throw new PathError('lanes', [...issues, `gap must be strictly below ${bound} (pieces vanish at ${fmt(sup)})`])
  const out: Lane[] = []
  for (let k = 0; k < o.n; k++) {
    const d = (k - half) * o.gap
    const pieces: Piece[] = []
    let s = 0
    I.pieces.forEach((pc, idx) => {
      if (pc.kind === 'arc') {
        const r = pc.r - Math.sign(pc.sweep) * d
        pieces.push({ ...pc, r, s0: s, len: r * Math.abs(pc.sweep) })
        s += r * Math.abs(pc.sweep)
        return
      }
      const j = segOf(idx)
      const u = pc.u, nr = right(u)
      const ta = pc.dep ? d * tanH(j) : 0, tb = pc.dep ? d * tanH(j + 1) : 0
      const a = add(add(pc.a, nr, d), u, ta), b = add(add(pc.b, nr, d), u, -tb)
      const len = pc.len - ta - tb
      pieces.push({ kind: 'line', a, b, u, s0: s, len, dep: pc.dep })
      s += len
    })
    const fromCentre = (sc: number) => {
      finite('fromCentre', sc)
      if (sc < -eps || sc > p.total + eps) throw new PathError('fromCentre', [`distance ${fmt(sc)} is outside [0, ${fmt(p.total)}]`])
      const i = pieceAt(I.pieces, Math.min(p.total, Math.max(0, sc)))
      const pc = I.pieces[i]!
      const f = pc.len > 0 ? Math.min(1, Math.max(0, (sc - pc.s0) / pc.len)) : 0
      return pieces[i]!.s0 + f * pieces[i]!.len
    }
    const marks = p.marks.map((m) => ({ name: m.name, s: fromCentre(m.s) }))
    const bends = p.bends().map((b) => {
      const s0 = fromCentre(b.s0), s1 = fromCentre(b.s1)
      return { ...b, s0, s1, s: (s0 + s1) / 2 }
    })
    const pts = p.pts.map((q, i) => {
      if (i === 0 || i === p.pts.length - 1) { const u = unit(i === 0 ? sub(p.pts[1]!, q) : sub(q, p.pts[i - 1]!)); return add(q, right(u), d) }
      const u = unit(sub(q, p.pts[i - 1]!)), w = unit(sub(p.pts[i + 1]!, q))
      const m = unit(add(right(u), right(w)))
      return add(q, m, d / Math.cos(rad(I.turns[i]!) / 2))
    })
    const lane = build(pts, pieces, marks, bends, eps, { turns: I.turns, fillet: I.fillet, segs: I.segs }) as Lane
    out.push(Object.assign(lane, { offset: d, fromCentre }))
  }
  return out
}

// ── Clearance ────────────────────────────────────────────────────────────────────────────────
export type Obstacle = { x: number; y: number; r: number } | { x: number; y: number; w: number; h: number }
export interface Violation { path: number; obstacle: number; s: number; distance: number }

function sdf(o: Obstacle, q: Pt): number {
  if ('r' in o) return dist(q, o) - o.r
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2
  const dx = Math.abs(q.x - cx) - o.w / 2, dy = Math.abs(q.y - cy) - o.h / 2
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0)
}

/** Minimum of f on [a, b] by golden-section search (f convex, or bracketed near its minimum). */
function golden(f: (x: number) => number, a: number, b: number): [number, number] {
  const g = (Math.sqrt(5) - 1) / 2
  let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d)
  for (let i = 0; i < 80; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c) }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d) }
  }
  const x = (a + b) / 2
  return [x, f(x)]
}

/** Closest point of a piece to q: [fraction, distance], in closed form. */
function toPoint(pc: Piece, q: Pt): [number, number] {
  if (pc.kind === 'line') {
    const v = sub(pc.b, pc.a), w = sub(q, pc.a), vv = v.x * v.x + v.y * v.y
    const f = vv > 0 ? Math.min(1, Math.max(0, (w.x * v.x + w.y * v.y) / vv)) : 0
    return [f, dist(q, add(pc.a, v, f))]
  }
  if (dist(q, pc.c) === 0) return [0, pc.r]
  const rel = (((Math.atan2(q.y - pc.c.y, q.x - pc.c.x) - pc.a0) * Math.sign(pc.sweep)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  if (rel <= Math.abs(pc.sweep)) return [rel / Math.abs(pc.sweep), Math.abs(dist(q, pc.c) - pc.r)]
  const d0 = dist(q, poseOn(pc, 0)), d1 = dist(q, poseOn(pc, 1))
  return d0 <= d1 ? [0, d0] : [1, d1]
}

/** Fractions of an arc where its signed distance to a rect can have a minimum: the rect's distance is
 * smooth except on its centre lines and medial diagonals, so the minimum is at an arc end, where the
 * arc is extreme in x or y (edge regions), on the line through a corner and the arc's centre (corner
 * regions), or where the arc crosses a centre line or a 45° line through a corner (the kinks). */
function arcRectCritical(pc: Arc, o: { x: number; y: number; w: number; h: number }): number[] {
  const out: number[] = []
  const at = (phi: number) => {
    const rel = ((((phi - pc.a0) * Math.sign(pc.sweep)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    if (rel <= Math.abs(pc.sweep)) out.push(rel / Math.abs(pc.sweep))
  }
  for (let k = 0; k < 4; k++) at((k * Math.PI) / 2)
  const corners = [{ x: o.x, y: o.y }, { x: o.x + o.w, y: o.y }, { x: o.x, y: o.y + o.h }, { x: o.x + o.w, y: o.y + o.h }]
  const cross = (q: Pt, d: Pt) => {
    const m = sub(q, pc.c), b = d.x * m.x + d.y * m.y, disc = b * b - (m.x * m.x + m.y * m.y - pc.r * pc.r)
    if (disc < 0) return
    for (const t of [-b - Math.sqrt(disc), -b + Math.sqrt(disc)]) { const z = add(q, d, t); at(Math.atan2(z.y - pc.c.y, z.x - pc.c.x)) }
  }
  for (const q of corners) {
    const a = Math.atan2(q.y - pc.c.y, q.x - pc.c.x)
    at(a); at(a + Math.PI)
    cross(q, unit({ x: 1, y: 1 })); cross(q, unit({ x: 1, y: -1 }))
  }
  const mid = { x: o.x + o.w / 2, y: o.y + o.h / 2 }
  cross(mid, { x: 1, y: 0 }); cross(mid, { x: 0, y: 1 })
  return out
}

/** Signed distance from piece to obstacle boundary at its closest point: [fraction, distance]; on a
 * flat minimum (within tol) the earliest such point. */
function closest(pc: Piece, o: Obstacle, tol: number): [number, number] {
  if ('r' in o) { const [f, d] = toPoint(pc, o); return [f, d - o.r] }
  const f = (x: number) => sdf(o, poseOn(pc, x))
  const N = pc.kind === 'line' ? 1 : 64
  let best: [number, number] = [0, f(0)]
  const take = (x: number) => { const v = f(x); if (v < best[1] - tol || (v <= best[1] + tol && x < best[0])) best = [x, v] }
  for (let i = 1; i <= N; i++) take(i / N)
  if (pc.kind === 'line') take(golden(f, 0, 1)[0])   // convex along a line
  else for (const x of arcRectCritical(pc, o)) take(x)
  // The earliest point within tol of the minimum: bisect the left edge of {f ≤ min + tol}.
  let lo = Math.max(0, (Math.round(best[0] * N) - 1) / N), hi = best[0]
  if (f(lo) <= best[1] + tol) return [lo, f(lo)]
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) <= best[1] + tol) hi = mid; else lo = mid }
  return [hi, Math.min(best[1], f(hi))]
}

/** One entry per path–obstacle pair whose minimum signed distance (centre curve − halfWidth to the
 * obstacle's boundary, negative inside) is below `min`, at that minimum. Distances equal within
 * eps/1000 are ties, resolved to the smallest s. */
export function clearance(paths: Path | readonly Path[], obstacles: readonly Obstacle[], o: { min: number; halfWidth?: number }): Violation[] {
  const list = Array.isArray(paths) ? paths as readonly Path[] : [paths as Path]
  const hw = o.halfWidth ?? 0
  finite('clearance', o.min, hw)
  if (hw < 0) throw new PathError('clearance', [`halfWidth must be ≥ 0, got ${hw}`])
  obstacles.forEach((ob, i) => {
    finite('clearance', ob.x, ob.y, ...('r' in ob ? [ob.r] : [ob.w, ob.h]))
    if ('r' in ob ? ob.r < 0 : ob.w < 0 || ob.h < 0) throw new PathError('clearance', [`obstacle ${i} has a negative size`])
  })
  const out: Violation[] = []
  list.forEach((p, pi) => {
    const I = inner.get(p)
    if (!I) throw new PathError('clearance', [`paths[${pi}] is not a path made by path()`])
    const tie = p.eps * 1e-3
    obstacles.forEach((ob, oi) => {
      let best = { s: 0, d: Infinity }
      for (const pc of I.pieces) {
        const [f, d] = closest(pc, ob, tie)
        if (d < best.d - tie) best = { s: pc.s0 + f * pc.len, d }
      }
      const distance = best.d - hw
      if (distance < o.min) out.push({ path: pi, obstacle: oi, s: best.s, distance })
    })
  })
  return out
}

export function assertClear(paths: Path | readonly Path[], obstacles: readonly Obstacle[], o: { min: number; halfWidth?: number }): void {
  const v = clearance(paths, obstacles, o)
  if (v.length) throw new PathError('clearance', v.map((x) => `path ${x.path} passes obstacle ${x.obstacle} at s = ${fmt(x.s)}: distance ${fmt(x.distance)} < ${fmt(o.min)}`))
}

// ── Time → distance ──────────────────────────────────────────────────────────────────────────
export type Pin = { t: number; s: number } | { t: number; mark: string }
export interface TravelOpts {
  shape?: 'cubic' | 'linear'
  before?: { speed: number }
  after?: { speed: number }
  maxSpeed?: number
  lanes?: readonly Lane[]
}
export interface Travel {
  (t: number): number
  /** When the head leaves the start and first reaches the end: null when that never happens,
   * −Infinity when the head is there for all time before the first pin. */
  readonly range: { leaves: number | null; arrives: number | null }
}

/** Distance along `p` as a pure function of time: monotone cubic Hermite (Fritsch–Carlson) or
 * piecewise linear through the pins; still outside them unless `before`/`after` speeds move the head,
 * which then stops at the path's ends. */
export function travel(p: Path, pins: readonly Pin[], o: TravelOpts = {}): Travel {
  const I = inner.get(p)
  if (!I) throw new PathError('travel', ['not a path made by path()'])
  if (!pins.length) throw new PathError('travel', ['needs at least one pin'])
  const issues: string[] = []
  const ts: number[] = [], ss: number[] = []
  pins.forEach((pin, k) => {
    finite('travel', pin.t)
    const s = 'mark' in pin ? p.mark(pin.mark) : pin.s
    finite('travel', s)
    if (s < -p.eps || s > p.total + p.eps) issues.push(`pin ${k}: distance ${fmt(s)} is outside [0, ${fmt(p.total)}]`)
    if (k && !(pin.t > ts[k - 1]!)) issues.push(`pin ${k}: t ${fmt(pin.t)} is not after pin ${k - 1}'s ${fmt(ts[k - 1]!)}`)
    if (k && s < ss[k - 1]! - p.eps) issues.push(`pin ${k}: distance ${fmt(s)} goes back from ${fmt(ss[k - 1]!)} (direction changes are not supported)`)
    ts.push(pin.t); ss.push(Math.min(p.total, Math.max(0, k ? Math.max(s, ss[k - 1]!) : s)))
  })
  const vb = o.before?.speed, va = o.after?.speed
  for (const [nm, v] of [['before', vb], ['after', va], ['maxSpeed', o.maxSpeed]] as const) {
    if (v !== undefined && !(Number.isFinite(v) && v >= 0)) issues.push(`${nm} must be a finite number ≥ 0, got ${v}`)
  }
  if (issues.length) throw new PathError('travel', issues)
  const N = ts.length
  const del = ts.slice(1).map((t, k) => (ss[k + 1]! - ss[k]!) / (t - ts[k]!))
  const m: number[] = new Array(N).fill(0)
  if (o.shape !== 'linear' && N > 1) {
    for (let k = 1; k < N - 1; k++) m[k] = del[k - 1]! > 0 && del[k]! > 0 ? (del[k - 1]! + del[k]!) / 2 : 0
    m[0] = del[0]!; m[N - 1] = del[N - 2]!
    const fixed = [false, ...new Array(N - 2).fill(false), false]
    if (vb !== undefined) {
      if (vb > 0 && del[0] === 0) issues.push('before: the head cannot arrive moving at pin 0 and then stand still')
      m[0] = vb; fixed[0] = true
    }
    if (va !== undefined) {
      if (va > 0 && del[N - 2] === 0) issues.push(`after: the head cannot stand still and leave pin ${N - 1} moving`)
      m[N - 1] = va; fixed[N - 1] = true
    }
    if (issues.length) throw new PathError('travel', issues)
    for (let k = 0; k < N - 1; k++) {
      const d = del[k]!
      if (d === 0) { m[k] = 0; m[k + 1] = 0; continue }
      const a = m[k]! / d, b = m[k + 1]! / d, h = a * a + b * b
      if (h > 9) {
        if (fixed[k] || fixed[k + 1]) { issues.push(`pins ${k}–${k + 1}: the imposed ${fixed[k] ? 'before' : 'after'} speed is too fast for a monotone curve (at most ${fmt(3 * d)})`); continue }
        const tau = 3 / Math.sqrt(h)
        m[k] = tau * a * d; m[k + 1] = tau * b * d
      }
    }
    if (issues.length) throw new PathError('travel', issues)
  }
  const linear = o.shape === 'linear'
  const inside = (k: number, t: number) => {
    const t0 = ts[k]!, h = ts[k + 1]! - t0, u = (t - t0) / h
    if (linear) return ss[k]! + (ss[k + 1]! - ss[k]!) * u
    const u2 = u * u, u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * ss[k]! + (u3 - 2 * u2 + u) * h * m[k]! + (-2 * u3 + 3 * u2) * ss[k + 1]! + (u3 - u2) * h * m[k + 1]!
  }
  const speedAt = (k: number, t: number) => {
    if (linear) return del[k]!
    const t0 = ts[k]!, h = ts[k + 1]! - t0, u = (t - t0) / h
    return ((6 * u * u - 6 * u) * ss[k]! + (3 * u * u - 4 * u + 1) * h * m[k]! + (-6 * u * u + 6 * u) * ss[k + 1]! + (3 * u * u - 2 * u) * h * m[k + 1]!) / h
  }
  const f = ((t: number) => {
    finite('travel', t)
    if (t <= ts[0]!) return vb ? Math.max(0, ss[0]! - vb * (ts[0]! - t)) : ss[0]!
    if (t >= ts[N - 1]!) return va ? Math.min(p.total, ss[N - 1]! + va * (t - ts[N - 1]!)) : ss[N - 1]!
    let k = 0
    while (t >= ts[k + 1]!) k++
    return Math.min(p.total, Math.max(0, inside(k, t)))
  }) as Travel

  // When the head is first off the start, and first at the end.
  let leaves: number | null = null, arrives: number | null = null
  if (ss[0]! > 0) leaves = vb ? ts[0]! - ss[0]! / vb : null
  else {
    const k = ss.findIndex((v) => v > 0)
    leaves = k > 0 ? ts[k - 1]! : va ? ts[N - 1]! : null
  }
  const end = p.total
  if (ss[N - 1]! < end) arrives = va ? ts[N - 1]! + (end - ss[N - 1]!) / va : null
  else {
    const k = ss.findIndex((v) => v >= end)
    if (k === 0) arrives = vb ? ts[0]! : -Infinity
    else {
      let lo = ts[k - 1]!, hi = ts[k]!
      for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (inside(k - 1, mid) >= end) hi = mid; else lo = mid }
      arrives = hi
    }
  }
  Object.defineProperty(f, 'range', { value: { leaves, arrives }, enumerable: true })

  if (o.maxSpeed !== undefined) speedCheck(p, I, o.maxSpeed, o.lanes ?? [], ts, ss, inside, speedAt, vb, va)
  return f
}

function speedCheck(p: Path, I: Inner, limit: number, ls: readonly Lane[], ts: number[], ss: number[], inside: (k: number, t: number) => number, speedAt: (k: number, t: number) => number, vb?: number, va?: number) {
  const lanesI = ls.map((l) => inner.get(l)!)
  const ratios = I.pieces.map((pc, i) => [1, ...lanesI.map((L) => (pc.len > 0 ? L.pieces[i]!.len / pc.len : 1))])
  const issues: string[] = []
  const flag = (when: string, i: number, v: number) => {
    ratios[i]!.forEach((r, li) => {
      if (v * r > limit + 1e-9) issues.push(`${when}, piece ${i}: ${li === 0 ? 'centreline' : `lane ${li - 1}`} at ${fmt(v * r)} > ${fmt(limit)}`)
    })
  }
  const piecesIn = (a: number, b: number) => {
    const out: number[] = []
    for (let i = pieceAt(I.pieces, a); i < I.pieces.length && I.pieces[i]!.s0 < b; i++) out.push(i)
    return out
  }
  if (vb) for (const i of piecesIn(0, ss[0]!)) flag('before', i, vb)
  if (va) for (const i of piecesIn(ss[ss.length - 1]!, p.total)) flag('after', i, va)
  for (let k = 0; k + 1 < ts.length; k++) {
    if (ss[k + 1]! <= ss[k]!) continue
    // Split the interval where it crosses piece boundaries.
    const cuts = [ts[k]!]
    for (const pc of I.pieces) {
      if (pc.s0 <= ss[k]! || pc.s0 >= ss[k + 1]!) continue
      let lo = ts[k]!, hi = ts[k + 1]!
      for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (inside(k, mid) < pc.s0) lo = mid; else hi = mid }
      cuts.push((lo + hi) / 2)
    }
    cuts.push(ts[k + 1]!)
    for (let c = 0; c + 1 < cuts.length; c++) {
      const a = cuts[c]!, b = cuts[c + 1]!
      const i = pieceAt(I.pieces, inside(k, (a + b) / 2))
      // Peak of the quadratic derivative: both ends and the vertex.
      const h = ts[k + 1]! - ts[k]!
      const cand = [a, b]
      const s0 = speedAt(k, ts[k]!), s1 = speedAt(k, ts[k]! + h / 2), s2 = speedAt(k, ts[k + 1]!)
      const A = 2 * (s0 - 2 * s1 + s2), B = -3 * s0 + 4 * s1 - s2
      if (A !== 0) { const tv = ts[k]! + (-B / (2 * A)) * h; if (tv > a && tv < b) cand.push(tv) }
      flag(`pins ${k}–${k + 1}`, i, Math.max(...cand.map((t) => speedAt(k, t))))
    }
  }
  if (issues.length) throw new PathError('travel: too fast', issues)
}
