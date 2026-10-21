// A symmetric plate: the subject rendered once and drawn twice through the look, mirrored left and
// right so the two meet nose to nose at the centre seam; thin construction lines and the axis.
// `side`: the galloping horse (dark void). `car`: the car in profile in the dark studio.
import * as THREE from 'three'
import { blocks } from '../lib/blocks.js'
import { poseAt, type Kit } from '../lib/kit.js'
import type { Mode, Rect } from '../lib/look.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, INK, RED, hline, text, vline } from '../lib/ui.js'
import { aim, horseStage, stride, type HorseStage } from './horse.js'

interface CarLite { scene: THREE.Scene; cam: THREE.PerspectiveCamera; car: THREE.Object3D; wheels: THREE.Object3D[]; centre: THREE.Vector3 }
interface S { hs: HorseStage; cs: CarLite }

/** A car stage of our own (camera, lights, dark backdrop) around the shared car root. The car's
 * materials and AO plane belong to the car shot's stage, so they are not touched here. */
function carStageLite(k: Kit): CarLite {
  const car = k.models.car.root
  const scene = new THREE.Scene()
  scene.environment = k.env
  scene.environmentIntensity = 0.9
  scene.background = new THREE.Color('#000000')
  const key = new THREE.DirectionalLight('#ffffff', 2.6)
  key.position.set(4, 7, 2)
  const rim = new THREE.DirectionalLight('#ffffff', 1.8)
  rim.position.set(-4, 2, -5)
  scene.add(key, rim)
  const box = new THREE.Box3().setFromObject(car)
  const centre = box.getCenter(new THREE.Vector3())
  const wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((n) => car.getObjectByName(n)!).filter(Boolean)
  const cam = new THREE.PerspectiveCamera(28, k.W / k.H, 0.05, 100)
  return { scene, cam, car, wheels, centre }
}

function renderCarSide(c: ShotCtx, cs: CarLite): THREE.Texture {
  cs.scene.add(cs.car)
  for (const w of cs.wheels) w.rotation.x = 6 * c.f.t
  cs.cam.position.set(12.6 - 0.4 * c.m.lt, 0.8, 0)
  cs.cam.lookAt(0, 0.55, 0)
  cs.cam.updateProjectionMatrix()
  return c.k.render(cs.scene, cs.cam)
}

const isCar = (c: ShotCtx) => c.plan.spec.view === 'car'

/** Which way the subject faces in its render (both face right), and the half-width window that
 * puts its front just short of the seam. */
function framing(c: ShotCtx): { headRight: boolean; crop: Rect } {
  return { headRight: true, crop: { x: isCar(c) ? 0.25 : 0.235, y: 0, w: 0.5, h: 1 } }
}

function halves(k: Kit): [Rect, Rect] {
  return [{ x: 0, y: 0, w: k.W / 2, h: k.H }, { x: k.W / 2, y: 0, w: k.W / 2, h: k.H }]
}

export default defineShot<S>({
  mount: (k) => ({ hs: horseStage(k), cs: carStageLite(k) }),
  draw(c, s) {
    const { k, f, m, plan } = c
    let tex: THREE.Texture
    if (isCar(c)) {
      tex = renderCarSide(c, s.cs)
    } else {
      const r = k.models.horse
      s.hs.scene.add(r.root)
      poseAt(r, stride(f.t))
      aim(s.hs, 'side', 0, 0.42)
      tex = k.render(s.hs.scene, s.hs.cam)
    }
    const mode: Mode = plan.spec.mode ?? 'dither'
    const fr = framing(c)
    const H = halves(k)
    H.forEach((rect, j) => {
      const bl = m.kick.k >= 0 ? blocks(`m${plan.shot.i}:${m.kick.k}`, { n: 3, modes: mode === 'ascii' ? ['clean', 'dots', 'matrix'] : ['ascii', 'dots', 'matrix'], w: [1, 4], h: [1, 3], area: { x: 0.1, y: 0.3, w: 0.8, h: 0.45 } }) : []
      k.look.draw(f, {
        src: tex, rect, crop: fr.crop, flipX: j === 0 ? !fr.headRight : fr.headRight, mode,
        cell: mode === 'ascii' ? 10 : 8, levels: isCar(c) ? [0.03, 0.6, 0.85] : [0.03, 0.8, 0.9],
        // the same blocks on both sides, mirrored
        blocks: bl.map((b) => (j === 0 ? { ...b, x: 1 - b.x - b.w } : b)),
        streak: m.glitch, colour: isCar(c) ? 1 : 0, exposure: isCar(c) ? 1.2 : undefined,
      })
    })
  },
  ui(g, c) {
    const { k, f, m } = c
    const cx = k.W / 2, cy = k.H / 2
    const car = isCar(c)
    vline(g, cx, 0, k.H, INK, 1)
    // construction: ground, top line and the diagonals through the seam
    const ground = car ? k.H * 0.585 : k.H * 0.71, top = car ? k.H * 0.4 : k.H * 0.29
    hline(g, k.W * 0.06, k.W * 0.94, ground, GREY)
    hline(g, k.W * 0.22, k.W * 0.78, top, 'rgba(242,242,238,0.25)')
    g.strokeStyle = 'rgba(242,242,238,0.22)'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(k.W * 0.06, top); g.lineTo(cx, ground); g.lineTo(k.W * 0.94, top)
    g.moveTo(k.W * 0.06, ground); g.lineTo(cx, top); g.lineTo(k.W * 0.94, ground)
    g.stroke()
    for (const x of [k.W * 0.25, k.W * 0.75]) vline(g, x, ground - 6, ground + 6, GREY)
    g.fillStyle = m.kick.pulse > 0.3 ? RED : INK
    g.fillRect(cx - 4, cy - 4, 8, 8)
    g.save()
    g.translate(cx + 14, k.H * 0.18)
    g.rotate(Math.PI / 2)
    text(g, f, 'AXIS OF SYMMETRY · x = 0', 0, 0, { size: 12, color: GREY, base: 'middle' })
    g.restore()
    const name = car ? '458' : 'EQUUS'
    text(g, f, name, cx - 24, ground + 34, { size: 14, align: 'right' })
    text(g, f, `${name}′`, cx + 24, ground + 34, { size: 14 })
    text(g, f, 'x', cx - 24, ground + 58, { size: 12, align: 'right', color: GREY })
    text(g, f, '−x', cx + 24, ground + 58, { size: 12, color: GREY })
  },
})
