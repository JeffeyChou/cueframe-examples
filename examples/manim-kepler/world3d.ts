// The 3D orbit (three.js), shared by the opening and the angular-momentum shot.
// Orbit plane = world XZ, up = +Y; 2D orbit coords (x, y) map to (x, 0, −y) so that r × v points
// up (+Y) for a counter-clockwise orbit. Seen from straight above, the world origin projects to
// ORIGIN px and one world unit is PX px, exactly like the 2D plane in the flat shots.
import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import type { MountContext } from '@cueframe/core'
import { M } from '../../recipes/manim.js'
import { kepler, type V2 } from './orbit.js'

export const A = 1             // semi-major axis (orbit units)
export const E = 0.55          // eccentricity
export const PERIOD = 2 * Math.PI
export const SCALE = 1.6       // world units per orbit unit
export const PX = 240          // px per world unit, seen from above
export const ORIGIN: V2 = [760, 540]
export const GRID = 0.25       // world units between grid lines (60 px)

/** Orbit coords → world, with the ellipse centre at the world origin. */
export const toWorld = ([x, y]: V2, out = new THREE.Vector3()) => out.set((x + A * E) * SCALE, 0, -y * SCALE)
/** Orbit coords → px in the flat shots (the same mapping as the top view). */
export const toPx = ([x, y]: V2): V2 => [ORIGIN[0] + (x + A * E) * SCALE * PX, ORIGIN[1] - y * SCALE * PX]

const col = (hex: string) => new THREE.Color(hex)

export interface ViewOpts { el: number; az: number; fov: number }

export interface World {
  scene: THREE.Scene
  cam: THREE.PerspectiveCamera
  grid: THREE.LineSegments
  orbit: Line2
  sun: THREE.Group
  planet: THREE.Mesh
  sectors: THREE.Mesh[]
  /** Fan of the current sector, growing: `sweep(k, frac)`. */
  sweep(k: number, frac: number, opacity: number): void
  arrow(color: string, radius: number): Arrow
  view(o: ViewOpts): void
  project(p: THREE.Vector3): V2
  render(): void
  mats: { grid: THREE.LineBasicMaterial; orbit: LineMaterial }
}

export interface Arrow { group: THREE.Group; set(from: THREE.Vector3, to: THREE.Vector3, opacity?: number): void }

/** Points of the exact orbit between times t0 and t1. */
const arc = (t0: number, t1: number, n: number) => Array.from({ length: n + 1 }, (_, i) => kepler(A, E, t0 + ((t1 - t0) * i) / n))

export function world(ctx: MountContext, layerId: string, sectorsN: number) {
  const layer = ctx.webgl().layer(layerId)
  const scene = new THREE.Scene()
  scene.background = col(M.bg)
  const cam = new THREE.PerspectiveCamera(40, ctx.stage.w / ctx.stage.h, 0.05, 200)

  const gp: number[] = []
  const R = 14
  for (let k = -R / GRID; k <= R / GRID; k++) {
    const v = k * GRID
    gp.push(-R, 0, v, R, 0, v, v, 0, -R, v, 0, R)
  }
  const gg = new THREE.BufferGeometry()
  gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3))
  const gridMat = new THREE.LineBasicMaterial({ color: col(M.blue), transparent: true, opacity: 0.16, depthWrite: false })
  // Explicit draw order: three sorts transparent objects by bounding-sphere centre, and the
  // per-frame quads' spheres would depend on the first frame rendered.
  const grid = new THREE.LineSegments(gg, gridMat)
  grid.renderOrder = 0
  scene.add(grid)
  const mp: number[] = []
  for (let k = -R; k <= R; k++) mp.push(-R, 0.001, k, R, 0.001, k, k, 0.001, -R, k, 0.001, R)
  const mg = new THREE.BufferGeometry()
  mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3))
  const majorMat = new THREE.LineBasicMaterial({ color: col(M.blue), transparent: true, opacity: 0.32, depthWrite: false })
  grid.add(new THREE.LineSegments(mg, majorMat))

  const ring = arc(0, PERIOD, 360)
  const lg = new LineGeometry()
  lg.setPositions(ring.flatMap((p) => toWorld(p).toArray()))
  const orbitMat = new LineMaterial({ color: col(M.teal).getHex(), linewidth: 4, transparent: true, opacity: 1, depthWrite: false })
  orbitMat.resolution.set(ctx.stage.w * ctx.stage.scale, ctx.stage.h * ctx.stage.scale)
  orbitMat.linewidth = 4 * ctx.stage.scale
  const orbit = new Line2(lg, orbitMat)
  orbit.renderOrder = 5
  orbit.computeLineDistances()
  scene.add(orbit)

  const sun = new THREE.Group()
  sun.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 48, 24), new THREE.MeshBasicMaterial({ color: col('#FFF4C2') })))
  const glowTex = (() => {
    const n = 128
    const data = new Uint8Array(n * n * 4)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2)
      const a = Math.max(0, 1 - d) ** 2.2
      data.set([255, 222, 90, Math.round(a * 200)], (y * n + x) * 4)
    }
    const t = new THREE.DataTexture(data, n, n)
    t.needsUpdate = true
    return t
  })()
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }))
  glow.scale.set(0.75, 0.75, 1)
  sun.add(glow)
  toWorld([0, 0], sun.position)
  sun.traverse((o) => { o.renderOrder = 8 })
  scene.add(sun)

  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 32, 16), new THREE.MeshBasicMaterial({ color: col('#E6F7FB') }))
  planet.renderOrder = 9
  scene.add(planet)

  // Equal-time sectors: fans from the Sun over the exact arc of each interval.
  const FAN = 48
  const dt = PERIOD / sectorsN
  const fan = (t0: number) => {
    const ps = arc(t0, t0 + dt, FAN)
    const pos: number[] = []
    const s = toWorld([0, 0])
    for (let i = 0; i < FAN; i++) {
      const a = toWorld(ps[i]!)
      const b = toWorld(ps[i + 1]!)
      pos.push(s.x, 0.002, s.z, a.x, 0.002, a.z, b.x, 0.002, b.z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }
  const sectors = Array.from({ length: sectorsN }, (_, k) => {
    const m = new THREE.Mesh(fan(k * dt), new THREE.MeshBasicMaterial({ color: col(M.gold), transparent: true, opacity: k % 2 ? 0.22 : 0.42, side: THREE.DoubleSide, depthWrite: false }))
    m.visible = false
    m.renderOrder = 2
    scene.add(m)
    return m
  })

  const arrow = (color: string, radius: number): Arrow => {
    const mat = new THREE.MeshBasicMaterial({ color: col(color), transparent: true, depthWrite: false })
    const group = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 16), mat)
    const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3, 1, 24), mat)
    group.add(shaft, head)
    shaft.renderOrder = head.renderOrder = 7
    scene.add(group)
    const dir = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    return {
      group,
      set(from, to, opacity = 1) {
        dir.subVectors(to, from)
        const L = dir.length()
        group.visible = L > 1e-4 && opacity > 0
        if (!group.visible) return
        mat.opacity = opacity
        const hl = Math.min(radius * 8, L * 0.4)
        group.position.copy(from)
        group.quaternion.setFromUnitVectors(up, dir.normalize())
        shaft.scale.set(1, L - hl, 1)
        shaft.position.set(0, (L - hl) / 2, 0)
        head.scale.set(1, hl, 1)
        head.position.set(0, L - hl / 2, 0)
      },
    }
  }

  const target = new THREE.Vector3((ctx.stage.w / 2 - ORIGIN[0]) / PX, 0, (ctx.stage.h / 2 - ORIGIN[1]) / PX)
  const view = (o: ViewOpts) => {
    const el = (o.el * Math.PI) / 180
    const az = (o.az * Math.PI) / 180
    cam.fov = o.fov
    // Distance so that the orbit plane at the target spans the same px as the flat shots when seen from above.
    const D = ctx.stage.h / PX / 2 / Math.tan((o.fov * Math.PI) / 360)
    cam.position.set(target.x + D * Math.cos(el) * Math.sin(az), D * Math.sin(el), target.z + D * Math.cos(el) * Math.cos(az))
    cam.up.set(-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az))
    cam.near = D * 0.05
    cam.far = D * 10
    cam.lookAt(target)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
  }
  const tmp = new THREE.Vector3()
  const project = (p: THREE.Vector3): V2 => {
    tmp.copy(p).project(cam)
    return [(tmp.x * 0.5 + 0.5) * ctx.stage.w, (-tmp.y * 0.5 + 0.5) * ctx.stage.h]
  }

  const live = new THREE.Mesh(fan(0), new THREE.MeshBasicMaterial({ color: col(M.gold), transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }))
  live.renderOrder = 3
  scene.add(live)
  const liveFans = Array.from({ length: sectorsN }, (_, k) => fan(k * dt))
  const sweep = (k: number, frac: number, opacity: number) => {
    live.visible = frac > 0 && opacity > 0
    if (!live.visible) return
    live.geometry = liveFans[k % sectorsN]!
    live.geometry.setDrawRange(0, Math.round(frac * FAN) * 3)
    ;(live.material as THREE.MeshBasicMaterial).opacity = (k % 2 ? 0.22 : 0.42) * opacity
  }

  /** A flat quad with per-frame corners (the r, v parallelogram); `set(a, b, c, d)`. */
  const quad = (color: string, alpha: number, order: number) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)
    const mat = new THREE.MeshBasicMaterial({ color: col(color), transparent: true, opacity: alpha, side: THREE.DoubleSide, depthWrite: false })
    const m = new THREE.Mesh(g, mat)
    m.frustumCulled = false
    m.renderOrder = order
    scene.add(m)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    return {
      mesh: m,
      set(ps: readonly THREE.Vector3[], opacity: number) {
        m.visible = opacity > 0
        mat.opacity = alpha * opacity
        ps.forEach((p, i) => pos.setXYZ(i, p.x, p.y, p.z))
        if (ps.length === 3) pos.setXYZ(3, ps[2]!.x, ps[2]!.y, ps[2]!.z)
        pos.needsUpdate = true
      },
    }
  }

  return {
    quad,
    scene, cam, grid, orbit, sun, planet, sectors, sweep, arrow, view, project,
    render: () => layer.render(scene, cam),
    mats: { grid: gridMat, major: majorMat, orbit: orbitMat },
  }
}
