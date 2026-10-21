// Point clouds on mesh surfaces: samples are fixed (triangle + barycentric, seeded, area-weighted),
// so an animated mesh (the horse's morph-target gallop) moves its points with it, and two clouds of
// the same size morph point by point (horse → car).
import * as THREE from 'three'
import { seeded } from '@cueframe/core'

export interface Samples {
  n: number
  mesh: Uint16Array
  tri: Uint32Array          // 3 vertex indices per sample
  bary: Float32Array        // 2 per sample (u, v); w = 1 − u − v
  meshes: THREE.Mesh[]
}

const v = new THREE.Vector3()

/** Evaluated world-space vertex positions of a mesh (morph targets and skinning applied). */
export function evalMesh(m: THREE.Mesh, out?: Float32Array): Float32Array {
  const pos = m.geometry.attributes.position!
  const arr = out ?? new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    m.getVertexPosition(i, v)
    v.applyMatrix4(m.matrixWorld)
    arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z
  }
  return arr
}

export function meshesOf(root: THREE.Object3D, keep: (m: THREE.Mesh) => boolean = () => true): THREE.Mesh[] {
  const ms: THREE.Mesh[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && keep(o as THREE.Mesh)) ms.push(o as THREE.Mesh) })
  return ms
}

/** n samples over the surfaces of `meshes`, area-weighted (with `weight` per mesh), seeded. */
export function sample(meshes: THREE.Mesh[], n: number, seed: string, weight: (m: THREE.Mesh) => number = () => 1): Samples {
  const rng = seeded(seed)
  const tris: { m: number; a: number; b: number; c: number }[] = []
  const cum: number[] = []
  let total = 0
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3()
  meshes.forEach((m, mi) => {
    const P = evalMesh(m)
    const idx = m.geometry.index
    const count = idx ? idx.count : P.length / 3
    const wgt = weight(m)
    for (let i = 0; i + 2 < count; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2
      pa.fromArray(P, a * 3); pb.fromArray(P, b * 3); pc.fromArray(P, c * 3)
      const area = pb.sub(pa).cross(pc.sub(pa)).length() * 0.5 * wgt
      if (!(area > 0)) continue
      total += area
      tris.push({ m: mi, a, b, c })
      cum.push(total)
    }
  })
  const s: Samples = { n, mesh: new Uint16Array(n), tri: new Uint32Array(n * 3), bary: new Float32Array(n * 2), meshes }
  for (let k = 0; k < n; k++) {
    const r = rng() * total
    let lo = 0, hi = cum.length - 1
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid]! < r) lo = mid + 1; else hi = mid }
    const t = tris[lo]!
    let u = rng(), w = rng()
    if (u + w > 1) { u = 1 - u; w = 1 - w }
    s.mesh[k] = t.m
    s.tri.set([t.a, t.b, t.c], k * 3)
    s.bary.set([u, w], k * 2)
  }
  return s
}

/** Current world positions of the samples into `out` (n × 3). Re-evaluates each mesh once. */
export function positions(s: Samples, out: Float32Array, cache: Float32Array[] = []): Float32Array {
  s.meshes.forEach((m, i) => { cache[i] = evalMesh(m, cache[i]) })
  for (let k = 0; k < s.n; k++) {
    const P = cache[s.mesh[k]!]!
    const a = s.tri[k * 3]! * 3, b = s.tri[k * 3 + 1]! * 3, c = s.tri[k * 3 + 2]! * 3
    const u = s.bary[k * 2]!, w = s.bary[k * 2 + 1]!, x = 1 - u - w
    out[k * 3] = P[a]! * x + P[b]! * u + P[c]! * w
    out[k * 3 + 1] = P[a + 1]! * x + P[b + 1]! * u + P[c + 1]! * w
    out[k * 3 + 2] = P[a + 2]! * x + P[b + 2]! * u + P[c + 2]! * w
  }
  return out
}

const VERT = `
attribute vec3 b;
attribute float seed;
uniform float mixT, spread, size, scale, time, jitter, legs;
varying float vFade;
vec3 h3(float n) { return fract(sin(vec3(n, n + 1.7, n + 3.1)) * vec3(43758.5453, 22578.1459, 19642.3490)) - 0.5; }
void main() {
  float d = seed * 0.55;
  float k = smoothstep(d, d + 0.45, mixT);
  vec3 p = mix(position, b, k);
  float lift = sin(3.14159 * k);
  vec3 swirl = h3(seed * 97.0) * 2.0;
  p += (swirl + vec3(0.0, 0.6, 0.0)) * spread * lift;
  p += h3(seed * 31.0 + floor(time * 30.0) * 0.01) * jitter;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * scale / max(0.5, -mv.z);
  vFade = mix(legs, 1.0, pow(smoothstep(0.12, 0.85, p.y), 2.0));
}`
const FRAG = `
uniform vec3 color;
uniform float opacity;
varying float vFade;
void main() { gl_FragColor = vec4(color * opacity * vFade, opacity * vFade); }`

export interface Cloud {
  points: THREE.Points
  a: THREE.BufferAttribute
  b: THREE.BufferAttribute
  u: Record<string, THREE.IUniform>
}

/** n points: `position` is shape A, `b` shape B; `mixT` 0..1 morphs with a per-point delay. */
export function cloud(n: number, seed: string, scale: number): Cloud {
  const geo = new THREE.BufferGeometry()
  const a = new THREE.BufferAttribute(new Float32Array(n * 3), 3)
  const b = new THREE.BufferAttribute(new Float32Array(n * 3), 3)
  const r = seeded(seed)
  const sd = new Float32Array(n)
  for (let i = 0; i < n; i++) sd[i] = r()
  geo.setAttribute('position', a)
  geo.setAttribute('b', b)
  geo.setAttribute('seed', new THREE.BufferAttribute(sd, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)
  const u = {
    legs: { value: 1 }, mixT: { value: 0 }, spread: { value: 0 }, size: { value: 2 }, scale: { value: scale }, time: { value: 0 }, jitter: { value: 0 },
    color: { value: new THREE.Color('#ffffff') }, opacity: { value: 1 },
  }
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 10
  return { points, a, b, u }
}
