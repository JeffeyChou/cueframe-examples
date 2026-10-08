import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { scene } from '@cueframe/core'
import { fsPass, glsl, hdr, layer2d, post } from '@cueframe/gfx'
import { blameGeom, C, clamp01, ft, inOutCubic, lerp, mono, outCubic, sans, seg, W, H } from '../lib.js'

const START = ft(21.75)
const END = ft(24.3)
const RING = ft(23.05) - START
const WIPE = ft(24.0) - START
const LABEL = '_TRANSMISSION_CONTROL_ROOM'
const COLS = [-84, -42, 0, 42, 84]
const ROWS = 10
const DZ = 58
const HERO = new THREE.Vector3(0, 0, -3 * DZ)

const SKY = glsl`
void main() {
  float y = vUv.y;
  vec3 c = mix(vec3(0.020, 0.030, 0.036), vec3(0.002, 0.004, 0.006), smoothstep(0.35, 1.0, y));
  c += vec3(0.05, 0.075, 0.085) * exp(-pow((y - 0.42) * 7.0, 2.0));
  fragColor = vec4(c, 1.0);
}`

function beam(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const len = a.distanceTo(b)
  const geo = new THREE.BoxGeometry(r, r, len)
  const o = new THREE.Object3D()
  o.position.copy(a).add(b).multiplyScalar(0.5)
  o.lookAt(b)
  o.updateMatrix()
  geo.applyMatrix4(o.matrix)
  return geo
}

/** A lattice transmission tower; returns geometry and the conductor attachment points. */
function tower(): { geo: THREE.BufferGeometry; hooks: THREE.Vector3[] } {
  const parts: THREE.BufferGeometry[] = []
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const lv = [0, 7, 13, 18, 22, 26.5, 31]
  const hw = [4.6, 3.4, 2.5, 1.9, 1.6, 1.3, 0.9]
  const corners = (i: number) => [V(hw[i], lv[i], hw[i]), V(-hw[i], lv[i], hw[i]), V(-hw[i], lv[i], -hw[i]), V(hw[i], lv[i], -hw[i])]
  for (let i = 0; i < lv.length; i++) {
    const c = corners(i)
    for (let k = 0; k < 4; k++) parts.push(beam(c[k], c[(k + 1) % 4], 0.22))
    if (i === lv.length - 1) break
    const n = corners(i + 1)
    for (let k = 0; k < 4; k++) {
      parts.push(beam(c[k], n[k], 0.42))
      parts.push(beam(c[k], n[(k + 1) % 4], 0.16))
      parts.push(beam(c[(k + 1) % 4], n[k], 0.16))
    }
  }
  const peak = V(0, 35, 0)
  for (const c of corners(lv.length - 1)) parts.push(beam(c, peak, 0.25))
  const hooks: THREE.Vector3[] = [peak.clone()]
  for (const [y, span] of [[18, 11], [26.5, 8]] as const) {
    const i = lv.indexOf(y)
    const w = hw[i]
    for (const s of [1, -1]) {
      const tip = V(s * span, y, 0)
      const up = V(s * span * 0.85, y + 2.2, 0)
      parts.push(beam(V(s * w, y, w), tip, 0.2), beam(V(s * w, y, -w), tip, 0.2))
      parts.push(beam(V(s * w, y + 2.4, 0), up, 0.2), beam(up, tip, 0.18))
      for (let k = 1; k < 4; k++) {
        const x = s * lerp(w, span, k / 4)
        parts.push(beam(V(x, y, 0), V(x, y + 2.3 * (1 - k / 4), 0), 0.12))
      }
      const ins = new THREE.CylinderGeometry(0.28, 0.28, 3.2, 8)
      ins.translate(s * span, y - 1.6, 0)
      parts.push(ins)
      hooks.push(V(s * span, y - 3.2, 0))
    }
  }
  return { geo: mergeGeometries(parts.map((p) => p.toNonIndexed()))!, hooks }
}

function ribbon(r0: number, r1: number, segs: number, dash = 0): THREE.BufferGeometry {
  const pos: number[] = []
  for (let i = 0; i < segs; i++) {
    if (dash && i % dash >= dash * 0.6) { for (let k = 0; k < 18; k++) pos.push(0); continue }
    const a = (i / segs) * Math.PI * 2
    const b = ((i + 1) / segs) * Math.PI * 2
    const p = (r: number, t: number) => [Math.cos(t) * r, 0, Math.sin(t) * r]
    pos.push(...p(r0, a), ...p(r1, a), ...p(r1, b), ...p(r0, a), ...p(r1, b), ...p(r0, b))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

interface Key { t: number; pos: [number, number, number]; at: [number, number, number]; up: number }
const KEYS: Key[] = [
  { t: 0.0, pos: [6, 260, -160], at: [0, 0, -176], up: 0 },
  { t: 0.75, pos: [4, 205, -150], at: [0, 0, -174], up: 0 },
  { t: 1.5, pos: [21, 34, 20], at: [2, 20, -174], up: 1 },
  { t: 2.55, pos: [18, 25.5, -160], at: [1, 23.5, -175], up: 1 },
]
function camAt(lt: number, cam: THREE.PerspectiveCamera): void {
  let i = 0
  while (i < KEYS.length - 2 && lt > KEYS[i + 1].t) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const raw = seg(lt, a.t, b.t)
  const k = i === 0 ? raw : i === 1 ? inOutCubic(raw) : outCubic(raw) * 0.85 + inOutCubic(raw) * 0.15
  const L = (u: [number, number, number], v: [number, number, number]) => new THREE.Vector3(lerp(u[0], v[0], k), lerp(u[1], v[1], k), lerp(u[2], v[2], k))
  cam.position.copy(L(a.pos, b.pos))
  const upK = lerp(a.up, b.up, k)
  cam.up.set(0.04 * Math.sin(lt * 1.3), upK, -(1 - upK)).normalize()
  cam.lookAt(L(a.at, b.at))
  cam.fov = lerp(38, 46, clamp01(lt / 1.5))
  cam.updateProjectionMatrix()
}

export default scene({
  id: 'pylons',
  at: START,
  end: END,
  async mount(ctx) {
    const comp = hdr(ctx)
    const sky = fsPass(ctx, SKY)
    const ui = layer2d(ctx, 'pylon-hud')
    const fx = post(ctx, {
      exposure: 1.15,
      bloom: { threshold: 0.95, knee: 0.4, strength: 0.75, radius: 0.7 },
      tone: 'shoulder',
      ca: 2.2,
      vignette: { amount: 0.55, inner: 0.25, outer: 1.0 },
      grade: { contrast: 1.28, saturation: 0.5, lift: [0.0, 0.004, 0.008], shadows: [0.86, 1.0, 1.12], highlights: [0.97, 1.02, 1.06], balance: -0.05 },
      grain: { amount: 0.055, size: 2 },
    })
    const gl = await sans()
    const bg = blameGeom(gl)
    const s3 = new THREE.Scene()
    s3.fog = new THREE.Fog('#071014', 70, 520)
    const cam = new THREE.PerspectiveCamera(40, ctx.stage.aspect, 0.5, 1200)
    const { geo, hooks } = tower()
    const metal = new THREE.MeshStandardMaterial({ color: '#a7b3b8', metalness: 0.45, roughness: 0.5 })
    const inst = new THREE.InstancedMesh(geo, metal, COLS.length * ROWS)
    const m = new THREE.Matrix4()
    let n = 0
    for (const x of COLS) for (let r = 0; r < ROWS; r++) { m.makeTranslation(x, 0, -r * DZ); inst.setMatrixAt(n++, m) }
    s3.add(inst)
    const wires: THREE.BufferGeometry[] = []
    for (const x of COLS) for (let r = 0; r < ROWS - 1; r++) for (const h of hooks) {
      const a = new THREE.Vector3(x + h.x, h.y, -r * DZ)
      const b = new THREE.Vector3(x + h.x, h.y, -(r + 1) * DZ)
      const pts = Array.from({ length: 9 }, (_, i) => {
        const u = i / 8
        return new THREE.Vector3().lerpVectors(a, b, u).add(new THREE.Vector3(0, -3.2 * 4 * u * (1 - u), 0))
      })
      wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.07, 3).toNonIndexed())
    }
    s3.add(new THREE.Mesh(mergeGeometries(wires)!, new THREE.MeshStandardMaterial({ color: '#7f8a8e', metalness: 0.3, roughness: 0.6 })))
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: '#0b1113', roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    s3.add(ground)
    const gp: number[] = []
    for (let k = -60; k <= 60; k++) {
      gp.push(k * 14, 0.05, 300, k * 14, 0.05, -900)
      gp.push(-840, 0.05, 300 - (k + 60) * 10, 840, 0.05, 300 - (k + 60) * 10)
    }
    const gg = new THREE.BufferGeometry()
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3))
    s3.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.02, 0.09, 0.1) })))
    s3.add(new THREE.HemisphereLight('#9fbac6', '#030506', 0.9))
    const key = new THREE.DirectionalLight('#e4f1f6', 3.2)
    key.position.set(-80, 120, -300)
    const fill = new THREE.DirectionalLight('#5c7f8c', 0.9)
    fill.position.set(60, 40, 120)
    s3.add(key, fill)
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 2.9), side: THREE.DoubleSide, fog: false })
    const ring = new THREE.Mesh(ribbon(12.5, 13.1, 256), ringMat)
    const ring2 = new THREE.Mesh(ribbon(14.4, 14.65, 240, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.1, 1.3), side: THREE.DoubleSide, fog: false }))
    ring.position.set(HERO.x, 14, HERO.z)
    ring2.position.set(HERO.x, 14, HERO.z)
    s3.add(ring, ring2)
    const ringN = ring.geometry.getAttribute('position').count
    const ring2N = ring2.geometry.getAttribute('position').count
    const cursor = bg.screen(ft(22.0), bg.qRight + 24, bg.base)
    return { comp, sky, ui, fx, s3, cam, ring, ring2, ringN, ring2N, cursor, v: new THREE.Vector3() }
  },
  render(f, s) {
    const lt = f.lt
    s.comp.begin(f)
    s.sky.draw(f)
    camAt(lt, s.cam)
    const rk = outCubic(seg(lt, RING, RING + 0.55))
    s.ring.geometry.setDrawRange(0, Math.floor((rk * s.ringN) / 6) * 6)
    s.ring2.geometry.setDrawRange(0, Math.floor((outCubic(seg(lt, RING + 0.1, RING + 0.7)) * s.ring2N) / 6) * 6)
    s.ring.rotation.y = -0.6 + lt * 0.5
    s.ring2.rotation.y = 0.4 - lt * 0.8
    s.comp.three(s.s3, s.cam)

    // Screen position of the hero pylon's upper truss, for the drifting label.
    const proj = (x: number, y: number, z: number): [number, number] => {
      s.v.set(x, y, z).project(s.cam)
      return [(s.v.x * 0.5 + 0.5) * W, (-s.v.y * 0.5 + 0.5) * H]
    }
    const [hx, hy] = proj(HERO.x + 1.6, 26.5, HERO.z)
    s.ui.draw(f, (g) => {
      // Label continues from the ME? cursor and drifts toward the hero pylon.
      const drift = inOutCubic(seg(lt, 0.9, 2.2))
      const lx = lerp(s.cursor[0], Math.min(W - 760, hx + 60), drift)
      const ly = lerp(s.cursor[1], Math.max(140, Math.min(H - 140, hy)), drift)
      const size = 30
      const cw = mono(g, size, 500)
      const shown = Math.min(LABEL.length, Math.max(0, Math.floor((lt - 0.3) * 42 + 1e-6)))
      const wipe = seg(lt, WIPE, WIPE + 0.16)
      if (shown > 0 && wipe < 1) {
        const bw = LABEL.length * cw + 28
        const bx = Math.min(lx, W - bw - 72)
        const by = ly - size - 6
        g.save()
        g.beginPath(); g.rect(bx + bw * wipe, by - 20, bw * (1 - wipe) + 40, 100); g.clip()
        const gr = g.createLinearGradient(bx, 0, bx + bw, 0)
        gr.addColorStop(0, 'rgba(74,82,86,0.92)')
        gr.addColorStop(1, 'rgba(22,26,28,0.55)')
        g.fillStyle = gr
        g.fillRect(bx, by, Math.min(bw, shown * cw + 28), size + 18)
        g.fillStyle = C.white
        g.fillText(LABEL.slice(0, shown), bx + 14, ly - 2)
        if (wipe > 0) { g.fillStyle = C.white; g.fillRect(bx + bw * wipe - 6, by, 6, size + 18) }
        g.restore()
      }
      // Ring readout.
      const ra = seg(lt, RING + 0.25, RING + 0.4)
      if (ra > 0) {
        const [px, py] = proj(HERO.x - 13.1, 14, HERO.z)
        g.globalAlpha = ra
        g.strokeStyle = C.cyan; g.lineWidth = 1.5
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - 40, py + 40); g.lineTo(px - 230, py + 40); g.stroke()
        mono(g, 16, 500)
        g.fillStyle = C.cyan
        g.fillText('NODE 07 / 400 kV', px - 226, py + 30)
        g.fillStyle = C.grey
        g.fillText('LOAD 98.7%  +OVR', px - 226, py + 62)
        g.globalAlpha = 1
      }
    }, { gain: 1.05 })
    s.fx.apply(f, s.comp)
  },
})
