// A procedural dragonfly in three.js: shaded body segments (dark metallic, iridescent teal), faceted
// compound eyes, four veined wings with translucent iridescent membranes, a jointed abdomen that
// curls, and ghost copies of each wing at earlier phases (a smear that reads as motion blur).
// Body along +x (head forward), wings in the xz plane, y up; the root pivots at the thorax.
// Built once in mount from a seed; `pose` sets every animated property.
// Also the flight: a route (enter, hover, dart, settle) and the body attitude from it, as pure
// functions of shot time.
import * as THREE from 'three'
import { seeded } from '@cueframe/core'

export interface Pose {
  /** Wing beat in cycles. */
  phase: number
  /** 0..1 opens the wings from folded back. */
  spread?: number
  /** Cycles the ghost wings trail behind (0: no smear; 1: the whole stroke). */
  smear?: number
  /** Abdomen curl, radians over the whole abdomen: pitch (+ up) and yaw (+ to the left). */
  curl?: [number, number]
  /** Wing opacity 0..1 (the membranes and veins). */
  wings?: number
  /** Hold every wing at this point of the stroke (-1 up .. 1 down) instead of beating. */
  hold?: number
}

export interface Dragonfly {
  /** Position and attitude go here (rotation order YZX: yaw, pitch, roll). */
  group: THREE.Group
  pose(p: Pose): void
  /** Call-out anchors: the eye, the right forewing tip, its pterostigma, the abdomen tip. */
  anchors: THREE.Object3D[]
  /** The same points fixed to the body (the wings at rest): stable for placing labels. */
  rest: THREE.Object3D[]
  /** Line work of the body and the main wings (no ghosts), for traces. */
  outline: THREE.LineSegments[]
  /** Vein ink. */
  lines: THREE.LineBasicMaterial
}

type V2 = [number, number]

/** Wing outline in its own frame: u along the span 0..1, v chordwise (+ leading edge). */
function outlineOf(len: number, chord: number, hind: boolean): V2[] {
  const pts: V2[] = []
  const N = 48
  for (let i = 0; i <= N; i++) {
    const u = i / N
    pts.push([u * len, chord * 0.18 * Math.sin(Math.PI * Math.min(1, u * 1.05)) * 0.2 + chord * 0.08 * (1 - (1 - u) ** 6)])
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N
    // trailing edge: broad base on the hindwing (the anal field), narrowing to the tip
    const base = hind ? 1 + 0.9 * Math.exp(-(((u - 0.12) / 0.12) ** 2)) : 1
    const w = chord * Math.sin(Math.PI * Math.pow(u, 0.75)) * 0.92 * base
    pts.push([u * len, -w + chord * 0.08])
  }
  return pts
}

const rootFade = (u: number) => { const t = Math.min(1, Math.max(0, (u - 0.04) / 0.3)); return t * t * (3 - 2 * t) }

function wing(len: number, chord: number, hind: boolean, rng: ReturnType<typeof seeded>) {
  const pos: number[] = []
  const seg = (a: V2, b: V2) => pos.push(a[0], 0, a[1], b[0], 0, b[1])
  const out = outlineOf(len, chord, hind)
  for (let i = 0; i + 1 < out.length; i++) seg(out[i]!, out[i + 1]!)
  const N = out.length / 2
  const lead = (u: number): number => out[Math.round(u * (N - 1))]![1]
  const trail = (u: number): number => out[out.length - 1 - Math.round(u * (N - 1))]![1]
  const fr = hind ? [0.06, 0.13, 0.22, 0.34, 0.5, 0.68] : [0.06, 0.14, 0.25, 0.4, 0.58]
  const vein = (k: number, u: number) => lead(u) + (trail(u) - lead(u)) * fr[k]! * (1 - 0.25 * u)
  const steps = 40
  for (let k = 0; k < fr.length; k++) {
    const u0 = 0.02 + k * 0.012
    for (let i = 0; i < steps; i++) {
      const a = u0 + (0.97 - u0) * (i / steps), b = u0 + (0.97 - u0) * ((i + 1) / steps)
      seg([a * len, vein(k, a)], [b * len, vein(k, b)])
    }
  }
  // cross-veins, sparser than life so the net stays open at film size
  for (let k = 0; k + 1 < fr.length; k++) {
    let u = 0.04 + rng() * 0.02
    while (u < 0.95) {
      const du = (0.022 + 0.03 * (k / fr.length)) * (0.7 + 0.6 * rng())
      seg([u * len, vein(k, u)], [u * len + (rng() - 0.5) * 0.006, vein(k + 1, u + (rng() - 0.5) * 0.01)])
      u += du
    }
  }
  // the cell net between the last vein and the trailing edge
  const last = fr.length - 1
  let u = 0.05
  let prev: V2 | null = null
  while (u < 0.94) {
    const t = trail(u), v = vein(last, u)
    const mid: V2 = [u * len, v + (t - v) * (0.45 + 0.2 * rng())]
    seg([u * len, v], mid)
    seg(mid, [(u + 0.006) * len, t])
    if (prev) seg(prev, mid)
    prev = mid
    u += 0.026 + 0.014 * rng()
  }
  // pterostigma: a dark filled cell on the leading edge near the tip
  const p0 = 0.83, p1 = 0.89
  const stig = [[p0, lead(p0)], [p1, lead(p1)], [p1, vein(1, p1)], [p0, vein(1, p0)]] as V2[]
  for (let i = 0; i < 4; i++) seg([stig[i]![0] * len, stig[i]![1]], [stig[(i + 1) % 4]![0] * len, stig[(i + 1) % 4]![1]])
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  // the veins fade in from the root, where all four wings and their ghosts cross the body
  const col: number[] = []
  for (let i = 0; i < pos.length; i += 3) { const k = rootFade(pos[i]! / len); col.push(k, k, k) }
  lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  const memGeo = new THREE.ShapeGeometry(new THREE.Shape(out.map(([x, y]) => new THREE.Vector2(x, y))))
  memGeo.rotateX(Math.PI / 2)
  const stigGeo = new THREE.ShapeGeometry(new THREE.Shape(stig.map(([a, v]) => new THREE.Vector2(a * len, v))))
  stigGeo.rotateX(Math.PI / 2)
  return {
    lineGeo, memGeo, stigGeo,
    tip: new THREE.Vector3(len * 0.99, 0, lead(0.99) - chord * 0.2),
    stigma: new THREE.Vector3(len * 0.86, 0, (lead(0.86) + vein(1, 0.86)) / 2),
  }
}

// Membrane: thin film over black. Faint in face-on view, brighter and shifting hue at grazing angles
// (fresnel), with thin-film bands along the span.
const MEM_VS = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec2 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vP = position.xz;
  gl_Position = projectionMatrix * mv;
}`
const MEM_FS = /* glsl */ `
uniform float opacity, span;
uniform vec3 teal, blue, warm;
varying vec3 vN; varying vec3 vV; varying vec2 vP;
void main() {
  float c = abs(dot(normalize(vN), normalize(vV)));
  float fr = pow(1.0 - c, 2.2);
  float s = clamp(vP.x / span, 0.0, 1.0);
  float band = 0.5 + 0.5 * cos(6.2832 * (1.6 * s + 1.3 * (1.0 - c)));
  vec3 film = mix(teal, blue, band);
  film = mix(film, warm, 0.35 * smoothstep(0.55, 1.0, fr));
  float a = opacity * (0.22 + 0.25 * s + 0.8 * fr) * smoothstep(0.04, 0.34, s);
  gl_FragColor = vec4(film * a, 1.0);
}`

function membrane(span: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: MEM_VS, fragmentShader: MEM_FS,
    uniforms: {
      opacity: { value: 0.2 }, span: { value: span },
      teal: { value: new THREE.Color('#3fd6c8') }, blue: { value: new THREE.Color('#5a78ff') }, warm: { value: new THREE.Color('#e8f0ff') },
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  })
}

// Flash safety (WCAG 2.3.1 per 4.8 px cell): the beating wing must change a cell's luminance by
// less than 0.1, so the smear is an even envelope over the stroke and the sharp wing is drawn in
// the blue accent, which reads by hue at a low luminance.
const WING_BLUE = '#5d6cff'
const MAIN_INK = 0.75, MAIN_MEM = 0.07
/** Ghost wing copies per wing (the smear); the main wing is ghost 0. */
const GHOSTS = 20
const SEGS = 10

export function dragonfly(seed = 'odonata', env?: THREE.Texture): Dragonfly {
  const rng = seeded(seed)
  const group = new THREE.Group()
  group.rotation.order = 'YZX'
  // the model was drawn with the thorax at x 0.36: shift it so the root pivots there
  const body = new THREE.Group()
  body.position.x = -0.36
  group.add(body)

  const lines = new THREE.LineBasicMaterial({ color: '#ffffff', vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false })
  const edgeInk = new THREE.LineBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.22, depthWrite: false })
  const shell = new THREE.MeshPhysicalMaterial({
    color: '#16484c', metalness: 0.75, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.45,
    iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [280, 620], envMap: env ?? null, envMapIntensity: 0.9,
  })
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: '#1d5f86', metalness: 0.35, roughness: 0.18, flatShading: true, clearcoat: 1, clearcoatRoughness: 0.05,
    iridescence: 0.7, iridescenceIOR: 1.5, envMap: env ?? null, envMapIntensity: 1.2,
  })
  const outline: THREE.LineSegments[] = []
  const edges = (mesh: THREE.Mesh, thresh = 12) => {
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, thresh), edgeInk)
    mesh.add(l)
    outline.push(l)
    return l
  }

  // head: two compound eyes (faceted spheres) meeting on top, a face below
  const eyes: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 2), eyeMat)
    eye.position.set(0.5, 0.018, s * 0.05)
    eye.scale.set(0.95, 1, 1)
    body.add(eye)
    edges(eye, 1)
    eyes.push(eye)
  }
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), shell)
  face.position.set(0.548, -0.03, 0)
  body.add(face)
  // thorax: a tilted capsule, with the wing roots on top
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), shell)
  thorax.scale.set(1.6, 1.12, 1)
  thorax.rotation.z = -0.25
  thorax.position.set(0.36, 0, 0)
  body.add(thorax)
  edges(thorax, 18)
  // abdomen: ten tapering segments, each a joint (nested groups), so a small turn per joint curls it
  const joints: THREE.Group[] = []
  let parent: THREE.Object3D = body
  let x0 = 0.25
  for (let i = 0; i < SEGS; i++) {
    const L = 0.07 - i * 0.0012
    const r0 = Math.max(0.009, 0.03 - i * 0.0017), r1 = Math.max(0.009, 0.03 - (i + 1) * 0.0017)
    const j = new THREE.Group()
    j.position.set(x0, 0, 0)
    parent.add(j)
    const g = new THREE.CylinderGeometry(r0, r1, L * 1.02, 24, 1, false)
    g.rotateZ(Math.PI / 2)
    // one smooth tube: alternating bands, joint gaps or rings sliding past at dart speed would
    // strobe cell by cell (WCAG 2.3.1)
    const m = new THREE.Mesh(g, shell)
    m.position.x = -L / 2
    j.add(m)
    edges(m, 30).visible = false
    joints.push(j)
    parent = j
    x0 = -L
  }
  // legs folded under the thorax
  const legPts: number[] = []
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const bx = 0.4 - i * 0.04
    legPts.push(bx, -0.05, s * 0.02, bx + 0.03, -0.11, s * 0.06, bx + 0.03, -0.11, s * 0.06, bx + 0.07, -0.13, s * 0.05)
  }
  const legGeo = new THREE.BufferGeometry()
  legGeo.setAttribute('position', new THREE.Float32BufferAttribute(legPts, 3))
  const legs = new THREE.LineSegments(legGeo, edgeInk)
  body.add(legs)

  // wings: pivots on the thorax, left and right, fore and hind; ghosts share the geometry
  const ghostInk = Array.from({ length: GHOSTS }, (_, g) => (g === 0 ? lines : lines.clone()))
  lines.color.set(WING_BLUE)
  const stigMat = new THREE.MeshBasicMaterial({ color: '#0a0d10', side: THREE.DoubleSide, transparent: true })
  const pivots: { piv: THREE.Group; hind: boolean; side: number; ghost: number; mem: THREE.ShaderMaterial }[] = []
  const anchorsWing: THREE.Object3D[] = []
  const restWing: THREE.Object3D[] = []
  for (const hind of [false, true]) {
    const len = hind ? 0.62 : 0.66
    const w = wing(len, hind ? 0.13 : 0.1, hind, rng)
    for (const side of [-1, 1]) {
      for (let ghost = 0; ghost < GHOSTS; ghost++) {
        const piv = new THREE.Group()
        piv.position.set(hind ? 0.31 : 0.39, 0.06, side * 0.03)
        const holder = new THREE.Group()
        // span along ±z, chord along x (leading edge forward); mirrored on the right
        holder.rotation.y = side * -Math.PI / 2
        if (side > 0) holder.scale.z = -1
        const mem = membrane(len)
        const lm = new THREE.LineSegments(w.lineGeo, ghostInk[ghost]!)
        holder.add(new THREE.Mesh(w.memGeo, mem))
        holder.add(lm)
        if (ghost === 0) {
          holder.add(new THREE.Mesh(w.stigGeo, stigMat))
          outline.push(lm)
          if (!hind && side > 0) {
            for (const p of [w.tip, w.stigma]) { const o = new THREE.Object3D(); o.position.copy(p); holder.add(o); anchorsWing.push(o) }
          }
        }
        piv.add(holder)
        body.add(piv)
        pivots.push({ piv, hind, side, ghost, mem })
        if (ghost === 0 && !hind && side > 0) {
          // the same points with the wing at rest, attached to the body
          const restHolder = holder.clone(false)
          const restPiv = new THREE.Group()
          restPiv.position.copy(piv.position)
          restPiv.rotation.set(-0.45, -0.04, 0)
          restPiv.add(restHolder)
          body.add(restPiv)
          for (const p of [w.tip, w.stigma]) { const o = new THREE.Object3D(); o.position.copy(p); restHolder.add(o); restWing.push(o) }
        }
      }
    }
  }
  const at = (parent: THREE.Object3D, x: number, y: number, z: number) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o }
  const eyeA = at(eyes[1]!, 0.03, 0.03, 0.04)
  const tailA = at(joints[SEGS - 1]!, -0.06, 0, 0)
  const eyeR = at(body, 0.53, 0.05, 0.09)
  const tailR = at(body, -0.43, -0.01, 0)

  return {
    group, lines, outline,
    anchors: [eyeA, anchorsWing[0]!, anchorsWing[1]!, tailA],
    rest: [eyeR, restWing[0]!, restWing[1]!, tailR],
    pose({ phase, spread = 1, smear = 0, curl = [0, 0], wings = 1, hold }) {
      for (const { piv, hind, side, ghost, mem } of pivots) {
        // hindwings lead the forewings by a quarter beat; ghosts trail behind the main wing
        const ph = (phase + (hind ? 0.25 : 0) - (smear * ghost) / GHOSTS) * Math.PI * 2
        const a = hold ?? Math.sin(ph)
        piv.rotation.order = 'XYZ'
        // flap about the body axis (large, stylised), sweep, and the feathering about the span
        piv.rotation.x = side * (-0.1 + 0.78 * a) * spread
        piv.rotation.y = side * (hind ? -0.1 : 0.05) * spread + side * (1 - spread) * (hind ? 0.9 : 0.75)
        piv.rotation.z = 0.32 * Math.cos(ph) * spread
        // an even envelope over the whole stroke: what a cell sees barely changes from frame to frame
        const o = 1
        const on = ghost === 0 || smear > 0
        piv.visible = on && wings > 0
        mem.uniforms.opacity!.value = (ghost === 0 ? MAIN_MEM : 0.025 * o) * wings
        if (ghost > 0) ghostInk[ghost]!.opacity = 0.013 * o * wings
      }
      lines.opacity = MAIN_INK * wings
      stigMat.opacity = wings
      // the abdomen: an even share of the curl per joint, plus a slight droop at the tip
      joints.forEach((j, i) => {
        const w = (i + 1) / SEGS
        j.rotation.order = 'YZX'
        j.rotation.z = (curl[0] / SEGS) * (0.6 + 0.8 * w) - 0.006 * i
        j.rotation.y = (curl[1] / SEGS) * (0.6 + 0.8 * w)
      })
    },
  }
}

// ---- flight -------------------------------------------------------------------------------------

export type V3 = [number, number, number]

/** A shot's route: enter along a curve (p0 → p1, braking), hover with bobs, dart (p1 → p2) on a hit and settle. */
export interface Route {
  p0: V3; c0: V3; p1: V3
  c1: V3; p2: V3
  /** Seconds: the entry starts (may be before the cut) and ends, the dart starts, the dart's settle time. */
  t0: number; tIn: number; tDart: number; dDart: number
  /** Damping of the dart's settle (a spring's ζ; lower overshoots more). */
  zeta?: number
  /** Slow drift while hovering, units per second. */
  drift?: V3
  bob?: number
  seed?: number
  /** The way the body faces when nearly still. */
  face: V3
}

const bez = (a: V3, b: V3, c: V3, u: number): THREE.Vector3 => {
  const v = 1 - u
  return new THREE.Vector3(v * v * a[0] + 2 * v * u * b[0] + u * u * c[0], v * v * a[1] + 2 * v * u * b[1] + u * u * c[1], v * v * a[2] + 2 * v * u * b[2] + u * u * c[2])
}
/** A damped spring's step response: 0 → 1 from rest, overshooting a little. */
function spring(t: number, wn: number, z: number): number {
  if (t <= 0) return 0
  const wd = wn * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * wn * t) * (Math.cos(wd * t) + ((z * wn) / wd) * Math.sin(wd * t))
}

function bob(r: Route, t: number): THREE.Vector3 {
  const a = r.bob ?? 1, s = r.seed ?? 0
  return new THREE.Vector3(
    0.022 * a * Math.sin(2 * Math.PI * 1.1 * t + s),
    // all under 3 Hz: a bob faster than that would flicker the bright edges (WCAG 2.3.1)
    0.035 * a * Math.sin(2 * Math.PI * 1.9 * t + 1.7 * s),
    0.018 * a * Math.sin(2 * Math.PI * 0.8 * t + 2.3 * s),
  )
}

/** Position on the route at shot time t (any t, also before 0 and after the end). */
export function routeAt(r: Route, t: number): THREE.Vector3 {
  const dr = r.drift ?? [0, 0, 0]
  if (t < r.tIn) {
    const u = (t - r.t0) / (r.tIn - r.t0)
    if (u < 0) {
      // before the entry: keep coming along its tangent
      const v0 = new THREE.Vector3(r.c0[0] - r.p0[0], r.c0[1] - r.p0[1], r.c0[2] - r.p0[2]).multiplyScalar((2 * 2) / (r.tIn - r.t0))
      return new THREE.Vector3(...r.p0).addScaledVector(v0, t - r.t0)
    }
    const k = u * u * (3 - 2 * u)
    return bez(r.p0, r.c0, r.p1, 1 - (1 - u) ** 2).add(bob(r, t).multiplyScalar(k))
  }
  const hover = new THREE.Vector3(...dr).multiplyScalar(Math.min(t, r.tDart) - r.tIn)
  const b = bob(r, t)
  if (t < r.tDart) return new THREE.Vector3(...r.p1).add(hover).add(b)
  const e = spring(t - r.tDart, 4.5 / r.dDart, r.zeta ?? 0.68)
  const p1: V3 = [r.p1[0] + hover.x, r.p1[1] + hover.y, r.p1[2] + hover.z]
  // the settled point keeps drifting after the dart
  const after = new THREE.Vector3(...dr).multiplyScalar(Math.max(0, t - r.tDart - r.dDart) * 0.6)
  const p = e <= 1 ? bez(p1, r.c1, r.p2, e) : bez(p1, r.c1, r.p2, 1).add(new THREE.Vector3(r.p2[0] - r.c1[0], r.p2[1] - r.c1[1], r.p2[2] - r.c1[2]).multiplyScalar(2 * (e - 1)))
  return p.add(b).add(after)
}

export interface Attitude { pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; pitch: number; roll: number; yawRate: number; pitchRate: number; speed: number }

function headingOf(r: Route, t: number): { yaw: number; pitch: number; roll: number; vel: THREE.Vector3 } {
  const h = 0.05
  const a = routeAt(r, t - h), b = routeAt(r, t + h), m = routeAt(r, t)
  const vel = b.clone().sub(a).divideScalar(2 * h)
  const acc = b.clone().add(a).addScaledVector(m, -2).divideScalar(h * h)
  // facing: the travel direction once it moves, the route's facing when nearly still
  const fx = vel.x + r.face[0] * 0.5, fz = vel.z + r.face[2] * 0.5
  const yaw = Math.atan2(-fz, fx)
  const hs = Math.hypot(vel.x, vel.z)
  const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
  const right = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
  const clamp = (v: number, l: number) => Math.max(-l, Math.min(l, v))
  // climb pitches the nose up; forward acceleration pitches it down (it leans into the dart)
  const pitch = clamp(0.5 * Math.atan2(vel.y, hs + 1.2) - 0.006 * acc.dot(fwd) + 0.03, 0.45)
  // bank into turns
  const roll = clamp(0.03 * acc.dot(right), 0.7)
  return { yaw, pitch, roll, vel }
}

/** Body attitude at t: position, travel, yaw toward travel, pitch and roll from climb and turns. */
export function attitude(r: Route, t: number): Attitude {
  const h = 0.06
  const now = headingOf(r, t), a = headingOf(r, t - h), b = headingOf(r, t + h)
  // average over a short window so a frame never snaps
  const unwrap = (x: number, ref: number) => x + Math.round((ref - x) / (2 * Math.PI)) * 2 * Math.PI
  const ya = unwrap(a.yaw, now.yaw), yb = unwrap(b.yaw, now.yaw)
  return {
    pos: routeAt(r, t), vel: now.vel, speed: now.vel.length(),
    yaw: (ya + 2 * now.yaw + yb) / 4,
    pitch: (a.pitch + 2 * now.pitch + b.pitch) / 4,
    roll: (a.roll + 2 * now.roll + b.roll) / 4,
    yawRate: (yb - ya) / (2 * h), pitchRate: (b.pitch - a.pitch) / (2 * h),
  }
}

/** A lagging follow point (an exponential average of the route's past), for cameras. */
export function lagged(r: Route, t: number, tau = 0.25): THREE.Vector3 {
  const out = new THREE.Vector3()
  let w = 0
  for (let i = 0; i < 16; i++) {
    const dt = i * 0.03, k = Math.exp(-dt / tau)
    out.addScaledVector(routeAt(r, t - dt), k)
    w += k
  }
  return out.divideScalar(w)
}

/** Place the model on the route: position, attitude and an abdomen that lags behind turns. */
export function fly(d: Dragonfly, r: Route, t: number, wing: Omit<Pose, 'curl'>): Attitude {
  const at = attitude(r, t)
  d.group.position.copy(at.pos)
  d.group.rotation.set(at.roll, at.yaw, at.pitch)
  const clamp = (v: number, l: number) => Math.max(-l, Math.min(l, v))
  d.pose({ ...wing, curl: [clamp(-0.04 * at.pitchRate + 0.03 * Math.min(1, at.speed / 3), 0.2), clamp(-0.04 * at.yawRate, 0.25)] })
  return at
}
