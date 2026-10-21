// The car in a grey studio (after the AE pixel/ASCII reference): monochrome silver paint, chrome,
// dark glass, an AO shadow, a soft gradient backdrop. Views: front, top, side, rear34, wheel and
// reveal (a light band scans the body while the dots resolve into the clean render). Blocks of dots,
// glyphs and inverted grey jump on kicks; pillars of pixel-sort rise on the cut.
import * as THREE from 'three'
import { blocks } from '../lib/blocks.js'
import type { Kit } from '../lib/kit.js'
import type { Block, Mode } from '../lib/look.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, brackets, hline, text } from '../lib/ui.js'
import { BEAT } from '../edit.js'
import { circle, silhouette, type Poly } from '../lib/trace.js'

export interface CarStage {
  scene: THREE.Scene
  cam: THREE.PerspectiveCamera
  car: THREE.Object3D
  wheels: THREE.Object3D[]
  size: THREE.Vector3
  centre: THREE.Vector3
  backdrop: { studio: THREE.Texture; dark: THREE.Texture }
  sweep: THREE.SpotLight
}

function gradient(top: string, bottom: string, floor: string): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 512
  const g = c.getContext('2d')!
  const gr = g.createLinearGradient(0, 0, 0, 512)
  gr.addColorStop(0, top)
  gr.addColorStop(0.62, bottom)
  gr.addColorStop(0.64, floor)
  gr.addColorStop(1, bottom)
  g.fillStyle = gr
  g.fillRect(0, 0, 16, 512)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Body paint: 'silver' (the AE studio look) or 'red' (kept in colour by the look's red filter). */
export const PAINT: 'silver' | 'red' = (globalThis as { __paint?: 'silver' | 'red' }).__paint ?? 'red'

/**
 * A car studio as an environment map: a long overhead softbox, two tall side strips and a low rim
 * strip on black, over a grey floor. Glossy paint then shows the clean highlight lines of a studio
 * shoot instead of a room's soft blur.
 */
function studioEnv(k: Kit): THREE.Texture {
  const env = new THREE.Scene()
  env.background = new THREE.Color('#000000')
  const box = (w: number, h: number, x: number, y: number, z: number, rx: number, ry: number, i: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide }))
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, 0)
    env.add(m)
  }
  box(14, 3.2, 0, 7, 0, Math.PI / 2, 0, 6)          // overhead softbox
  box(1.2, 5, -9, 2.5, 0, 0, Math.PI / 2, 4)          // side strips
  box(1.2, 5, 9, 2.5, 0, 0, -Math.PI / 2, 4)
  box(16, 0.6, 0, 1.2, -9, 0, 0, 2.5)                 // low rim strip behind
  box(16, 0.6, 0, 1.2, 9, 0, Math.PI, 1.5)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: '#2a2a2a', side: THREE.DoubleSide }))
  floor.rotation.x = -Math.PI / 2
  env.add(floor)
  const pm = new THREE.PMREMGenerator(k.gl)
  const t = pm.fromScene(env, 0.02).texture
  pm.dispose()
  return t
}

const stages = new WeakMap<Kit, CarStage>()

/** One car stage per kit: several shots share it (materials and the AO plane are set up once). */
export function carStage(k: Kit): CarStage {
  const memo = stages.get(k)
  if (memo) return memo
  const st = makeCarStage(k)
  stages.set(k, st)
  return st
}

function makeCarStage(k: Kit): CarStage {
  const car = k.models.car.root
  const scene = new THREE.Scene()
  scene.environment = studioEnv(k)
  scene.environmentIntensity = 1
  const silver = PAINT === 'red'
    ? new THREE.MeshPhysicalMaterial({ color: '#8f0410', metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.03 })
    : new THREE.MeshPhysicalMaterial({ color: '#c4c8cc', metalness: 1, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.03 })
  const chrome = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.12 })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#050608', metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0 })
  car.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const n = m.name.toLowerCase()
    if (n.includes('body')) m.material = silver
    else if (n.includes('rim') || n.includes('trim')) m.material = chrome
    else if (n.includes('glass')) m.material = glass
    else {
      // everything else in grey: keep the material, drop its colour
      const mat = (m.material as THREE.MeshStandardMaterial).clone()
      if (mat.color) { const l = mat.color.r * 0.2126 + mat.color.g * 0.7152 + mat.color.b * 0.0722; mat.color.setRGB(l, l, l) }
      if ('map' in mat) mat.map = null
      m.material = mat
    }
  })
  const ao = new THREE.Mesh(
    new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
    new THREE.MeshBasicMaterial({ map: k.carAO, blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, premultipliedAlpha: true }),
  )
  ao.rotation.x = -Math.PI / 2
  ao.renderOrder = 2
  car.add(ao)
  const wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((n) => car.getObjectByName(n)!).filter(Boolean)
  scene.add(car)
  car.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(car)
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3())
  // reflections do the work; one soft key for the shadow side
  const key = new THREE.DirectionalLight('#ffffff', 0.6)
  key.position.set(3, 6, 4)
  const sweep = new THREE.SpotLight('#ffffff', 0, 30, 0.12, 0.6)
  scene.add(key, sweep, sweep.target)
  const cam = new THREE.PerspectiveCamera(28, k.W / k.H, 0.05, 100)
  return { scene, cam, car, wheels, size, centre, backdrop: { studio: gradient('#a9abad', '#cfd1d3', '#bcbec0'), dark: gradient('#050505', '#0b0b0c', '#101011') }, sweep }
}

/** Camera for a view; `lt` drifts it slowly. The car is about 2.3 × 1.2 × 4.5 m, long along z. */
export function carView(cs: CarStage, view: string, lt: number): void {
  const { cam, centre } = cs
  const c = centre.clone()
  const d = 0.03 * lt
  let pos: THREE.Vector3
  cam.fov = 28
  cam.up.set(0, 1, 0)
  switch (view) {
    case 'top': pos = new THREE.Vector3(0.001, 13.5 - lt * 0.4, 0); cam.up.set(0, 0, 1); break
    case 'side': pos = new THREE.Vector3(9.0 - lt * 0.3, 0.9, d * 4); break
    case 'rear34': pos = new THREE.Vector3(-5.2 + d * 6, 1.6, 6.4); break
    case 'haunch': pos = new THREE.Vector3(4.6, 1.05, 3.4 + d * 4); c.set(0.6, 0.55, 1.2); cam.fov = 30; break
    case 'wheel': pos = new THREE.Vector3(3.2, 0.45, 1.25 + d * 3); c.set(0.9, 0.35, 1.35); cam.fov = 32; break
    case 'reveal': pos = new THREE.Vector3(5.6 - lt * 0.25, 1.25, 7.4 - lt * 0.2); break
    default: pos = new THREE.Vector3(0.5 * Math.sin(lt * 0.3), 0.55, -6.2 + lt * 0.25); c.set(0, 0.5, 0); cam.fov = 30   // the nose is at −z; low and frontal
  }
  cam.position.copy(pos)
  cam.lookAt(c)
  cam.updateProjectionMatrix()
}

export function renderCar(c: ShotCtx, cs: CarStage, view: string, o: { dark?: boolean; spin?: number } = {}) {
  cs.scene.add(cs.car)
  cs.scene.background = o.dark ? cs.backdrop.dark : cs.backdrop.studio
  for (const w of cs.wheels) w.rotation.x = (o.spin ?? 0) * c.f.t
  carView(cs, view, c.m.lt)
  // the reveal's light band: a narrow spot sweeping along the car on each beat
  const sw = view === 'reveal'
  cs.sweep.intensity = sw ? 260 : 0
  const ph = (c.m.lt / (BEAT * 4)) % 1
  cs.sweep.position.set(0, 4.5, -4 + 8 * ph)
  cs.sweep.target.position.set(0, 0, -4 + 8 * ph)
  return c.k.render(cs.scene, cs.cam)
}

const v3 = new THREE.Vector3()
function toStage(p: THREE.Vector3, cam: THREE.Camera, W: number, H: number): [number, number] {
  v3.copy(p).project(cam)
  return [(v3.x * 0.5 + 0.5) * W, (0.5 - v3.y * 0.5) * H]
}

/** The car's half of a trace, in stage px, for the camera of `view` at shot time `lt`. */
export function carTrace(k: Kit, cs: CarStage, trace: string, view: string, lt: number): Poly[] | null {
  carView(cs, view, lt)
  cs.cam.updateMatrixWorld(true)
  cs.car.updateMatrixWorld(true)
  const meshes = k.models.car.meshes
  if (trace === 'spine' || trace === 'body') {
    const [top, bot] = silhouette(meshes, cs.cam, k.W, k.H, { bins: 56, stride: 5, bottom: true })
    if (trace === 'body') return [top!, bot!.slice().reverse()]
    // the haunch: the arch over the rear wheel (the car faces right, so the rear is on the left)
    const wheel = cs.wheels.map((w) => w.getWorldPosition(new THREE.Vector3())).sort((a, b) => toStage(a, cs.cam, k.W, k.H)[0] - toStage(b, cs.cam, k.W, k.H)[0])[0]!
    const c = toStage(wheel, cs.cam, k.W, k.H)
    const rim = toStage(wheel.clone().add(new THREE.Vector3(0, 0.46, 0)), cs.cam, k.W, k.H)
    const r = Math.abs(c[1] - rim[1]) * 1.18
    const arch: Poly = Array.from({ length: 25 }, (_, i) => { const a = Math.PI + (i / 24) * Math.PI; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] })
    return [top!, arch]
  }
  if (trace === 'eye') {
    // headlamps: the front corners of the body at lamp height (the car's front is −z)
    return [-1, 1].map((sx) => {
      const p = toStage(new THREE.Vector3(sx * 0.74, 0.66, -2.02), cs.cam, k.W, k.H)
      const q = toStage(new THREE.Vector3(sx * 0.74 + 0.16, 0.66, -2.02), cs.cam, k.W, k.H)
      return circle(p[0], p[1], Math.max(18, Math.abs(q[0] - p[0])))
    })
  }
  return null
}

/** Blocks for kick k, easing from kick k−1's layout over 0.22 s (rects in 0..1 of the frame). */
function easedBlocks(shot: number, k: number, since: number, reveal: boolean): Block[] {
  const o = { n: 5, modes: (reveal ? ['clean', 'ascii', 'clean', 'shift', 'ascii'] : ['shift', 'matrix', 'shift', 'ascii', 'dots']) as Mode[], w: [2, 5] as [number, number], h: [1, 3] as [number, number], area: { x: 0.14, y: 0.3, w: 0.72, h: 0.5 } }
  const b = blocks(`${shot}:${k}`, o)
  if (k < 0) return []
  const a = blocks(`${shot}:${k - 1}`, o)
  const t = Math.min(1, since / 0.22), e = t * t * (3 - 2 * t)
  return b.map((x, i) => ({ ...x, x: a[i]!.x + (x.x - a[i]!.x) * e, y: a[i]!.y + (x.y - a[i]!.y) * e, w: a[i]!.w + (x.w - a[i]!.w) * e, h: a[i]!.h + (x.h - a[i]!.h) * e }))
}

export default defineShot({
  mount: (k) => carStage(k),
  trace: (c, cs) => (c.plan.spec.trace ? carTrace(c.k, cs, c.plan.spec.trace, c.plan.spec.view ?? 'front', c.m.lt) : null),
  draw(c, cs) {
    const { k, plan, m, f } = c
    const view = plan.spec.view ?? 'front'
    const reveal = view === 'reveal'
    const tex = renderCar(c, cs, view, { dark: reveal, spin: view === 'wheel' ? 9 : 0 })
    // the reveal resolves from dots to clean as the hats come in
    const mode = reveal ? (m.u < 0.72 ? 'dots' : 'print') : plan.spec.mode ?? 'print'
    const traced = !!plan.spec.trace
    // AE grammar: blocks ease from one layout to the next on each kick (no pops), glyph cells grow
    // over the dark parts as a moving field, thin pillars sweep slowly; traced shots stay calm
    const bl = traced ? [] : easedBlocks(plan.shot.i, m.kick.k, m.kick.since, reveal)
    const pillars = m.glitch
      ? { ...m.glitch, dir: 0 as const, width: 1.5, reach: 0.55 * (m.glitch.amount / 0.75) + 0.1 }
      : traced ? undefined : { amount: 0.12 + 0.12 * m.low, seed: plan.shot.i * 7 + Math.floor(m.beats / 4), dir: (plan.shot.i % 2 ? 1 : 0) as 0 | 1, width: 0.5, reach: 0.18 + 0.1 * Math.sin(f.t * 1.3) }
    k.look.draw(f, {
      src: tex, mode, cell: 8, levels: reveal ? [0.02, 0.7, 1] : [0.0, 1, 1], blocks: bl, streak: pillars,
      ink: '#f4f4f2', paper: reveal ? '#000000' : '#0a0a0a', exposure: reveal ? 1.1 : 1.25, colour: PAINT === 'red' ? 1 : 0,
      field: traced ? undefined : { amount: 0.05 + 0.05 * m.low, scale: 9, time: f.t * 0.35, dark: 0.6, modes: ['ascii', 'matrix'] },
    })
  },
  ui(g, c, cs) {
    const { f, k, m, plan } = c
    // small top marks like the reference: five glyph slots that tick with the hats
    const marksY = 46
    for (let i = 0; i < 5; i++) {
      const on = (m.hat.k + i) % 5 === 0
      g.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,0.35)'
      g.fillRect(k.W / 2 - 120 + i * 60, marksY, 7, 7)
    }
    if (plan.spec.view === 'side' || plan.spec.view === 'front') {
      const y = k.H * 0.82
      hline(g, k.W * 0.18, k.W * 0.82, y, GREY)
      text(g, f, plan.spec.view === 'side' ? 'L 4527 mm · WB 2650 mm' : 'W 1937 mm · H 1213 mm', k.W / 2, y + 26, { size: 14, align: 'center', color: GREY })
    }
    if (plan.spec.view === 'reveal') brackets(g, { x: k.W * 0.22, y: k.H * 0.3, w: k.W * 0.56, h: k.H * 0.45 }, 'rgba(255,255,255,0.6)')
    void cs
  },
})
