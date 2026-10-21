// CSS 3D by matrices: one 4×4 library drives both the DOM and the math (project, billboards).
// Conventions are CSS's: x right, y down, z toward the viewer, px and degrees, RX(a) = rotateX(a).
// mul(A, B, C) multiplies in written order like a CSS transform list; on a point it acts C first.
// Placement rule: every object is a direct child of the space element, placed by put() (left/top 0,
// transform-origin 0 0), so its local point (u, v, 0) renders at apply(m, (u, v, 0)) before the
// perspective divide. Pivots live in the matrix (pivot()), never in transform-origin.
// Design: cueframe/docs/design/camera-space-acting.md.

/** A 4×4 matrix, column-major (CSS matrix3d order): m[col * 4 + row]. */
export type M = readonly number[]
export interface P3 { x: number; y: number; z: number }
export interface Space { el: HTMLElement; perspective: number; origin: { x: number; y: number } }

const rad = (d: number) => (d * Math.PI) / 180
const cols = (a: number[][]): M => [0, 1, 2, 3].flatMap((c) => [0, 1, 2, 3].map((r) => a[r]![c]!))

export const I: M = cols([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])
export const T = (x: number, y: number, z = 0): M => cols([[1, 0, 0, x], [0, 1, 0, y], [0, 0, 1, z], [0, 0, 0, 1]])
export const S = (x: number, y = x, z = x): M => cols([[x, 0, 0, 0], [0, y, 0, 0], [0, 0, z, 0], [0, 0, 0, 1]])
export function RX(deg: number): M { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return cols([[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]]) }
export function RY(deg: number): M { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return cols([[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]]) }
export function RZ(deg: number): M { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return cols([[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) }

/** Matrices multiplied in written order (as a CSS transform list). */
export function mul(...ms: M[]): M {
  return ms.reduce((a, b) => {
    const o = new Array<number>(16)
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let v = 0
      for (let k = 0; k < 4; k++) v += a[k * 4 + r]! * b[c * 4 + k]!
      o[c * 4 + r] = v
    }
    return o
  }, I)
}

/** The point through the matrix (affine: w is 1 for every matrix built here). */
export function apply(m: M, p: Partial<P3> = {}): P3 {
  const x = p.x ?? 0, y = p.y ?? 0, z = p.z ?? 0
  const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!
  return {
    x: (m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / w,
    y: (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / w,
    z: (m[2]! * x + m[6]! * y + m[10]! * z + m[14]!) / w,
  }
}

/** Inverse of an affine matrix (linear part invertible). */
export function inverse(m: M): M {
  const a = [[m[0]!, m[4]!, m[8]!], [m[1]!, m[5]!, m[9]!], [m[2]!, m[6]!, m[10]!]]
  const det = a[0]![0]! * (a[1]![1]! * a[2]![2]! - a[1]![2]! * a[2]![1]!) - a[0]![1]! * (a[1]![0]! * a[2]![2]! - a[1]![2]! * a[2]![0]!) + a[0]![2]! * (a[1]![0]! * a[2]![1]! - a[1]![1]! * a[2]![0]!)
  if (Math.abs(det) < 1e-12) throw new Error('inverse: the matrix is singular')
  const inv = [0, 1, 2].map((r) => [0, 1, 2].map((c) => {
    const r1 = (c + 1) % 3, r2 = (c + 2) % 3, c1 = (r + 1) % 3, c2 = (r + 2) % 3
    return (a[r1]![c1]! * a[r2]![c2]! - a[r1]![c2]! * a[r2]![c1]!) / det
  }))
  const t = [m[12]!, m[13]!, m[14]!]
  const ti = inv.map((row) => -(row[0]! * t[0]! + row[1]! * t[1]! + row[2]! * t[2]!))
  return cols([[...inv[0]!, ti[0]!], [...inv[1]!, ti[1]!], [...inv[2]!, ti[2]!], [0, 0, 0, 1]])
}

const num = (n: number) => { const s = Number(n.toFixed(6)); return Object.is(s, -0) ? '0' : String(s) }
/** CSS `matrix3d(…)`. */
export const css = (m: M) => `matrix3d(${m.map(num).join(', ')})`

/** Puts an element's anchor (ax, ay in 0…1 of its w × h box; feet = 0.5, 1) at the matrix's origin. */
export const pivot = (w: number, h: number, ax: number, ay: number): M => T(-ax * w, -ay * h, 0)

/**
 * The orbit view: T(origin) · S(zoom) · RZ(roll) · RX(pitch) · RZ(yaw) · T(−target). On a point: target
 * to 0, spin by yaw about world z (the normal of a board lying in the screen plane), tilt the board
 * away by pitch about screen x, roll about the view axis, scale, then target at stage point origin.
 */
export function orbit(o: { origin: { x: number; y: number }; target: P3; pitch?: number; yaw?: number; roll?: number; zoom?: number }): M {
  return mul(T(o.origin.x, o.origin.y, 0), S(o.zoom ?? 1), RZ(o.roll ?? 0), RX(o.pitch ?? 0), RZ(o.yaw ?? 0), T(-o.target.x, -o.target.y, -o.target.z))
}

/** The space element: perspective `perspective` px from stage point `origin`, preserve-3d. It covers
 * its parent from the top left; the parent is the stage or a box at the stage's origin, so space px
 * are stage px (what project() returns). */
export function spaceEl(parent: HTMLElement, o: { perspective: number; origin: { x: number; y: number } }): Space {
  // CSS clamps perspective below 1 px to 1 px; project() would disagree.
  if (!(Number.isFinite(o.perspective) && o.perspective >= 1)) throw new Error('spaceEl: perspective must be a finite number ≥ 1 (px)')
  const el = document.createElement('div')
  Object.assign(el.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', margin: '0', padding: '0', border: '0',
    perspective: `${o.perspective}px`, perspectiveOrigin: `${o.origin.x}px ${o.origin.y}px`, transformStyle: 'preserve-3d',
  })
  parent.append(el)
  return { el, perspective: o.perspective, origin: { ...o.origin } }
}

/** Places a direct child of the space by matrix (the placement rule). */
export function put(el: HTMLElement | SVGElement, m: M) {
  const s = el.style
  s.position = 'absolute'
  s.margin = '0'
  s.left = '0'
  s.top = '0'
  s.transformOrigin = '0 0'
  s.transform = css(m)
}

/** Where the local point `local` of an object placed by `m` renders, in the space element's px;
 * `scale` is the perspective scale there; `behind` when it is at or behind the viewer. */
export function project(space: Pick<Space, 'perspective' | 'origin'>, m: M, local: Partial<P3> = {}) {
  const p = apply(m, local)
  const P = space.perspective
  const behind = p.z >= P
  const s = behind ? Infinity : P / (P - p.z)
  return { x: space.origin.x + (p.x - space.origin.x) * s, y: space.origin.y + (p.y - space.origin.y) * s, scale: s, behind }
}

/**
 * A matrix facing the screen at the point where `m` puts the local origin: no rotation, and a uniform
 * scale — `m`'s own (`world`), or `px` screen px per unit whatever the depth (`screen`). The pivot
 * comes after: mul(billboard(…), pivot(…)).
 */
export function billboard(m: M, space: Pick<Space, 'perspective' | 'origin'>, o: { size: 'world' } | { size: 'screen'; px: number }): M {
  const p = apply(m)
  let k: number
  if (o.size === 'world') {
    const det = m[0]! * (m[5]! * m[10]! - m[9]! * m[6]!) - m[4]! * (m[1]! * m[10]! - m[9]! * m[2]!) + m[8]! * (m[1]! * m[6]! - m[5]! * m[2]!)
    k = Math.cbrt(Math.abs(det))
  } else {
    const s = project(space, m).scale
    k = Number.isFinite(s) ? o.px / s : 0
  }
  return mul(T(p.x, p.y, p.z), S(k))
}

/** Field-by-field interpolation of a numeric pose record (matrices are not interpolated). */
export function lerpPose<P extends Record<string, number>>(a: P, b: P, k: number): P {
  const out = {} as Record<string, number>
  for (const key of Object.keys(a)) out[key] = a[key]! + (b[key]! - a[key]!) * k
  return out as P
}
