// The car in a smoke tunnel: dark studio, the car clean, streamlines over its contour (drawn by the
// trace layer as the 'flow' trace, so the air over the dragonfly's wing becomes the air over the
// roof across the cut). Views: side, top (the car lies across the frame, nose right).
import * as THREE from 'three'
import { streamlines } from '../lib/flow.js'
import { blocks } from '../lib/blocks.js'
import { silhouette, type Poly } from '../lib/trace.js'
import type { Kit } from '../lib/kit.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, text } from '../lib/ui.js'
import { carStage, type CarStage } from './car.js'

interface S { cs: CarStage; cam: THREE.PerspectiveCamera }

function aim(s: S, view: string, lt: number): void {
  const { cam } = s
  if (view === 'top') {
    cam.position.set(0, 12.5 - lt * 0.3, 0.001)
    cam.up.set(-1, 0, 0)
    cam.lookAt(0, 0, 0)
  } else {
    cam.position.set(12.5 - lt * 0.25, 0.75, 0)
    cam.up.set(0, 1, 0)
    cam.lookAt(0, 0.62, 0)
  }
  cam.updateMatrixWorld(true)
}

export function flowLines(k: Kit, meshes: (THREE.Mesh | THREE.LineSegments)[], cam: THREE.Camera, top: boolean): Poly[] {
  const [up, down] = silhouette(meshes, cam, k.W, k.H, { bins: 64, stride: 5, bottom: true })
  if (!top) {
    const ground = Math.max(...down!.map((p) => p[1]))
    return streamlines(up!, ground, { n: 7 })
  }
  // from above: the air parts around both sides of the body, about its centre line
  const mid = (Math.min(...up!.map((p) => p[1])) + Math.max(...down!.map((p) => p[1]))) / 2
  const above = streamlines(up!, mid, { n: 4, gap: 70 })
  const mirrored: Poly = down!.map(([x, y]) => [x, 2 * mid - y])
  const below = streamlines(mirrored, mid, { n: 4, gap: 70 }).map((l) => l.map(([x, y]) => [x, 2 * mid - y] as [number, number]))
  return [...above.slice(0, 2), below[0]!, ...above.slice(2), ...below.slice(1)]
}

export default defineShot({
  mount: (k) => ({ cs: carStage(k), cam: new THREE.PerspectiveCamera(26, k.W / k.H, 0.05, 100) }),
  draw(c: ShotCtx, s: S) {
    const { k, f, m, plan } = c
    const view = plan.spec.view ?? 'side'
    s.cs.scene.add(s.cs.car)
    s.cs.scene.background = s.cs.backdrop.dark
    s.cs.sweep.intensity = 0
    for (const w of s.cs.wheels) w.rotation.x = -f.t * 14
    aim(s, view, m.lt)
    const tex = k.render(s.cs.scene, s.cam)
    k.look.draw(f, {
      src: tex, mode: 'print', levels: [0.0, 0.85, 1.05], streak: m.glitch, colour: 1, exposure: 1.2,
      blocks: m.kick.k >= 0 ? blocks(`w${plan.shot.i}:${m.kick.k}`, { n: 3, modes: ['dots', 'matrix', 'ascii'], w: [1, 3], h: [1, 2], area: { x: 0.2, y: 0.3, w: 0.6, h: 0.45 } }) : [],
    })
  },
  trace(c, s) {
    aim(s, c.plan.spec.view ?? 'side', c.m.lt)
    s.cs.car.updateMatrixWorld(true)
    return flowLines(c.k, c.k.models.car.meshes, s.cam, c.plan.spec.view === 'top')
  },
  ui(g, c) {
    text(g, c.f, `U∞ ${(38 + 4 * c.m.low).toFixed(1)} m/s · Re ${(5.9e6).toExponential(1)} · SMOKE LINES 7`, c.k.W / 2, 150, { size: 14, align: 'center', color: GREY })
  },
})
