// A dragonfly in flight: the procedural three.js model (shaded body, iridescent membranes, vein
// line work) enters, hovers, darts on the shot's snare or kick and settles; wings beat four times a
// beat with a smear of ghost wings. A lagging camera per view: side (tracking alongside), top (from
// above as it crosses), front (it flies at the camera and pulls up). Call-outs follow the moving
// anchors.
import * as THREE from 'three'
import { BEAT, type Plan } from '../edit.js'
import { dragonfly, fly, lagged, type Dragonfly, type Route } from '../lib/dragonfly.js'
import type { Kit } from '../lib/kit.js'
import { defineShot, type ShotCtx } from '../lib/shot.js'
import { GREY, INK, RED, text } from '../lib/ui.js'
import type { Poly } from '../lib/trace.js'
import { flowLines } from './windtunnel.js'

interface S { scene: THREE.Scene; cam: THREE.PerspectiveCamera; fly: Dragonfly }

export function flyStage(k: Kit): S {
  const scene = new THREE.Scene()
  const d = dragonfly('odonata', k.env)
  scene.add(d.group)
  const key = new THREE.DirectionalLight('#fff3e6', 3.2)
  key.position.set(2, 4, 3)
  const rim = new THREE.DirectionalLight('#a8ecff', 5)
  rim.position.set(-3, 1.2, -4)
  const under = new THREE.DirectionalLight('#5a6bff', 1.2)
  under.position.set(1, -3, 1)
  scene.add(key, rim, under, new THREE.HemisphereLight('#7f9cff', '#000000', 0.35))
  const cam = new THREE.PerspectiveCamera(30, k.W / k.H, 0.02, 60)
  return { scene, cam, fly: d }
}

/** Wingbeats per beat: two per eighth note, a stylised visible rate (life: ~30 Hz). */
const BEATS_PER = 4
const wingPhase = (t: number) => (t / BEAT) * BEATS_PER

/** The dart: the shot's first snare (else kick) after an entry and a hover, else the beat nearest the middle. */
function dartTime(plan: Plan): number {
  const { shot } = plan
  const span = shot.end - shot.at
  const lo = Math.max(0.4, 0.3 * span), hi = span - 0.25
  const ok = shot.hits.filter((h) => (h.tier ?? 0) === 0 && h.t - shot.at >= lo && h.t - shot.at <= hi)
  const h = ok.find((x) => x.kind === 'snare') ?? ok.find((x) => x.kind === 'kick')
  if (h) return h.t - shot.at
  const beats = [1, 2, 3, 4].map((n) => n * BEAT).filter((t) => t >= 0.3 && t <= hi)
  if (!beats.length) return span * 0.45
  return beats.reduce((a, b) => (Math.abs(b - 0.55 * span) < Math.abs(a - 0.55 * span) ? b : a))
}

function route(plan: Plan, view: string): Route {
  const tDart = dartTime(plan)
  const tIn = Math.max(0.1, tDart - Math.max(0.1, 0.3 * tDart))
  const t0 = -0.12
  const seed = plan.shot.i * 1.7
  switch (view) {
    case 'top':
      // up from the bottom of the frame, a turn to the right, a dart across
      return { p0: [-0.95, 0, 2.3], c0: [-1.05, 0, 0.75], p1: [-0.6, 0.05, 0.2], c1: [0.15, 0, -0.1], p2: [0.9, 0.1, -0.02], t0, tIn, tDart, dDart: 0.3, face: [1, 0, -0.1], drift: [0.15, 0, -0.03], seed }
    case 'front':
      // far and low, hovering; then straight at the camera, pulling up over it
      return { p0: [-3.4, -1.3, 0.6], c0: [-3.1, -0.3, 0.3], p1: [-2.5, 0, 0.15], c1: [0.3, -0.25, 0], p2: [1.0, 0.6, -0.1], t0, tIn, tDart, dDart: 0.36, zeta: 0.8, face: [1, 0, 0], drift: [0.25, 0.02, 0], seed }
    default:
      // from the left, low; a dart forward and up; a slow drift on
      return { p0: [-3.0, -0.45, 0.1], c0: [-1.7, -0.3, 0.05], p1: [-0.55, 0, 0], c1: [0.15, 0.02, 0], p2: [0.8, 0.22, -0.05], t0, tIn, tDart, dDart: 0.3, face: [1, 0, 0], drift: [0.14, 0.02, 0], seed }
  }
}

function aim(s: S, r: Route, view: string, lt: number, u: number): void {
  const { cam } = s
  const L = lagged(r, lt, 0.3)
  switch (view) {
    case 'top': {
      // slightly oblique from above; a slow turn of the frame
      const tx = L.x * 0.35, tz = L.z * 0.35
      const a = -0.08 + 0.16 * u
      cam.position.set(tx, 3.4, tz + 0.75)
      cam.up.set(Math.sin(a), 0, -Math.cos(a))
      cam.lookAt(tx, 0, tz)
      break
    }
    case 'front': {
      // follow the climb, not the dip of the entry from below
      const ty = Math.max(-0.1, L.y) * 0.75
      cam.position.set(3.4, 0.12 + ty * 0.4, 0.35 - 0.5 * u)
      cam.up.set(0, 1, 0)
      cam.lookAt(L.x * 0.15 - 0.4, ty, L.z * 0.3)
      break
    }
    default: {
      // tracking alongside, a slow orbit from slightly behind to slightly ahead
      const tx = L.x * 0.45, ty = L.y * 0.4
      const a = -0.22 + 0.36 * u
      cam.position.set(tx + Math.sin(a) * 3.1, ty + 0.32, Math.cos(a) * 3.1)
      cam.up.set(0, 1, 0)
      cam.lookAt(tx, ty, 0)
    }
  }
  cam.updateMatrixWorld(true)
}

/** Pose the model and the camera for the shot at shot time `lt`; `still` holds the wings flat (traces). */
function place(c: ShotCtx, s: S, still = false): string {
  const { plan, m } = c
  const view = plan.spec.view ?? 'side'
  const r = route(plan, view)
  const span = plan.shot.end - plan.shot.at
  // the wing phase from the song's clock, so the beat locks to the music across shots
  const ph = wingPhase(plan.shot.at + m.lt)
  fly(s.fly, r, m.lt, { phase: ph, smear: 1 })
  // traces: the wings held at the top of the stroke, the body level: a steady profile the air rises
  // over, clear of the beating wings
  if (still) {
    s.fly.pose({ phase: 0, hold: -1, curl: [0, 0] })
    s.fly.group.rotation.set(0, s.fly.group.rotation.y, 0)
  }
  s.scene.updateMatrixWorld(true)
  aim(s, r, view, m.lt, Math.min(1, m.lt / span))
  return view
}

/**
 * Soften a streamline's rise (a gaussian over its heights, `sig` points) and keep it above the
 * beating wings: over a small insect the film's moving dashes would otherwise bunch into a dense
 * flickering patch on the wings (WCAG 2.3.1).
 */
function ease(l: Poly, sig: number): Poly {
  const R = Math.ceil(sig * 2.5)
  const at = (i: number) => l[Math.min(l.length - 1, Math.max(0, i))]!
  // first lift each point to the highest within reach, so the softened line still clears the wings
  const top = l.map((_, i) => { let y = Infinity; for (let j = -R; j <= R; j++) y = Math.min(y, at(i + j)[1]); return y })
  return l.map(([x], i) => {
    let sy = 0, w = 0
    for (let j = -R; j <= R; j++) {
      const k = Math.exp(-(j * j) / (2 * sig * sig))
      sy += top[Math.min(l.length - 1, Math.max(0, i + j))]! * k
      w += k
    }
    return [x, sy / w] as [number, number]
  })
}

function project(o: THREE.Object3D, cam: THREE.Camera, W: number, H: number): { x: number; y: number; z: number } {
  const v = o.getWorldPosition(new THREE.Vector3()).project(cam)
  return { x: (v.x * 0.5 + 0.5) * W, y: (0.5 - v.y * 0.5) * H, z: v.z }
}

const LABELS = ['OMMATIDIA ×28 000', 'FOREWING 66 mm', 'PTEROSTIGMA', 'ABDOMEN S10']
/** Where each label leans (screen px direction) and which side its text sits. */
const LEAN: [number, number, 1 | -1][] = [[1, 0.25, 1], [-0.35, -1, -1], [0.55, -1, 1], [-1, 0.5, -1]]

export default defineShot({
  mount: (k) => flyStage(k),
  trace(c, s) {
    if (c.plan.spec.trace !== 'flow') return null
    place(c, s, true)
    return flowLines(c.k, s.fly.outline, s.cam, false).map((l) => ease(l, 9))
  },
  draw(c, s) {
    place(c, s)
    const tex = c.k.render(s.scene, s.cam)
    // the cut's glitch only: a kick glitch right after it would smear the bright body on, off and on
    // again within a third of a second (WCAG 2.3.1)
    const streak = c.m.lt < 0.16 ? c.m.glitch : undefined
    c.k.look.draw(c.f, { src: tex, mode: 'clean', levels: [0.0, 0.8, 0.95], colour: 0.85, streak, split: 4 * c.m.kick.pulse })
  },
  ui(g, c, s) {
    const { f, k, m, plan } = c
    place(c, s)
    const ctr = project(s.fly.group, s.cam, k.W, k.H)
    // the chapter card sits top left for the first bar of the chapter's first shot
    const card = plan.shot.n === 0 && m.lt < BEAT * 4
    s.fly.anchors.forEach((o, i) => {
      // the wing points ride the stroke's mean, not the beating wing: a leader that swung with
      // every beat would flicker (WCAG 2.3.1)
      const q = project(s.fly.rest[i]!, s.cam, k.W, k.H)
      const p = i === 1 || i === 2 ? q : project(o, s.cam, k.W, k.H)
      if (p.z > 1 || p.x < 20 || p.x > k.W - 20 || p.y < 20 || p.y > k.H - 20) return
      const [bx, by, side] = LEAN[i]!
      let dx = q.x - ctr.x + bx * 260, dy = q.y - ctr.y + by * 260
      const n = Math.hypot(dx, dy) || 1
      dx /= n; dy /= n
      let lx = q.x + dx * 210, ly = q.y + dy * 150
      lx = Math.min(k.W - 170, Math.max(170, lx))
      ly = Math.min(k.H - 200, Math.max(card && lx < 620 ? 360 : 130, ly))
      const hot = m.snare.k >= 0 && m.snare.k % 4 === i && m.snare.since < 0.4
      g.strokeStyle = hot ? RED : 'rgba(242,242,238,0.6)'
      g.lineWidth = 1
      const ex = lx + side * 70
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(lx, ly); g.lineTo(ex, ly); g.stroke()
      g.fillStyle = hot ? RED : INK
      g.fillRect(p.x - 3, p.y - 3, 6, 6)
      const tx = ex + side * 8
      const al = side > 0 ? 'left' : 'right'
      text(g, f, LABELS[i]!, tx, ly + 5, { size: 14, align: al, color: hot ? RED : INK })
      text(g, f, `${p.x.toFixed(1)}, ${p.y.toFixed(1)}`, tx, ly + 25, { size: 12, align: al, color: GREY })
    })
    text(g, f, `WINGBEAT ${(BEATS_PER / BEAT).toFixed(2)} Hz (VIDEO) · 30 Hz (LIFE)`, k.W / 2, k.H - 140, { size: 14, align: 'center', color: GREY })
  },
})
