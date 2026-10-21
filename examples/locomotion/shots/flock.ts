// A loose V of storks, flamingos and parrots crossing left to right, lit like the horse and drawn
// as small glyphs. One mesh per bird shares its species' geometry; each frame the species rig is
// posed at the bird's wingbeat phase and its morph weights copied into the bird (pure, cheap).
import * as THREE from 'three'
import { seeded } from '@cueframe/core'
import { BEAT } from '../edit.js'
import { poseAt, type Kit, type Rig } from '../lib/kit.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, INK, RED, text } from '../lib/ui.js'

type Species = 'stork' | 'flamingo' | 'parrot'

interface Bird {
  sp: Species
  group: THREE.Group
  mesh: THREE.Mesh
  /** Place in the V (world units), wingbeat offset, beats per wingbeat. */
  pos: THREE.Vector3
  off: number
  beat: number
}

interface S { scene: THREE.Scene; cam: THREE.PerspectiveCamera; birds: Bird[] }

// the V: the leader at the front (right), two arms trailing back-left, one into depth
const V: [Species, number][] = [
  ['stork', 0], ['flamingo', 1], ['stork', -1], ['parrot', 2], ['flamingo', -2], ['stork', 3],
  ['parrot', -3], ['flamingo', 4], ['stork', -4], ['parrot', 5], ['flamingo', -5], ['stork', 6], ['parrot', -6],
]
const SCALE: Record<Species, number> = { stork: 1, flamingo: 1.15, parrot: 1.25 }
const RATE: Record<Species, number> = { stork: 2, flamingo: 1.5, parrot: 1 }
const LABELS: Record<number, string> = { 0: 'CICONIA CICONIA · 45 KM/H', 4: 'PHOENICOPTERUS · 55 KM/H' }

function makeBird(r: Rig, mat: THREE.Material, sp: Species): { group: THREE.Group; mesh: THREE.Mesh } {
  const src = r.meshes[0]!
  const mesh = new THREE.Mesh(src.geometry, mat)
  mesh.position.copy(src.position)
  mesh.quaternion.copy(src.quaternion)
  mesh.scale.copy(src.scale).multiplyScalar(SCALE[sp])
  mesh.morphTargetInfluences = new Array(src.morphTargetInfluences?.length ?? 0).fill(0)
  const group = new THREE.Group()
  // the rigs fly along +z; turn them to fly along +x (left to right on screen)
  group.rotation.y = Math.PI / 2
  group.add(mesh)
  return { group, mesh }
}

function flockStage(k: Kit): S {
  const scene = new THREE.Scene()
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0 })
  const rnd = seeded('flock')
  const birds: Bird[] = V.map(([sp, slot]) => {
    const { group, mesh } = makeBird(k.models[sp], mat, sp)
    scene.add(group)
    const n = Math.abs(slot)
    const pos = new THREE.Vector3(
      -n * 165 + rnd.range(-30, 30),
      (slot >= 0 ? 1 : -1) * n * 42 + rnd.range(-14, 14),
      (slot >= 0 ? -1 : 1) * n * 14 + rnd.range(-40, 40),
    )
    return { sp, group, mesh, pos, off: rnd.range(0, 1), beat: RATE[sp] }
  })
  const key = new THREE.DirectionalLight('#ffffff', 3.2)
  key.position.set(1, 1.4, 1.2).multiplyScalar(1000)
  const rim = new THREE.DirectionalLight('#ffffff', 2.4)
  rim.position.set(-1.2, 0.6, -1).multiplyScalar(1000)
  scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.08))
  const cam = new THREE.PerspectiveCamera(30, k.W / k.H, 10, 10000)
  return { scene, cam, birds }
}

/** The flock's lead position: drifting right through the shot. */
function place(c: ShotCtx, s: S): void {
  const lt = c.m.lt
  const drift = 60 + lt * 330
  for (const b of s.birds) {
    const bob = 10 * Math.sin((lt / BEAT + b.off) * Math.PI * 2 / b.beat)
    b.group.position.set(b.pos.x + drift, b.pos.y + bob, b.pos.z)
    b.group.updateMatrixWorld(true)
  }
  s.cam.position.set(-160, -90, 1500)
  s.cam.lookAt(-160, 0, 0)
  s.cam.updateMatrixWorld(true)
}

export default defineShot<S>({
  mount: (k) => flockStage(k),
  draw(c, s) {
    const { k, f, m, plan } = c
    place(c, s)
    for (const b of s.birds) {
      const r = k.models[b.sp]
      // one wingbeat per `beat` beats, offset per bird
      poseAt(r, m.lt / (BEAT * b.beat) + b.off)
      const src = r.meshes[0]!.morphTargetInfluences!
      const dst = b.mesh.morphTargetInfluences!
      for (let i = 0; i < dst.length; i++) dst[i] = src[i] ?? 0
    }
    const tex = k.render(s.scene, s.cam)
    k.look.draw(f, { src: tex, mode: plan.spec.mode ?? 'ascii', cell: 8, levels: [0.02, 0.6, 0.75], streak: m.glitch, split: 3 * m.kick.pulse })
  },
  ui(g, c, s) {
    const { k, f } = c
    place(c, s)
    const v = new THREE.Vector3()
    s.birds.forEach((b, i) => {
      const label = LABELS[i]
      if (!label) return
      v.setFromMatrixPosition(b.group.matrixWorld).project(s.cam)
      const x = (v.x * 0.5 + 0.5) * k.W, y = (0.5 - v.y * 0.5) * k.H
      const up = i === 0
      // elbow leaders below the birds: right of the leader (open sky ahead), left of the other
      const ly = y + (up ? 100 : 120), ex = up ? x + 30 : x - 40, lx = up ? ex + 180 : ex - 230
      g.strokeStyle = i === 0 ? RED : INK
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(ex, ly)
      g.lineTo(lx, ly)
      g.stroke()
      g.fillStyle = i === 0 ? RED : INK
      g.fillRect(x - 3, y - 3, 6, 6)
      const [name, speed] = label.split(' · ')
      const tx = Math.min(ex, lx) + 4
      text(g, f, name!, tx, ly - 8, { size: 13 })
      text(g, f, speed!, tx, ly + 20, { size: 12, color: GREY })
    })
  },
})
