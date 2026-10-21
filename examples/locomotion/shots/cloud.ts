// Horse and car as point clouds on their surfaces, scaled to the same length and axis, so one
// becomes the other point by point. `transit` (the bar where the drums stop): the gallop freezes at
// the moment Muybridge photographed (all four hooves off the ground), then flows into the car.
// `cloud` views: horse (galloping points), car (the car's points turning), gallop (car → horse).
import * as THREE from 'three'
import { BEAT, T } from '../edit.js'
import { cloud, meshesOf, positions, sample, type Cloud, type Samples } from '../lib/cloud.js'
import { poseAt, type Kit } from '../lib/kit.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, RED, text, hline } from '../lib/ui.js'
import { stride } from './horse.js'

const N = 60000

interface S {
  scene: THREE.Scene
  cam: THREE.PerspectiveCamera
  cl: Cloud
  horse: Samples
  carPts: Float32Array
  horseScale: number
  horseCentre: THREE.Vector3
  transit: number
  buf: Float32Array
  cache: Float32Array[]
}

/** The gallop phase where the lowest hoof is highest: the unsupported transit. */
function transitPhase(k: Kit): number {
  const r = k.models.horse
  let best = 0, bestY = -Infinity
  const v = new THREE.Vector3()
  for (let p = 0; p < 1; p += 0.02) {
    poseAt(r, p)
    let lo = Infinity
    for (const m of r.meshes) {
      const n = m.geometry.attributes.position!.count
      for (let i = 0; i < n; i += 1) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); if (v.y < lo) lo = v.y }
    }
    if (lo > bestY) { bestY = lo; best = p }
  }
  return best
}

export function cloudStage(k: Kit): S {
  const scene = new THREE.Scene()
  const cl = cloud(N, 'locomotion', k.scale)
  scene.add(cl.points)
  const transit = transitPhase(k)
  poseAt(k.models.horse, transit)
  const horse = sample(k.models.horse.meshes, N, 'horse')
  // the car: its own frame, centred on the origin at the ground (exclude the AO plane)
  const car = k.models.car.root
  car.position.set(0, 0, 0)
  car.updateMatrixWorld(true)
  const carSamples = sample(meshesOf(car, (m) => !(m.geometry instanceof THREE.PlaneGeometry)), N, 'car', (m) => (m.name.toLowerCase().includes('body') ? 2 : 1))
  const carPts = positions(carSamples, new Float32Array(N * 3))
  // turn the car to face +z like the horse (its nose is at −z)
  for (let i = 0; i < N; i++) { carPts[i * 3] = -carPts[i * 3]!; carPts[i * 3 + 2] = -carPts[i * 3 + 2]! }
  // the horse at the car's length: 322 units → 4.5 m, standing on the same ground
  const hb = new THREE.Box3().setFromObject(k.models.horse.root, true)
  const horseScale = 4.4 / (hb.max.z - hb.min.z)
  const horseCentre = new THREE.Vector3((hb.min.x + hb.max.x) / 2, hb.min.y, (hb.min.z + hb.max.z) / 2)
  const cam = new THREE.PerspectiveCamera(30, k.W / k.H, 0.05, 100)
  return { scene, cam, cl, horse, carPts, horseScale, horseCentre, transit, buf: new Float32Array(N * 3), cache: [] }
}

/** Horse points at gallop phase `phase`, in car space, into the cloud's `position`. */
function horseInto(k: Kit, s: S, phase: number, target: THREE.BufferAttribute): void {
  poseAt(k.models.horse, phase)
  positions(s.horse, s.buf, s.cache)
  const a = target.array as Float32Array
  for (let i = 0; i < N; i++) {
    a[i * 3] = (s.buf[i * 3]! - s.horseCentre.x) * s.horseScale
    a[i * 3 + 1] = (s.buf[i * 3 + 1]! - s.horseCentre.y) * s.horseScale + 0.15
    a[i * 3 + 2] = (s.buf[i * 3 + 2]! - s.horseCentre.z) * s.horseScale
  }
  target.needsUpdate = true
}
function carInto(s: S, target: THREE.BufferAttribute): void {
  ;(target.array as Float32Array).set(s.carPts)
  target.needsUpdate = true
}

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t) }

function aimSide(s: S, lt: number, orbit: number): void {
  // from −x: the long axis (z) runs across the screen, heads to the right
  s.cam.position.set(-Math.cos(orbit) * 11, 1.4 + 0.4 * Math.sin(orbit), Math.sin(orbit) * 11)
  s.cam.lookAt(0, 0.7, 0)
  void lt
}

export default defineShot({
  mount: (k) => cloudStage(k),
  draw(c, s) {
    const { k, f, m, plan } = c
    const u = s.cl.u
    const view = plan.spec.kind === 'transit' ? 'transit' : plan.spec.view ?? 'horse'
    u.time!.value = f.t
    // larger, dimmer points: each 0.1° cell averages several, so moving points shimmer less
    u.size!.value = 3.4
    u.opacity!.value = 0.5
    // horse legs fade into the dark (photosensitivity: see horse.ts); the car keeps its wheels
    // the transit keeps its legs: they are the point (all four hooves off the ground)
    u.legs!.value = view === 'car' || view === 'transit' ? 1 : 0.2
    u.jitter!.value = 0
    let mixT = 0, spread = 0
    if (view === 'transit') {
      // hold the frozen horse for a beat, then flow into the car by the end of the bar
      horseInto(k, s, s.transit, s.cl.a)
      carInto(s, s.cl.b)
      mixT = smooth((m.lt - BEAT * 0.8) / (T.machine - T.stop - BEAT * 1.2))
      spread = 1.6
      aimSide(s, m.lt, 0.35 * smooth(m.lt / (T.machine - T.stop)))
    } else if (view === 'horse') {
      horseInto(k, s, stride(f.t), s.cl.a)
      mixT = 0
      aimSide(s, m.lt, 0.08 * Math.sin(m.lt))
      u.jitter!.value = 0.02 * m.kick.pulse
    } else if (view === 'car') {
      carInto(s, s.cl.a)
      aimSide(s, m.lt, 0.6 + m.lt * 0.5)
      u.jitter!.value = 0.04 * m.kick.pulse
    } else {
      // gallop: the car's points run back into a galloping horse
      carInto(s, s.cl.a)
      horseInto(k, s, stride(f.t), s.cl.b)
      mixT = smooth(m.u * 1.4)
      spread = 1.2
      aimSide(s, m.lt, 0.3)
    }
    u.mixT!.value = mixT
    const toCar = view === 'transit' ? mixT : view === 'car' ? 1 : view === 'gallop' ? 1 - mixT : 0
    ;(u.color!.value as THREE.Color).setRGB(1, 1 - 0.84 * toCar, 1 - 0.8 * toCar)
    u.spread!.value = spread
    const tex = k.render(s.scene, s.cam)
    k.look.draw(f, { src: tex, mode: 'clean', levels: [0, 0.55, 0.9], streak: m.glitch })
  },
  ui(g, c) {
    const { f, k, m, plan } = c
    if (plan.spec.kind !== 'transit') return
    const y = k.H * 0.705
    hline(g, k.W * 0.2, k.W * 0.8, y, GREY)
    if (m.lt < BEAT * 1.4) {
      g.fillStyle = RED
      for (const x of [0.4, 0.46, 0.55, 0.6]) g.fillRect(k.W * x - 3, y - 3, 6, 6)
      text(g, f, 'ALL FOUR HOOVES OFF THE GROUND', k.W / 2, y + 40, { size: 16, align: 'center' })
      text(g, f, 'UNSUPPORTED TRANSIT · 1878', k.W / 2, y + 66, { size: 13, align: 'center', color: GREY })
    } else {
      text(g, f, `RESAMPLE ${N} PTS · EQUUS → 458`, k.W / 2, y + 40, { size: 14, align: 'center', color: GREY })
    }
  },
})
