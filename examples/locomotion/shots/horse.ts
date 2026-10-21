// The three.js horse galloping one stride per beat (140 BPM ≈ a real gallop's 2.3 strides/s), lit
// hard from the side so the look turns its volume into dots or glyphs. Views: side, front, top, low.
import * as THREE from 'three'
import { BEAT } from '../edit.js'
import { poseAt, type Kit } from '../lib/kit.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import type { Mode } from '../lib/look.js'
import { GREY, INK, RED, hline, text, vline } from '../lib/ui.js'

export interface HorseStage {
  scene: THREE.Scene
  cam: THREE.PerspectiveCamera
  centre: THREE.Vector3
  size: THREE.Vector3
  mat: THREE.MeshStandardMaterial
}

export function horseStage(k: Kit): HorseStage {
  const r = k.models.horse
  const scene = new THREE.Scene()
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0 })
  for (const m of r.meshes) m.material = mat
  poseAt(r, 0)
  const box = new THREE.Box3().setFromObject(r.root, true)
  const centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3())
  // stage light from above: the legs fade into the dark below the belly. A bright leg crosses a
  // 0.1° cell several times a stride; kept under 10 % luminance it is not a flash (WCAG 2.3.1)
  // Horse.glb's POSITION bounds: y 0.8–183.1 (computeBoundingBox on this morph geometry disagrees)
  const gb = { min: { y: 0.8 } }, gh = 182.3
  // the look maps tone perceptually and mixes ink in linear light: under 10 % displayed luminance
  // means near black here, so the legs fall off fully, the gradient ending at the belly
  const lo = gb.min.y + 0.12 * gh, hi = gb.min.y + 0.55 * gh
  mat.onBeforeCompile = (sh) => {
    // height of the morphed vertex (the mesh has no node transform: local = world)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLy;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLy = (modelMatrix * vec4(transformed, 1.0)).y;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLy;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\ngl_FragColor.rgb *= pow(smoothstep(${lo.toFixed(3)}, ${hi.toFixed(3)}, vLy), 2.0);`)
  }
  const key = new THREE.DirectionalLight('#ffffff', 3.2)
  key.position.set(1, 1.4, 1.2).multiplyScalar(size.length())
  const rim = new THREE.DirectionalLight('#ffffff', 2.4)
  rim.position.set(-1.2, 0.6, -1).multiplyScalar(size.length())
  scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.08))
  const cam = new THREE.PerspectiveCamera(24, k.W / k.H, size.length() * 0.05, size.length() * 20)
  return { scene, cam, centre, size, mat }
}

/** One stride per beat, the hoof strike on the beat. */
export const stride = (t: number) => t / BEAT + 0.15

/** Frame the horse: `view` sets the direction, `fill` how much of the frame height it takes. */
export function aim(hs: HorseStage, view: string, lt: number, fill = 0.62): void {
  const { cam, centre, size } = hs
  const tan = Math.tan((cam.fov * Math.PI) / 360)
  // the horse's long axis is z (61 × 182 × 322 units); it faces +z: seen from −x it runs to the right, like every subject in the film
  const drift = Math.sin(lt * 0.6) * 0.04
  let dir: THREE.Vector3, extentH: number, extentW: number
  switch (view) {
    case 'front': dir = new THREE.Vector3(-0.85, 0.12, 1); extentH = size.y; extentW = size.z * 0.75; break
    case 'top': dir = new THREE.Vector3(0.02, 1, 0); extentH = size.x * 2.2; extentW = size.z; break
    case 'low': dir = new THREE.Vector3(-1, -0.14, 0.55 + drift); extentH = size.y; extentW = size.z * 0.8; break
    case 'travel': {
      // one long shot: from profile to a low three-quarter as the bars go by
      const u = Math.min(1, lt / 3.4), e = u * u * (3 - 2 * u)
      dir = new THREE.Vector3(-1, 0.04 - 0.2 * e, 0.85 * e); extentH = size.y * (1 + 0.25 * e); extentW = size.z * (1 - 0.3 * e); break
    }
    default: dir = new THREE.Vector3(-1, 0, drift); extentH = size.y; extentW = size.z
  }
  const dist = Math.max(extentH / fill, extentW / fill / cam.aspect) / (2 * tan)
  cam.position.copy(centre).add(dir.normalize().multiplyScalar(dist))
  cam.up.set(0, 1, 0)
  if (view === 'top') cam.up.set(0, 0, 1)
  cam.lookAt(centre)
}

export function drawHorse(c: ShotCtx, hs: HorseStage, view: string, phase: number) {
  const r = c.k.models.horse
  hs.scene.add(r.root)
  poseAt(r, phase)
  aim(hs, view, c.m.lt)
  return c.k.render(hs.scene, hs.cam)
}

export default defineShot({
  mount: (k) => horseStage(k),
  draw(c, hs) {
    const { k, plan, m, f } = c
    const view = plan.spec.view ?? 'side'
    const tex = drawHorse(c, hs, view, stride(f.t))
    // a long shot changes treatment on the snares only (≤ 1 change a bar: photosensitivity)
    const TRAVEL: Mode[] = ['clean', 'dither', 'clean', 'dots']
    const mode = view === 'travel' ? TRAVEL[Math.max(0, m.snare.k + 1) % TRAVEL.length]! : plan.spec.mode ?? 'dots'
    const small = plan.spec.frame === 'window'
    const rect = small ? { x: 560, y: 270, w: 800, h: 540 } : undefined
    k.look.draw(f, { src: tex, rect, mode, cell: mode === 'ascii' ? 12 : 9, levels: [0.03, 0.8, 0.9], streak: m.glitch, split: 5 * m.kick.pulse })
  },
  ui(g, c) {
    const { f, k, m } = c
    if (c.plan.spec.view !== 'side' && c.plan.spec.view !== 'low' && c.plan.spec.view !== 'travel') return
    // ground line with ticks that scroll with the gallop: a strip of film moving under the horse
    const y = k.H * 0.79
    hline(g, 0, k.W, y, GREY, 1)
    const speed = 900, off = (f.t * speed) % 120
    for (let x = -off; x < k.W; x += 120) vline(g, x, y, y + 10, GREY)
    // hoof strike: a red tick on the beat
    const beat = m.phase < 0.12
    g.fillStyle = beat ? RED : INK
    g.fillRect(k.W / 2 - 3, y - 3, 6, 6)
    text(g, f, `STRIDE ${(60 / 140).toFixed(3)} s · ${(140 / 60).toFixed(2)} Hz`, k.W / 2 + 14, y + 28, { size: 14, color: GREY })
  },
})
