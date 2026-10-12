// Orbits in units with GM = 1, the Sun at the origin. Pure functions; precompute in mount.

export type V2 = [number, number]

/** Exact Kepler orbit (semi-major axis a, eccentricity e, perihelion on +x) at time t; period 2π·a^1.5. */
export function kepler(a: number, e: number, t: number): V2 {
  const n = a ** -1.5
  const Mn = n * t
  let E = e < 0.8 ? Mn : Math.PI
  for (let i = 0; i < 30; i++) E -= (E - e * Math.sin(E) - Mn) / (1 - e * Math.cos(E))
  return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)]
}

export const keplerVel = (a: number, e: number, t: number, h = 1e-5): V2 => {
  const p = kepler(a, e, t - h)
  const q = kepler(a, e, t + h)
  return [(q[0] - p[0]) / (2 * h), (q[1] - p[1]) / (2 * h)]
}

export type Accel = (p: V2) => V2

export const inverseSquare: Accel = ([x, y]) => {
  const r = Math.hypot(x, y)
  return [-x / r ** 3, -y / r ** 3]
}
export const spring: Accel = ([x, y]) => [-x, -y]
export const constant: Accel = ([x, y]) => {
  const r = Math.hypot(x, y)
  return [-x / r, -y / r]
}

export interface Polygon { pts: V2[]; kicks: V2[]; areas: number[] }

/**
 * Newton's construction: coast for dt, then an instantaneous kick towards the centre.
 * pts[k+1] = pts[k] + v·dt, then v += a(pts[k+1])·dt. Every triangle (0, pts[k], pts[k+1]) has
 * area |r × v|·dt / 2 exactly, since each kick is parallel to r.
 */
export function newton(p0: V2, v0: V2, dt: number, steps: number, acc: Accel): Polygon {
  const pts: V2[] = [p0]
  const kicks: V2[] = []
  const areas: number[] = []
  let [x, y] = p0
  let [vx, vy] = v0
  for (let k = 0; k < steps; k++) {
    const nx = x + vx * dt
    const ny = y + vy * dt
    areas.push(Math.abs(x * ny - y * nx) / 2)
    const [ax, ay] = acc([nx, ny])
    kicks.push([ax * dt, ay * dt])
    vx += ax * dt
    vy += ay * dt
    x = nx
    y = ny
    pts.push([x, y])
  }
  return { pts, kicks, areas }
}

/** Fine integration of the same law (for smooth reference curves): many small Newton steps. */
export function path(p0: V2, v0: V2, T: number, n: number, acc: Accel, sub = 20): V2[] {
  const poly = newton(p0, v0, T / (n * sub), n * sub, acc)
  return poly.pts.filter((_, i) => i % sub === 0)
}
